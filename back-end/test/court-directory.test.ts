import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildAdminOperations } from "../src/admin-operations.js";
import { collectCourtDirectory } from "../src/collect-court-directory.js";
import { parseCourtDirectory, prepareCourtDirectory, validateCourtDirectorySnapshot, verifyCourtDirectoryPolicy, verifyCourtDirectoryProfile } from "../src/court-directories.js";
import { createCourtDirectoryRepository, importCourtDirectory, readCourtDirectoryEnvelope, withCourtDirectoryLock } from "../src/court-directory-storage.js";
import { courtDigest, courtFixture, courtTestTime } from "./helpers/court-directory.js";

test("court roster reconciles active cards, navigation, chief role and independent profile identities", () => {
	const fixture = courtFixture();
	const judges = parseCourtDirectory(fixture.body);
	assert.deepEqual(judges.map(judge => [judge.name, judge.role, judge.division]), [["Avery Future", "Chief Judge", "A"], ["Morgan Second", "Judge", "B"]]);
	for (const [index, judge] of judges.entries()) verifyCourtDirectoryProfile(fixture.profiles[index]!.body, judge);
	assert.equal("party" in judges[0]!, false);
	assert.equal("onCurrentBallot" in judges[0]!, false);
	assert.equal("portraitUrl" in judges[0]!, false);
	assert.equal(parseCourtDirectory(courtFixture("Taylor Successor").body)[0]!.name, "Taylor Successor");
});

test("extra staff, missing cards, duplicate judges, different roles and policy inventories require review", () => {
	const { body } = courtFixture();
	for (const changed of [
		body.replace("<h3>MORGAN SECOND</h3>", "<h3>Another Person</h3>"),
		body.replace("Chief Judge Avery Future", "Judge Avery Future"),
		body.replace("Division B | 2F", "Division A | 2F"),
		body.replace("<h1>The JUDGES</h1>", "<h1>Former Judges</h1>"),
		body.replace("</main>", "<h3>Another Person</h3></main>"),
		body.replace("Privacy Policy</a>", "Privacy Policy</a><a href='/new-terms/'>Terms</a>"),
		body.replaceAll("https://fultonstate.org/judge-morgan-second/", "https://example.org/judge-morgan-second/"),
		body.replaceAll("https://fultonstate.org/judge-morgan-second/", "https://fultonstate.org/judge-morgan-second/?token=private"),
		body.replace("id=\"primary-menu\"", "id=\"mobile-menu\"")
	]) assert.throws(() => parseCourtDirectory(changed));
	const fixture = courtFixture();
	assert.throws(() => verifyCourtDirectoryProfile(fixture.profiles[1]!.body, fixture.snapshot.judges[0]!));
	assert.throws(() => verifyCourtDirectoryProfile(fixture.profiles[0]!.body.replace("Division A", "Division C"), fixture.snapshot.judges[0]!));
	assert.throws(() => verifyCourtDirectoryPolicy("User-agent: *\nDisallow: /", 0));
	assert.throws(() => verifyCourtDirectoryPolicy("Changed terms", 2));
});

test("snapshot imports are facts-only, bounded and tied to exact source provenance", () => {
	validateCourtDirectorySnapshot(courtFixture().snapshot, courtTestTime);
	for (const mutate of [
		(value: ReturnType<typeof courtFixture>["snapshot"]) => { value.countyFips = "00000"; },
		(value: ReturnType<typeof courtFixture>["snapshot"]) => { value.judges[0]!.profileUrl += "?private=value"; },
		(value: ReturnType<typeof courtFixture>["snapshot"]) => { Object.assign(value.judges[0]!, { party: "inferred" }); },
		(value: ReturnType<typeof courtFixture>["snapshot"]) => { value.documents[1]!.capturedAt = "2030-01-01T00:00:00.000Z"; },
		(value: ReturnType<typeof courtFixture>["snapshot"]) => { value.documents.pop(); },
		(value: ReturnType<typeof courtFixture>["snapshot"]) => { value.sourceSha256 = "0".repeat(64); }
	]) {
		const { snapshot } = courtFixture();
		mutate(snapshot);
		assert.throws(() => validateCourtDirectorySnapshot(snapshot, courtTestTime));
	}
	assert.throws(() => prepareCourtDirectory({ schemaVersion: 1, type: "court-directory-capture", documents: [] }));
});

