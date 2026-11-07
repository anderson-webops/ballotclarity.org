import type { JohnsonCollectionOptions } from "../src/state-ballot-johnson-collection.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { once } from "node:events";
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";
import { johnsonBallotHash, johnsonBallotMapUrl, johnsonSampleInventory } from "../src/johnson-ballot-publications.js";
import { johnsonSampleStyle } from "../src/johnson-ballot-questions.js";
import { fetchIowaJohnsonCandidateCapture, parseIowaJohnsonCandidateCapture, readIowaJohnsonCandidatePage } from "../src/state-ballot-iowa-johnson.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { registerStateRecordRoutes, stateRecordDocumentLinks } from "../src/state-records.js";
import { johnsonBallotFixture } from "./helpers/johnson-ballot-fixture.js";

const parse = (fixture: ReturnType<typeof johnsonBallotFixture>) => parseIowaJohnsonCandidateCapture(fixture.source, fixture.body(), createStateCandidateRecord, fixture.now);
function resourceBody(fixture: ReturnType<typeof johnsonBallotFixture>, index: number, change: (body: string) => string) {
	const resource = fixture.ballots.resources[index]!;
	resource.body = change(resource.body);
	resource.sha256 = johnsonBallotHash(resource.body);
}
function collectionOptions(fixture: ReturnType<typeof johnsonBallotFixture>, directory: string, requests: string[] = []): JohnsonCollectionOptions {
	return { scratchDirectory: directory, now: () => fixture.now, wait: async (milliseconds) => {
		assert.ok(milliseconds >= 11000);
	}, extract: async () => fixture.raw, requestDocument: async (url, options) => {
		requests.push(url);
		assert.deepEqual(options.allowedHosts, [new URL(url).hostname]);
		assert.equal(options.timeoutMs, 25000);
		assert.ok(options.maxBytes! <= 12 * 1024 * 1024);
		if (url === fixture.sampleUrl) return { status: 200, body: fixture.bytes, contentType: "application/pdf", etag: undefined };
		const resource = fixture.ballots.resources.find(item => item.url === url);
		assert.ok(resource, `Only actual offered resources may be requested: ${url}`);
		return { status: resource.status, body: Buffer.from(resource.body), contentType: "text/html", etag: undefined };
	} };
}

test("Johnson native capture retains six literal questions, independent scopes and all 102 earlier candidate fields", () => {
	const fixture = johnsonBallotFixture();
	const result = parse(fixture);
	assert.deepEqual(result.records, readIowaJohnsonCandidatePage(fixture.source, fixture.discovery.pages[0]!.body, createStateCandidateRecord).records);
	assert.equal(result.records.length, 102);
	assert.equal(result.ballotQuestions?.length, 6);
	assert.deepEqual(result.ballotQuestions?.map(question => question.audience), ["Iowa", "Johnson County", "Hills", "Lone Tree Community School District", "Mid-Prairie Community School District", "Kirkwood Community College (Merged Area X)"]);
	assert.ok(result.ballotQuestions?.every(question => question.choices.join("|") === "YES|NO" && question.pages.join("|") === "2" && !question.voterApplicabilityVerified && question.sourceUrl === fixture.sampleUrl));
	assert.equal(result.documents.length, 10);
	assert.equal(result.documents[0]!.includedRecordCount, 102);
	assert.ok(result.documents.slice(1).every(document => document.includedRecordCount === 0));
	assert.notEqual(result.sha256, fixture.discovery.pages[0]!.sha256);
});

test("Future published-cycle fixtures reuse native parsing and keep candidate/judicial-only ballots valid", () => {
	const future = johnsonBallotFixture("2028-11-07");
	const futureParsed = parse(future);
	assert.equal(futureParsed.ballotQuestions?.length, 6);
	assert.ok(futureParsed.ballotQuestions?.every(question => !parse(johnsonBallotFixture()).ballotQuestions?.some(prior => prior.id === question.id)));
	const only = johnsonBallotFixture("2028-11-07", true);
	assert.deepEqual(parse(only).ballotQuestions, []);
	assert.equal(parse(only).records.length, 102);
	assert.throws(() => parseIowaJohnsonCandidateCapture(johnsonBallotFixture().source, future.body(), createStateCandidateRecord, future.now), /offer|selected|election/u);
});

