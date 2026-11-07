import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { readFairbanksBallotCandidates } from "../src/fairbanks-ballot-candidates.js";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, parseStateBallotCycleCatalog, readStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fairbanksDocumentDigest, fairbanksSource, fetchFairbanksCandidateCapture, parseFairbanksCandidateCapture, readFairbanksCandidateCapture, readFairbanksCycleDiscovery, validateFairbanksSource } from "../src/state-ballot-fairbanks.js";
import { createStateCandidateRecord, parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { stateRecordDocumentLinks } from "../src/state-records.js";
import { fairbanksOval, fairbanksSyntheticCandidateCapture as fixture } from "./fixtures/fairbanks-candidate-synthetic.js";

const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const source = fairbanksSource();
const temporary = async () => realpath(await mkdtemp(join(tmpdir(), "ballot-fairbanks-")));

test("Fairbanks normalizes evidence-derived municipal candidates without voter, party or outcome inference", () => {
	const data = fixture();
	const result = parseFairbanksCandidateCapture(source, data.body, createStateCandidateRecord, data.now);
	assert.equal(result.records.length, 5);
	assert.equal(result.documents.length, 2);
	assert.equal(result.collectionIndexSha256, fairbanksDocumentDigest(data.capture.documents));
	assert.deepEqual(parseStateCandidateRecords(source, data.body), result.records);
	assert.deepEqual(configuredStateBallotSources.find(item => item.id === source.id), source);
	assert.ok(result.records.every(record => record.status === "listed" && record.scope === "local" && record.district === "" && record.termYears === 3 && !record.party && !record.incumbent && !record.termEnd && !record.seats));
	assert.equal(result.records.find(record => record.name === "Morgan Lane")?.voteLimit, 2);
	assert.equal(new Set(result.records.map(record => record.jurisdiction)).size, 3);
	assert.equal(buildStateBallotPreview({ source, ...result }, { districtMatches: [] }), null);
	assert.deepEqual(stateRecordDocumentLinks(source, { source, ...result }), [{ label: "Sample ballot", url: source.documentUrls![1] }, { label: "Election office", url: source.pageUrl }]);
	assert.equal(configuredStateBallotSources.find(item => item.id === "ak-doe-2026")?.retrievalPolicy, "manual-snapshot");
});

test("Fairbanks discovery follows printed future dates and offered URLs with no annual source edits", () => {
	const data = fixture(2027);
	for (const [index, document] of data.capture.documents.entries()) {
		const offered = document.url.replace(index ? "/29012/" : "/28941/", index ? "/39012/" : "/38941/");
		data.capture.index.body = data.capture.index.body.replaceAll(document.url, offered);
		document.url = offered;
	}
	data.capture.index.sha256 = hash(data.capture.index.body);
	data.native.prepared = readFairbanksBallotCandidates(data.capture, data.documents, data.now);
	data.body = JSON.stringify({ schemaVersion: 1, type: "fairbanks-candidate-capture", capture: data.capture, native: data.native });
	const body = JSON.stringify(data.capture);
	const catalog = discoverStateBallotElectionCycles(body, source.id, data.now);
	const future = stateBallotCycleSources(catalog, data.now)[0]!;
	assert.equal(future.id, "ak-fairbanks-municipal-2027-10-05");
	assert.deepEqual(future.documentUrls, data.capture.documents.map(document => document.url));
	assert.equal(getStateBallotCycleFamily(source.id).format, "fairbanks-pdf");
	assert.equal(parseFairbanksCandidateCapture(future, data.body, createStateCandidateRecord, data.now).records.length, 5);
	assert.throws(() => parseFairbanksCandidateCapture(source, data.body, createStateCandidateRecord, data.now), /agreement/u);
	assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, elections: [...catalog.elections, ...catalog.elections] }, data.now), /duplicated/u);
	const changed = structuredClone(catalog);
	changed.elections[0]!.fairbanksDocuments![0]!.url = "https://example.com/ballot.pdf";
	assert.throws(() => parseStateBallotCycleCatalog(changed, data.now), /inventory/u);
});

