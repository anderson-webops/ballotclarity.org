import type { ElectionReferenceSnapshot } from "../src/election-references.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { pack } from "tar-stream";
import { buildElectionReferencePage, createElectionReferenceStorage, electionReferenceDocumentDigest, parseElectionReferenceSnapshot } from "../src/election-references.js";
import { openStatesBulkSources } from "../src/openstates-bulk.js";
import { enrichOpenStatesProfiles, openStatesProfileArchiveLimits } from "../src/openstates-profile-enrichment.js";
import { openStatesProfilePolicySha256 } from "../src/openstates-profile-evidence.js";
import { prepareOpenStatesProfileFiles } from "../src/prepare-openstates-profiles.js";

const source = openStatesBulkSources.find(item => item.stateCode === "GA")!;
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const uuid = "00000000-0000-4000-8000-000000000001";
const personId = `ocd-person/${uuid}`;
const commit = "1".repeat(40);
const capturedAt = "2026-10-22T12:00:00.000Z";
const now = Date.parse(capturedAt);
const prefix = `openstates-people-${commit.slice(0, 7)}`;
const memberPath = `data/ga/legislature/Alex-Rivera-${uuid}.yml`;
const biography = `id: ${personId}\nname: Alex Rivera\nroles:\n  - type: upper\n    district: '12'\n    jurisdiction: ocd-jurisdiction/country:us/state:ga/government\n    start_date: 2021-01-01\nextras:\n  occupation: Attorney\n  education: Example College\n  prison: Ignore this field\nbiography: Unreviewed prose\nemail: private@example.test\n`;

function baseline(): ElectionReferenceSnapshot {
	const documents = [{ url: source.documents[0]!.url, sha256: hash("csv"), capturedAt, includedRecordCount: 1 }];
	return { schemaVersion: 1, type: "election-references", stateCode: "GA", sourceId: source.id, electionDate: source.electionDate, retrievedAt: capturedAt, sourceSha256: electionReferenceDocumentDigest(documents), recordCount: 1, documents, records: [{ id: hash(`${source.id}/${personId}`).slice(0, 24), name: "Alex Rivera", office: "State Senator", scope: "state-senate", jurisdiction: "District 12", facts: ["Listed by Open States as a serving state legislator for District 12."], sourceDocumentIndex: 0 }] };
}

async function archive(options: { body?: string; path?: string; license?: string; extra?: { name: string; body?: string; type?: "file" | "symlink"; linkname?: string }[] } = {}) {
	const stream = pack();
	stream.entry({ name: `${prefix}/README.md` }, options.license ?? "CC0, all copyright waived");
	stream.entry({ name: options.path ?? `${prefix}/${memberPath}` }, options.body ?? biography);
	for (const member of options.extra ?? []) stream.entry({ name: member.name, ...(member.type ? { type: member.type } : {}), ...(member.linkname ? { linkname: member.linkname } : {}) }, member.body ?? "");
	stream.finalize();
	const chunks = [];
	for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
	return gzipSync(Buffer.concat(chunks));
}

async function prepare(options: Parameters<typeof archive>[0] = {}) {
	const body = await archive(options);
	return enrichOpenStatesProfiles(body, { commit, capturedAt, sha256: hash(body) }, [{ source, snapshot: baseline() }], now);
}

test("enrichment preserves profile IDs and adds narrowly attributed role and professional facts", async () => {
	const output = await prepare();
	assert.equal(output.snapshots.length, 1);
	assert.equal(output.roleStartDates, 1);
	assert.equal(output.professionalFacts, 2);
	const snapshot = output.snapshots[0]!.snapshot;
	assert.equal(snapshot.recordCount, 1);
	assert.equal(snapshot.records[0]!.id, baseline().records[0]!.id);
	assert.deepEqual(snapshot.records[0]!.facts, [baseline().records[0]!.facts[0], "Recorded role start: January 1, 2021.", "Listed occupation: Attorney", "Listed education: Example College"]);
	assert.equal(snapshot.documents.length, 2);
	assert.equal(snapshot.documents[0]!.includedRecordCount, 0);
	assert.equal(snapshot.documents[1]!.sha256, hash(biography));
	assert.equal(snapshot.documents[1]!.member!.policySha256, openStatesProfilePolicySha256);
	assert.ok(!JSON.stringify(snapshot).includes("private@example.test"));
	assert.ok(!JSON.stringify(snapshot).includes("Unreviewed prose"));
	assert.ok(!JSON.stringify(snapshot).includes("Ignore this field"));
});

