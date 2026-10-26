import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readOpenStatesCandidateInputs } from "../src/prepare-openstates-references.js";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { configuredStateBallotSources, legacyReviewedStateBallotSource } from "../src/state-ballot-registry.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import {
	fetchTuscolaCandidateCapture,
	fetchTuscolaCycleDiscovery,
	parseTuscolaCandidateCapture,
	readTuscolaDiscovery,
	validateTuscolaDocumentUrl
} from "../src/state-ballot-tuscola-collection.js";
import { readTuscolaCandidateDocuments } from "../src/state-ballot-tuscola.js";
import { tuscolaDiscoveryFixture } from "./helpers/tuscola-fixture.js";

const source = configuredStateBallotSources.find(source => source.id === "mi-tuscola-candidates-2026")!;
const now = Date.parse("2026-10-20T01:00:00.000Z");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function legacySnapshot() {
	const value = tuscolaDiscoveryFixture();
	const documents = value.documents[0]!;
	return {
		source: legacyReviewedStateBallotSource(source)!,
		records: readTuscolaCandidateDocuments(source, documents[0]!.text, documents[1]!.text).records,
		retrievedAt: documents[0]!.retrievedAt,
		sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))),
		documents: documents.map(({ url, sha256, retrievedAt }, index) => ({
			url,
			sha256,
			retrievedAt,
			includedRecordCount: index ? 0 : 4
		}))
	};
}

test("Tuscola discovery uses offered future controls, dates and original document digests", async () => {
	const value = tuscolaDiscoveryFixture(2028);
	const clock = Date.parse("2028-10-20T01:00:00Z");
	const catalog = discoverStateBallotElectionCycles(JSON.stringify(value), source.id, clock);
	const [future] = stateBallotCycleSources(catalog, clock);
	assert.equal(future.id, "mi-tuscola-general-2028-11-07");
	assert.equal(future.countyName, "Tuscola County");
	const captured = await fetchTuscolaCandidateCapture(future, { discovery: JSON.stringify(value), now: () => clock });
	assert.equal(parseTuscolaCandidateCapture(future, captured, clock).records.length, 4);
	const partial = tuscolaDiscoveryFixture();
	partial.index.body = partial.index.body.replace(/<li><a href="[^"]+">Sample Ballots[^<]+<\/a><\/li>/u, "");
	partial.index.sha256 = hash(partial.index.body);
	partial.documents[0]!.pop();
	assert.deepEqual(readTuscolaDiscovery(JSON.stringify(partial), now).elections[0]!.tuscolaDocuments, []);
	await assert.rejects(
		async () =>
			parseTuscolaCandidateCapture(
				source,
				await fetchTuscolaCandidateCapture(source, { discovery: JSON.stringify(partial), now: () => now }),
				now
			),
		StateBallotAwaitingRecordsError
	);
});

test("Tuscola changed legal inventories, document provenance and URL controls fail closed", () => {
	for (const mutate of [
		(value: ReturnType<typeof tuscolaDiscoveryFixture>) => (value.index.body += "<a href='/terms'>New terms</a>"),
		(value: ReturnType<typeof tuscolaDiscoveryFixture>) =>
			(value.index.body = value.index.body.replace("November 3rd", "November 4th")),
		(value: ReturnType<typeof tuscolaDiscoveryFixture>) =>
			(value.documents[0]![0]!.retrievedAt = "2026-10-19T00:00:00.000Z"),
		(value: ReturnType<typeof tuscolaDiscoveryFixture>) => value.documents[0]!.pop()
	]) {
		const value = tuscolaDiscoveryFixture();
		mutate(value);
		value.index.sha256 = hash(value.index.body);
		assert.throws(() => readTuscolaDiscovery(JSON.stringify(value), now), /Tuscola/u);
	}
	for (const url of [
		"http://www.tuscolacounty.org/file.pdf",
		"https://example.org/file.pdf",
		`${source.pageUrl}?file=1`,
		`${tuscolaDiscoveryFixture().documents[0]![0]!.url}#page=1`
	])
		assert.throws(() => validateTuscolaDocumentUrl(url, "candidates", "2026"));
});

test("Tuscola denied or changed robots stop before any candidate request or converter", async () => {
	for (const status of [200, 301, 403, 429]) {
		const requested: string[] = [];
		await assert.rejects(
			fetchTuscolaCycleDiscovery({
				sleep: async () => {},
				requestDocument: async (url) => {
					requested.push(url);
					return {
						status,
						body: Buffer.from("User-agent: *\nDisallow: /"),
						contentType: "text/plain",
						etag: undefined
					};
				},
				extractor: async () => {
					throw new Error("Converter must not run");
				}
			}),
			/policy/u
		);
		assert.deepEqual(requested, ["https://www.tuscolacounty.org/robots.txt"]);
	}
});

