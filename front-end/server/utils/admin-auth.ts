import type { H3Event } from "h3";
import type {
	AdminContentResponse,
	AdminCorrectionsResponse,
	AdminOverviewResponse,
	AdminReviewResponse,
	AdminSessionResponse,
	AdminSourceMonitorResponse,
	AdminUserRole,
	AdminUsersResponse,
	GuidePackageDiagnosticsResponse,
	GuidePackageListResponse,
	GuidePackageRecordResponse,
} from "~/types/civic";
import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import process from "node:process";
import { useRuntimeConfig } from "#imports";
import { createError, deleteCookie, getCookie, setCookie } from "h3";
import { $fetch, FetchError } from "ofetch";

const adminCookieName = "ballot_clarity_admin_session";
const adminSessionMaxAge = 60 * 60 * 12;

interface AdminConfig {
	apiBase: string;
	apiKey: string;
	sessionSecret: string;
}

interface BackendLoginResponse {
	authenticated: boolean;
	configured: boolean;
	displayName: string | null;
	role: AdminUserRole | null;
	username: string | null;
}

interface AdminSessionPayload {
	displayName: string;
	expiresAt: number;
	role: AdminUserRole;
	username: string;
}

function constantTimeEqual(left: string, right: string) {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);

	if (leftBuffer.length !== rightBuffer.length)
		return false;

	return timingSafeEqual(leftBuffer, rightBuffer);
}

function getAdminConfig(event: H3Event): AdminConfig {
	const runtimeConfig = useRuntimeConfig(event);

	return {
		apiBase: process.env.NUXT_ADMIN_API_BASE || process.env.ADMIN_API_BASE || String(runtimeConfig.adminApiBase || ""),
		apiKey: process.env.NUXT_ADMIN_API_KEY || process.env.ADMIN_API_KEY || String(runtimeConfig.adminApiKey || ""),
		sessionSecret: process.env.NUXT_ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || String(runtimeConfig.adminSessionSecret || "")
	};
}

function isAdminConfigured(config: AdminConfig) {
	return Boolean(config.apiBase && config.apiKey && config.sessionSecret);
}

function normalizeHeaderValue(value: string | string[] | undefined) {
	return Array.isArray(value) ? value.join(", ") : value;
}

function getForwardHeaders(event: H3Event, extraHeaders: Record<string, string> = {}) {
	const forwardedFor = normalizeHeaderValue(event.node.req.headers["x-forwarded-for"]);
	const remoteAddress = event.node.req.socket.remoteAddress;
	const userAgent = normalizeHeaderValue(event.node.req.headers["user-agent"]);
	const requestId = normalizeHeaderValue(event.node.req.headers["x-request-id"]);

	return {
		...(forwardedFor ? { "x-forwarded-for": forwardedFor } : remoteAddress ? { "x-forwarded-for": remoteAddress } : {}),
		...(requestId ? { "x-request-id": requestId } : {}),
		...(userAgent ? { "user-agent": userAgent } : {}),
		...extraHeaders
	};
}

function signPayload(payload: string, sessionSecret: string) {
	return createHmac("sha256", sessionSecret).update(payload).digest("hex");
}

function serializeSession(payload: AdminSessionPayload, sessionSecret: string) {
	const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
	const signature = signPayload(encodedPayload, sessionSecret);

	return `${encodedPayload}.${signature}`;
}

function parseSession(rawValue: string | undefined, sessionSecret: string) {
	if (!rawValue)
		return null;

	const [encodedPayload, signature] = rawValue.split(".");

	if (!encodedPayload || !signature)
		return null;

	const expectedSignature = signPayload(encodedPayload, sessionSecret);

	if (!constantTimeEqual(signature, expectedSignature))
		return null;

	try {
		const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<AdminSessionPayload>;

		if (!payload.username || !payload.displayName || !payload.role || typeof payload.expiresAt !== "number")
			return null;

		if (payload.expiresAt <= Date.now())
			return null;

		return payload as AdminSessionPayload;
	}
	catch {
		return null;
	}
}

