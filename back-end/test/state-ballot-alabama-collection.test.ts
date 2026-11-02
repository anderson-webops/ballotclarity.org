import type { TestContext } from "node:test";
import type { StateBallotSource } from "../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { selectAlabamaCountyBatch } from "../src/state-ballot-alabama-batch.js";
import {
	fetchAlabamaCandidateCapture,
	fetchAlabamaCycleDiscovery,
	parseAlabamaCandidateCapture,
	readAlabamaDiscovery
} from "../src/state-ballot-alabama-collection.js";
import {
	alabamaCountySource,
	alabamaDocumentDigest,
	validateAlabamaSource
} from "../src/state-ballot-alabama-source.js";
import { alabamaHash } from "../src/state-ballot-alabama-types.js";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import {
	discoverStateBallotElectionCycles,
	parseStateBallotCycleCatalog,
	stateBallotCycleSources,
	writeStateBallotCycleCatalog
} from "../src/state-ballot-cycles.js";
import { createStateCandidateRecord, stateRecordMatchesDistricts } from "../src/state-ballot-records.js";
import { createStateBallotRepository, resolveStateBallotConfiguration } from "../src/state-ballot-repository.js";
import {
	alabamaCaptureFixture,
	alabamaFixturePdf,
	alabamaVerificationFixture
} from "./helpers/alabama-collection-fixture.js";

