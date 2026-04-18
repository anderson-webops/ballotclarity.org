const staleChunkPattern = new RegExp([
	"failed to fetch dynamically imported module",
	"error loading dynamically imported module",
	"importing a module script failed",
	"loading chunk",
	"chunkloaderror",
	"failed to load module script",
	"unable to preload css",
	"css chunk"
].join("|"), "i");
const nuxtAssetPattern = /\/_nuxt\/[^"' )]+\.(?:js|mjs|css)(?:\?[^"' )]*)?$/i;
const reloadKeyPrefix = "ballot-clarity:stale-client-reload:";
const noticeElementId = "ballot-clarity-stale-client-notice";

interface ErrorLike {
	filename?: string | null;
	message?: string | null;
	reason?: unknown;
	sourceURL?: string | null;
	stack?: string | null;
}

function toMessage(value: unknown): string {
	if (value instanceof Error)
		return `${value.name}: ${value.message} ${value.stack ?? ""}`.trim();

	if (typeof value === "string")
		return value;

	if (value && typeof value === "object") {
		const maybeError = value as ErrorLike;
		const parts = [
			typeof maybeError.message === "string" ? maybeError.message : "",
			typeof maybeError.stack === "string" ? maybeError.stack : "",
			typeof maybeError.filename === "string" ? maybeError.filename : "",
			typeof maybeError.sourceURL === "string" ? maybeError.sourceURL : "",
			maybeError.reason ? toMessage(maybeError.reason) : ""
		];

		return parts.filter(Boolean).join(" ").trim();
	}

	return "";
}

export function isLikelyStaleNuxtChunkError(error: unknown): boolean {
	const combined = toMessage(error);

	if (!combined)
		return false;

	if (nuxtAssetPattern.test(combined))
		return staleChunkPattern.test(combined) || combined.includes("/_nuxt/");

	return staleChunkPattern.test(combined);
}

export function normalizeBuildId(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

export function readServerBuildId(doc: Pick<Document, "documentElement" | "querySelector"> = document): string {
	const htmlBuildId = doc.documentElement.getAttribute("data-app-build");

	if (htmlBuildId)
		return normalizeBuildId(htmlBuildId);

	const metaTag = doc.querySelector<HTMLMetaElement>("meta[name='ballot-clarity-build-id']");

	return normalizeBuildId(metaTag?.content);
}

export function hasBuildMismatch(clientBuildId: string, serverBuildId: string): boolean {
	return Boolean(clientBuildId && serverBuildId && clientBuildId !== serverBuildId);
}

function recoveryReloadKey(targetBuildId: string) {
	return `${reloadKeyPrefix}${targetBuildId || "unknown"}`;
}

function ensureReloadNotice(message: string) {
	const existing = document.getElementById(noticeElementId);

	if (existing) {
		existing.textContent = message;
		return;
	}

	const notice = document.createElement("div");
	notice.id = noticeElementId;
	notice.setAttribute("role", "status");
	notice.setAttribute("aria-live", "polite");
	notice.textContent = message;
	notice.style.position = "fixed";
	notice.style.right = "1rem";
	notice.style.bottom = "1rem";
	notice.style.zIndex = "9999";
	notice.style.maxWidth = "20rem";
	notice.style.padding = "0.85rem 1rem";
	notice.style.borderRadius = "1rem";
	notice.style.background = "rgba(16, 37, 62, 0.96)";
	notice.style.boxShadow = "0 24px 48px -28px rgba(0, 0, 0, 0.45)";
	notice.style.color = "#fff";
	notice.style.font = "600 0.92rem/1.45 \"Public Sans\", system-ui, sans-serif";
	notice.style.pointerEvents = "none";
	document.body.append(notice);
}

export function triggerStaleClientRecovery(targetBuildId: string, message = "Ballot Clarity updated. Reloading…"): boolean {
	const reloadKey = recoveryReloadKey(targetBuildId);

	try {
		if (window.sessionStorage.getItem(reloadKey)) {
			ensureReloadNotice("Ballot Clarity updated. Please refresh this page.");
			return false;
		}

		window.sessionStorage.setItem(reloadKey, "1");
	}
	catch {
		// Ignore sessionStorage failures and still attempt a single runtime reload.
	}

	ensureReloadNotice(message);

	window.setTimeout(() => {
		window.location.reload();
	}, 150);

	return true;
}
