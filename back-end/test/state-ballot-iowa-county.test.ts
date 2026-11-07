import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchIowaCountyCandidateCapture, fetchIowaCountyCycleDiscovery, iowaCountyDocumentDigest, iowaCountyPolicyFingerprint, parseIowaCountyCandidateCapture, readIowaCountyDiscovery, validateIowaCountyElection } from "../src/state-ballot-iowa-county.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { orderStateBallotSources, StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import { serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { registerStateRecordRoutes } from "../src/state-records.js";
import { iowaFixtureHash as hash, iowaCountyFixture } from "./helpers/iowa-county-fixture.js";

for (const county of ["Monona", "Woodbury"] as const) {
	test(`${county} discovers actual offered dates, complete PDFs and all aliases without guessing editions`, () => {
		const fixture = iowaCountyFixture(county, "2028-11-07");
		const read = readIowaCountyDiscovery(JSON.stringify(fixture.discovery), county, fixture.now);
		assert.deepEqual(read.elections[0]!.iowaCountyDocuments, [fixture.link]);
		const family = configuredStateBallotSources.find(source => source.countyName === `${county} County`)!;
		const catalog = discoverStateBallotElectionCycles(JSON.stringify(fixture.discovery), family.id, fixture.now);
		assert.deepEqual(stateBallotCycleSources(catalog, fixture.now), [fixture.source]);
		const changed = structuredClone(fixture.discovery);
		changed.pages = [];
		assert.throws(() => readIowaCountyDiscovery(JSON.stringify(changed), county, fixture.now), /incomplete/u);
		changed.indexes[0]!.body = changed.indexes[0]!.body.replace("2028 General Election", "2026 General Election");
		changed.indexes[0]!.sha256 = hash(changed.indexes[0]!.body);
		assert.throws(() => readIowaCountyDiscovery(JSON.stringify(changed), county, fixture.now));
	});

	test(`${county} normalizes joint tickets, explicit nonpartisan offices and retention without inferring parties`, () => {
		const fixture = iowaCountyFixture(county);
		const parsed = parseIowaCountyCandidateCapture(fixture.source, JSON.stringify(fixture.capture), createStateCandidateRecord, fixture.now);
		assert.equal(parsed.records.length, 11);
		assert(parsed.records.some(record => record.name === "Jordan Example / Casey Sample"));
		assert(!parsed.records.find(record => record.name === "Harper Sample")!.party);
		assert.equal(parsed.records.find(record => record.name === "Quinn Example")!.party, "Nonpartisan");
		assert.equal(parsed.records.find(record => record.name === "Quinn Example")!.voteLimit, 2);
		assert.equal(parsed.records.filter(record => /Judicial retention/u.test(record.office)).length, 2);
		assert.deepEqual(parsed.documents[0]!.styles, fixture.link.styles);
		assert.equal(parsed.retrievedAt, fixture.instant);
		assert.equal(parsed.collectionIndexSha256, iowaCountyDocumentDigest([fixture.link]));
		const snapshot = { source: fixture.source, ...parsed };
		assert.deepEqual(parseBundledStateSnapshot(fixture.source, serializeStoredStateSnapshot(snapshot), "automatic").documents, parsed.documents);
		assert.equal(buildStateBallotPreview(snapshot, { districtMatches: [] }), null);
	});

	test(`${county} keeps pending publication separate from missing converter capabilities`, async () => {
		const fixture = iowaCountyFixture(county, "2028-11-07", true);
		const body = await fetchIowaCountyCandidateCapture(fixture.source, {
			discovery: JSON.stringify(fixture.discovery),
			now: () => fixture.now,
			extract: async () => { throw new Error("Unexpected conversion"); },
			request: async () => { throw new Error("Unexpected request"); }
		});
		assert.throws(() => parseIowaCountyCandidateCapture(fixture.source, body, createStateCandidateRecord, fixture.now), StateBallotAwaitingRecordsError);
	});

	test(`${county} explicit native acquisition is serial and rejects redirects or missing fields`, async () => {
		const fixture = iowaCountyFixture(county);
		const waits: number[] = [];
		let clock = fixture.now;
		const options = {
			discovery: JSON.stringify(fixture.discovery),
			now: () => clock,
			sleep: async (milliseconds: number) => {
				waits.push(milliseconds);
				clock += milliseconds;
			},
			extract: async () => fixture.native
		};
		const body = await fetchIowaCountyCandidateCapture(fixture.source, {
			...options,
			request: async (url) => {
				assert.equal(url, fixture.link.url);
				return { status: 200, etag: undefined, contentType: "application/pdf", body: Buffer.from("%PDF-Synthetic source fixture") };
			}
		});
		assert.deepEqual(waits, [20000]);
		assert.equal(parseIowaCountyCandidateCapture(fixture.source, body, createStateCandidateRecord, clock).records.length, 11);
		await assert.rejects(fetchIowaCountyCandidateCapture(fixture.source, { ...options, request: async () => ({ status: 302, etag: undefined, contentType: "application/pdf", location: fixture.link.url, body: Buffer.from("%PDF-Synthetic") }) }), /unavailable/u);
		const changed = structuredClone(fixture.capture);
		changed.documents[0]!.visible = changed.documents[0]!.visible.replace("Avery Example", "Changed name");
		assert.throws(() => parseIowaCountyCandidateCapture(fixture.source, JSON.stringify(changed), createStateCandidateRecord, fixture.now));
	});

	test(`${county} rejects alias loss, changed inventories and stored provenance tampering`, () => {
		const fixture = iowaCountyFixture(county);
		const parsed = parseIowaCountyCandidateCapture(fixture.source, JSON.stringify(fixture.capture), createStateCandidateRecord, fixture.now);
		assert.throws(() => parseIowaCountyCandidateCapture(fixture.source, JSON.stringify(fixture.capture), createStateCandidateRecord, fixture.now, { records: parsed.records, documents: [{ url: fixture.link.url, styles: ["Missing precinct"] }] }), /disappeared/u);
		assert.throws(() => validateIowaCountyElection({ electionId: null, electionDate: fixture.source.electionDate, pageUrl: fixture.source.pageUrl, iowaCountyDocuments: [fixture.link, fixture.link] }, county));
		const stored = JSON.parse(serializeStoredStateSnapshot({ source: fixture.source, ...parsed }));
		stored.documents[0].styles.pop();
		assert.throws(() => parseBundledStateSnapshot(fixture.source, JSON.stringify(stored), "automatic"), /index/u);
	});
	test(`${county} requires appearance-bound capture version two and exact page evidence`, () => {
		const fixture = iowaCountyFixture(county);
		const parse = (value: unknown) => parseIowaCountyCandidateCapture(fixture.source, JSON.stringify(value), createStateCandidateRecord, fixture.now);
		assert.throws(() => parse({ ...fixture.capture, schemaVersion: 1 }), /contract/u);
		for (const field of ["bboxSha256", "geometrySha256", "wordInventorySha256", "svgSha256", "words", "characters", "minimumContrast", "ruleContacts"]) {
			const changed = structuredClone(fixture.capture);
			const proof = changed.documents[0]!.appearance.pages[0]! as unknown as Record<string, unknown>;
			proof[field] = ["minimumContrast", "ruleContacts"].includes(field) ? -1 : typeof proof[field] === "string" ? "changed" : Number(proof[field]) + 1;
			assert.throws(() => parse(changed));
		}
		const changed = structuredClone(fixture.capture);
		changed.documents[0]!.appearance.pages.pop();
		assert.throws(() => parse(changed), /appearance/u);
		changed.documents[0]!.appearance = { ...fixture.capture.documents[0]!.appearance, sourceSha256: "0".repeat(64) };
		assert.throws(() => parse(changed), /appearance/u);
	});

	test(`${county} robot-policy changes fail before requesting any election content`, async () => {
		const urls: string[] = [];
		await assert.rejects(fetchIowaCountyCycleDiscovery(county, {
			request: async (url) => {
				urls.push(url);
				return { status: 200, etag: undefined, contentType: "text/plain", body: Buffer.from("User-agent: *\nDisallow: /\n") };
			},
			now: () => 0
		}), /policy/u);
		assert.equal(urls.length, 1);
	});
}

