import assert from "node:assert/strict";
import test from "node:test";
import { hasBuildMismatch, isLikelyStaleNuxtChunkError, normalizeBuildId, readServerBuildId } from "../src/utils/deploy-recovery.ts";

test("deploy recovery recognizes stale Nuxt chunk failures", () => {
	assert.equal(isLikelyStaleNuxtChunkError(new Error("Failed to fetch dynamically imported module: https://example.org/_nuxt/DrwoJfRy.js")), true);
	assert.equal(isLikelyStaleNuxtChunkError({ message: "Importing a module script failed.", sourceURL: "https://example.org/_nuxt/rcUcbRU_.js" }), true);
	assert.equal(isLikelyStaleNuxtChunkError(new Error("Network request failed while saving settings")), false);
});

test("deploy recovery reads and compares build ids", () => {
	const fakeDocument = {
		documentElement: {
			getAttribute(name: string) {
				return name === "data-app-build" ? "build-123" : null;
			}
		},
		querySelector() {
			return null;
		}
	} as unknown as Pick<Document, "documentElement" | "querySelector">;

	assert.equal(normalizeBuildId(" build-123 "), "build-123");
	assert.equal(readServerBuildId(fakeDocument), "build-123");
	assert.equal(hasBuildMismatch("build-old", "build-123"), true);
	assert.equal(hasBuildMismatch("build-123", "build-123"), false);
});