test("public API citations point to the immutable person member rather than the unrelated CSV", async () => {
	const snapshot = (await prepare()).snapshots[0]!.snapshot;
	const page = buildElectionReferencePage(source, snapshot, { search: "", scope: "all", offset: 0, limit: 100 });
	assert.equal(page.records[0]!.source.pageUrl, `https://github.com/openstates/people/blob/${commit}/${memberPath}`);
	assert.equal(page.records[0]!.source.url, `https://raw.githubusercontent.com/openstates/people/${commit}/${memberPath}`);
	assert.equal(page.records[0]!.source.capturedAt, capturedAt);
	assert.equal(page.records[0]!.source.kind, "public-dataset");
	assert.equal(page.records[0]!.source.collectionId, source.id);
});

test("existing source fingerprints and CSV-only cache envelopes remain valid", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "openstates-profile-cache-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const storage = createElectionReferenceStorage(directory);
	const original = baseline();
	await storage.write(source, original);
	const before = JSON.parse(await readFile(join(directory, `references-${source.id}.json`), "utf8"));
	assert.equal(before.sourceConfigurationSha256, hash(JSON.stringify(source)));
	assert.deepEqual(await storage.read(source, now), original);
	const enriched = (await prepare()).snapshots[0]!.snapshot;
	await storage.write(source, enriched);
	assert.deepEqual(await storage.read(source, now), enriched);
	await storage.write(source, original);
	assert.deepEqual(await storage.read(source, now), original);
});

test("future end dates remain current but past role labels never become facts", async () => {
	const body = biography.replace("    start_date: 2021-01-01", "    start_date: 2021-01-01\n    end_date: 2027-01-01\n  - type: upper\n    district: '12'\n    jurisdiction: ocd-jurisdiction/country:us/state:ga/government\n    start_date: 2010-01-01\n    end_date: 2020-01-01");
	const output = await prepare({ body });
	assert.equal(output.snapshots[0]!.snapshot.recordCount, 1);
	assert.ok(!JSON.stringify(output.snapshots[0]!.snapshot.records).includes("2010"));
	assert.equal(output.holds.filter(hold => hold.field === "historicalRole").length, 1);
});

test("missing dates and empty professional fields stay unknown", async () => {
	const output = await prepare({ body: biography.replace("    start_date: 2021-01-01\n", "").replace("occupation: Attorney", "occupation: null") });
	assert.equal(output.roleStartDates, 0);
	assert.equal(output.professionalFacts, 1);
	assert.equal(output.holds.length, 2);
	assert.equal(output.snapshots[0]!.snapshot.records[0]!.facts.length, 2);
});

test("unreviewed keys cannot exploit inherited object properties or imply new credentials", async () => {
	const output = await prepare({ body: biography.replace("education: Example College", "education: Roy High School\n  constructor: Not a profession\n  __proto__: Not a profession") });
	const facts = output.snapshots[0]!.snapshot.records[0]!.facts;
	assert.ok(facts.includes("Listed education: Roy High School"));
	assert.ok(!facts.some(fact => fact.includes("Not a profession")));
});

