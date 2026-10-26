import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { eastGreenwichPolicyFingerprint, fetchEastGreenwichCandidateCapture, fetchEastGreenwichCycleDiscovery, parseEastGreenwichCandidateCapture, readEastGreenwichDiscovery, validateEastGreenwichDocumentUrl } from "../src/state-ballot-east-greenwich-collection.js";
import { configuredStateBallotSources, legacyReviewedStateBallotSource } from "../src/state-ballot-registry.js";
import { StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { eastGreenwichDiscoveryFixture, eastGreenwichFixtureHash, eastGreenwichFixtureTime, eastGreenwichVisualFixture } from "./helpers/east-greenwich-collection-fixture.js";

const source = configuredStateBallotSources.find(item => item.id === "ri-east-greenwich-2026")!;
async function capture(fixture = eastGreenwichDiscoveryFixture(), selected = source) {
	return fetchEastGreenwichCandidateCapture(selected, { discovery: JSON.stringify(fixture), now: () => eastGreenwichFixtureTime });
}
test("East Greenwich discovers the dated section and reconciles every sample without duplicate local records", async () => {
	const fixture = eastGreenwichDiscoveryFixture();
	const discovery = readEastGreenwichDiscovery(JSON.stringify(fixture), eastGreenwichFixtureTime);
	const parsed = parseEastGreenwichCandidateCapture(source, await capture(fixture), eastGreenwichFixtureTime);
	assert.equal(discovery.elections.length, 1);
	assert.equal(parsed.records.length, 10);
	assert.deepEqual(parsed.documents.map(item => item.includedRecordCount), [9, 0, 1, 0, 0]);
	assert.equal(parsed.retrievedAt, fixture.documents[0]!.retrievedAt);
	assert.deepEqual(parsed.records.filter(item => item.scope === "state-house").map(item => item.district), ["30", "24"]);
});
test("advancing copyright years alone require no annual edit while changed owners and legal text remain held", () => {
	const body = "<div id=\"mainWrapTS\">Publisher metadata: 1997-2026 CivicPlus. Factual copyright range: 2006-2026 East Greenwich, RI and its representatives.</div>";
	const url = "https://www.eastgreenwichri.gov/site/copyright";
	const now = Date.parse("2030-01-01T00:00:00Z");
	const fingerprint = eastGreenwichPolicyFingerprint(Buffer.from(body), "region", url, "mainWrapTS", now);
	assert.equal(eastGreenwichPolicyFingerprint(Buffer.from(body.replaceAll("-2026", "-2030")), "region", url, "mainWrapTS", now), fingerprint);
	for (const changed of [body.replace("CivicPlus", "Other owner"), body.replace("Publisher metadata", "Reuse requires permission"), body.replace("its representatives", "new license terms")]) assert.notEqual(eastGreenwichPolicyFingerprint(Buffer.from(changed), "region", url, "mainWrapTS", now), fingerprint);
	assert.throws(() => eastGreenwichPolicyFingerprint(Buffer.from(body.replaceAll("-2026", "-2031")), "region", url, "mainWrapTS", now), /year requires review/u);
});
test("dated headings, legal inventories, explicit PDF roles, image proofs and provenance remain strict", () => {
	for (const mutate of [(fixture: ReturnType<typeof eastGreenwichDiscoveryFixture>) => {
		fixture.index.body += "<a href=\"/new-terms\">Terms</a>";
	}, (fixture: ReturnType<typeof eastGreenwichDiscoveryFixture>) => {
		fixture.index.body = fixture.index.body.replace("November 3, 2026", "November 4, 2026");
	}, (fixture: ReturnType<typeof eastGreenwichDiscoveryFixture>) => {
		fixture.documents[0]!.url += "?download=1";
	}, (fixture: ReturnType<typeof eastGreenwichDiscoveryFixture>) => {
		fixture.documents[0]!.retrievedAt = "2099-01-01T00:00:00.000Z";
	}, (fixture: ReturnType<typeof eastGreenwichDiscoveryFixture>) => {
		fixture.documents[0]!.visual.pages[0]!.images[1]!.sha256 = "f".repeat(64);
	}, (fixture: ReturnType<typeof eastGreenwichDiscoveryFixture>) => {
		fixture.documents[0]!.text = fixture.documents[0]!.text.replace(">DEMOCRAT<", ">Different Party<");
	}, (fixture: ReturnType<typeof eastGreenwichDiscoveryFixture>) => {
		fixture.documents.push(fixture.documents[0]!);
	}]) {
		const fixture = eastGreenwichDiscoveryFixture();
		mutate(fixture);
		fixture.index.sha256 = eastGreenwichFixtureHash(fixture.index.body);
		assert.throws(() => readEastGreenwichDiscovery(JSON.stringify(fixture), eastGreenwichFixtureTime), /review|inventory|provenance/u);
	}
	for (const url of ["https://127.0.0.1/DocumentCenter/View/1/General-Election-Precinct-0901-Sample-Ballot-PDF", `${source.url}#sample`, "https://www.eastgreenwichri.gov/DocumentCenter/View/1/General-Election-Precinct-0902-Sample-Ballot-PDF"]) assert.throws(() => validateEastGreenwichDocumentUrl(url, "0901"));
});
test("shared source claims and disappearing accepted identities require review", async () => {
	const fixture = eastGreenwichDiscoveryFixture();
	const accepted = parseEastGreenwichCandidateCapture(source, await capture(fixture), eastGreenwichFixtureTime);
	const changed = fixture.documents[1]!;
	changed.text = changed.text.replace(">Blair Sample<", ">Other Sample<");
	changed.visual = eastGreenwichVisualFixture(changed.text, changed.sha256);
	await assert.rejects(async () => parseEastGreenwichCandidateCapture(source, await capture(fixture), eastGreenwichFixtureTime), /shared statewide or town/u);
	await assert.rejects(async () => parseEastGreenwichCandidateCapture(source, await capture(), eastGreenwichFixtureTime, [...accepted.records, { ...accepted.records[0]!, id: "a".repeat(24) }]), /candidate disappeared/u);
});
test("partial offered sample sets remain pending and cannot replace accepted facts", async () => {
	const body = await capture(eastGreenwichDiscoveryFixture(["2026-11-03"], 4));
	assert.throws(() => parseEastGreenwichCandidateCapture(source, body, eastGreenwichFixtureTime), StateBallotAwaitingRecordsError);
	assert.throws(() => parseEastGreenwichCandidateCapture(source, body, eastGreenwichFixtureTime, [{ id: "a" } as never]), /publications disappeared/u);
});
test("unreviewed robots or index policies stop collection before PDF or alternate-path requests", async () => {
	for (const response of [{ status: 403, body: Buffer.alloc(0) }, { status: 200, body: Buffer.from("User-agent: *\nDisallow: /\n") }]) {
		const requests: string[] = [];
		await assert.rejects(fetchEastGreenwichCycleDiscovery({ requestDocument: async (url) => {
			requests.push(url);
			return { ...response, contentType: "text/plain", etag: undefined, location: undefined };
		}, sleep: async () => {} }));
		assert.deepEqual(requests, ["https://www.eastgreenwichri.gov/robots.txt"]);
	}
});
test("first automatic replacement backs up exact reviewed bytes and keeps unchanged capture clocks", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "east-greenwich-legacy-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const fixture = eastGreenwichDiscoveryFixture();
	const parsed = parseEastGreenwichCandidateCapture(source, await capture(fixture), eastGreenwichFixtureTime);
	const storage = createStateBallotStorage(directory);
	await storage.write({ ...parsed, source: legacyReviewedStateBallotSource(source)!, collectionIndexSha256: undefined });
	const file = (await readdir(directory)).find(name => name.startsWith(source.id))!;
	const before = await readFile(join(directory, file));
	const options = { familyId: source.id, dataDirectory: directory, catalogPath: join(directory, "cycles.json"), now: () => eastGreenwichFixtureTime, fetchDiscovery: async () => JSON.stringify(fixture) };
	const first = await syncStateBallotCycles(options);
	const cached = await syncStateBallotCycles({ ...options, fetchCandidates: async () => {
		throw new Error("Stored records must remain cached");
	} });
	assert.equal(first.results[0]!.status, "available");
	assert.equal(first.results[0]!.imported, true);
	assert.equal(cached.results[0]!.imported, false);
	assert.equal(cached.results[0]!.retrievedAt, first.results[0]!.retrievedAt);
	assert.deepEqual((await storage.read(source))!.records, parsed.records);
	const backup = (await readdir(directory)).find(name => name.startsWith(`${file}.legacy-`))!;
	assert.ok(backup);
	assert.deepEqual(await readFile(join(directory, backup)), before);
	await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => JSON.stringify(eastGreenwichDiscoveryFixture(["2026-11-03"], 4)) }), /publication disappeared/u);
	assert.equal(JSON.parse(serializeStoredStateSnapshot((await storage.read(source))!)).retrievalPolicy, "automatic");
});
test("compatible synthetic future publications progress from pending to available without annual source edits", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "east-greenwich-future-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	let fixture = eastGreenwichDiscoveryFixture(["2030-11-05"], 0);
	const catalog = discoverStateBallotElectionCycles(JSON.stringify(fixture), source.id, eastGreenwichFixtureTime);
	const future = stateBallotCycleSources(catalog, eastGreenwichFixtureTime)[0]!;
	assert.equal(future.id, "ri-east-greenwich-general-2030-11-05");
	const options = { familyId: source.id, dataDirectory: directory, catalogPath: join(directory, "cycles.json"), now: () => eastGreenwichFixtureTime, fetchDiscovery: async () => JSON.stringify(fixture) };
	assert.equal((await syncStateBallotCycles(options)).results[0]!.status, "awaiting-records");
	fixture = eastGreenwichDiscoveryFixture(["2030-11-05"]);
	assert.equal((await syncStateBallotCycles(options)).results[0]!.records, 10);
	assert.equal((await syncStateBallotCycles({ ...options, fetchCandidates: async () => {
		throw new Error("Cached future source must not download again");
	} })).results[0]!.imported, false);
});
test("same URLs with revised digests refresh imports, while expired elections are not extrapolated", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "east-greenwich-revision-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	let fixture = eastGreenwichDiscoveryFixture();
	const options = { familyId: source.id, dataDirectory: directory, catalogPath: join(directory, "cycles.json"), now: () => eastGreenwichFixtureTime, fetchDiscovery: async () => JSON.stringify(fixture) };
	await syncStateBallotCycles(options);
	fixture = eastGreenwichDiscoveryFixture(["2026-11-03"], 5, "revised");
	assert.equal((await syncStateBallotCycles(options)).results[0]!.imported, true);
	let requests = 0;
	const expired = await syncStateBallotCycles({ ...options, now: () => Date.parse("2026-11-06T12:00:00Z"), fetchCandidates: async () => {
		requests++;
		throw new Error("Expired publications are not a future ballot");
	} });
	assert.equal(expired.results.length, 1);
	assert.equal(expired.results[0]!.status, "expired");
	assert.equal(requests, 0);
});
test("failed recovery backup preserves the accepted reviewed envelope", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "east-greenwich-backup-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const fixture = eastGreenwichDiscoveryFixture();
	const parsed = parseEastGreenwichCandidateCapture(source, await capture(fixture), eastGreenwichFixtureTime);
	const storage = createStateBallotStorage(directory);
	await storage.write({ ...parsed, source: legacyReviewedStateBallotSource(source)!, collectionIndexSha256: undefined });
	const file = (await readdir(directory)).find(name => name.startsWith(source.id))!;
	const before = await readFile(join(directory, file));
	await writeFile(join(directory, `${file}.legacy-${createHash("sha256").update(before).digest("hex")}`), "Synthetic conflicting recovery file", { flag: "wx" });
	const result = await syncStateBallotCycles({ familyId: source.id, dataDirectory: directory, catalogPath: join(directory, "cycles.json"), now: () => eastGreenwichFixtureTime, fetchDiscovery: async () => JSON.stringify(fixture) });
	assert.equal(result.results[0]!.status, "persistence-failed");
	assert.deepEqual(await readFile(join(directory, file)), before);
});
