import type { ElectionReferenceSource } from "../src/election-reference-sources.js";
import type { ElectionReferenceSnapshot } from "../src/election-references.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";
import { registerElectionReferenceRoutes } from "../src/election-reference-routes.js";
import { electionReferenceSources } from "../src/election-reference-sources.js";
import { createElectionReferenceRepository, createElectionReferenceStorage, electionReferenceDocumentDigest, parseElectionReferenceSelection } from "../src/election-references.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { registerStateRecordDetailRoutes } from "../src/state-record-detail.js";

const source = electionReferenceSources.find(source => source.id === "la-senate-reporting-2026")!;
const future: ElectionReferenceSource = { ...source, id: "la-test-reporting-2028", electionDate: "2028-11-07" };
const cutoff = Date.parse(`${source.electionDate}T00:00:00Z`) + 2 * 86400000;
function snapshot(collection = source): ElectionReferenceSnapshot {
	const documents = collection.documents.map(document => ({
		url: document.url,
		sha256: "a".repeat(64),
		capturedAt: "2026-10-20T12:00:00.000Z",
		includedRecordCount: 1
	}));
	return {
		schemaVersion: 1,
		type: "election-references",
		stateCode: "LA",
		sourceId: collection.id,
		electionDate: collection.electionDate,
		retrievedAt: documents[0]!.capturedAt,
		sourceSha256: electionReferenceDocumentDigest(documents),
		recordCount: 1,
		documents,
		records: [
			{
				id: "b".repeat(24),
				name: "Example Person",
				office: "Mayor",
				jurisdiction: "Example town",
				scope: "local",
				facts: ["A dated candidate statement."],
				sourceDocumentIndex: 0
			}
		]
	};
}

test("reference selection accepts explicit source/date pins and rejects malformed or repeated values", () => {
	assert.deepEqual(parseElectionReferenceSelection({}), {});
	assert.deepEqual(parseElectionReferenceSelection({ source: source.id, electionDate: source.electionDate }), { sourceId: source.id, electionDate: source.electionDate });
	for (const query of [
		{ source: "../private" },
		{
			source: [source.id]
		},
		{ source: "" },
		{ electionDate: "2026-02-30" },
		{ electionDate: "2026-11-03T00:00:00Z" },
		{ electionDate: "" },
		{
			electionDate: [source.electionDate]
		}
	]) assert.throws(() => parseElectionReferenceSelection(query));
});

test("default and personal reference selection expires while exact historical selection stays readable", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "reference-history-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const storage = createElectionReferenceStorage(directory);
	await storage.write(source, snapshot());
	let clock = cutoff - 1;
	const repository = createElectionReferenceRepository({
		dataDirectory: directory,
		sources: [source, future],
		now: () => clock
	});
	assert.equal((await repository.getSnapshots!("LA")).length, 1);
	for (const instant of [cutoff, cutoff + 1]) {
		clock = instant;
		assert.deepEqual(await repository.getSnapshots!("LA"), []);
		assert.equal((await repository.getSnapshots!("LA", { sourceId: source.id }))[0]!.sourceId, source.id);
		assert.equal((await repository.getSnapshots!("LA", { electionDate: source.electionDate }))[0]!.electionDate, source.electionDate);
	}
	assert.deepEqual(await repository.getElections!("LA"), [source.electionDate]);
	assert.deepEqual(await repository.getElections!("HI"), []);
	assert.deepEqual(await repository.getSnapshots!("LA", { sourceId: future.id }), []);
	assert.deepEqual(await repository.getSnapshots!("LA", { sourceId: source.id, electionDate: future.electionDate }), []);
});

