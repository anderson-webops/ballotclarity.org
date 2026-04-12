import process from "node:process";

export type SourceAssetMode = "external-base" | "public-mirror";
const httpProtocolPattern = /^https?:\/\//i;
const leadingSlashPattern = /^\/+/;

function trimTrailingSlash(value: string) {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeSourceAssetPath(url: string) {
	return url.startsWith("/source-files/") ? url.slice("/source-files/".length) : url.replace(leadingSlashPattern, "");
}

export function createSourceAssetStore() {
	const configuredBaseUrl = (process.env.SOURCE_ASSET_BASE_URL || "").trim();
	const mode: SourceAssetMode = configuredBaseUrl ? "external-base" : "public-mirror";
	const baseUrl = configuredBaseUrl ? trimTrailingSlash(configuredBaseUrl) : null;

	return {
		baseUrl,
		mode,
		resolve(url: string) {
			if (!url)
				return url;

			if (httpProtocolPattern.test(url))
				return url;

			if (mode === "external-base" && baseUrl)
				return `${baseUrl}/${normalizeSourceAssetPath(url)}`;

			return url;
		}
	};
}
