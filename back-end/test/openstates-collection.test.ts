import type { OpenStatesCollectionPlan } from "../src/openstates-collection.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { openStatesBulkPublication, openStatesBulkSources } from "../src/openstates-bulk.js";
import { collectOpenStates, openStatesPolicyFingerprint, seedOpenStatesCollection } from "../src/openstates-collection.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const source = openStatesBulkSources.find(item => item.stateCode === "GA")!;
const official = configuredStateBallotSources.find(item => item.id === "ga-fulton-2026")!;
const initialTime = Date.parse("2026-10-22T12:00:00.000Z");
const day = 86_400_000;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const body = "id,name,current_chamber,current_district,email\nocd-person/00000000-0000-0000-0000-000000000001,Alex Rivera,upper,12,private@example.test\n";
const policy = "<header>Changing header</header><section><h1>Terms of Service</h1><h2>Attribution</h2><p>We make no copyright claim.</p><a href='/license'>Data terms</a></section><section><h1>Privacy Policy</h1><p>Public policy.</p></section><script>changing()</script>";
const policyResponse = () => new Response(policy, { headers: { "content-type": "text/html" } });
const csvResponse = (text = body) => new Response(text, { headers: { "content-type": "text/csv", "etag": "\"edition-two\"" } });
async function noSleep() {}

