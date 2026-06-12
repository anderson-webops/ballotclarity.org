import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export type SourceAssetMode = "external-base" | "public-mirror";
const httpProtocolPattern = /^https?:\/\//i;
const leadingSlashPattern = /^\/+/;

export interface SourceAssetStoreOptions {
	publicSourceFileDirectory?: string | null;
}

function trimTrailingSlash(value: string) {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeSourceAssetPath(url: string) {
	return url.startsWith("/source-files/") ? url.slice("/source-files/".length) : url.replace(leadingSlashPattern, "");
}

function isPublicSourceFileUrl(url: string) {
	return url.startsWith("/source-files/");
}

function isSafeSourceAssetPath(assetPath: string) {
	return !assetPath.split(/[\\/]/).includes("..");
}

function defaultPublicSourceFileDirectory() {
	const configuredDirectory = (process.env.SOURCE_ASSET_PUBLIC_DIR || "").trim();

	if (configuredDirectory)
		return configuredDirectory;

	const moduleDirectory = dirname(fileURLToPath(import.meta.url));
	const candidates = [
		resolvePath(process.cwd(), "front-end", "public", "source-files"),
		resolvePath(process.cwd(), "..", "front-end", "public", "source-files"),
		resolvePath(moduleDirectory, "..", "..", "front-end", "public", "source-files"),
		resolvePath(moduleDirectory, "..", "..", "front-end", ".output", "public", "source-files"),
	];

	return candidates.find(candidate => existsSync(candidate)) ?? null;
}

export function createSourceAssetStore(options: SourceAssetStoreOptions = {}) {
	const configuredBaseUrl = (process.env.SOURCE_ASSET_BASE_URL || "").trim();
	const mode: SourceAssetMode = configuredBaseUrl ? "external-base" : "public-mirror";
	const baseUrl = configuredBaseUrl ? trimTrailingSlash(configuredBaseUrl) : null;
	const publicSourceFileDirectory = options.publicSourceFileDirectory === undefined
		? defaultPublicSourceFileDirectory()
		: options.publicSourceFileDirectory;

	return {
		baseUrl,
		mode,
		publicSourceFileDirectory,
		resolve(url: string) {
			if (!url)
				return url;

			if (httpProtocolPattern.test(url))
				return url;

			const normalizedAssetPath = normalizeSourceAssetPath(url);

			if (isPublicSourceFileUrl(url) && !isSafeSourceAssetPath(normalizedAssetPath))
				return "";

			if (mode === "external-base" && baseUrl)
				return `${baseUrl}/${normalizedAssetPath}`;

			if (isPublicSourceFileUrl(url) && publicSourceFileDirectory) {
				const assetPath = resolvePath(publicSourceFileDirectory, normalizedAssetPath);

				if (!existsSync(assetPath))
					return "";
			}

			return url;
		}
	};
}