const initial = Date.parse("2026-11-02T12:00:00.000Z");
function transport(year = 2026, day = 3) {
	const capture = alabamaCaptureFixture(year, day);
	const documents = new Map(capture.documents.map(item => [item.url, item.body]));
	const requests: string[] = [];
	const sleeps: number[] = [];
	let instant = initial;
	let status = 200;
	const options = {
		now: () => instant,
		sleep: async (milliseconds: number) => {
			sleeps.push(milliseconds);
			instant += milliseconds;
		},
		request: async (url: string) => {
			requests.push(url);
			const body = documents.get(url);
			return {
				status,
				etag: undefined,
				body: body === undefined ? alabamaFixturePdf : Buffer.from(body),
				contentType:
					body === undefined ? "application/pdf" : url.endsWith("/robots.txt") ? "text/plain" : "text/html"
			};
		},
		verifyOriginal: async (_bytes: Buffer, input: Parameters<typeof alabamaVerificationFixture>[0]) =>
			alabamaVerificationFixture(input)
	};
	return {
		capture,
		documents,
		requests,
		sleeps,
		options,
		fail(value: number) {
			status = value;
		},
		advance() {
			instant += 5 * 60 * 60 * 1000;
		}
	};
}
async function directory(context: TestContext) {
	const path = await mkdtemp(join(tmpdir(), "alabama-collection-"));
	context.after(() => rm(path, { recursive: true, force: true }));
	return path;
}
async function fixture() {
	const data = transport();
	const discovery = await fetchAlabamaCycleDiscovery(data.options);
	const references = readAlabamaDiscovery(discovery, data.options.now());
	const election = references.elections[0];
	const source = alabamaCountySource(election, "Macon");
	return { ...data, discovery, election, source };
}
test("Alabama shared acquisition is serial, paced and follows only offered publications", async () => {
	const data = await fixture();
	assert.equal(data.requests.length, 4);
	assert(data.sleeps.slice(1).every(milliseconds => milliseconds === 20000));
	assert.equal(readAlabamaDiscovery(data.discovery, data.options.now()).elections[0].countyBallots.length, 3);
	const capture = await fetchAlabamaCandidateCapture(data.source, { ...data.options, discovery: data.discovery });
	assert.equal(data.requests.at(-2), data.source.url);
	assert.equal(data.requests.at(-1), data.election.pageUrl);
	const parsed = parseAlabamaCandidateCapture(data.source, capture, createStateCandidateRecord, data.options.now());
	assert.equal(parsed.records.length, 2);
	assert.equal(parsed.records[0].status, "listed");
	assert.equal(parsed.records[0].sourceStatus, undefined);
	assert.equal(parsed.records[1].scope, "state-board-of-education");
	assert.equal(parsed.records[1].jurisdiction, "Alabama State Board of Education District 2");
	assert.equal(
		stateRecordMatchesDistricts(parsed.records[1], [
			{ id: "house:2", label: "House 2", districtType: "state-house", districtCode: "2", sourceSystem: "Fixture" }
		]),
		false
	);
	assert.equal(parsed.collectionIndexSha256, alabamaDocumentDigest(data.election, "Macon"));
});
for (const [year, day] of [
	[2028, 7],
	[2030, 5]
]) {
	test(`Alabama ${year} discovery and candidate capture require no source filename edits`, async () => {
		const data = transport(year, day);
		const discovery = await fetchAlabamaCycleDiscovery(data.options);
		const election = readAlabamaDiscovery(discovery, data.options.now()).elections[0];
		const source = alabamaCountySource(election, "Macon");
		const parsed = parseAlabamaCandidateCapture(
			source,
			await fetchAlabamaCandidateCapture(source, { ...data.options, discovery }),
			createStateCandidateRecord,
			data.options.now()
		);
		assert.equal(source.electionDate, `${year}-11-0${day}`);
		assert.equal(parsed.records.length, 2);
	});
}
test("Alabama changed certifications, robot policy and HTTP challenges stop acquisition", async () => {
	const data = await fixture();
	data.documents.set(data.election.pageUrl, `${data.documents.get(data.election.pageUrl)!} changed`);
	await assert.rejects(
		fetchAlabamaCandidateCapture(data.source, { ...data.options, discovery: data.discovery }),
		/certification controls changed/u
	);
	const policy = transport();
	const url = policy.capture.documents[0].url;
	policy.documents.set(url, `${policy.documents.get(url)!}\nDisallow: /\n`);
	await assert.rejects(fetchAlabamaCycleDiscovery(policy.options), /requires review/u);
	assert.equal(policy.requests.length, 1);
	const challenged = transport();
	challenged.fail(403);
	await assert.rejects(fetchAlabamaCycleDiscovery(challenged.options));
	assert.equal(challenged.requests.length, 1);
});
test("Alabama captured proof, record identity, applicability and missing accepted candidates reject tampering", async () => {
	const data = await fixture();
	const body = await fetchAlabamaCandidateCapture(data.source, { ...data.options, discovery: data.discovery });
	const original = JSON.parse(body);
	for (const mutate of [
		(value: typeof original) => {
			value.native.result.records[0].name = "CHANGED CANDIDATE";
		},
		(value: typeof original) => {
			value.document.sha256 = "0".repeat(64);
		},
		(value: typeof original) => {
			value.native.result.individualApplicabilityVerified = true;
		},
		(value: typeof original) => {
			value.native.result.records[1].scope = "statewide";
			value.native.proof.reviewSha256 = alabamaHash(JSON.stringify(value.native.result));
		}
	]) {
		const changed = structuredClone(original);
		mutate(changed);
		assert.throws(() =>
			parseAlabamaCandidateCapture(
				data.source,
				JSON.stringify(changed),
				createStateCandidateRecord,
				data.options.now()
			)
		);
	}
	const parsed = parseAlabamaCandidateCapture(data.source, body, createStateCandidateRecord, data.options.now());
	assert.throws(
		() =>
			parseAlabamaCandidateCapture(data.source, body, createStateCandidateRecord, data.options.now(), {
				source: data.source,
				...parsed,
				records: [...parsed.records, { ...parsed.records[0], id: "0".repeat(24) }]
			}),
		/disappeared/u
	);
});
test("Alabama registration preserves old source selection and exposes only explicitly enabled county data", async (context) => {
	const data = await fixture();
	const path = join(await directory(context), "catalog.json");
	const catalog = discoverStateBallotElectionCycles(data.discovery, "al-sos-2026", data.options.now());
	await writeStateBallotCycleCatalog(path, catalog, data.options.now());
	assert.equal(stateBallotCycleSources(catalog, data.options.now()).length, 3);
	const environment = {
		STATE_BALLOT_ENABLED_STATES: "AL",
		STATE_BALLOT_CYCLE_CATALOGS: JSON.stringify({ "al-sos-2026": path })
	};
	assert.deepEqual(
		resolveStateBallotConfiguration(environment, data.options.now()).sources.map(source => source.id),
		["al-sos-2026"]
	);
	assert.deepEqual(
		resolveStateBallotConfiguration(
			{ ...environment, STATE_BALLOT_ENABLED_SOURCES: "al-sos-2026" },
			data.options.now()
		).sources.map(source => source.id),
		["al-sos-2026"]
	);
	assert.equal(
		resolveStateBallotConfiguration(
			{ ...environment, STATE_BALLOT_ENABLED_FAMILIES: "al-sos-2026" },
			data.options.now()
		).sources.length,
		4
	);
	assert.deepEqual(
		resolveStateBallotConfiguration(
			{ ...environment, STATE_BALLOT_ENABLED_SOURCES: data.source.id },
			data.options.now()
		).sources.map(source => source.id),
		[data.source.id]
	);
	const changed = structuredClone(catalog);
	changed.elections[0].alabamaElection!.countyBallots[0].url = "https://evil.example/Macon-Sample.pdf";
	assert.throws(() => parseStateBallotCycleCatalog(changed, data.options.now()));
	assert.throws(() => validateAlabamaSource({ ...data.source, ballotPreview: undefined }));
});
test("Alabama cycle collection persists, reloads offline, repeats, isolates holds and recovers from outages", async (context) => {
	const data = await fixture();
	const folder = await directory(context);
	const path = join(folder, "catalog.json");
	let calls = 0;
	const run = () =>
		syncStateBallotCycles({
			familyId: "al-sos-2026",
			dataDirectory: folder,
			catalogPath: path,
			fetchDiscovery: async () => data.discovery,
			now: data.options.now,
			fetchCandidates: async (source) => {
				calls++;
				if (source.countyName !== "Macon County")
					throw new Error("Synthetic county appearance requires review.");
				return fetchAlabamaCandidateCapture(source, { ...data.options, discovery: data.discovery });
			}
		});
	const first = await run();
	assert.equal(first.results.find(item => item.sourceId === data.source.id)?.records, 2);
	assert.equal(first.results.filter(item => item.status === "unavailable").length, 2);
	const file = join(folder, `${data.source.id}.json`);
	const accepted = await readFile(file);
	const reader = createStateBallotRepository({
		sources: [data.source],
		dataDirectory: folder,
		now: data.options.now,
		fetchText: async () => {
			throw new Error("Public reader must remain offline.");
		}
	});
	assert.equal((await reader.getSnapshot("AL", data.source.id))?.records.length, 2);
	await run();
	assert.equal(calls, 5);
	assert.deepEqual(await readFile(file), accepted);
	data.advance();
	data.fail(503);
	const outage = await run();
	assert.equal(outage.results.find(item => item.sourceId === data.source.id)?.status, "unavailable");
	assert.deepEqual(await readFile(file), accepted);
	data.fail(200);
	const recovered = await run();
	assert.equal(recovered.results.find(item => item.sourceId === data.source.id)?.status, "available");
	assert.equal(recovered.results.find(item => item.sourceId === data.source.id)?.imported, true);
	assert.equal(
		(
			await createStateBallotRepository({
				sources: [data.source],
				dataDirectory: folder,
				now: data.options.now
			}).getSnapshot("AL", data.source.id)
		)?.records.length,
		2
	);
});
test("Alabama batch cursor bounds broad collection to 25 and rotates after restart", async (context) => {
	const data = await fixture();
	const path = join(await directory(context), "catalog.json");
	const sources: StateBallotSource[] = Array.from({ length: 67 }, (_, index) => ({
		...data.source,
		id: `al-county-general-fixture-${String(index).padStart(2, "0")}`
	}));
	const first = await selectAlabamaCountyBatch(sources, path);
	assert.equal(first.sources.length, 25);
	assert.equal(first.deferredSources.length, 42);
	await first.complete();
	const second = await selectAlabamaCountyBatch(sources, path);
	assert.equal(second.sources[0].id, sources[25].id);
	await second.complete();
	const third = await selectAlabamaCountyBatch(sources, path);
	assert.equal(third.sources[0].id, sources[50].id);
	assert.equal(new Set([...first.sources, ...second.sources, ...third.sources].map(source => source.id)).size, 67);
	const narrowed = await selectAlabamaCountyBatch([data.source], path);
	assert.equal(narrowed.sources.length, 1);
	await writeFile(`${path}.alabama-batch.json`, "{}");
	await assert.rejects(selectAlabamaCountyBatch(sources, path), /cursor requires review/u);
});