test("Complete printed style and election identities reject prefix matches and foreign sample URLs", () => {
	const fixture = johnsonBallotFixture();
	for (const replacement of ["Ballot Style 10", "Ballot Style 2"]) {
		fixture.ballots.documents[0]!.raw = fixture.raw.replace("Ballot Style 1", replacement);
		fixture.ballots.documents[0]!.layout = fixture.ballots.documents[0]!.raw;
		assert.throws(() => parse(fixture), /complete style/u);
	}
	assert.throws(() => johnsonSampleStyle(fixture.sampleUrl.replace("https://", "https://user@"), fixture.source.electionDate));
	assert.throws(() => johnsonSampleStyle(fixture.sampleUrl, "2026-11-04"));
	assert.throws(() => johnsonSampleStyle(fixture.sampleUrl.replace("johnsoncountyiowa.gov", "example.invalid"), fixture.source.electionDate));
});

test("Incomplete vote choices, unknown codes and independent native disagreement hold a capture", () => {
	for (const change of [(body: string) => body.replace("\nLY\n", "\nZZ\n"), (body: string) => body.replace("bonds for a synthetic facility?\nYES\nNO", "bonds for a synthetic facility?\nYES\nMAYBE")]) {
		const fixture = johnsonBallotFixture();
		fixture.ballots.documents[0]!.raw = change(fixture.raw);
		fixture.ballots.documents[0]!.layout = fixture.ballots.documents[0]!.raw;
		assert.throws(() => parse(fixture), /review/u);
	}
	const fixture = johnsonBallotFixture();
	fixture.ballots.documents[0]!.layout = fixture.raw.replace("facility", "warehouse");
	assert.throws(() => parse(fixture), /raw\/layout/u);
});

test("Literal sample URL normalization retains raw attributes and rejects embedded controls", () => {
	const fixture = johnsonBallotFixture();
	const ids = fixture.ballots.resources[6]!.body;
	const records = JSON.parse(fixture.ballots.resources[7]!.body);
	records.features[0].attributes.SampleBallotURL += "\r\n";
	const inventory = johnsonSampleInventory(fixture.source, ids, JSON.stringify(records));
	assert.deepEqual(inventory.urls, [fixture.sampleUrl]);
	assert.ok(String(inventory.attributes[0]!.SampleBallotURL).endsWith("\r\n"));
	records.features[0].attributes.SampleBallotURL = fixture.sampleUrl.replace("Style01", "Style\n01");
	assert.throws(() => johnsonSampleInventory(fixture.source, ids, JSON.stringify(records)), /literal public sample/u);
});

test("A partial GIS table, duplicated IDs, extra personal fields and transfer truncation require review", () => {
	for (const change of [(body: Record<string, unknown>) => {
		body.features = [];
	}, (body: Record<string, unknown>) => {
		body.exceededTransferLimit = true;
	}, (body: Record<string, unknown>) => {
		(body.features as { attributes: Record<string, unknown> }[])[0]!.attributes.voterName = "Synthetic private field";
	}]) {
		const fixture = johnsonBallotFixture();
		resourceBody(fixture, 7, (body) => {
			const value = JSON.parse(body);
			change(value);
			return JSON.stringify(value);
		});
		assert.throws(() => parse(fixture), /inventory|response fields/u);
	}
	const fixture = johnsonBallotFixture();
	resourceBody(fixture, 6, body => body.replace("[1]", "[1,1]"));
	assert.throws(() => parse(fixture), /object-ID/u);
});

test("Changed GIS policies, publication copyright or an unoffered layer hold acquisition", () => {
	for (const index of [1, 4, 5]) {
		const fixture = johnsonBallotFixture();
		if (index === 1) {
			fixture.ballots.resources[1]!.status = 200;
			resourceBody(fixture, 1, () => "User-agent: *\nDisallow: /\n");
		}
		else {
			resourceBody(fixture, index, body => body.replace("\"copyrightText\":\"\"", "\"copyrightText\":\"Changed publication terms\""));
		}
		assert.throws(() => parse(fixture), /policy|terms/u);
	}
	const fixture = johnsonBallotFixture();
	resourceBody(fixture, 3, body => body.replace("gis.johnsoncountyiowa.gov", "example.invalid"));
	assert.throws(() => parse(fixture), /same-host offered/u);
});

test("Stored metadata validates exact choices, source/page identity, question hashes and the complete publication set", () => {
	const fixture = johnsonBallotFixture();
	const snapshot = { source: fixture.source, ...parse(fixture) };
	const body = serializeStoredStateSnapshot(snapshot);
	assert.deepEqual(parseBundledStateSnapshot(fixture.source, body, "automatic").ballotQuestions, snapshot.ballotQuestions);
	for (const field of ["id", "audience", "choices", "pages", "sourceUrl", "voterApplicabilityVerified"]) {
		const changed = JSON.parse(body);
		changed.ballotQuestions[0][field] = { id: "0".repeat(24), audience: "Other County", choices: ["Maybe"], pages: [1], sourceUrl: fixture.source.pageUrl, voterApplicabilityVerified: true }[field];
		assert.throws(() => parseBundledStateSnapshot(fixture.source, JSON.stringify(changed), "automatic"), /review/u);
	}
	const changed = JSON.parse(body);
	changed.documents.splice(7, 1);
	assert.throws(() => parseBundledStateSnapshot(fixture.source, JSON.stringify(changed), "automatic"), /review/u);
});

