import type { OpenStatesCollectionPlan } from "../src/openstates-collection.js";
import type { OpenStatesProfileCollectionPlan } from "../src/openstates-profile-collection.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { pack } from "tar-stream";
import { openStatesBulkPublication, openStatesBulkSources } from "../src/openstates-bulk.js";
import { collectOpenStates, openStatesPolicyFingerprint, seedOpenStatesCollection } from "../src/openstates-collection.js";
import { collectOpenStatesProfiles, openStatesProfileCollectionPolicySha256, openStatesProfilePublication, seedOpenStatesProfileCollection } from "../src/openstates-profile-collection.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const initialTime = Date.parse("2026-10-22T12:00:00.000Z");
const day = 86_400_000;
const commit = "1".repeat(40);
const uuid = "00000000-0000-0000-0000-000000000001";
const source = openStatesBulkSources.find(item => item.stateCode === "GA")!;
const official = configuredStateBallotSources.find(item => item.id === "ga-fulton-2026")!;
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const csv = `id,name,current_chamber,current_district\nocd-person/${uuid},Alex Rivera,upper,12\n`;
const policy = "<section><h1>Terms of Service</h1><p>Attribution. We make no copyright claim.</p></section><section><h1>Privacy Policy</h1><p>Public policy.</p></section>";
const readme = "People dataset: CC0, all copyright waived";
const person = `id: ocd-person/${uuid}\nname: Alex Rivera\nroles:\n  - type: upper\n    district: '12'\n    jurisdiction: ocd-jurisdiction/country:us/state:ga/government\n    start_date: 2021-01-01\nextras:\n  occupation: Attorney\n`;

async function archive(selectedCommit = commit, dedication = readme, biography = person) {
	const stream = pack();
	const prefix = `openstates-people-${selectedCommit.slice(0, 7)}`;
	stream.entry({ name: `${prefix}/README.md` }, dedication);
	stream.entry({ name: `${prefix}/data/ga/legislature/Alex-Rivera-${uuid}.yml` }, biography);
	stream.finalize();
	const chunks = [];
	for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
	return gzipSync(Buffer.concat(chunks));
}

function commitResponse(selectedCommit = commit) {
	return Response.json({ sha: selectedCommit, url: `https://api.github.com/repos/openstates/people/commits/${selectedCommit}`, html_url: `https://github.com/openstates/people/commit/${selectedCommit}` }, { headers: { etag: "\"commit-one\"" } });
}