export function getAdminSession(event: H3Event): AdminSessionResponse {
	const config = getAdminConfig(event);

	if (!isAdminConfigured(config)) {
		return {
			authenticated: false,
			configured: false,
			displayName: null,
			role: null,
			username: null
		};
	}

	const cookieValue = getCookie(event, adminCookieName);
	const session = parseSession(cookieValue, config.sessionSecret);

	if (!session) {
		return {
			authenticated: false,
			configured: true,
			displayName: null,
			role: null,
			username: null
		};
	}

	return {
		authenticated: true,
		configured: true,
		displayName: session.displayName,
		role: session.role,
		username: session.username
	};
}

export function requireAdminSession(event: H3Event) {
	const session = getAdminSession(event);

	if (!session.configured) {
		throw createError({
			statusCode: 503,
			statusMessage: "Admin portal is not configured."
		});
	}

	if (!session.authenticated) {
		throw createError({
			statusCode: 401,
			statusMessage: "Admin authentication required."
		});
	}

	return session;
}

export function clearAdminSession(event: H3Event): AdminSessionResponse {
	const currentSession = getAdminSession(event);

	deleteCookie(event, adminCookieName, {
		path: "/"
	});

	return {
		authenticated: false,
		configured: currentSession.configured,
		displayName: null,
		role: null,
		username: null
	};
}

export async function createAdminSession(event: H3Event, username: string, password: string) {
	const config = getAdminConfig(event);

	if (!isAdminConfigured(config)) {
		throw createError({
			statusCode: 503,
			statusMessage: "Admin portal is not configured."
		});
	}

	let loginResponse: BackendLoginResponse;

	try {
		loginResponse = await $fetch<BackendLoginResponse>(`${config.apiBase}/admin/auth/login`, {
			body: {
				password,
				username
			},
			headers: getForwardHeaders(event),
			method: "POST"
		});
	}
	catch (error) {
		if (error instanceof FetchError) {
			throw createError({
				statusCode: error.statusCode || 500,
				statusMessage: error.data?.message || error.statusMessage || "Unable to verify admin credentials."
			});
		}

		throw error;
	}

	if (!loginResponse.authenticated || !loginResponse.username || !loginResponse.displayName || !loginResponse.role) {
		throw createError({
			statusCode: 401,
			statusMessage: "Invalid admin credentials."
		});
	}

	const serializedSession = serializeSession({
		displayName: loginResponse.displayName,
		expiresAt: Date.now() + (adminSessionMaxAge * 1000),
		role: loginResponse.role,
		username: loginResponse.username
	}, config.sessionSecret);

	setCookie(event, adminCookieName, serializedSession, {
		httpOnly: true,
		maxAge: adminSessionMaxAge,
		path: "/",
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production"
	});

	return {
		authenticated: true,
		configured: true,
		displayName: loginResponse.displayName,
		role: loginResponse.role,
		username: loginResponse.username
	} satisfies AdminSessionResponse;
}

async function fetchAdminApi<T>(event: H3Event, path: string, options?: {
	body?: Record<string, unknown>;
	method?: "GET" | "PATCH" | "POST";
}) {
	const config = getAdminConfig(event);

	if (!isAdminConfigured(config)) {
		throw createError({
			statusCode: 503,
			statusMessage: "Admin API proxy is not configured."
		});
	}

	return await $fetch<T>(`${config.apiBase}${path}`, {
		body: options?.body,
		headers: getForwardHeaders(event, {
			"x-admin-api-key": config.apiKey
		}),
		method: options?.method
	});
}

export async function getAdminOverview(event: H3Event) {
	requireAdminSession(event);
	return await fetchAdminApi<AdminOverviewResponse>(event, "/admin/overview");
}

export async function getAdminCorrections(event: H3Event) {
	requireAdminSession(event);
	return await fetchAdminApi<AdminCorrectionsResponse>(event, "/admin/corrections");
}