test("Existing version-one candidate captures and stored snapshots remain readable", () => {
	const fixture = johnsonBallotFixture();
	const old = parseIowaJohnsonCandidateCapture(fixture.source, JSON.stringify(fixture.discovery), createStateCandidateRecord, fixture.now);
	assert.equal(old.records.length, 102);
	assert.equal(old.ballotQuestions, undefined);
	assert.equal(old.documents.length, 1);
	assert.deepEqual(parseBundledStateSnapshot(fixture.source, serializeStoredStateSnapshot({ source: fixture.source, ...old }), "automatic").records, JSON.parse(JSON.stringify(old.records)));
	assert.throws(() => parseIowaJohnsonCandidateCapture(fixture.source, JSON.stringify(fixture.discovery), createStateCandidateRecord, fixture.now, parse(fixture)), /disappeared/u);
});

test("The collector follows only offered public resources, retains originals and reuses native extraction across restart", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "johnson-native-")));
	context.after(() => rm(directory, { recursive: true }));
	const fixture = johnsonBallotFixture();
	const requests: string[] = [];
	const options = collectionOptions(fixture, directory, requests);
	const first = await fetchIowaJohnsonCandidateCapture(fixture.source, { ...options, discovery: JSON.stringify(fixture.discovery) });
	assert.equal(requests.length, 9);
	assert.equal(parseIowaJohnsonCandidateCapture(fixture.source, first, createStateCandidateRecord, fixture.now).ballotQuestions?.length, 6);
	assert.ok((await readFile(join(directory, `original-${johnsonBallotHash(fixture.bytes)}.pdf`))).equals(fixture.bytes));
	const second = await fetchIowaJohnsonCandidateCapture(fixture.source, { ...options, discovery: JSON.stringify(fixture.discovery), now: () => fixture.now + 60000, extract: async () => {
		throw new Error("Unchanged PDF must reuse stored native text");
	} });
	assert.equal(second, first);
	assert.equal(requests.length, 18);
	assert.equal((await readdir(directory)).filter(name => name.endsWith(".capture.json")).length, 1);
});

test("Publisher failure, changed questions and a stale acquisition lock preserve the accepted capture", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "johnson-recovery-")));
	context.after(() => rm(directory, { recursive: true }));
	const fixture = johnsonBallotFixture();
	const options = collectionOptions(fixture, directory);
	await fetchIowaJohnsonCandidateCapture(fixture.source, { ...options, discovery: JSON.stringify(fixture.discovery) });
	const pointer = join(directory, `${fixture.source.id}-last-capture.json`);
	const accepted = await readFile(pointer);
	await assert.rejects(fetchIowaJohnsonCandidateCapture(fixture.source, { ...options, discovery: JSON.stringify(fixture.discovery), requestDocument: async () => {
		throw new Error("publisher unavailable");
	} }), /publisher unavailable/u);
	assert.ok((await readFile(pointer)).equals(accepted));
	fixture.bytes = Buffer.from("%PDF-changed-synthetic-johnson");
	fixture.raw = fixture.raw.replace("synthetic facility", "different synthetic facility");
	await assert.rejects(fetchIowaJohnsonCandidateCapture(fixture.source, { ...options, discovery: JSON.stringify(fixture.discovery) }), /accepted question changed/u);
	assert.ok((await readFile(pointer)).equals(accepted));
	await writeFile(join(directory, `${fixture.source.id}.lock`), "review this abandoned lock", { flag: "wx" });
	await assert.rejects(fetchIowaJohnsonCandidateCapture(fixture.source, { ...options, discovery: JSON.stringify(fixture.discovery) }), /EEXIST/u);
	assert.ok((await readFile(pointer)).equals(accepted));
});

