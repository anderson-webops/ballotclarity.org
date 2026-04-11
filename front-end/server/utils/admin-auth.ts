import type { H3Event } from "h3";
import type {
	AdminCorrectionsResponse,
	AdminOverviewResponse,
	AdminReviewResponse,
	AdminSessionResponse,
	AdminSourceMonitorResponse
} from "~/types/civic";
import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import process from "node:process";
import { useRuntimeConfig } from "#imports";
import { createError, deleteCookie, getCookie, setCookie } from "h3";
import { $fetch } from "ofetch";

const adminCookieName = "ballot_clarity_admin_session";
const adminSessionMaxAge = 60 * 60 * 12;

interface AdminConfig {
	apiBase: string;
	apiKey: string;
	password: string;
	sessionSecret: string;
	username: string;
}

interface AdminSessionPayload {
	expiresAt: number;
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
		password: process.env.NUXT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || String(runtimeConfig.adminPassword || ""),
		sessionSecret: process.env.NUXT_ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || String(runtimeConfig.adminSessionSecret || ""),
		username: process.env.NUXT_ADMIN_USERNAME || process.env.ADMIN_USERNAME || String(runtimeConfig.adminUsername || "")
	};
}

function isAdminConfigured(config: AdminConfig) {
	return Boolean(config.apiBase && config.apiKey && config.password && config.sessionSecret && config.username);
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

		if (!payload.username || typeof payload.expiresAt !== "number")
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
			username: null
		};
	}

	const cookieValue = getCookie(event, adminCookieName);
	const session = parseSession(cookieValue, config.sessionSecret);

	if (!session || !constantTimeEqual(session.username, config.username)) {
		return {
			authenticated: false,
			configured: true,
			username: null
		};
	}

	return {
		authenticated: true,
		configured: true,
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

	if (!constantTimeEqual(username, config.username) || !constantTimeEqual(password, config.password)) {
		throw createError({
			statusCode: 401,
			statusMessage: "Invalid admin credentials."
		});
	}

	const serializedSession = serializeSession({
		expiresAt: Date.now() + (adminSessionMaxAge * 1000),
		username: config.username
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
		username: config.username
	} satisfies AdminSessionResponse;
}

async function fetchAdminApi<T>(event: H3Event, path: string) {
	const config = getAdminConfig(event);

	if (!isAdminConfigured(config)) {
		throw createError({
			statusCode: 503,
			statusMessage: "Admin API proxy is not configured."
		});
	}

	return await $fetch<T>(`${config.apiBase}${path}`, {
		headers: {
			"x-admin-api-key": config.apiKey
		}
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

export async function getAdminReview(event: H3Event) {
	requireAdminSession(event);
	return await fetchAdminApi<AdminReviewResponse>(event, "/admin/review");
}

export async function getAdminSourceMonitor(event: H3Event) {
	requireAdminSession(event);
	return await fetchAdminApi<AdminSourceMonitorResponse>(event, "/admin/sources");
}