test("Iowa publication descriptors retain date identity and reject foreign links and control-bearing aliases", () => {
	const fixture = iowaCountyFixture();
	for (const link of [{ ...fixture.link, url: "https://example.test/sample.pdf" }, { ...fixture.link, styles: ["bad\u0001style"] }]) assert.throws(() => validateIowaCountyElection({ electionId: null, electionDate: fixture.source.electionDate, pageUrl: fixture.source.pageUrl, iowaCountyDocuments: [link] }, "Monona"));
	const footer = "<div id=\"footer\">Monona County © 2026</div><div id=\"credit\">County publishing</div><a href=\"/page/title_vi/\">Title VI</a>";
	assert.equal(iowaCountyPolicyFingerprint(footer, "Monona", "home"), iowaCountyPolicyFingerprint(footer.replace("2026", "2028"), "Monona", "home"));
	assert.notEqual(iowaCountyPolicyFingerprint(footer, "Monona", "home"), iowaCountyPolicyFingerprint(`${footer}<a href=\"/terms/\">Terms</a>`, "Monona", "home"));
});

test("Iowa county additions preserve the existing default directory precedence", () => {
	const sources = orderStateBallotSources(configuredStateBallotSources.filter(source => source.stateCode === "IA"));
	assert.notEqual(sources[0]!.format, "iowa-county-pdf");
	assert.equal(sources.filter(source => source.format === "iowa-county-pdf").length, 2);
});

