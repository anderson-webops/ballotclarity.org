import type { H3Event } from "h3";
import { defineEventHandler } from "h3";

const immutableNuxtAssetPattern = /^\/_nuxt\/.+/;

function getRequestPathname(event: H3Event) {
	const rawUrl = event.node?.req.url || "/";

	try {
		return new URL(rawUrl, "http://localhost").pathname;
	}
	catch {
		return "/";
	}
}

function getRequestHeader(event: H3Event, name: string) {
	const value = event.node?.req.headers[name.toLowerCase()];

	if (Array.isArray(value))
		return value.join(", ");

	return value || "";
}

function setResponseHeader(event: H3Event, name: string, value: string) {
	event.node?.res.setHeader(name, value);
}

export default defineEventHandler((event) => {
	const pathname = getRequestPathname(event);

	if (immutableNuxtAssetPattern.test(pathname)) {
		setResponseHeader(event, "cache-control", "public, max-age=31536000, immutable");
		return;
	}

	if (pathname.startsWith("/api/"))
		return;

	const acceptHeader = getRequestHeader(event, "accept");

	if (acceptHeader.includes("text/html"))
		setResponseHeader(event, "cache-control", "public, max-age=0, must-revalidate");
});