test("Future candidate records import before current sample PDFs are offered without inventing ballot questions", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "johnson-future-wait-")));
	context.after(() => rm(directory, { recursive: true }));
	const fixture = johnsonBallotFixture("2028-11-07", true);
	resourceBody(fixture, 7, body => body.replaceAll("2028-11Sample", "2026-11Sample"));
	const capture = await fetchIowaJohnsonCandidateCapture(fixture.source, { ...collectionOptions(fixture, directory), discovery: JSON.stringify(fixture.discovery) });
	assert.equal(JSON.parse(capture).schemaVersion, 1);
	assert.equal(parseIowaJohnsonCandidateCapture(fixture.source, capture, createStateCandidateRecord, fixture.now).ballotQuestions, undefined);
	assert.ok(!(await readdir(directory)).some(name => name.endsWith(".pdf")));
});

test("Same-HTML refresh detects changed PDF bytes after cache expiry and rejected changes preserve the prior snapshot", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "johnson-refresh-")));
	context.after(() => rm(directory, { recursive: true }));
	const fixture = johnsonBallotFixture();
	let clock = fixture.now;
	let capture = fixture.body();
	const options = { sources: [fixture.source], dataDirectory: directory, collectionIndexSha256: { [fixture.source.id]: fixture.discovery.pages[0]!.sha256 }, refreshReviewedLegacy: true, now: () => clock, fetchText: async () => capture };
	const repository = createStateBallotRepository(options);
	const first = await repository.getSnapshot("IA", fixture.source.id);
	assert.equal(first?.ballotQuestions?.length, 6);
	fixture.ballots.documents[0]!.sha256 = johnsonBallotHash("changed PDF bytes with identical text");
	capture = fixture.body();
	clock += 5 * 3600000;
	const second = await repository.getSnapshot("IA", fixture.source.id);
	assert.ok(second);
	assert.notEqual(first?.sha256, second.sha256);
	assert.deepEqual(first?.ballotQuestions, second.ballotQuestions);
	const storage = createStateBallotStorage(directory);
	const accepted = serializeStoredStateSnapshot((await storage.read(fixture.source))!);
	fixture.ballots.documents[0]!.raw = fixture.raw.replace("synthetic facility", "unexpected new facility");
	fixture.ballots.documents[0]!.layout = fixture.ballots.documents[0]!.raw;
	capture = fixture.body();
	clock += 5 * 3600000;
	await repository.getSnapshot("IA", fixture.source.id);
	assert.equal(serializeStoredStateSnapshot((await storage.read(fixture.source))!), accepted);
});

test("First candidate-only pages remain importable before a sample map is offered, while an accepted map cannot disappear", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "johnson-no-map-")));
	context.after(() => rm(directory, { recursive: true }));
	const fixture = johnsonBallotFixture();
	const complete = fixture.discovery.pages[0]!.body;
	const withoutMap = complete.replace(`<a href="${johnsonBallotMapUrl}">Polling Place and Sample Ballot Lookup</a>`, "");
	assert.notEqual(withoutMap, complete);
	fixture.discovery.pages[0]!.body = withoutMap;
	fixture.discovery.pages[0]!.sha256 = johnsonBallotHash(withoutMap);
	const options = collectionOptions(fixture, directory);
	const legacy = await fetchIowaJohnsonCandidateCapture(fixture.source, {
		...options,
		discovery: JSON.stringify(fixture.discovery),
		requestDocument: async () => {
			throw new Error("The page offers no sample map");
		},
	});
	assert.equal(JSON.parse(legacy).schemaVersion, 1);
	assert.equal(parseIowaJohnsonCandidateCapture(fixture.source, legacy, createStateCandidateRecord, fixture.now).records.length, 102);
	fixture.discovery.pages[0]!.body = complete;
	fixture.discovery.pages[0]!.sha256 = johnsonBallotHash(complete);
	await fetchIowaJohnsonCandidateCapture(fixture.source, { ...options, discovery: JSON.stringify(fixture.discovery) });
	const pointer = join(directory, `${fixture.source.id}-last-capture.json`);
	const accepted = await readFile(pointer);
	fixture.discovery.pages[0]!.body = withoutMap;
	fixture.discovery.pages[0]!.sha256 = johnsonBallotHash(withoutMap);
	await assert.rejects(fetchIowaJohnsonCandidateCapture(fixture.source, { ...options, discovery: JSON.stringify(fixture.discovery) }), /sample map disappeared/u);
	assert.ok((await readFile(pointer)).equals(accepted));
});