test("ambiguous, mismatched and ended identities fail closed rather than retaining a misleading profile", async () => {
	for (const body of [biography.replace("Alex Rivera", "Alex Rivéra"), biography.replace("district: '12'", "district: '120'"), biography.replace("type: upper", "type: lower"), biography.replace("state:ga", "state:al"), biography.replace("2021-01-01", "2027-01-01"), biography.replace("2021-01-01", "2025-02-29"), biography.replace("    start_date: 2021-01-01", "    start_date: 2021-01-01\n    end_date: 2026-10-22")]) {
		await assert.rejects(prepare({ body }), /No valid profile members/u);
	}
});

test("reusing an unchanged archive does not keep a role current after its end date", async () => {
	const body = await archive({ body: biography.replace("    start_date: 2021-01-01", "    start_date: 2021-01-01\n    end_date: 2026-10-23") });
	const capture = { commit, capturedAt, sha256: hash(body) };
	assert.equal((await enrichOpenStatesProfiles(body, capture, [{ source, snapshot: baseline() }], now)).snapshots[0]!.snapshot.recordCount, 1);
	await assert.rejects(enrichOpenStatesProfiles(body, capture, [{ source, snapshot: baseline() }], now + 86_400_000), /No valid profile members/u);
});

test("YAML duplicate keys, aliases and unsupported tags do not become facts", async () => {
	for (const body of [`${biography}name: Someone Else\n`, biography.replace("name: Alex Rivera", "name: &name Alex Rivera\nother_name: *name"), biography.replace("name: Alex Rivera", "name: !custom Alex Rivera")]) {
		await assert.rejects(prepare({ body }), /No valid profile members/u);
	}
});

test("invalid archive identity, checksum, freshness and compressed bounds fail closed", async () => {
	const body = await archive();
	for (const capture of [{ commit: "bad", sha256: hash(body), capturedAt }, { commit, sha256: "0".repeat(64), capturedAt }, { commit, sha256: hash(body), capturedAt: "2027-01-01T00:00:00.000Z" }]) {
		await assert.rejects(enrichOpenStatesProfiles(body, capture, [{ source, snapshot: baseline() }], now));
	}
	await assert.rejects(enrichOpenStatesProfiles(Buffer.alloc(openStatesProfileArchiveLimits.compressedBytes + 1), { commit, capturedAt, sha256: "0".repeat(64) }, [{ source, snapshot: baseline() }], now));
});

test("missing license, traversal, links and duplicate members never produce output", async () => {
	for (const options of [{ license: "No dedication" }, { path: `${prefix}/../escape.yml` }, { extra: [{ name: `${prefix}/linked`, type: "symlink" as const, linkname: "/tmp/elsewhere" }] }, { extra: [{ name: `${prefix}/${memberPath}`, body: biography }] }, { body: "a".repeat(openStatesProfileArchiveLimits.selectedMemberBytes + 1) }]) {
		await assert.rejects(prepare(options));
	}
});

test("truncated compressed input is not accepted as a complete archive", async () => {
	const complete = await archive();
	const body = complete.subarray(0, complete.length - 10);
	await assert.rejects(enrichOpenStatesProfiles(body, { commit, capturedAt, sha256: hash(body) }, [{ source, snapshot: baseline() }], now));
});

test("partial archives exclude conflicted profiles and report their holds explicitly", async () => {
	const input = baseline();
	input.records.push({ ...input.records[0]!, id: "e".repeat(24), name: "Missing Person" });
	input.recordCount = 2;
	input.documents[0]!.includedRecordCount = 2;
	const body = await archive();
	const result = await enrichOpenStatesProfiles(body, { commit, capturedAt, sha256: hash(body) }, [{ source, snapshot: input }], now);
	assert.equal(result.excludedProfiles, 1);
	assert.equal(result.snapshots[0]!.snapshot.recordCount, 1);
	assert.equal(result.holds[0]!.reason, "profile-member-not-found");
});

