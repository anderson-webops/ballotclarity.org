import type { TestContext } from "node:test";
import type { StateCandidateRecord } from "../../src/state-ballot-records.js";
import type { StateBallotSnapshot } from "../../src/state-ballot-repository.js";
import type { StateBallotSource } from "../../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reconcileConnecticutBallots } from "../../src/state-ballot-connecticut.js";
import { serializeStateBallotSnapshots } from "../../src/state-ballot-export.js";
import { reconcileOregonBallots } from "../../src/state-ballot-oregon.js";
import { parseStateCandidateRecords } from "../../src/state-ballot-records.js";
import { createStateBallotRepository } from "../../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../../src/state-ballot-sources.js";
import { createStateBallotStorage } from "../../src/state-ballot-storage.js";

interface FixtureDescriptor {
	stateCode: string;
	sourceId: string;
	file: string;
	recordCount: number;
	originalRecordCount: number;
	metadata: Record<string, unknown>;
	strategy: { kind: "parser-input" | "county-publications" | "reviewed-vector"; file?: string; records?: StateCandidateRecord[] };
	counts: Record<string, number>;
}

const catalog = JSON.parse(readFileSync(new URL("../fixtures/reviewed-state-catalog.json", import.meta.url), "utf8")) as {
	descriptors: FixtureDescriptor[];
	automaticFixtures: Record<string, { file: string; retrievedAt: string; sha256: string }>;
	transfers: Record<string, { fixtureSha256: string; states?: string[]; header?: Record<string, unknown>; lines: number }>;
};
const bodies = new Map<string, string>();
const transfers = new Map<string, string>();
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const readInput = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");

function configuredSource(value: string | StateBallotSource) {
	if (typeof value !== "string") return value;
	const descriptor = catalog.descriptors.find(item => [item.stateCode, item.sourceId, item.file, item.file.replace(/-2026\.json$/u, "")].includes(value));
	const source = stateBallotSources.find(source => source.id === descriptor?.sourceId || source.stateCode === value);
	assert.ok(source, `No controlled regression source for ${value}.`);
	return source;
}

export function reviewedFixtureStatistics(value: string) {
	const source = configuredSource(value);
	const descriptor = catalog.descriptors.find(item => item.sourceId === source.id);
	assert.ok(descriptor);
	return descriptor;
}

export function readReviewedStateFixture(value: string | StateBallotSource) {
	const source = configuredSource(value);
	const cached = bodies.get(source.id);
	if (cached) return cached;
	const descriptor = catalog.descriptors.find(item => item.sourceId === source.id);
	assert.ok(descriptor);
	let records: StateCandidateRecord[];
	if (descriptor.strategy.kind === "parser-input") {
		records = parseStateCandidateRecords(source, readInput(descriptor.strategy.file!));
	}
	else if (descriptor.strategy.kind === "county-publications") {
		const fixtures = JSON.parse(readInput("state-ballots-county-publications.json")) as { state: string; records: StateCandidateRecord[] }[];
		records = fixtures.find(fixture => fixture.state === source.stateCode)!.records;
	}
	else {
		records = descriptor.strategy.records!;
	}
	const body = JSON.stringify({ ...descriptor.metadata, records });
	parseBundledStateSnapshot(source, body);
	bodies.set(source.id, body);
	return body;
}

export function loadReviewedStateFixture(value: string | StateBallotSource): StateBallotSnapshot {
	const source = configuredSource(value);
	const automatic = catalog.automaticFixtures[source.stateCode];
	if (automatic) return { source, records: parseStateCandidateRecords(source, readInput(automatic.file)), retrievedAt: automatic.retrievedAt, sha256: automatic.sha256 };
	return parseBundledStateSnapshot(source, readReviewedStateFixture(source));
}

export async function createReviewedFixtureRepository(context: TestContext, options: NonNullable<Parameters<typeof createStateBallotRepository>[0]> = {}) {
	assert.equal(options.dataDirectory, undefined);
	const directory = await mkdtemp(join(tmpdir(), "ballot-unit-reviewed-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const storage = createStateBallotStorage(directory);
	for (const descriptor of catalog.descriptors) await storage.write(loadReviewedStateFixture(descriptor.stateCode));
	return createStateBallotRepository({ ...options, dataDirectory: directory });
}

export function readReviewedTransferFixture(name: string) {
	const cached = transfers.get(name);
	if (cached) return cached;
	const descriptor = catalog.transfers[name];
	assert.ok(descriptor, `No controlled transfer vector for ${name}.`);
	let text: string;
	if (descriptor.states) {
		text = serializeStateBallotSnapshots(descriptor.states.map(state => loadReviewedStateFixture(state)));
	}
	else {
		const code = descriptor.header!.stateCode;
		assert.ok(code === "CT" || code === "OR");
		const source = configuredSource(code);
		const input = readInput(catalog.descriptors.find(item => item.sourceId === source.id)!.strategy.file!);
		const result = code === "CT" ? reconcileConnecticutBallots(input) : reconcileOregonBallots(input);
		const snapshot = loadReviewedStateFixture(code);
		const associations = new Map(result.records.flatMap((record, index) => record.claimIndexes.map(claim => [claim, snapshot.records[index]!.id] as const)));
		text = `${[JSON.stringify(descriptor.header), ...result.claims.map((claim, index) => JSON.stringify({ type: code === "CT" ? "ballot-line" : "ballot-candidate-claim", candidateId: associations.get(index), ...JSON.parse(JSON.stringify(claim)) }))].join("\n")}\n`;
	}
	assert.equal(digest(text), descriptor.fixtureSha256, `Reviewed fixture transfer changed: ${name}`);
	transfers.set(name, text);
	return text;
}