test("Fairbanks collection uses external policy renewal and accepts real acquisition clock advancement", async () => {
	const directory = await temporary();
	const previousReview = process.env.STATE_BALLOT_FAIRBANKS_REVIEW_FILE;
	try {
		const data = fixture(2027);
		const file = join(directory, "review.json");
		await writeFile(file, JSON.stringify(data.capture.accessReview));
		process.env.STATE_BALLOT_FAIRBANKS_REVIEW_FILE = file;
		let clock = data.now + 5000;
		let requests = 0;
		const body = await fetchFairbanksCandidateCapture(fairbanksSource(data.electionDate), {
			scratchDirectory: directory,
			now: () => clock,
			sleep: async () => {},
			requestText: async (url, options) => {
				requests++;
				clock += 500;
				assert.equal(options?.maxRedirects, 0);
				const page = [...data.capture.policies, data.capture.index].find(page => page.url === String(url));
				assert.ok(page);
				return page.body;
			},
			requestDocument: async (url) => {
				requests++;
				clock += 500;
				const document = data.capture.documents.find(document => document.url === String(url));
				assert.ok(document);
				return { status: 200, contentType: "application/pdf", body: Buffer.from(document.body, "base64"), etag: undefined };
			},
			extractor: async (bytes) => {
				const document = data.capture.documents.find(document => document.body === bytes.toString("base64"));
				assert.ok(document);
				return document.text;
			},
			prepare: async (capture, _directory, now) => ({ ...data.native, prepared: readFairbanksBallotCandidates(capture, data.documents, now) })
		});
		assert.equal(requests, 5);
		assert.equal(readFairbanksCandidateCapture(body, clock).prepared.records.length, 5);
	}
	finally {
		if (previousReview === undefined) delete process.env.STATE_BALLOT_FAIRBANKS_REVIEW_FILE;
		else process.env.STATE_BALLOT_FAIRBANKS_REVIEW_FILE = previousReview;
		await rm(directory, { recursive: true, force: true });
	}
});

test("Fairbanks source configuration keeps exact publisher, municipality and stored-reader boundaries", () => {
	validateFairbanksSource(Object.fromEntries(Object.entries(source).reverse()) as typeof source);
	for (const altered of [{ ...source, stateCode: "GA" }, { ...source, countyName: "Anchorage" }, { ...source, ballotPreview: undefined }, { ...source, snapshotStorage: undefined }, { ...source, extra: true }, { ...source, documentUrls: [...source.documentUrls!].reverse() }]) assert.throws(() => validateFairbanksSource(altered as typeof source), /review/u);
	assert.throws(() => fairbanksSource("2027-10-06"), /review/u);
	assert.throws(() => fairbanksSource("2027-10-05", ["https://example.com/ballot.pdf", source.documentUrls![1]!]), /review/u);
});

test("Fairbanks capture rejects altered bytes, native facts, geometry, missing rows and unknown evidence", () => {
	for (const kind of ["pdf", "prepared", "geometry", "mark", "extra", "tools"]) {
		const data = JSON.parse(fixture().body);
		if (kind === "pdf") data.capture.documents[0].sha256 = "0".repeat(64);
		if (kind === "prepared") data.native.prepared.records[0].name = "Different Person";
		if (kind === "geometry") data.native.documents[0].geometry.pages[0].cropBox[0] = 20;
		if (kind === "mark") data.native.documents[0].pages[0].svg = data.native.documents[0].pages[0].svg.replace(fairbanksOval(96, 260), "");
		if (kind === "extra") data.native.documents[0].extra = true;
		if (kind === "tools") data.native.tools.inspectorSha256 = "unknown";
		assert.throws(() => readFairbanksCandidateCapture(JSON.stringify(data), fixture().now), /review|changed/u, kind);
	}
});

test("Fairbanks private collection retains original clocks and reuses exact unchanged native evidence", async () => {
	const directory = await temporary();
	try {
		const data = fixture();
		let conversions = 0;
		const options = {
			discovery: JSON.stringify(data.capture),
			scratchDirectory: directory,
			now: () => data.now,
			prepare: async () => {
				conversions++;
				return data.native;
			}
		};
		const first = await fetchFairbanksCandidateCapture(source, options);
		assert.equal(first, data.body);
		const later = structuredClone(data.capture);
		const checkedAt = new Date(data.now + 1000).toISOString();
		for (const page of [...later.policies, later.index, ...later.documents]) page.checkedAt = page.capturedAt = checkedAt;
		const second = await fetchFairbanksCandidateCapture(source, { ...options, discovery: JSON.stringify(later), now: () => data.now + 1000 });
		const accepted = readFairbanksCandidateCapture(second, data.now + 1000);
		assert.equal(conversions, 1);
		assert.ok(accepted.capture.documents.every(document => document.capturedAt === data.capture.documents[0]!.capturedAt && document.checkedAt === checkedAt));
		assert.equal(await readFile(join(directory, "fairbanks-last-capture.json"), "utf8"), second);
		const evidenceFiles = (await readdir(directory)).filter(name => name.startsWith("fairbanks-candidates-"));
		assert.equal(evidenceFiles.length, 1);
		assert.equal(await readFile(join(directory, evidenceFiles[0]!), "utf8"), first);
		assert.equal(await fetchFairbanksCandidateCapture(source, { ...options, discovery: JSON.stringify(later), now: () => data.now + 1000 }), second);
		assert.equal(conversions, 1);
		await assert.rejects(fetchFairbanksCandidateCapture(source, { ...options, discovery: JSON.stringify(fixture(2027).capture), now: () => fixture(2027).now }), /selection/u);
		assert.equal(await readFile(join(directory, "fairbanks-last-capture.json"), "utf8"), second);
	}
	finally {
		await rm(directory, {
			recursive: true,
			force: true
		});
	}
});