test("Iowa retains accepted snapshots through publisher outage, persistence failure and recovery", async () => {
	const directory = await mkdtemp(join(tmpdir(), "iowa-retention-"));
	const dataDirectory = join(directory, "data");
	const backup = join(directory, "retained");
	const fixture = iowaCountyFixture("Woodbury", "2028-11-07");
	let mode = "available";
	let clock = fixture.now;
	try {
		const repository = createStateBallotRepository({
			sources: [fixture.source],
			dataDirectory,
			ttlMs: 1,
			refreshReviewedLegacy: true,
			now: () => clock,
			fetchText: async () => {
				if (mode === "outage") throw new Error("Synthetic publisher outage");
				if (mode === "persistence") {
					await rename(dataDirectory, backup);
					await writeFile(dataDirectory, "Synthetic persistence guard");
				}
				return JSON.stringify(fixture.capture);
			}
		});
		const first = (await repository.getSnapshot("IA", fixture.source.id))!;
		assert.equal(first.records.length, 11);
		const original = await readFile(join(dataDirectory, `${fixture.source.id}.json`), "utf8");
		mode = "outage";
		clock += 1000;
		assert.deepEqual(await repository.getSnapshot("IA", fixture.source.id), JSON.parse(JSON.stringify(first)));
		assert.equal(await readFile(join(dataDirectory, `${fixture.source.id}.json`), "utf8"), original);
		mode = "persistence";
		clock += 301000;
		assert.deepEqual(await repository.getSnapshot("IA", fixture.source.id), JSON.parse(JSON.stringify(first)));
		await rm(dataDirectory);
		await rename(backup, dataDirectory);
		assert.equal(await readFile(join(dataDirectory, `${fixture.source.id}.json`), "utf8"), original);
		mode = "available";
		clock += 301000;
		assert.equal((await repository.getSnapshot("IA", fixture.source.id))!.records.length, 11);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Iowa recurring acquisition moves from waiting to durable import and offline restart, retaining accepted styles on failure", async () => {
	const directory = await mkdtemp(join(tmpdir(), "iowa-county-sync-"));
	const fixture = iowaCountyFixture("Monona", "2028-11-07");
	const pending = iowaCountyFixture("Monona", "2028-11-07", true);
	const family = configuredStateBallotSources.find(source => source.id === "ia-monona-samples-2026")!;
	const catalogPath = join(directory, "catalog.json");
	let calls = 0;
	try {
		const run = (waiting: boolean) => syncStateBallotCycles({
			familyId: family.id,
			catalogPath,
			dataDirectory: directory,
			now: () => fixture.now,
			fetchDiscovery: async () => JSON.stringify(waiting ? pending.discovery : fixture.discovery),
			fetchCandidates: async () => {
				calls++;
				return JSON.stringify(waiting ? pending.capture : fixture.capture);
			}
		});
		assert.equal((await run(true)).results.find(result => result.sourceId === fixture.source.id)!.status, "awaiting-records");
		assert.equal((await run(false)).results.find(result => result.sourceId === fixture.source.id)!.records, 11);
		const importedCalls = calls;
		assert.equal((await run(false)).results.find(result => result.sourceId === fixture.source.id)!.status, "available");
		assert.equal(calls, importedCalls);
		const reader = createStateBallotRepository({
			sources: [fixture.source],
			dataDirectory: directory,
			now: () => fixture.now,
			fetchText: async () => { throw new Error("Unexpected network or converter use"); }
		});
		assert.equal((await reader.getSnapshot("IA", fixture.source.id))!.records.length, 11);
		const originalCatalog = await readFile(catalogPath, "utf8");
		await assert.rejects(run(true), /disappeared/u);
		assert.equal(await readFile(catalogPath, "utf8"), originalCatalog);
		const app = express();
		registerStateRecordRoutes(app, reader, undefined, () => fixture.now);
		const server = app.listen(0, "127.0.0.1");
		try {
			await new Promise<void>(resolve => server.once("listening", resolve));
			const address = server.address();
			assert(address && typeof address === "object");
			const response = await fetch(`http://127.0.0.1:${address.port}/api/state-records/IA?source=${fixture.source.id}`);
			assert.equal(response.status, 200);
			const payload = await response.json();
			assert.equal(payload.records.length, 11);
			assert.deepEqual(payload.source.documentLinks, [{ label: "Sample ballots", url: fixture.source.pageUrl }]);
		}
		finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