async function fixture(context: { after: (callback: () => Promise<void>) => void }, secondPerson = false) {
	const directory = await mkdtemp(join(tmpdir(), "openstates-profile-collector-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	let clock = initialTime;
	const now = () => clock;
	const candidateRecords = [{ id: "a".repeat(24), name: "Alex Rivera", office: "State Senator", scope: "state-senate" as const, district: "12", status: "listed" as const }];
	if (secondPerson) candidateRecords.push({ id: "b".repeat(24), name: "Blake Chen", office: "State Senator", scope: "state-senate", district: "13", status: "listed" });
	const selectedCsv = csv + (secondPerson ? "ocd-person/00000000-0000-0000-0000-000000000002,Blake Chen,upper,13\n" : "");
	const documents = official.documentUrls!.map((url, index) => ({ url, retrievedAt: new Date(clock).toISOString(), sha256: hash(url), includedRecordCount: index === 0 ? candidateRecords.length : 0 }));
	const candidateFile = join(directory, "candidates.json");
	await writeFile(candidateFile, serializeStoredStateSnapshot({ source: official, retrievedAt: new Date(clock).toISOString(), sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), documents, records: candidateRecords }));
	const collection: OpenStatesCollectionPlan = { schemaVersion: 1, type: "openstates-collection", sourceIds: [source.id], cacheDirectory: join(directory, "csv-cache"), outputRoot: join(directory, "runs"), candidateFiles: [candidateFile], allowedCandidateSourceIds: [official.id], accessReview: { reviewedAt: new Date(clock).toISOString(), termsTextSha256: openStatesPolicyFingerprint(policy) } };
	await seedOpenStatesCollection(collection, { policy: { body: policy, capturedAt: new Date(clock).toISOString() }, downloads: [{ sourceId: source.id, body: selectedCsv, capturedAt: new Date(clock).toISOString(), etag: "\"csv-one\"" }] }, clock);
	const plan: OpenStatesProfileCollectionPlan = { schemaVersion: 1, type: "openstates-profile-collection", collection, archiveCacheDirectory: join(directory, "archive-cache"), accessReview: { reviewedAt: new Date(clock).toISOString(), collectionPolicySha256: openStatesProfileCollectionPolicySha256, readmeSha256: hash(readme) } };
	const bytes = await archive();
	const capture = { path: join(directory, "reviewed.tar.gz"), commit, sha256: hash(bytes), capturedAt: new Date(clock).toISOString() };
	await writeFile(capture.path, bytes);
	const requests: { url: string; options: RequestInit }[] = [];
	async function fetchImpl(url: string, options: RequestInit) {
		requests.push({ url, options });
		if (url === openStatesBulkPublication.termsUrl) return new Response(policy, { headers: { "content-type": "text/html" } });
		if (url === source.documents[0]!.url) return new Response(null, { status: 304 });
		if (url === openStatesProfilePublication.commitUrl) return commitResponse();
		if (url === `https://api.github.com/repos/openstates/people/tarball/${commit}`) return new Response(null, { status: 302, headers: { location: `https://codeload.github.com/openstates/people/legacy.tar.gz/${commit}` } });
		if (url === `https://codeload.github.com/openstates/people/legacy.tar.gz/${commit}`) return new Response(bytes, { headers: { "content-type": "application/x-gzip" } });
		throw new Error("Unexpected publisher request.");
	}
	const options = { now, fetchImpl, sleep: async () => {} };
	async function seed() {
		const collected = await collectOpenStates(collection, options);
		const manifest = JSON.parse(await readFile(join(collected.outputDirectory, "openstates-reference-preparation.json"), "utf8"));
		return seedOpenStatesProfileCollection(plan, capture, manifest.files.map((file: { path: string }) => join(collected.outputDirectory, file.path)), clock);
	}
	return { directory, plan, capture, bytes, requests, fetchImpl, options, now, seed, advance: (time: number) => {
		clock = time;
	}, current: join(plan.archiveCacheDirectory, "current.json"), hold: join(plan.archiveCacheDirectory, "hold.json") };
}

async function runFixtureCommand(directory: string, planPath: string) {
	const preload = join(directory, "cli-fixture.mjs");
	await writeFile(preload, `Date.now = () => ${initialTime}; globalThis.fetch = async () => { throw new Error("Publisher requests are forbidden in the CLI fixture."); };`, { flag: "wx" });
	return spawnSync(process.execPath, ["--import", preload, "--import", "tsx", fileURLToPath(new URL("../src/manage-election-references.ts", import.meta.url)), "collect-openstates-profiles", planPath], { encoding: "utf8", env: { ...process.env, STATE_BALLOT_DATA_DIR: "" }, timeout: 30_000 });
}

test("profile collection downloads one pinned archive through only GitHub's documented redirect", async (context) => {
	const state = await fixture(context);
	const result = await collectOpenStatesProfiles(state.plan, state.options);
	assert.equal(result.complete, true);
	assert.equal(result.publisherRequests, 3);
	assert.equal(result.archive.status, "downloaded");
	assert.equal(result.prepared.profiles, 1);
	assert.equal(result.prepared.facts, 3);
	assert.equal(result.imported, false);
	assert.equal(result.archive.sha256, hash(state.bytes));
	assert.ok(result.outputDirectory.startsWith(await realpath(state.plan.collection.outputRoot)));
	for (const request of state.requests) {
		assert.equal(request.options.redirect, "manual");
		assert.equal(request.options.credentials, "omit");
		assert.equal(new Headers(request.options.headers).has("authorization"), false);
		assert.equal(new Headers(request.options.headers).has("cookie"), false);
		assert.ok(request.options.signal);
	}
	const repeated = await collectOpenStatesProfiles(state.plan, state.options);
	assert.equal(repeated.publisherRequests, 0);
	assert.equal(repeated.archive.status, "cache");
	assert.equal(repeated.archive.capturedAt, result.archive.capturedAt);
});

test("reviewed archive seeds prepare the same profiles without any publisher requests or overwrites", async (context) => {
	const state = await fixture(context);
	await state.seed();
	const result = await collectOpenStatesProfiles(state.plan, state.options);
	assert.equal(result.publisherRequests, 0);
	assert.equal(result.prepared.facts, 3);
	await assert.rejects(state.seed, /never replace/u);
	assert.equal(state.requests.length, 0);
});

test("conditional checks retain original body capture times and immutable archive bytes", async (context) => {
	const state = await fixture(context);
	const first = await collectOpenStatesProfiles(state.plan, state.options);
	state.advance(initialTime + day);
	const result = await collectOpenStatesProfiles(state.plan, { ...state.options, fetchImpl: async (url, options) => url === openStatesProfilePublication.commitUrl ? new Response(null, { status: 304 }) : state.fetchImpl(url, options) });
	assert.equal(result.archive.status, "not-modified");
	assert.equal(result.archive.capturedAt, first.archive.capturedAt);
	assert.equal(result.archive.sha256, first.archive.sha256);
	assert.equal(Date.parse(result.archive.checkedAt), initialTime + day);
	assert.equal(result.publisherRequests, 3);
	state.advance(initialTime + 2 * day);
	const unchanged = await collectOpenStatesProfiles(state.plan, state.options);
	assert.equal(unchanged.archive.status, "same-commit");
	assert.equal(unchanged.archive.capturedAt, first.archive.capturedAt);
	assert.equal(state.requests.filter(request => request.url.includes("tarball/")).length, 1);
});

test("a new observed commit gets its own source-bound body while retaining the preceding archive", async (context) => {
	const state = await fixture(context);
	const first = await collectOpenStatesProfiles(state.plan, state.options);
	const nextCommit = "2".repeat(40);
	const bytes = await archive(nextCommit);
	state.advance(initialTime + day);
	const result = await collectOpenStatesProfiles(state.plan, { ...state.options, fetchImpl: async (url, options) => {
		if (url === openStatesProfilePublication.commitUrl) return commitResponse(nextCommit);
		if (url.endsWith(`/tarball/${nextCommit}`)) return new Response(null, { status: 302, headers: { location: `https://codeload.github.com/openstates/people/legacy.tar.gz/${nextCommit}` } });
		if (url.endsWith(`/legacy.tar.gz/${nextCommit}`)) return new Response(bytes, { headers: { "content-type": "application/gzip" } });
		return state.fetchImpl(url, options);
	} });
	assert.equal(result.archive.commit, nextCommit);
	assert.equal(result.archive.status, "downloaded");
	assert.equal(result.archive.sha256, hash(bytes));
	assert.equal(hash(await readFile(join(state.plan.archiveCacheDirectory, "bodies", `${first.archive.sha256}.tar.gz`))), first.archive.sha256);
});

for (const status of [403, 429]) {
	test(`publisher ${status} creates a persistent hold before future network requests`, async (context) => {
		const state = await fixture(context);
		await assert.rejects(collectOpenStatesProfiles(state.plan, { ...state.options, fetchImpl: async () => new Response(new ReadableStream({ cancel() {
			throw new Error("Cancellation failed.");
		} }), { status }) }), /stopped for review/u);
		assert.equal(JSON.parse(await readFile(state.hold, "utf8")).status, status);
		await assert.rejects(collectOpenStatesProfiles(state.plan, state.options), /on hold/u);
		assert.equal(state.requests.length, 0);
	});
}

test("a transient commit failure preserves accepted bytes and enforces the attempt cooldown", async (context) => {
	const state = await fixture(context);
	await state.seed();
	const before = await readFile(state.current, "utf8");
	state.advance(initialTime + day);
	await assert.rejects(collectOpenStatesProfiles(state.plan, { ...state.options, fetchImpl: async (url, options) => url === openStatesProfilePublication.commitUrl ? new Response(null, { status: 503 }) : state.fetchImpl(url, options) }), /temporarily unavailable/u);
	await assert.rejects(readFile(state.hold), { code: "ENOENT" });
	assert.equal(await readFile(state.current, "utf8"), before);
	await assert.rejects(collectOpenStatesProfiles(state.plan, state.options), /cooldown/u);
	assert.equal(await readFile(state.current, "utf8"), before);
});

for (const variant of ["commit-identity", "commit-redirect", "archive-host", "archive-query", "content-type", "archive-size", "stream-size", "invalid-gzip", "dedication"]) {
	test(`profile collection holds ${variant} without promoting archive metadata`, async (context) => {
		const state = await fixture(context);
		await assert.rejects(collectOpenStatesProfiles(state.plan, { ...state.options, fetchImpl: async (url, options) => {
			if (url === openStatesProfilePublication.commitUrl && variant === "commit-identity") return Response.json({ sha: commit, url: "https://example.test/commit", html_url: `https://github.com/openstates/people/commit/${commit}` });
			if (url === openStatesProfilePublication.commitUrl && variant === "commit-redirect") return new Response(null, { status: 302, headers: { location: "https://example.test/commit" } });
			if (url.includes("/tarball/") && variant.startsWith("archive-") && variant !== "archive-size") return new Response(null, { status: 302, headers: { location: variant === "archive-host" ? `https://example.test/${commit}` : `https://codeload.github.com/openstates/people/legacy.tar.gz/${commit}?extra=1` } });
			if (url.includes("/legacy.tar.gz/")) {
				if (variant === "content-type") return new Response("challenge", { headers: { "content-type": "text/html" } });
				if (variant === "archive-size") return new Response("too large", { headers: { "content-type": "application/gzip", "content-length": String(33 * 1024 * 1024) } });
				if (variant === "stream-size") {
					return new Response(new ReadableStream({ start(controller) {
						controller.enqueue(new Uint8Array(32 * 1024 * 1024));
						controller.enqueue(new Uint8Array(1));
						controller.close();
					} }), { headers: { "content-type": "application/gzip" } });
				}
				if (variant === "invalid-gzip") return new Response("not gzip", { headers: { "content-type": "application/gzip" } });
				if (variant === "dedication") return new Response(await archive(commit, `${readme}\nChanged dedication.`), { headers: { "content-type": "application/gzip" } });
			}
			return state.fetchImpl(url, options);
		} }), /stopped for review/u);
		await assert.rejects(readFile(state.current), { code: "ENOENT" });
		assert.ok(JSON.parse(await readFile(state.hold, "utf8")).reason);
		const count = state.requests.length;
		await assert.rejects(collectOpenStatesProfiles(state.plan, state.options), /on hold/u);
		assert.equal(state.requests.length, count);
	});
}

test("corrupt or linked archive bodies fail locally rather than trigger a replacement request", async (context) => {
	const state = await fixture(context);
	await state.seed();
	const cachePath = join(state.plan.archiveCacheDirectory, "bodies", `${state.capture.sha256}.tar.gz`);
	await writeFile(cachePath, "corrupt");
	await assert.rejects(collectOpenStatesProfiles(state.plan, state.options), /fingerprint/u);
	await rm(cachePath);
	await symlink(state.capture.path, cachePath);
	await assert.rejects(collectOpenStatesProfiles(state.plan, state.options));
	assert.equal(state.requests.length, 0);
});

test("expired policy reviews, extra configuration and shared caches fail before collection", async (context) => {
	const state = await fixture(context);
	await assert.rejects(collectOpenStatesProfiles({ ...state.plan, accessReview: { ...state.plan.accessReview, reviewedAt: new Date(initialTime - 31 * day).toISOString() } }, state.options), /current explicit/u);
	await assert.rejects(collectOpenStatesProfiles({ ...state.plan, extra: true } as OpenStatesProfileCollectionPlan, state.options), /current explicit/u);
	await assert.rejects(collectOpenStatesProfiles({ ...state.plan, archiveCacheDirectory: state.plan.collection.cacheDirectory }, state.options), /separate caches/u);
	assert.equal(state.requests.length, 0);
});

test("an existing collector lock is not removed or treated as a stopped process", async (context) => {
	const state = await fixture(context);
	await state.seed();
	const path = join(state.plan.archiveCacheDirectory, ".collection.lock");
	await writeFile(path, "{\"ownerId\":\"other-collector\"}");
	await assert.rejects(collectOpenStatesProfiles(state.plan, state.options), /locked/u);
	assert.equal(await readFile(path, "utf8"), "{\"ownerId\":\"other-collector\"}");
	assert.equal(state.requests.length, 0);
});

for (const failedStep of ["archive", "content"]) {
	test(`transient ${failedStep} failures preserve the preceding accepted archive without an access hold`, async (context) => {
		const state = await fixture(context);
		await state.seed();
		const previous = await readFile(state.current, "utf8");
		state.advance(initialTime + day);
		const nextCommit = "2".repeat(40);
		await assert.rejects(collectOpenStatesProfiles(state.plan, { ...state.options, fetchImpl: async (url, options) => {
			if (url === openStatesProfilePublication.commitUrl) return commitResponse(nextCommit);
			if (url.includes("/tarball/")) return failedStep === "archive" ? new Response(null, { status: 503 }) : new Response(null, { status: 302, headers: { location: `https://codeload.github.com/openstates/people/legacy.tar.gz/${nextCommit}` } });
			if (url.includes("/legacy.tar.gz/")) return new Response(null, { status: 503 });
			return state.fetchImpl(url, options);
		} }), /temporarily unavailable/u);
		assert.equal(await readFile(state.current, "utf8"), previous);
		await assert.rejects(readFile(state.hold), { code: "ENOENT" });
	});
}

test("a not-modified response without a prior validator is held rather than inventing freshness", async (context) => {
	const state = await fixture(context);
	await state.seed();
	const previous = await readFile(state.current, "utf8");
	state.advance(initialTime + day);
	await assert.rejects(collectOpenStatesProfiles(state.plan, { ...state.options, fetchImpl: async (url, options) => url === openStatesProfilePublication.commitUrl ? new Response(null, { status: 304 }) : state.fetchImpl(url, options) }), /unexpected-not-modified/u);
	assert.equal(await readFile(state.current, "utf8"), previous);
});

test("partial member coverage is explicit and the CLI exits unsuccessfully without an active import", async (context) => {
	const state = await fixture(context, true);
	const result = await collectOpenStatesProfiles(state.plan, state.options);
	assert.equal(result.complete, false);
	assert.equal(result.collection.prepared.profiles, 2);
	assert.equal(result.prepared.profiles, 1);
	assert.equal(result.prepared.holdCount, 1);
	assert.equal(result.imported, false);
	const path = join(state.directory, "partial-plan.json");
	await writeFile(path, JSON.stringify(state.plan));
	const command = await runFixtureCommand(state.directory, path);
	assert.equal(command.status, 1, command.stderr);
	assert.equal(JSON.parse(command.stdout).complete, false);
	assert.equal(JSON.parse(command.stdout).publisherRequests, 0);
});

test("the management CLI uses reviewed caches without an active state-data directory", async (context) => {
	const state = await fixture(context);
	await state.seed();
	const path = join(state.directory, "collection-plan.json");
	await writeFile(path, JSON.stringify(state.plan));
	const result = await runFixtureCommand(state.directory, path);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(JSON.parse(result.stdout).publisherRequests, 0);
	assert.equal(JSON.parse(result.stdout).complete, true);
	assert.equal(JSON.parse(result.stdout).imported, false);
});