async function fixture(context: { after: (callback: () => Promise<void>) => void }) {
	const directory = await mkdtemp(join(tmpdir(), "openstates-collector-test-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	let clock = initialTime;
	const now = () => clock;
	const documents = official.documentUrls!.map((url, index) => ({ url, retrievedAt: new Date(clock).toISOString(), sha256: hash(url), includedRecordCount: index === 0 ? 1 : 0 }));
	const candidateFile = join(directory, "candidates.json");
	await writeFile(candidateFile, serializeStoredStateSnapshot({ source: official, retrievedAt: new Date(clock).toISOString(), sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), documents, records: [{ id: "a".repeat(24), name: "Alex Rivera", office: "State Senator", scope: "state-senate", district: "12", status: "listed" }] }));
	const plan: OpenStatesCollectionPlan = { schemaVersion: 1, type: "openstates-collection", sourceIds: [source.id], cacheDirectory: join(directory, "cache"), outputRoot: join(directory, "runs"), candidateFiles: [candidateFile], allowedCandidateSourceIds: [official.id], accessReview: { reviewedAt: new Date(clock).toISOString(), termsTextSha256: openStatesPolicyFingerprint(policy) } };
	const seed = (policyTime = initialTime, validators: { etag?: string; lastModified?: string } = { etag: "\"edition-one\"" }) => seedOpenStatesCollection(plan, { policy: { body: policy, capturedAt: new Date(policyTime).toISOString() }, downloads: [{ sourceId: source.id, body, capturedAt: new Date(initialTime).toISOString(), ...validators }] }, clock);
	return { directory, plan, now, seed, advance: (time: number) => {
		clock = time;
	}, cacheFile: join(plan.cacheDirectory, `${source.id}.json`) };
}

test("policy fingerprints monitor the reviewed sections and links, not decorative scripts or headers", () => {
	assert.equal(openStatesPolicyFingerprint(policy), openStatesPolicyFingerprint(policy.replace("Changing header", "Other header").replace("changing()", "different()")));
	assert.notEqual(openStatesPolicyFingerprint(policy), openStatesPolicyFingerprint(policy.replace("/license", "/other-license")));
	assert.notEqual(openStatesPolicyFingerprint(policy), openStatesPolicyFingerprint(policy.replace("Public policy.", "Changed policy.")));
	assert.throws(() => openStatesPolicyFingerprint("<h1>Challenge</h1>"), /unavailable/u);
});

test("reviewed fresh captures produce repeatable external preparation without requests or imports", async (context) => {
	const setup = await fixture(context);
	await setup.seed();
	let requests = 0;
	const options = { now: setup.now, sleep: noSleep, fetchImpl: async () => {
		requests++;
		throw new Error("Unexpected publisher request");
	} };
	const first = await collectOpenStates(setup.plan, options);
	const second = await collectOpenStates(setup.plan, options);
	assert.equal(requests, 0);
	assert.equal(first.prepared.profiles, 1);
	assert.equal(first.imported, false);
	assert.notEqual(first.outputDirectory, second.outputDirectory);
	assert.equal(first.observations[0]!.status, "cache");
	const snapshot = JSON.parse(await readFile(join(first.outputDirectory, "election-references-openstates-ga-2026.json"), "utf8"));
	assert.equal(snapshot.documents[0].capturedAt, new Date(initialTime).toISOString());
	assert.doesNotMatch(JSON.stringify(snapshot), /private@|email/u);
	assert.ok(!(await readdir(setup.plan.cacheDirectory)).includes(".collection.lock"));
});

test("daily successful refreshes use exact URLs, bounded anonymous requests and new capture provenance", async (context) => {
	const setup = await fixture(context);
	await setup.seed();
	setup.advance(initialTime + day);
	const calls: { url: string; options: RequestInit }[] = [];
	const delays: number[] = [];
	const result = await collectOpenStates(setup.plan, { now: setup.now, sleep: async (delay) => {
		delays.push(delay);
	}, fetchImpl: async (url, options) => {
		calls.push({ url, options });
		return url === openStatesBulkPublication.termsUrl ? policyResponse() : csvResponse(`${body}\n`);
	} });
	assert.deepEqual(calls.map(call => call.url), [openStatesBulkPublication.termsUrl, source.documents[0]!.url]);
	assert.deepEqual(delays, [1000, 1000]);
	assert.ok(calls.every(call => call.options.redirect === "manual" && call.options.credentials === "omit" && call.options.signal instanceof AbortSignal));
	assert.equal(new Headers(calls[1]!.options.headers).get("If-None-Match"), "\"edition-one\"");
	assert.equal(result.publisherRequests, 2);
	assert.equal(result.observations[0]!.capturedAt, new Date(initialTime + day).toISOString());
	assert.equal(result.observations[0]!.sha256, hash(`${body}\n`));
	assert.equal((await readdir(join(setup.plan.cacheDirectory, "bodies"))).filter(name => name.endsWith(".csv")).length, 2);
});

test("304 revalidation preserves original bytes and capture date while advancing only the check date", async (context) => {
	const setup = await fixture(context);
	await setup.seed();
	setup.advance(initialTime + day);
	const result = await collectOpenStates(setup.plan, { now: setup.now, sleep: noSleep, fetchImpl: async url => url === openStatesBulkPublication.termsUrl ? policyResponse() : new Response(null, { status: 304 }) });
	assert.equal(result.observations[0]!.status, 304);
	assert.equal(result.observations[0]!.capturedAt, new Date(initialTime).toISOString());
	assert.equal(result.observations[0]!.checkedAt, new Date(initialTime + day).toISOString());
	assert.equal(result.observations[0]!.sha256, hash(body));
	assert.equal((await collectOpenStates(setup.plan, { now: setup.now, fetchImpl: async () => {
		throw new Error("Unnecessary request");
	} })).publisherRequests, 0);
});

test("valid last-modified validators are used when no ETag is available", async (context) => {
	const setup = await fixture(context);
	await setup.seed(initialTime, { lastModified: "Thu, 22 Oct 2026 08:00:00 GMT" });
	setup.advance(initialTime + day);
	await collectOpenStates(setup.plan, { now: setup.now, sleep: noSleep, fetchImpl: async (url, options) => {
		if (url === openStatesBulkPublication.termsUrl) return policyResponse();
		assert.equal(new Headers(options.headers).get("If-Modified-Since"), "Thu, 22 Oct 2026 08:00:00 GMT");
		return new Response(null, { status: 304 });
	} });
});

for (const status of [301, 302, 401, 403, 429]) {
	test(`HTTP ${status} creates a persistent publisher hold without retrying or following redirects`, async (context) => {
		const setup = await fixture(context);
		setup.advance(initialTime + day);
		await setup.seed(initialTime + day);
		const before = await readFile(setup.cacheFile, "utf8");
		let calls = 0;
		let cancellationErrors = 0;
		const options = { now: setup.now, sleep: noSleep, fetchImpl: async () => {
			calls++;
			const responseBody = status === 403
				? new ReadableStream({ cancel() {
						cancellationErrors++;
						throw new Error("Synthetic cancellation failure");
					} })
				: "Denied";
			return new Response(responseBody, { status, headers: { location: "https://example.test/alternate" } });
		} };
		await assert.rejects(collectOpenStates(setup.plan, options), /stopped for review/u);
		assert.equal(await readFile(setup.cacheFile, "utf8"), before);
		await assert.rejects(collectOpenStates(setup.plan, options), /access is on hold/u);
		assert.equal(calls, 1);
		assert.equal(cancellationErrors, status === 403 ? 1 : 0);
		assert.deepEqual(await readdir(setup.plan.outputRoot), []);
	});
}

test("policy changes stop collection before any CSV request or cache replacement", async (context) => {
	const setup = await fixture(context);
	await setup.seed();
	setup.advance(initialTime + day);
	const before = await readFile(setup.cacheFile, "utf8");
	const urls: string[] = [];
	await assert.rejects(collectOpenStates(setup.plan, { now: setup.now, sleep: noSleep, fetchImpl: async (url) => {
		urls.push(url);
		return new Response(policy.replace("Public policy.", "Revised terms."), { headers: { "content-type": "text/html" } });
	} }), /policy-changed/u);
	assert.deepEqual(urls, [openStatesBulkPublication.termsUrl]);
	assert.equal(await readFile(setup.cacheFile, "utf8"), before);
});

test("missing sources and transient errors retain cached bytes and enforce a daily attempt cooldown", async (context) => {
	const setup = await fixture(context);
	setup.advance(initialTime + day);
	await setup.seed(initialTime + day);
	const before = await readFile(setup.cacheFile, "utf8");
	let calls = 0;
	const options = { now: setup.now, sleep: noSleep, fetchImpl: async () => {
		calls++;
		return new Response("Not available", { status: 404 });
	} };
	await assert.rejects(collectOpenStates(setup.plan, options), /No Open States source is available/u);
	await assert.rejects(collectOpenStates(setup.plan, options), /No Open States source is available/u);
	assert.equal(calls, 1);
	assert.equal(await readFile(setup.cacheFile, "utf8"), before);
	assert.ok(!(await readdir(setup.plan.cacheDirectory)).includes("hold.json"));
});

test("server and transport failures preserve accepted captures and their daily cooldown", async (context) => {
	for (const failure of ["server", "transport", "timeout"]) {
		const setup = await fixture(context);
		setup.advance(initialTime + day);
		await setup.seed(initialTime + day);
		const before = await readFile(setup.cacheFile, "utf8");
		let calls = 0;
		const options = { now: setup.now, sleep: noSleep, fetchImpl: async () => {
			calls++;
			if (failure === "transport") throw new Error("Synthetic connection failure");
			if (failure === "timeout") throw new DOMException("Synthetic deadline failure", "TimeoutError");
			return new Response("Unavailable", { status: 503 });
		} };
		await assert.rejects(collectOpenStates(setup.plan, options), /No Open States source is available/u);
		await assert.rejects(collectOpenStates(setup.plan, options), /No Open States source is available/u);
		assert.equal(calls, 1);
		assert.equal(await readFile(setup.cacheFile, "utf8"), before);
	}
});

test("one temporarily missing state does not suppress other validated state preparations", async (context) => {
	const setup = await fixture(context);
	setup.advance(initialTime + day);
	const other = openStatesBulkSources.find(item => item.stateCode === "CA")!;
	setup.plan.sourceIds.push(other.id);
	await seedOpenStatesCollection(setup.plan, { policy: { body: policy, capturedAt: new Date(initialTime + day).toISOString() }, downloads: [source, other].map(item => ({ sourceId: item.id, body, capturedAt: new Date(initialTime).toISOString() })) }, setup.now());
	const before = await readFile(join(setup.plan.cacheDirectory, `${other.id}.json`), "utf8");
	const result = await collectOpenStates(setup.plan, { now: setup.now, sleep: noSleep, fetchImpl: async url => url === source.documents[0]!.url ? csvResponse() : new Response("Not available", { status: 404 }) });
	assert.equal(result.complete, false);
	assert.equal(result.prepared.profiles, 1);
	assert.equal(result.observations.find(item => item.sourceId === other.id)!.status, "unavailable");
	assert.equal(result.observations.find(item => item.sourceId === other.id)!.httpStatus, 404);
	assert.equal(await readFile(join(setup.plan.cacheDirectory, `${other.id}.json`), "utf8"), before);
	assert.ok(!(await readdir(result.outputDirectory)).some(name => name.includes("-ca-")));
});

for (const kind of ["html", "invalid-csv", "oversized"]) {
	test(`${kind} responses cannot replace a validated CSV capture`, async (context) => {
		const setup = await fixture(context);
		setup.advance(initialTime + day);
		await setup.seed(initialTime + day);
		const before = await readFile(setup.cacheFile, "utf8");
		const response = kind === "html" ? new Response("<h1>Challenge</h1>", { headers: { "content-type": "text/html" } }) : kind === "invalid-csv" ? csvResponse("name\nUnknown\n") : new Response("ignored", { headers: { "content-type": "text/csv", "content-length": String(openStatesBulkPublication.maximumBytes + 1) } });
		await assert.rejects(collectOpenStates(setup.plan, { now: setup.now, sleep: noSleep, fetchImpl: async () => response }), /stopped for review/u);
		assert.equal(await readFile(setup.cacheFile, "utf8"), before);
	});
}

test("304 without a previously validated conditional representation is held", async (context) => {
	const setup = await fixture(context);
	await assert.rejects(collectOpenStates(setup.plan, { now: setup.now, sleep: noSleep, fetchImpl: async url => url === openStatesBulkPublication.termsUrl ? policyResponse() : new Response(null, { status: 304 }) }), /unexpected-not-modified/u);
});

test("tampered content fails closed before network use", async (context) => {
	const setup = await fixture(context);
	await setup.seed();
	await writeFile(join(setup.plan.cacheDirectory, "bodies", `${hash(body)}.csv`), body.replace("Alex", "Changed"));
	await assert.rejects(collectOpenStates(setup.plan, { now: setup.now, fetchImpl: async () => {
		throw new Error("Unexpected request");
	} }), /fingerprint/u);
});

test("concurrent collectors and repeated seeds never overwrite an existing owner or cache", async (context) => {
	const setup = await fixture(context);
	await setup.seed();
	await assert.rejects(setup.seed(), /never overwrite/u);
	const lock = join(setup.plan.cacheDirectory, ".collection.lock");
	await writeFile(lock, "owned by another run");
	await assert.rejects(collectOpenStates(setup.plan, { now: setup.now }), /cache is locked/u);
	assert.equal(await readFile(lock, "utf8"), "owned by another run");
	await rm(lock);
	setup.advance(initialTime + day);
	await assert.rejects(collectOpenStates(setup.plan, { now: setup.now, sleep: noSleep, fetchImpl: async (url) => {
		await writeFile(lock, JSON.stringify({ ownerId: "replacement-owner" }));
		return url === openStatesBulkPublication.termsUrl ? policyResponse() : csvResponse();
	} }), /ownership changed/u);
	assert.equal(JSON.parse(await readFile(lock, "utf8")).ownerId, "replacement-owner");
});

test("expired access reviews, elections and unreviewed candidate sources stop before requests", async (context) => {
	const setup = await fixture(context);
	for (const plan of [{ ...setup.plan, sourceIds: ["https://example.test/data.csv"] }, { ...setup.plan, allowedCandidateSourceIds: [] }, { ...setup.plan, sourceIds: [source.id, source.id] }, { ...setup.plan, accessReview: { ...setup.plan.accessReview, reviewedAt: "2026-09-01T00:00:00Z" } }, { ...setup.plan, cacheDirectory: fileURLToPath(new URL("../../", import.meta.url)) }]) {
		await assert.rejects(collectOpenStates(plan, { now: setup.now, fetchImpl: async () => {
			throw new Error("Unexpected request");
		} }));
	}
	setup.advance(Date.parse("2026-11-06T00:00:00Z"));
	await assert.rejects(collectOpenStates(setup.plan, { now: setup.now }), /expired/u);
});

test("linked content storage cannot place downloaded data inside the application", async (context) => {
	const setup = await fixture(context);
	await setup.seed();
	await rm(join(setup.plan.cacheDirectory, "bodies"), { recursive: true });
	await symlink(fileURLToPath(new URL("../../", import.meta.url)), join(setup.plan.cacheDirectory, "bodies"));
	await assert.rejects(collectOpenStates(setup.plan, { now: setup.now }), /linked directory/u);
});

test("the source management CLI can collect from a reviewed fresh cache without runtime data configuration", async (context) => {
	const setup = await fixture(context);
	await setup.seed();
	const path = join(setup.directory, "plan.json");
	await writeFile(path, JSON.stringify(setup.plan));
	const clockPath = join(setup.directory, "clock.mjs");
	await writeFile(clockPath, `Date.now = () => ${initialTime};\n`);
	const script = fileURLToPath(new URL("../src/manage-election-references.ts", import.meta.url));
	const command = ["--import", clockPath, "--import", import.meta.resolve("tsx"), script, "collect-openstates", path];
	const result = spawnSync(process.execPath, command, { env: { HOME: process.env.HOME, PATH: process.env.PATH }, encoding: "utf8" });
	assert.equal(result.status, 0, result.stderr);
	assert.equal(JSON.parse(result.stdout).publisherRequests, 0);
	assert.equal(JSON.parse(result.stdout).prepared.profiles, 1);
	assert.equal(JSON.parse(result.stdout).imported, false);
	const snapshot = await readFile(setup.plan.candidateFiles[0]!, "utf8");
	await writeFile(setup.plan.candidateFiles[0]!, JSON.stringify({ snapshot, sourceConfigurationSha256: hash(JSON.stringify(official)) }));
	const stored = spawnSync(process.execPath, command, { env: { HOME: process.env.HOME, PATH: process.env.PATH }, encoding: "utf8" });
	assert.equal(stored.status, 0, stored.stderr);
	assert.equal(JSON.parse(stored.stdout).prepared.profiles, 1);
	await writeFile(setup.plan.candidateFiles[0]!, JSON.stringify({ snapshot, sourceConfigurationSha256: "0".repeat(64) }));
	const tampered = spawnSync(process.execPath, command, { env: { HOME: process.env.HOME, PATH: process.env.PATH }, encoding: "utf8" });
	assert.notEqual(tampered.status, 0);
	assert.match(tampered.stderr, /source fingerprint/u);
});