test("An accepted style cannot disappear even when the remaining sample still contains every question", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "johnson-style-disappearance-")));
	context.after(() => rm(directory, { recursive: true }));
	const fixture = johnsonBallotFixture();
	const secondUrl = fixture.sampleUrl.replace("Style01", "Style02");
	resourceBody(fixture, 7, (body) => {
		const value = JSON.parse(body);
		value.features[0].attributes.SampleBallotURL2 = secondUrl;
		return JSON.stringify(value);
	});
	const options = collectionOptions(fixture, directory);
	const secondBytes = Buffer.from("%PDF-synthetic-second-johnson-style");
	const request = options.requestDocument!;
	await fetchIowaJohnsonCandidateCapture(fixture.source, {
		...options,
		discovery: JSON.stringify(fixture.discovery),
		requestDocument: async (url, transport) => url === secondUrl ? { status: 200, body: secondBytes, contentType: "application/pdf", etag: undefined } : request(url, transport),
		extract: async bytes => bytes.equals(secondBytes) ? fixture.raw.replace("Ballot Style 1", "Ballot Style 2") : fixture.raw,
	});
	const pointer = join(directory, `${fixture.source.id}-last-capture.json`);
	const accepted = await readFile(pointer);
	resourceBody(fixture, 7, (body) => {
		const value = JSON.parse(body);
		value.features[0].attributes.SampleBallotURL2 = null;
		return JSON.stringify(value);
	});
	await assert.rejects(fetchIowaJohnsonCandidateCapture(fixture.source, { ...options, discovery: JSON.stringify(fixture.discovery) }), /sample ballot disappeared/u);
	assert.ok((await readFile(pointer)).equals(accepted));
});

test("A failed immutable-capture write preserves the prior pointer and allows a clean retry", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "johnson-write-failure-")));
	context.after(() => rm(directory, { recursive: true }));
	const fixture = johnsonBallotFixture();
	const options = collectionOptions(fixture, directory);
	const first = await fetchIowaJohnsonCandidateCapture(fixture.source, { ...options, discovery: JSON.stringify(fixture.discovery) });
	const pointer = join(directory, `${fixture.source.id}-last-capture.json`);
	const accepted = await readFile(pointer);
	fixture.bytes = Buffer.from("%PDF-synthetic-changed-container-identical-native-text");
	const next = JSON.parse(first);
	next.ballots.documents[0].sha256 = johnsonBallotHash(fixture.bytes);
	const blocker = join(directory, `${johnsonBallotHash(JSON.stringify(next))}.capture.json`);
	await mkdir(blocker);
	await assert.rejects(fetchIowaJohnsonCandidateCapture(fixture.source, { ...options, discovery: JSON.stringify(fixture.discovery) }), /EISDIR|ENOTDIR|EEXIST/u);
	assert.ok((await readFile(pointer)).equals(accepted));
	assert.ok(!(await readdir(directory)).some(name => name.endsWith(".lock") || name.endsWith(".tmp")));
	await rm(blocker, { recursive: true });
	const retry = await fetchIowaJohnsonCandidateCapture(fixture.source, { ...options, discovery: JSON.stringify(fixture.discovery) });
	assert.equal(retry, JSON.stringify(next));
	assert.equal(parseIowaJohnsonCandidateCapture(fixture.source, retry, createStateCandidateRecord, fixture.now).ballotQuestions?.length, 6);
});

test("Public stored reads expose six questions with precise citations and one official sample selector", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "johnson-question-api-")));
	context.after(() => rm(directory, { recursive: true }));
	const fixture = johnsonBallotFixture();
	const snapshot = { source: fixture.source, ...parse(fixture) };
	await createStateBallotStorage(directory).write(snapshot);
	const repository = createStateBallotRepository({ sources: [fixture.source], dataDirectory: directory, now: () => fixture.now, fetchText: async () => {
		throw new Error("Public readers never acquire PDFs or GIS data");
	} });
	const app = express();
	registerStateRecordRoutes(app, repository);
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	context.after(() => new Promise<void>(resolve => server.close(() => resolve())));
	const address = server.address();
	assert.ok(address && typeof address === "object");
	const origin = `http://127.0.0.1:${address.port}`;
	const response = await fetch(`${origin}/api/state-records/IA/questions?source=${fixture.source.id}`);
	assert.equal(response.status, 200);
	const payload = await response.json();
	assert.equal(payload.questions.length, 6);
	assert.deepEqual(payload.source.documentLinks, stateRecordDocumentLinks(fixture.source, snapshot));
	assert.equal(payload.source.documentLinks[0].url, johnsonBallotMapUrl);
	assert.equal(payload.source.documentLinks.length, 3);
	assert.ok(payload.questions.every((question: { sourceUrl: string }) => payload.source.documentLinks.some((link: { url: string }) => link.url === question.sourceUrl)));
	const candidates = await (await fetch(`${origin}/api/state-records/IA?source=${fixture.source.id}`)).json();
	assert.equal(candidates.questionCount, 6);
	assert.equal(candidates.total, 102);
});
