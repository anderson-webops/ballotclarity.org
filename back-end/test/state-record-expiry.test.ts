import type { StateBallotRepository, StateBallotSnapshot } from "../src/state-ballot-repository.js";
import type { LocationLookupResponse } from "../src/types/civic.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { attachStateBallotPreview } from "../src/state-ballot-repository.js";
import { stateBallotSourceIsCurrent } from "../src/state-ballot-source-state.js";
import { registerStateRecordDetailRoutes } from "../src/state-record-detail.js";
import { registerStateRecordRoutes } from "../src/state-records.js";

const source = configuredStateBallotSources.find(source => source.id === "ak-doe-2026")!;
const cutoff = Date.parse("2026-11-05T00:00:00.000Z");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const snapshot: StateBallotSnapshot = { source, sha256: hash("synthetic Alaska data"), retrievedAt: "2026-10-26T01:00:00.000Z", records: Array.from({ length: 155 }, (_, index) => ({ id: hash(`synthetic-${index}`).slice(0, 24), name: `Synthetic Candidate ${index}`, office: "United States Senator", district: "", scope: "statewide", status: "listed" })) };
async function serve(clock: () => number, data = snapshot, read?: StateBallotRepository["getSnapshot"]) {
	const reads: (string | undefined)[] = [];
	const repository: StateBallotRepository = { sources: [data.source], async getSnapshot(state, id) {
		reads.push(id);
		if (read) return read(state, id);
		return id !== undefined || stateBallotSourceIsCurrent(data.source, clock()) ? data : null;
	} };
	const app = express();
	registerStateRecordRoutes(app, repository, undefined, clock);
	registerStateRecordDetailRoutes(app, repository, null, undefined, clock);
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	assert.ok(address && typeof address === "object");
	return { origin: `http://127.0.0.1:${address.port}`, reads, close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}

test("The actual state-records route honors the exact cutoff while explicit historical selection retains all 155 records", async () => {
	for (const clock of [cutoff - 1, cutoff, cutoff + 1, Date.parse("2026-11-07T12:00:00Z")]) {
		const server = await serve(() => clock);
		try {
			const current = await fetch(`${server.origin}/api/state-records/AK?scope=all&limit=100`);
			assert.equal(current.status, 200);
			assert.equal(current.headers.get("cache-control"), "no-store");
			const data = await current.json();
			assert.equal(data.available, clock < cutoff);
			assert.equal(data.total, clock < cutoff ? 155 : 0);
			assert.equal(data.records.length, clock < cutoff ? 100 : 0);
			assert.deepEqual(server.reads, clock < cutoff ? [undefined] : []);
			const archived = await (await fetch(`${server.origin}/api/state-records/AK?scope=all&limit=100&source=${source.id}`)).json();
			assert.equal(archived.available, true);
			assert.equal(archived.total, 155);
			assert.equal(archived.source.electionDate, "2026-11-03");
		}
		finally { await server.close(); }
	}
});

test("Default candidate detail expires at the cutoff while explicit historical detail stays readable", async () => {
	for (const clock of [cutoff - 1, cutoff, cutoff + 1]) {
		const server = await serve(() => clock);
		try {
			const url = `${server.origin}/api/state-records/AK/${snapshot.records[0]!.id}`;
			assert.equal((await fetch(url)).status, clock < cutoff ? 200 : 404);
			assert.equal((await fetch(`${url}?source=${source.id}`)).status, 200);
		}
		finally { await server.close(); }
	}
});

test("Default route lookup never promotes a null current read to an explicit archive read", async () => {
	const server = await serve(() => cutoff - 1, snapshot, async (_state, id) => id === undefined ? null : snapshot);
	try {
		const data = await (await fetch(`${server.origin}/api/state-records/AK`)).json();
		assert.equal(data.available, false);
		assert.equal((await fetch(`${server.origin}/api/state-records/AK/${snapshot.records[0]!.id}`)).status, 404);
		assert.deepEqual(server.reads, [undefined, undefined]);
	}
	finally { await server.close(); }
});

test("The directory preserves historical source choices without advertising an expired default election", async () => {
	for (const clock of [cutoff - 1, cutoff, cutoff + 1]) {
		const server = await serve(() => clock);
		try {
			const directory = await (await fetch(`${server.origin}/api/state-records`)).json();
			const alaska = directory.states.find((state: { stateCode: string }) => state.stateCode === "AK");
			assert.equal(alaska.configured, true);
			assert.equal(alaska.electionDate, clock < cutoff ? source.electionDate : undefined);
			assert.deepEqual(alaska.sources, [{ id: source.id, label: source.label, electionDate: source.electionDate }]);
		}
		finally { await server.close(); }
	}
});

test("Expiry crossed during an asynchronous current lookup cannot return historical candidate facts", async () => {
	let clock = cutoff - 1;
	const server = await serve(() => clock, snapshot, async () => {
		clock = cutoff;
		return snapshot;
	});
	try {
		const response = await fetch(`${server.origin}/api/state-records/AK`);
		assert.equal(response.status, 503);
		assert.equal((await response.json()).available, undefined);
	}
	finally { await server.close(); }
});

test("Personal results reject expired snapshots even when a repository returns one, and clear saved expired previews", async () => {
	for (const clock of [cutoff - 1, cutoff, cutoff + 1]) {
		const lookup = { result: "resolved", inputKind: "zip", detectedFromIp: false, location: { state: "AK" }, districtMatches: [], representativeMatches: [], actions: [], guideAvailability: "not-published", guideContent: null } as unknown as LocationLookupResponse;
		const repository: StateBallotRepository = { sources: [source], async getSnapshot() {
			return snapshot;
		} };
		await attachStateBallotPreview(lookup, repository, undefined, () => clock);
		assert.equal(lookup.ballotContentPreviews?.length ?? 0, clock < cutoff ? 1 : 0);
		if (clock < cutoff) {
			await attachStateBallotPreview(lookup, null, undefined, () => cutoff);
			assert.deepEqual(lookup.ballotContentPreviews, []);
		}
	}
});

test("Personal lookup rechecks expiry after awaiting a candidate snapshot", async () => {
	let clock = cutoff - 1;
	const lookup = { result: "resolved", inputKind: "zip", location: { state: "AK" }, districtMatches: [] } as unknown as LocationLookupResponse;
	await attachStateBallotPreview(lookup, { sources: [source], async getSnapshot() {
		clock = cutoff;
		return snapshot;
	} }, undefined, () => clock);
	assert.equal(lookup.ballotContentPreviews?.length ?? 0, 0);
});