test("Tuscola exact reviewed recovery, cached clocks and same-URL amendments survive restart", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "tuscola-automatic-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const storage = createStateBallotStorage(directory);
	const original = legacySnapshot();
	await storage.write(original);
	const filename = (await readdir(directory)).find(name => name.startsWith(source.id))!;
	const before = await readFile(join(directory, filename));
	const value = tuscolaDiscoveryFixture();
	const options = {
		familyId: source.id,
		catalogPath: join(directory, "cycles.json"),
		dataDirectory: directory,
		now: () => now,
		fetchDiscovery: async () => JSON.stringify(value)
	};
	const first = await syncStateBallotCycles(options);
	assert.equal(first.results[0]!.status, "available");
	assert.equal(first.results[0]!.imported, true);
	const backup = (await readdir(directory)).find(name => name.startsWith(`${filename}.legacy-`))!;
	assert.ok((await readFile(join(directory, backup))).equals(before));
	const cached = await syncStateBallotCycles({
		...options,
		fetchCandidates: async () => {
			throw new Error("Unchanged data must remain cached");
		}
	});
	assert.equal(cached.results[0]!.imported, false);
	assert.equal(cached.results[0]!.retrievedAt, first.results[0]!.retrievedAt);
	value.documents[0]![0]!.sha256 = hash("official same-URL amendment");
	const amended = await syncStateBallotCycles(options);
	assert.equal(amended.results[0]!.imported, true);
	assert.deepEqual((await storage.read(source))!.records, original.records);
	const restarted = createStateBallotRepository({
		sources: [source],
		dataDirectory: directory,
		now: () => now,
		fetchText: async () => {
			throw new Error("Persisted reads must not collect");
		}
	});
	assert.deepEqual((await restarted.getSnapshot("MI"))!.records, original.records);
	const acceptedCatalog = await readFile(options.catalogPath);
	value.index.body = value.index.body.replace(/<li><a href="[^"]+">Sample Ballots[^<]+<\/a><\/li>/u, "");
	value.index.sha256 = hash(value.index.body);
	value.documents[0]!.pop();
	await assert.rejects(syncStateBallotCycles(options), /accepted Tuscola publications disappeared/u);
	assert.ok((await readFile(options.catalogPath)).equals(acceptedCatalog));
});

test("Tuscola legacy candidate inputs retain exact fingerprints after automatic promotion", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "tuscola-legacy-input-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const original = legacySnapshot();
	const path = join(directory, "reviewed.json");
	const snapshot = serializeStoredStateSnapshot(original);
	await writeFile(
		path,
		JSON.stringify({ snapshot, sourceConfigurationSha256: hash(JSON.stringify(original.source)) })
	);
	const [result] = await readOpenStatesCandidateInputs([path], [source.id]);
	assert.deepEqual(result.records, original.records);
	assert.deepEqual(result.source, original.source);
	await writeFile(path, JSON.stringify({ snapshot, sourceConfigurationSha256: hash(JSON.stringify(source)) }));
	await assert.rejects(readOpenStatesCandidateInputs([path], [source.id]), /fingerprint/u);
});

test("Tuscola failed reviewed backup preserves the accepted envelope", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "tuscola-backup-failure-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const storage = createStateBallotStorage(directory);
	const original = legacySnapshot();
	await storage.write(original);
	const filename = (await readdir(directory)).find(name => name.startsWith(source.id))!;
	const before = await readFile(join(directory, filename), "utf8");
	await writeFile(join(directory, `${filename}.legacy-${hash(before)}`), "Conflicting existing backup");
	const result = await syncStateBallotCycles({ familyId: source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: directory, now: () => now, fetchDiscovery: async () => JSON.stringify(tuscolaDiscoveryFixture()) });
	assert.equal(result.results[0]!.status, "persistence-failed");
	assert.equal(await readFile(join(directory, filename), "utf8"), before);
	assert.deepEqual((await storage.read(source))!.records, original.records);
});

test("Tuscola missing accepted identities require review rather than silently replacing records", async () => {
	const value = tuscolaDiscoveryFixture();
	value.documents[0]![0]!.text = value.documents[0]![0]!.text.replaceAll("Cassie Piché", "Different Person");
	value.documents[0]![1]!.text = value.documents[0]![1]!.text.replaceAll("Cassie Piché", "Different Person");
	const capture = await fetchTuscolaCandidateCapture(source, { discovery: JSON.stringify(value), now: () => now });
	assert.throws(() => parseTuscolaCandidateCapture(source, capture, now, legacySnapshot().records), /accepted Tuscola candidate disappeared/u);
});
