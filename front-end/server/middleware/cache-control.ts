import { defineEventHandler, getHeader, getRequestURL, setHeader } from "h3";

const immutableNuxtAssetPattern = /^\/_nuxt\/.+/;

export default defineEventHandler((event) => {
	const pathname = getRequestURL(event).pathname;

	if (immutableNuxtAssetPattern.test(pathname)) {
		setHeader(event, "cache-control", "public, max-age=31536000, immutable");
		return;
	}

	if (pathname.startsWith("/api/"))
		return;

	const acceptHeader = getHeader(event, "accept") || "";

	if (acceptHeader.includes("text/html"))
		setHeader(event, "cache-control", "public, max-age=0, must-revalidate");
});
