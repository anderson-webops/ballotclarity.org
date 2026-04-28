import type { H3Event } from "h3";
import { Buffer } from "node:buffer";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import process from "node:process";
import { useRuntimeConfig } from "#imports";
import { createError, getCookie, getRequestHeader, getRequestURL, setCookie, setHeader, setResponseStatus } from "h3";

export const contactAddressNonceCookieName = "ballot_clarity_contact_nonce";
export const contactAddressNonceHeaderName = "x-ballot-clarity-contact-nonce";

const contactAddressSessionCookieName = "ballot_clarity_contact_session";
const contactAddressSessionMaxAgeSeconds = 10 * 60;
const contactAddressSessionVersion = 1;
const contactAddressRateLimitWindowMs = 60 * 1000;
const contactAddressRateLimitMax = 12;
const startupContactAddressSessionSecret = randomBytes(32).toString("base64url");
const defaultContactAddressCodes = [
	104,
	101,
	108,
	108,
	111,
	64,
	98,
	97,
	108,
	108,
	111,
	116,
	99,
	108,
	97,
	114,
	105,
	116,
	121,
	46,
	111,
	114,
	103
] as const;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

interface ContactAddressSessionPayload {
	expiresAt: number;
	nonceHash: string;
	version: typeof contactAddressSessionVersion;
}

function decodeCharacterCodes(codes: readonly number[]) {
	return String.fromCharCode(...codes);
}

function constantTimeEqual(left: string, right: string) {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);

	if (leftBuffer.length !== rightBuffer.length)
		return false;

	return timingSafeEqual(leftBuffer, rightBuffer);
}

function hashNonce(nonce: string) {
	return createHash("sha256").update(nonce).digest("base64url");
}

function signPayload(payload: string, sessionSecret: string) {
	return createHmac("sha256", sessionSecret).update(payload).digest("base64url");
}

function serializeSession(payload: ContactAddressSessionPayload, sessionSecret: string) {
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
		const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<ContactAddressSessionPayload>;

		if (payload.version !== contactAddressSessionVersion || typeof payload.expiresAt !== "number" || typeof payload.nonceHash !== "string")
			return null;

		if (payload.expiresAt <= Date.now())
			return null;

		return payload as ContactAddressSessionPayload;
	}
	catch {
		return null;
	}
}

function getContactAddressSessionSecret(event: H3Event) {
	const runtimeConfig = useRuntimeConfig(event);
	const configuredSecret = process.env.NUXT_CONTACT_ADDRESS_SESSION_SECRET
		|| process.env.CONTACT_ADDRESS_SESSION_SECRET
		|| String(runtimeConfig.contactAddressSessionSecret || "")
		|| process.env.NUXT_ADMIN_SESSION_SECRET
		|| process.env.ADMIN_SESSION_SECRET
		|| "";

	return configuredSecret || startupContactAddressSessionSecret;
}

function getConfiguredContactAddress(event: H3Event) {
	const runtimeConfig = useRuntimeConfig(event);
	const configuredAddress = process.env.NUXT_CONTACT_ADDRESS
		|| process.env.CONTACT_ADDRESS
		|| String(runtimeConfig.contactAddress || "");

	return configuredAddress.trim() || decodeCharacterCodes(defaultContactAddressCodes);
}

function getRequestOrigin(event: H3Event) {
	const requestUrl = getRequestURL(event);
	const forwardedHost = getRequestHeader(event, "x-forwarded-host");
	const forwardedProto = getRequestHeader(event, "x-forwarded-proto");
	const host = forwardedHost || getRequestHeader(event, "host") || requestUrl.host;
	const protocol = forwardedProto || requestUrl.protocol.replace(/:$/, "") || "https";

	return `${protocol}://${host}`;
}

function readOriginHeader(value: string | undefined) {
	if (!value)
		return "";

	try {
		return new URL(value).origin;
	}
	catch {
		return "";
	}
}

function getClientRateLimitKey(event: H3Event) {
	const forwardedFor = getRequestHeader(event, "x-forwarded-for")?.split(",")[0]?.trim();
	const realIp = getRequestHeader(event, "x-real-ip")?.trim();

	return forwardedFor || realIp || event.node.req.socket.remoteAddress || "unknown";
}