test("Fairbanks disappearance and converter failure preserve the complete accepted capture", async () => {
	const directory = await temporary();
	try {
		const data = fixture();
		const options = { discovery: JSON.stringify(data.capture), scratchDirectory: directory, now: () => data.now, prepare: async () => data.native };
		const first = await fetchFairbanksCandidateCapture(source, options);
		const next = fixture();
		const raw = "%PDF-1.7\nSynthetic changed municipal publication";
		next.capture.documents[1]!.body = Buffer.from(raw).toString("base64");
		next.capture.documents[1]!.sha256 = hash(raw);
		next.documents[1]!.sourceSha256 = hash(raw);
		const page = next.documents[1]!.pages[2]!;
		next.documents[1]!.bbox = next.documents[1]!.bbox.replace(/<line[^>]*>Taylor Park<\/line>/u, "");
		page.ocr = page.ocr.split("\n").filter(line => !line.endsWith("\tTaylor Park")).join("\n");
		page.svg = page.svg.replace(fairbanksOval(222, 280), "");
		next.native.prepared = readFairbanksBallotCandidates(next.capture, next.documents, next.now);
		assert.equal(next.native.prepared.records.length, 4);
		await assert.rejects(fetchFairbanksCandidateCapture(source, { ...options, discovery: JSON.stringify(next.capture), prepare: async () => next.native }), /disappeared/u);
		await assert.rejects(fetchFairbanksCandidateCapture(source, {
			...options,
			discovery: JSON.stringify(next.capture),
			prepare: async () => {
				throw new Error("Converter unavailable");
			}
		}), /Converter unavailable/u);
		assert.equal(await readFile(join(directory, "fairbanks-last-capture.json"), "utf8"), first);
		assert.equal((await readdir(directory)).filter(name => name.startsWith("fairbanks-candidates-")).length, 1);
	}
	finally {
		await rm(directory, {
			recursive: true,
			force: true
		});
	}
});

test("Fairbanks collection rejects overlap and releases its owned lock after completion", async () => {
	const directory = await temporary();
	let begin!: () => void;
	let resume!: () => void;
	const entered = new Promise<void>((resolve) => {
		begin = resolve;
	});
	const paused = new Promise<void>((resolve) => {
		resume = resolve;
	});
	try {
		const data = fixture();
		const options = {
			discovery: JSON.stringify(data.capture),
			scratchDirectory: directory,
			now: () => data.now,
			prepare: async () => {
				begin();
				await paused;
				return data.native;
			}
		};
		const first = fetchFairbanksCandidateCapture(source, options);
		await entered;
		await assert.rejects(fetchFairbanksCandidateCapture(source, options), /lock requires review/u);
		resume();
		assert.equal(await first, data.body);
		assert.ok(!(await readdir(directory)).some(name => name.endsWith(".lock") || name.endsWith(".tmp")));
	}
	finally {
		resume();
		await rm(directory, {
			recursive: true,
			force: true
		});
	}
});

test("Fairbanks snapshot persistence failure keeps serving the prior accepted records", async () => {
	const directory = await temporary();
	try {
		const data = fixture(2027);
		const future = fairbanksSource(data.electionDate);
		const snapshot = { source: future, ...parseFairbanksCandidateCapture(future, data.body, createStateCandidateRecord, data.now) };
		const storage = createStateBallotStorage(directory);
		await storage.write(snapshot);
		const files = await readdir(directory);
		assert.equal(files.length, 1);
		const target = join(directory, files[0]!);
		const previous = await readFile(target);
		let failures = 0;
		const repository = createStateBallotRepository({
			sources: [future],
			dataDirectory: directory,
			ttlMs: 1,
			now: () => data.now + 3600000,
			collectionIndexSha256: {
				[future.id]: snapshot.collectionIndexSha256
			},
			refreshReviewedLegacy: true,
			onPersistenceError: () => {
				failures++;
			},
			fetchText: async () => {
				await rename(target, `${target}.preserved`);
				await mkdir(target);
				return data.body;
			}
		});
		assert.equal((await repository.getSnapshot("AK", future.id))?.records.length, 5);
		assert.equal(failures, 1);
		assert.deepEqual(await readFile(`${target}.preserved`), previous);
		await rm(target, { recursive: true });
		await rename(`${target}.preserved`, target);
		assert.equal((await createStateBallotRepository({ sources: [future], dataDirectory: directory, now: () => data.now }).getSnapshot("AK", future.id))?.records.length, 5);
	}
	finally {
		await rm(directory, {
			recursive: true,
			force: true
		});
	}
});