test("member policy, state, UUID, public URL and contribution tampering is rejected", async () => {
	const snapshot = (await prepare()).snapshots[0]!.snapshot;
	for (const modify of [
		(copy: ElectionReferenceSnapshot) => { copy.documents[1]!.member!.policySha256 = "0".repeat(64); },
		(copy: ElectionReferenceSnapshot) => { copy.documents[1]!.member!.memberPath = memberPath.replace("data/ga", "data/al"); },
		(copy: ElectionReferenceSnapshot) => { copy.documents[1]!.url = "https://example.test/evil"; },
		(copy: ElectionReferenceSnapshot) => { copy.documents[1]!.includedRecordCount = 0; },
		(copy: ElectionReferenceSnapshot) => { copy.records[0]!.id = "f".repeat(24); },
	]) {
		const copy = structuredClone(snapshot);
		modify(copy);
		copy.sourceSha256 = electionReferenceDocumentDigest(copy.documents);
		assert.throws(() => parseElectionReferenceSnapshot(source, JSON.stringify(copy), now));
	}
	const altered = structuredClone(snapshot);
	altered.documents[1]!.member!.archiveSha256 = "0".repeat(64);
	assert.throws(() => parseElectionReferenceSnapshot(source, JSON.stringify(altered), now), /capture provenance/u);
});

test("other collections cannot add arbitrary document URLs and enriched input is not silently enriched again", async () => {
	const snapshot = (await prepare()).snapshots[0]!.snapshot;
	const otherSource = { ...source, id: "different-source" };
	assert.throws(() => parseElectionReferenceSnapshot(otherSource, JSON.stringify({ ...snapshot, sourceId: otherSource.id }), now));
	const body = await archive();
	await assert.rejects(enrichOpenStatesProfiles(body, { commit, capturedAt, sha256: hash(body) }, [{ source, snapshot }], now), /CSV-only/u);
});

test("duplicate states or mixed elections cannot share one enrichment run", async () => {
	const body = await archive();
	const first = { source, snapshot: baseline() };
	await assert.rejects(enrichOpenStatesProfiles(body, { commit, capturedAt, sha256: hash(body) }, [first, first], now));
	const futureSource = { ...source, id: "openstates-ga-service-2028", electionDate: "2028-11-07" };
	await assert.rejects(enrichOpenStatesProfiles(body, { commit, capturedAt, sha256: hash(body) }, [first, { source: futureSource, snapshot: baseline() }], now));
});

test("source CLI accepts reviewed external preparation without importing or downloading", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "openstates-profile-cli-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const body = await archive();
	const file = join(directory, "reference.json");
	await writeFile(file, JSON.stringify({ sourceConfigurationSha256: hash(JSON.stringify(source)), snapshot: JSON.stringify(baseline()) }));
	const archivePath = join(directory, "people.tar.gz");
	await writeFile(archivePath, body);
	const planPath = join(directory, "plan.json");
	const outputDirectory = join(directory, "prepared");
	const plan = { schemaVersion: 1, type: "openstates-profile-enrichment", archive: { path: archivePath, commit, capturedAt, sha256: hash(body) }, referenceFiles: [file], outputDirectory };
	await writeFile(planPath, JSON.stringify(plan));
	const environment = { HOME: process.env.HOME, PATH: process.env.PATH, TMPDIR: process.env.TMPDIR, NODE_ENV: "test" };
	const root = fileURLToPath(new URL("../../", import.meta.url));
	const result = spawnSync(process.execPath, ["--import", "tsx", "back-end/src/manage-election-references.ts", "enrich-openstates", planPath], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 0, result.stderr);
	const receipt = JSON.parse(result.stdout);
	assert.equal(receipt.profiles, 1);
	assert.equal(receipt.publisherRequests, 0);
	assert.equal(receipt.imported, false);
	assert.equal(receipt.complete, true);
	assert.equal((await readdir(outputDirectory)).length, 4);
	await assert.rejects(prepareOpenStatesProfileFiles(planPath, now));
	const altered = { ...plan, outputDirectory: root };
	await writeFile(planPath, JSON.stringify(altered));
	await assert.rejects(prepareOpenStatesProfileFiles(planPath, now), /outside/u);
});
