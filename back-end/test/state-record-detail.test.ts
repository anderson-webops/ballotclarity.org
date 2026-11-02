import type { ElectionReferenceRepository } from "../src/election-references.js";
import type { StateBallotRepository, StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { createPublicRequestThrottle } from "../src/public-request-throttle.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { registerStateRecordDetailRoutes } from "../src/state-record-detail.js";
import { registerStateRecordRoutes } from "../src/state-records.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const source = configuredStateBallotSources.find(source => source.id === "ga-fulton-2026")!;
const snapshot = (): StateBallotSnapshot => ({ source, sha256: hash("original"), retrievedAt: "2026-11-01T12:00:00Z", records: Array.from({ length: 151 }, (_, index) => ({ id: hash(`candidate-${index}`).slice(0, 24), name: `Candidate ${index}`, office: "Governor", district: "", scope: "statewide", party: "Example", status: index === 150 ? "withdrawn" : "listed" })) });
async function serve(options: { snapshot?: StateBallotSnapshot | null; candidateFailure?: boolean; referenceFailure?: boolean; maximum?: number } = {}) {
	const data = options.snapshot === undefined ? snapshot() : options.snapshot;
	let reads = 0;
	const candidates = { sources: [source], async getSnapshot() {
		reads++;
		if (options.candidateFailure) throw new Error("private candidate storage path");
		return data;
	} } as unknown as StateBallotRepository;
	const references: ElectionReferenceRepository = { async getSnapshot() {
		if (options.referenceFailure) throw new Error("private reference storage path");
		return null;
	} };
	const app = express();
	registerStateRecordRoutes(app, candidates, createPublicRequestThrottle({ maxRequests: options.maximum ?? 30, maxBuckets: 10, windowMs: 60_000 }));
	registerStateRecordDetailRoutes(app, candidates, references);
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	assert(address && typeof address === "object");
	return { origin: `http://127.0.0.1:${address.port}`, reads: () => reads, close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}

test("a stable candidate ID resolves directly without a name hint or paginating directory pages", async () => {
	const server = await serve();
	try {
		const last = snapshot().records[150]!;
		const response = await fetch(`${server.origin}/api/state-records/GA/${last.id}?source=${source.id}`);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("cache-control"), "no-store");
		const body = await response.json();
		assert.equal(body.record.id, last.id);
		assert.equal(body.record.name, last.name);
		assert.equal(body.record.status, "withdrawn");
		assert.equal(body.source.id, source.id);
		assert.equal(body.source.electionDate, source.electionDate);
		assert.deepEqual(body.references, []);
		assert.equal(server.reads(), 1);
		assert.equal("records" in body, false);
	}
	finally { await server.close(); }
});

test("invalid identifiers, source arrays and extraneous filters fail before candidate reads", async () => {
	const server = await serve();
	try {
		for (const suffix of [`ZZ/${hash("id").slice(0, 24)}`, "GA/not-an-id", `GA/${hash("id").slice(0, 24)}?source=unknown`, `GA/${hash("id").slice(0, 24)}?source=a&source=b`, `GA/${hash("id").slice(0, 24)}?q=other`, `GA/${hash("id").slice(0, 24)}?source[key]=a`]) assert.equal((await fetch(`${server.origin}/api/state-records/${suffix}`)).status, 400);
		assert.equal(server.reads(), 0);
	}
	finally { await server.close(); }
});

test("missing records are 404 while candidate storage failures are 503", async () => {
	for (const failure of [false, true]) {
		const server = await serve({ candidateFailure: failure });
		try {
			const response = await fetch(`${server.origin}/api/state-records/GA/${hash("missing").slice(0, 24)}`);
			assert.equal(response.status, failure ? 503 : 404);
			assert.doesNotMatch(await response.text(), /private|storage path/u);
		}
		finally { await server.close(); }
	}
});

test("reference failure preserves the official record and reports a separate recoverable error", async () => {
	const server = await serve({ referenceFailure: true });
	try {
		const response = await fetch(`${server.origin}/api/state-records/GA/${snapshot().records[0]!.id}`);
		assert.equal(response.status, 200);
		const body = await response.json();
		assert.equal(body.record.name, "Candidate 0");
		assert.deepEqual(body.references, []);
		assert.equal(body.referencesUnavailable, true);
		assert.doesNotMatch(JSON.stringify(body), /private reference/u);
	}
	finally { await server.close(); }
});

test("the direct endpoint shares the existing bounded record throttle", async () => {
	const server = await serve({ maximum: 1 });
	try {
		assert.equal((await fetch(`${server.origin}/api/state-records/GA/${snapshot().records[0]!.id}`)).status, 200);
		const response = await fetch(`${server.origin}/api/state-records/GA/${snapshot().records[1]!.id}`);
		assert.equal(response.status, 429);
		assert(response.headers.get("retry-after"));
		assert.equal(server.reads(), 1);
	}
	finally { await server.close(); }
});
