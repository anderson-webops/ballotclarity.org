import assert from "node:assert/strict";
import test from "node:test";
import {
	buildPreHydrationDeployRecoveryScript,
	hasBuildMismatch,
	isLikelyStaleNuxtChunkError,
	normalizeBuildId,
	persistClientBuildId,
	readServerBuildId,
	recoveryReloadKey,
	shouldRecoverFromBuildMismatch,
	staleClientBuildStorageKey,
	staleClientNoticeId,
	triggerStaleClientRecovery,
	unregisterStaleServiceWorkers,
} from "../src/utils/deploy-recovery.ts";

function createStorage(seedEntries: Array<[string, string]> = []) {
	const entries = new Map(seedEntries);

	return {
		getItem(key: string) {
			return entries.get(key) ?? null;
		},
		key(index: number) {
			return [...entries.keys()][index] ?? null;
		},
		get length() {
			return entries.size;
		},
		removeItem(key: string) {
			entries.delete(key);
		},
		setItem(key: string, value: string) {
			entries.set(key, value);
		},
	};
}

test("deploy recovery recognizes stale Nuxt chunk failures", () => {
	assert.equal(isLikelyStaleNuxtChunkError(new Error("Failed to fetch dynamically imported module: https://example.org/_nuxt/DrwoJfRy.js")), true);
	assert.equal(isLikelyStaleNuxtChunkError({ message: "Importing a module script failed.", sourceURL: "https://example.org/_nuxt/rcUcbRU_.js" }), true);
	assert.equal(isLikelyStaleNuxtChunkError({
		target: {
			src: "https://example.org/_nuxt/BPF53uJ4.js",
		},
		type: "error",
	}), true);
	assert.equal(isLikelyStaleNuxtChunkError({
		detail: {
			href: "https://example.org/_nuxt/CzLB4Ne1.js",
		},
		type: "vite:preloadError",
	}), true);
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

test("deploy recovery stores the current client build id and clears stale reload markers", () => {
	const storage = createStorage([
		[recoveryReloadKey("build-a"), "1"],
		[recoveryReloadKey("build-b"), "1"],
		["unrelated", "keep"],
	]);

	persistClientBuildId(" build-current ", storage);

	assert.equal(storage.getItem(staleClientBuildStorageKey), "build-current");
	assert.equal(storage.getItem(recoveryReloadKey("build-a")), null);
	assert.equal(storage.getItem(recoveryReloadKey("build-b")), null);
	assert.equal(storage.getItem("unrelated"), "keep");
});

test("deploy recovery only retries a build mismatch once per target build", () => {
	const storage = createStorage();

	assert.equal(shouldRecoverFromBuildMismatch("build-a", "build-b", storage), true);
	storage.setItem(recoveryReloadKey("build-b"), "1");
	assert.equal(shouldRecoverFromBuildMismatch("build-a", "build-b", storage), false);
	assert.equal(shouldRecoverFromBuildMismatch("build-b", "build-b", storage), false);
});

test("deploy recovery pre-hydration script checks the stored client build id before hydration", () => {
	const script = buildPreHydrationDeployRecoveryScript();

	assert.match(script, /data-app-build/);
	assert.match(script, /window\.location\.reload\(\)/);
	assert.match(script, new RegExp(staleClientBuildStorageKey));
});

test("deploy recovery shows a reload notice and only schedules one runtime reload per target build", () => {
	const storage = createStorage();
	let reloadCalls = 0;
	let timerCalls = 0;
	const appendedNodes: Array<{ id?: string; textContent?: string }> = [];
	const fakeDocument = {
		body: {
			append(node: { id?: string; textContent?: string }) {
				appendedNodes.push(node);
			},
		},
		createElement() {
			return {
				setAttribute() {
					// Ignore DOM attribute writes in the test harness.
				},
				style: {},
				textContent: "",
			};
		},
		getElementById(id: string) {
			return appendedNodes.find(node => node.id === id) ?? null;
		},
	} as unknown as Document;
	const fakeWindow = {
		location: {
			reload() {
				reloadCalls += 1;
			},
		},
		sessionStorage: storage,
		setTimeout(callback: () => void) {
			timerCalls += 1;
			callback();
			return 1;
		},
	} as unknown as Window;
	const previousDocument = globalThis.document;
	const previousWindow = globalThis.window;

	try {
		Object.assign(globalThis, {
			document: fakeDocument,
			window: fakeWindow,
		});

		assert.equal(triggerStaleClientRecovery("build-new"), true);
		assert.equal(storage.getItem(recoveryReloadKey("build-new")), "1");
		assert.equal(reloadCalls, 1);
		assert.equal(timerCalls, 1);
		assert.equal(appendedNodes[0]?.id, staleClientNoticeId);
		assert.match(appendedNodes[0]?.textContent ?? "", /Ballot Clarity updated/i);

		assert.equal(triggerStaleClientRecovery("build-new"), false);
		assert.equal(reloadCalls, 1);
	}
	finally {
		Object.assign(globalThis, {
			document: previousDocument,
			window: previousWindow,
		});
	}
});

test("deploy recovery can unregister stale service workers when present", async () => {
	let unregisterCalls = 0;
	const registrations = [
		{
			unregister: async () => {
				unregisterCalls += 1;
				return true;
			},
		},
		{
			unregister: async () => {
				unregisterCalls += 1;
				return true;
			},
		},
	];

	const removed = await unregisterStaleServiceWorkers({
		serviceWorker: {
			getRegistrations: async () => registrations,
		},
	});

	assert.equal(removed, 2);
	assert.equal(unregisterCalls, 2);
});