export async function updateAdminCorrection(event: H3Event, id: string, body: Record<string, unknown>) {
	requireAdminSession(event);
	return await fetchAdminApi<AdminCorrectionsResponse>(event, `/admin/corrections/${id}`, {
		body,
		method: "PATCH"
	});
}

export async function getAdminReview(event: H3Event) {
	requireAdminSession(event);
	return await fetchAdminApi<AdminReviewResponse>(event, "/admin/review");
}

export async function getAdminContent(event: H3Event) {
	requireAdminSession(event);
	return await fetchAdminApi<AdminContentResponse>(event, "/admin/content");
}

export async function updateAdminContent(event: H3Event, id: string, body: Record<string, unknown>) {
	requireAdminSession(event);
	return await fetchAdminApi<AdminContentResponse>(event, `/admin/content/${id}`, {
		body,
		method: "PATCH"
	});
}

export async function getAdminGuidePackages(event: H3Event) {
	requireAdminSession(event);
	return await fetchAdminApi<GuidePackageListResponse>(event, "/admin/packages");
}

export async function getAdminGuidePackage(event: H3Event, id: string) {
	requireAdminSession(event);
	return await fetchAdminApi<GuidePackageRecordResponse>(event, `/admin/packages/${id}`);
}

export async function getAdminGuidePackageDiagnostics(event: H3Event, id: string) {
	requireAdminSession(event);
	return await fetchAdminApi<GuidePackageDiagnosticsResponse>(event, `/admin/packages/${id}/diagnostics`);
}

export async function createAdminGuidePackage(event: H3Event, body: Record<string, unknown>) {
	requireAdminSession(event);
	return await fetchAdminApi<GuidePackageRecordResponse>(event, "/admin/packages", {
		body,
		method: "POST"
	});
}

export async function updateAdminGuidePackage(event: H3Event, id: string, body: Record<string, unknown>) {
	requireAdminSession(event);
	return await fetchAdminApi<GuidePackageRecordResponse>(event, `/admin/packages/${id}`, {
		body,
		method: "PATCH"
	});
}

export async function publishAdminGuidePackage(event: H3Event, id: string, body: Record<string, unknown>) {
	requireAdminSession(event);
	return await fetchAdminApi<GuidePackageRecordResponse>(event, `/admin/packages/${id}/publish`, {
		body,
		method: "POST"
	});
}

export async function unpublishAdminGuidePackage(event: H3Event, id: string, body: Record<string, unknown>) {
	requireAdminSession(event);
	return await fetchAdminApi<GuidePackageRecordResponse>(event, `/admin/packages/${id}/unpublish`, {
		body,
		method: "POST"
	});
}

export async function getAdminSourceMonitor(event: H3Event) {
	requireAdminSession(event);
	return await fetchAdminApi<AdminSourceMonitorResponse>(event, "/admin/sources");
}

export async function updateAdminSource(event: H3Event, id: string, body: Record<string, unknown>) {
	requireAdminSession(event);
	return await fetchAdminApi<AdminSourceMonitorResponse>(event, `/admin/sources/${id}`, {
		body,
		method: "PATCH"
	});
}

export async function getAdminUsers(event: H3Event) {
	const session = requireAdminSession(event);

	if (session.role !== "admin") {
		throw createError({
			statusCode: 403,
			statusMessage: "Only admin users can manage accounts."
		});
	}

	return await fetchAdminApi<AdminUsersResponse>(event, "/admin/users");
}

export async function createAdminUser(event: H3Event, body: Record<string, unknown>) {
	const session = requireAdminSession(event);

	if (session.role !== "admin") {
		throw createError({
			statusCode: 403,
			statusMessage: "Only admin users can manage accounts."
		});
	}

	return await fetchAdminApi<AdminUsersResponse>(event, "/admin/users", {
		body,
		method: "POST"
	});
}