test("Fairbanks snapshots round-trip offline and archived without browser-triggered collection", async () => {
	const directory = await temporary();
	try {
		const data = fixture();
		const snapshot = { source, ...parseFairbanksCandidateCapture(source, data.body, createStateCandidateRecord, data.now) };
		const storage = createStateBallotStorage(directory);
		await storage.write(snapshot);
		const body = serializeStoredStateSnapshot(snapshot);
		assert.deepEqual(parseBundledStateSnapshot(source, body, "automatic").records, JSON.parse(JSON.stringify(snapshot.records)));
		for (const field of ["collectionIndexSha256", "jurisdiction", "scope", "party", "termYears", "voteLimit"]) {
			const altered = JSON.parse(body);
			if (field === "collectionIndexSha256") altered[field] = "0".repeat(64);
			else altered.records[0][field] = { jurisdiction: "Anchorage", scope: "statewide", party: "Democratic", termYears: 12, voteLimit: 50 }[field];
			assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(altered), "automatic"), /review|invalid/u, field);
		}
		let requests = 0;
		const repository = createStateBallotRepository({
			sources: [source],
			dataDirectory: directory,
			now: () => data.now,
			fetchText: async () => {
				requests++;
				throw new Error("Publisher request unexpected");
			}
		});
		assert.equal((await repository.getSnapshot("AK", source.id))?.records.length, 5);
		assert.equal(await repository.getSnapshot("AK"), null);
		assert.equal(requests, 0);
	}
	finally {
		await rm(directory, {
			recursive: true,
			force: true
		});
	}
});

test("Fairbanks transport and format failures retain available last-good snapshots", async () => {
	const directory = await temporary();
	try {
		const data = fixture(2027);
		const future = fairbanksSource(data.electionDate);
		const snapshot = { source: future, ...parseFairbanksCandidateCapture(future, data.body, createStateCandidateRecord, data.now) };
		await createStateBallotStorage(directory).write(snapshot);
		for (const failure of ["transport", "format"]) {
			const repository = createStateBallotRepository({ sources: [future], dataDirectory: directory, ttlMs: 1, now: () => data.now + 3600000, collectionIndexSha256: { [future.id]: snapshot.collectionIndexSha256 }, fetchText: async () => {
				if (failure === "transport") throw new Error("Publisher unavailable");
				return "{}";
			} });
			assert.deepEqual((await repository.getSnapshot("AK", future.id))?.records, JSON.parse(JSON.stringify(snapshot.records)));
			assert.ok((await repository.inspectSources!())[0]?.failure);
		}
	}
	finally {
		await rm(directory, {
			recursive: true,
			force: true
		});
	}
});

test("Fairbanks future-cycle synchronization preserves accepted catalogs through publisher and format failures", async () => {
	const directory = await temporary();
	try {
		const data = fixture(2027);
		const options = { familyId: source.id, catalogPath: join(directory, "catalog.json"), dataDirectory: join(directory, "snapshots"), fetchDiscovery: async () => JSON.stringify(data.capture), fetchCandidates: async () => data.body, now: () => data.now };
		const result = await syncStateBallotCycles(options);
		assert.deepEqual(result.results.map(item => item.status), ["available"]);
		assert.equal(result.results[0]!.records, 5);
		const accepted = await readFile(options.catalogPath, "utf8");
		await assert.rejects(syncStateBallotCycles({
			...options,
			fetchDiscovery: async () => {
				throw new Error("Publisher unavailable");
			}
		}), /Publisher unavailable/u);
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => JSON.stringify(fixture().capture) }), /active.*disappeared/u);
		const altered = structuredClone(data.capture);
		const bytes = "%PDF-1.7\nSynthetic updated publication";
		altered.documents[0]!.body = Buffer.from(bytes).toString("base64");
		altered.documents[0]!.sha256 = hash(bytes);
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => JSON.stringify(altered), fetchCandidates: async () => "{}" }), /collection failed/u);
		assert.equal(await readFile(options.catalogPath, "utf8"), accepted);
		const repeated = await syncStateBallotCycles(options);
		assert.equal(repeated.results[0]!.records, 5);
		assert.equal(readStateBallotCycleCatalog(options.catalogPath, data.now)?.elections.length, 1);
		assert.equal(readFairbanksCycleDiscovery(JSON.stringify(data.capture), data.now).elections[0]!.electionDate, "2027-10-05");
	}
	finally {
		await rm(directory, {
			recursive: true,
			force: true
		});
	}
});