function enforceSameOrigin(event: H3Event) {
	const expectedOrigin = getRequestOrigin(event);
	const requestOrigin = readOriginHeader(getRequestHeader(event, "origin"));
	const referrerOrigin = readOriginHeader(getRequestHeader(event, "referer"));
	const fetchSite = getRequestHeader(event, "sec-fetch-site")?.toLowerCase();

	if (fetchSite && !["none", "same-origin"].includes(fetchSite)) {
		throw createError({
			statusCode: 403,
			statusMessage: "Same-origin contact lookup required."
		});
	}

	if (requestOrigin && requestOrigin !== expectedOrigin) {
		throw createError({
			statusCode: 403,
			statusMessage: "Same-origin contact lookup required."
		});
	}

	if (referrerOrigin && referrerOrigin !== expectedOrigin) {
		throw createError({
			statusCode: 403,
			statusMessage: "Same-origin contact lookup required."
		});
	}
}

function enforceRateLimit(event: H3Event) {
	const now = Date.now();
	const key = getClientRateLimitKey(event);
	const bucket = rateLimitBuckets.get(key);

	for (const [bucketKey, value] of rateLimitBuckets) {
		if (value.resetAt <= now)
			rateLimitBuckets.delete(bucketKey);
	}

	if (!bucket || bucket.resetAt <= now) {
		rateLimitBuckets.set(key, {
			count: 1,
			resetAt: now + contactAddressRateLimitWindowMs
		});
		return;
	}

	bucket.count += 1;

	if (bucket.count > contactAddressRateLimitMax) {
		setHeader(event, "Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
		throw createError({
			statusCode: 429,
			statusMessage: "Too many contact address requests."
		});
	}
}

function isSecureRequest(event: H3Event) {
	const forwardedProto = getRequestHeader(event, "x-forwarded-proto")?.toLowerCase();
	const requestUrl = getRequestURL(event);

	return forwardedProto === "https" || requestUrl.protocol === "https:";
}

function issueContactAddressChallenge(event: H3Event, sessionSecret: string) {
	const nonce = randomBytes(24).toString("base64url");
	const expiresAt = Date.now() + contactAddressSessionMaxAgeSeconds * 1000;
	const session = serializeSession({
		expiresAt,
		nonceHash: hashNonce(nonce),
		version: contactAddressSessionVersion
	}, sessionSecret);
	const secure = isSecureRequest(event);

	setCookie(event, contactAddressSessionCookieName, session, {
		httpOnly: true,
		maxAge: contactAddressSessionMaxAgeSeconds,
		path: "/",
		sameSite: "lax",
		secure
	});
	setCookie(event, contactAddressNonceCookieName, nonce, {
		httpOnly: false,
		maxAge: contactAddressSessionMaxAgeSeconds,
		path: "/",
		sameSite: "lax",
		secure
	});
}

function isVerifiedContactAddressRequest(event: H3Event, sessionSecret: string) {
	const submittedNonce = getRequestHeader(event, contactAddressNonceHeaderName)?.trim();
	const session = parseSession(getCookie(event, contactAddressSessionCookieName), sessionSecret);

	if (!submittedNonce || !session)
		return false;

	return constantTimeEqual(hashNonce(submittedNonce), session.nonceHash);
}

export function getProtectedContactAddress(event: H3Event) {
	setHeader(event, "Cache-Control", "no-store, private");
	setHeader(event, "Vary", "Cookie, Origin, Referer, Sec-Fetch-Site, X-Ballot-Clarity-Contact-Nonce");

	enforceSameOrigin(event);
	enforceRateLimit(event);

	const sessionSecret = getContactAddressSessionSecret(event);

	if (!isVerifiedContactAddressRequest(event, sessionSecret)) {
		issueContactAddressChallenge(event, sessionSecret);
		setResponseStatus(event, 202, "Contact address challenge issued.");
		return {
			address: null,
			challenge: "contact_nonce_required"
		};
	}

	return {
		address: getConfiguredContactAddress(event)
	};
}