test("court imports replace records without restart and preserve exact predecessor bytes and unrelated files", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-court-"));
	try {
		await writeFile(join(directory, "unrelated.json"), "preserved");
		await importCourtDirectory(directory, courtFixture().snapshot, courtTestTime);
		const repository = createCourtDirectoryRepository(directory)!;
		const first = await readFile(join(directory, "ga-fulton-state-court.json"));
		assert.equal((await repository.getSnapshot()).judges[0]!.name, "Avery Future");
		await importCourtDirectory(directory, courtFixture("Taylor Successor", courtTestTime + 1000).snapshot, courtTestTime + 1000);
		assert.equal((await repository.getSnapshot()).judges[0]!.name, "Taylor Successor");
		assert.deepEqual(await readFile(join(directory, "ga-fulton-state-court.previous.json")), first);
		assert.equal(await readFile(join(directory, "unrelated.json"), "utf8"), "preserved");
		assert.equal((await stat(join(directory, "ga-fulton-state-court.json"))).mode & 0o777, 0o600);
		await assert.rejects(importCourtDirectory(directory, courtFixture().snapshot, courtTestTime + 2000), /Older court evidence/u);
		const operations = await buildAdminOperations({ courts: repository, candidates: null, references: null, dataDirectory: null });
		assert.equal(operations.datasets.find(source => source.id === "ga-fulton-state-court")?.records, 2);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("a court source failure preserves data and success clocks, bounds retry and records an operations exception", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-court-failure-"));
	try {
		await importCourtDirectory(directory, courtFixture().snapshot, courtTestTime);
		const before = await readFile(join(directory, "ga-fulton-state-court.json"));
		let requests = 0;
		const options = { directory, now: () => courtTestTime + 7 * 3600000, request: async () => {
			requests++;
			return "Changed publisher policy";
		} };
		await assert.rejects(collectCourtDirectory(options), /policy requires review/u);
		await assert.rejects(collectCourtDirectory(options), /next permitted retry/u);
		assert.equal(requests, 1);
		assert.deepEqual(await readFile(join(directory, "ga-fulton-state-court.json")), before);
		const run = JSON.parse(await readFile(join(directory, "court-automation/automation-run.json"), "utf8"));
		assert.equal(run.lastSuccessAt, null);
		assert.equal(run.lastImportAt, new Date(courtTestTime).toISOString());
		assert.equal((await createCourtDirectoryRepository(directory)!.inspectSources())[0]!.status, "error");
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("warm court imports and competing collectors make no publisher requests", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-court-lock-"));
	try {
		await importCourtDirectory(directory, courtFixture().snapshot, courtTestTime);
		let requests = 0;
		assert.equal((await collectCourtDirectory({ directory, now: () => courtTestTime + 1000, request: async () => {
			requests++;
			throw new Error("No request expected");
		} })).collected, false);
		assert.equal(requests, 0);
		await withCourtDirectoryLock(directory, async () => {
			await assert.rejects(collectCourtDirectory({ directory }), /EEXIST/u);
		});
		assert.equal((await readCourtDirectoryEnvelope(directory, courtTestTime)).envelope.acquisition, "imported");
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("court snapshot symlinks, changed configuration and invalid per-document clocks stay unavailable", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-court-invalid-"));
	try {
		await importCourtDirectory(directory, courtFixture().snapshot, courtTestTime);
		const filename = join(directory, "ga-fulton-state-court.json");
		const original = await readFile(filename, "utf8");
		await rm(filename);
		await writeFile(join(directory, "redirect.json"), original);
		await symlink(join(directory, "redirect.json"), filename);
		await assert.rejects(createCourtDirectoryRepository(directory)!.getSnapshot(), /temporarily unavailable/u);
		await rm(filename);
		const changed = JSON.parse(original);
		changed.sourceConfigurationSha256 = "0".repeat(64);
		await writeFile(filename, JSON.stringify(changed));
		await assert.rejects(readCourtDirectoryEnvelope(directory, courtTestTime));
		const snapshot = courtFixture().snapshot;
		snapshot.documents[5]!.capturedAt = new Date(courtTestTime + 1000).toISOString();
		snapshot.sourceSha256 = courtDigest(JSON.stringify(snapshot.documents));
		await rm(filename);
		await assert.rejects(importCourtDirectory(directory, snapshot, courtTestTime), /provenance is invalid/u);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