test("actual reference routes preserve expiry, expose only stored dates and bind historical requests exactly", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "reference-history-api-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	await createElectionReferenceStorage(directory).write(source, snapshot());
	let clock = cutoff - 1;
	const repository = createElectionReferenceRepository({
		dataDirectory: directory,
		sources: [source, future],
		now: () => clock
	});
	const app = express();
	registerElectionReferenceRoutes(app, repository, undefined, undefined, () => clock);
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	context.after(() => new Promise<void>(resolve => server.close(() => resolve())));
	const address = server.address();
	assert(address && typeof address !== "string");
	const url = `http://127.0.0.1:${address.port}/api/election-references/LA`;
	for (const instant of [cutoff - 1, cutoff, cutoff + 1]) {
		clock = instant;
		const response = await fetch(url);
		assert.equal(response.status, 200);
		assert.equal((await response.json()).available, instant < cutoff);
		for (const query of [`?source=${source.id}`, `?electionDate=${source.electionDate}`]) {
			const historic = await fetch(url + query);
			assert.equal(historic.status, 200);
			const body = await historic.json();
			assert.equal(body.total, 1);
			assert.equal(body.electionDate, source.electionDate);
			assert.deepEqual(body.collections, [source.id]);
			assert.equal(historic.headers.get("cache-control"), "no-store");
		}
	}
	assert.deepEqual(await (await fetch(`${url}/catalog`)).json(), {
		stateCode: "LA",
		elections: [source.electionDate]
	});
	for (const query of [
		"?electionDate=2026-02-30",
		"?electionDate=2019-01-01",
		"?source=unknown",
		"?source=la-senate-reporting-2026&source=unknown",
		`?source=${source.id}&electionDate=${future.electionDate}`,
		"?includeHistory=true"
	]) assert.equal((await fetch(url + query)).status, 400);
	assert.equal((await fetch(`${url}/catalog?source=unknown`)).status, 400);
	assert.equal((await fetch(`${url.replace("/LA", "/XX")}/catalog`)).status, 400);
	await writeFile(join(directory, `references-${source.id}.json`), "{}");
	assert.equal((await fetch(`${url}/catalog`)).status, 503);
	assert.equal((await fetch(`${url}?source=${source.id}`)).status, 503);
});

test("a repository returning an expired or different collection cannot override current route selection", async (context) => {
	const app = express();
	registerElectionReferenceRoutes(app, {
		getSources: async () => [source, future],
		getSnapshot: async () => snapshot()
	}, undefined, undefined, () => cutoff);
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	context.after(() => new Promise<void>(resolve => server.close(() => resolve())));
	const address = server.address();
	assert(address && typeof address !== "string");
	const url = `http://127.0.0.1:${address.port}/api/election-references/LA`;
	assert.equal((await fetch(url)).status, 503);
	assert.equal((await fetch(`${url}?source=${future.id}`)).status, 503);
	assert.equal((await fetch(`${url}?source=${source.id}`)).status, 200);
});

test("historical official record details request only the matching election's background", async (context) => {
	const official = configuredStateBallotSources.find(source => source.id === "la-st-charles-sample-2026")!;
	const record = createStateCandidateRecord(official, {
		name: "Example Person",
		office: "Mayor",
		jurisdiction: "Example town",
		party: "",
		status: "listed",
		scope: "local"
	})!;
	const app = express();
	let requested: unknown;
	registerStateRecordDetailRoutes(app, {
		sources: [official],
		getSnapshot: async () => ({
			source: official,
			records: [record],
			sha256: "a".repeat(64),
			retrievedAt: "2026-10-20T12:00:00.000Z"
		})
	}, {
		getSources: async () => [source],
		getSnapshot: async (_state, selection) => {
			requested = selection;
			return snapshot();
		}
	}, undefined, () => cutoff);
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	context.after(() => new Promise<void>(resolve => server.close(() => resolve())));
	const address = server.address();
	assert(address && typeof address !== "string");
	const url = `http://127.0.0.1:${address.port}/api/state-records/LA/${record.id}`;
	assert.equal((await fetch(url)).status, 404);
	assert.equal(requested, undefined);
	const response = await fetch(`${url}?source=${official.id}`);
	assert.equal(response.status, 200);
	assert.deepEqual(requested, { electionDate: source.electionDate });
	assert.equal((await response.json()).references.length, 1);
});

test("reference history discovery preserves stored files and rejects symbolic-link storage", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "reference-history-storage-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const storage = createElectionReferenceStorage(directory);
	await storage.write(source, snapshot());
	const path = join(directory, `references-${source.id}.json`);
	const before = await readFile(path);
	const repository = createElectionReferenceRepository({
		dataDirectory: directory,
		sources: [source],
		now: () => cutoff
	});
	assert.deepEqual(await repository.getElections!("LA"), [source.electionDate]);
	assert.deepEqual(await readFile(path), before);
	const aliasDirectory = join(directory, "alias");
	await mkdir(aliasDirectory);
	await symlink(path, join(aliasDirectory, `references-${source.id}.json`));
	await assert.rejects(createElectionReferenceStorage(aliasDirectory).read(source), /regular file/u);
});
