import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildAdminOperations } from "../src/admin-operations.js";
import { readMauiPreparationOutput, readMauiPreparationRun } from "../src/maui-measure-automation-storage.js";
import { readMauiMeasureAutomationPlan, runMauiMeasureAutomation } from "../src/maui-measure-automation.js";
import { prepareMauiMeasureGuideFiles } from "../src/maui-measure-guides.js";
import { createMauiMeasureRepository } from "../src/maui-measure-operations.js";
import { createApp } from "../src/server.js";
import { mauiAutomationFixture } from "./helpers/maui-automation.js";

async function isolated(work: (directory: string, fixture: Awaited<ReturnType<typeof mauiAutomationFixture>>) => Promise<void>) {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "maui-managed-")));
	try {
		await work(directory, await mauiAutomationFixture(directory));
	}
	finally { await rm(directory, { recursive: true, force: true }); }
}

test("Maui managed preparation produces pinned native drafts once and retains the editorial clock on repeat", async () => isolated(async (_directory, source) => {
	const first = await runMauiMeasureAutomation(source.planPath, { now: source.now });
	assert.equal(first.prepared, true);
	assert.equal(first.reused, false);
	assert.equal(first.publicationApproved, false);
	assert.equal(first.automaticImportApproved, false);
	const stored = first.lastPrepared!;
	const original = await readFile(join(source.plan.preparationDirectory, stored.directory, "maui-measures-native-draft.json"));
	const editorialClock = JSON.parse(original.toString()).reviewedAt;
	source.advance(60_000);
	const repeated = await runMauiMeasureAutomation(source.planPath, { now: source.now });
	assert.equal(repeated.reused, true);
	assert.deepEqual(repeated.lastPrepared, stored);
	assert.equal((await readdir(source.plan.preparationDirectory)).filter(name => name.startsWith("maui-prepared-")).length, 1);
	assert.deepEqual(await readFile(join(source.plan.preparationDirectory, stored.directory, "maui-measures-native-draft.json")), original);
	assert.equal(JSON.parse(original.toString()).reviewedAt, editorialClock);
	await readMauiPreparationOutput(source.plan.preparationDirectory, stored, source.now());
}));

test("Maui changed questions become review exceptions while preserving earlier prepared pages", async () => isolated(async (_directory, source) => {
	const first = await runMauiMeasureAutomation(source.planPath, { now: source.now });
	source.advance();
	await source.seed("2028", true);
	const held = await runMauiMeasureAutomation(source.planPath, { now: source.now });
	assert.equal(held.status, "review");
	assert.ok(held.issues.some(issue => issue.reason === "question-changed" && issue.resolution === "28-2"));
	assert.deepEqual(held.lastPrepared, first.lastPrepared);
	await source.reviewCurrent();
	const revised = await runMauiMeasureAutomation(source.planPath, { now: source.now });
	assert.equal(revised.prepared, true);
	assert.notEqual(revised.lastPrepared?.directory, first.lastPrepared?.directory);
	assert.equal((await readdir(source.plan.preparationDirectory)).filter(name => name.startsWith("maui-prepared-")).length, 2);
}));

test("Maui future cycles wait for their own evidence and then reuse the same pipeline without changing prior guides", async () => isolated(async (_directory, source) => {
	const first = await runMauiMeasureAutomation(source.planPath, { now: source.now });
	await source.seed("2030");
	const held = await runMauiMeasureAutomation(source.planPath, { now: source.now });
	assert.deepEqual(held.issues, [{ resolution: null, reason: "election-review-required" }]);
	assert.equal(held.lastPrepared?.electionDate, "2028-11-07");
	await source.reviewCurrent();
	const future = await runMauiMeasureAutomation(source.planPath, { now: source.now });
	assert.equal(future.lastPrepared?.electionDate, "2030-11-05");
	assert.equal(future.publicationApproved, false);
	await readMauiPreparationOutput(source.plan.preparationDirectory, first.lastPrepared!, source.now());
}));

test("Maui missing resolution evidence remains an explicit review exception rather than an invented native page", async () => isolated(async (_directory, source) => {
	source.plan.cohorts[0]!.documents.pop();
	await source.save();
	const result = await runMauiMeasureAutomation(source.planPath, { now: source.now });
	assert.equal(result.status, "review");
	assert.equal(result.lastPrepared, null);
	assert.deepEqual(result.issues, [{ resolution: "28-2", reason: "resolution-evidence-required" }]);
}));

test("Maui changed input bytes fail closed before reuse and preserve the prior output reference", async () => isolated(async (_directory, source) => {
	const first = await runMauiMeasureAutomation(source.planPath, { now: source.now });
	await writeFile(source.plan.cohorts[0]!.documents[0]!.path, "%PDF-tampered");
	await assert.rejects(runMauiMeasureAutomation(source.planPath, { now: source.now }), /input bytes changed/u);
	const failed = await readMauiPreparationRun(source.plan.preparationDirectory, source.now());
	assert.equal(failed?.status, "failed");
	assert.deepEqual(failed?.lastPrepared, first.lastPrepared);
}));

test("Maui failed native persistence preserves the earlier prepared guide and removes only its disposable attempt", async () => isolated(async (_directory, source) => {
	const first = await runMauiMeasureAutomation(source.planPath, { now: source.now });
	source.advance(1000);
	await source.reviewCurrent();
	await assert.rejects(runMauiMeasureAutomation(source.planPath, { now: source.now, prepare: async (path) => {
		const plan = JSON.parse(await readFile(path, "utf8"));
		await mkdir(plan.outputDirectory);
		await writeFile(join(plan.outputDirectory, "partial.json"), "partial derivative");
		throw new Error("controlled persistence failure");
	} }), /controlled persistence/u);
	assert.deepEqual((await readMauiPreparationRun(source.plan.preparationDirectory, source.now()))?.lastPrepared, first.lastPrepared);
	assert.equal((await readdir(source.plan.preparationDirectory)).filter(name => name.startsWith("maui-prepared-")).length, 1);
	assert.equal((await runMauiMeasureAutomation(source.planPath, { now: source.now })).prepared, true);
}));

test("Maui collection failure retains prior native output without performing a private import", async () => isolated(async (_directory, source) => {
	const first = await runMauiMeasureAutomation(source.planPath, { now: source.now });
	await assert.rejects(runMauiMeasureAutomation(source.planPath, { now: source.now, collect: true, collector: async () => {
		throw new Error("controlled source outage");
	} }), /source outage/u);
	const failed = await readMauiPreparationRun(source.plan.preparationDirectory, source.now());
	assert.equal(failed?.failure, "collection-failed");
	assert.deepEqual(failed?.lastPrepared, first.lastPrepared);
}));

test("Maui completed output survives journal interruption and is adopted once without regenerating it", async () => isolated(async (_directory, source) => {
	const first = await runMauiMeasureAutomation(source.planPath, { now: source.now });
	const run = (await readMauiPreparationRun(source.plan.preparationDirectory, source.now()))!;
	await writeFile(join(source.plan.preparationDirectory, "maui-preparation-run.json"), JSON.stringify({ ...run, status: "running", input: null, lastPrepared: null, finishedAt: null }));
	const recovered = await runMauiMeasureAutomation(source.planPath, { now: source.now, prepare: async () => {
		throw new Error("a complete output must be reused");
	} });
	assert.equal(recovered.reused, true);
	assert.deepEqual(recovered.lastPrepared, first.lastPrepared);
}));

test("Maui preparation ownership excludes another worker without changing its reviewed content", async () => isolated(async (_directory, source) => {
	let enter!: () => void;
	let release!: () => void;
	const started = new Promise<void>((resolve) => {
		enter = resolve;
	});
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	const running = runMauiMeasureAutomation(source.planPath, { now: source.now, prepare: async (...args) => {
		enter();
		await held;
		return prepareMauiMeasureGuideFiles(...args);
	} });
	await started;
	try {
		await assert.rejects(runMauiMeasureAutomation(source.planPath, { now: source.now }), /already running/u);
	}
	finally { release(); }
	assert.equal((await running).prepared, true);
}));

test("Maui dataset status remains protected and reports preparation independently of production import", async () => isolated(async (_directory, source) => {
	await runMauiMeasureAutomation(source.planPath, { now: source.now });
	const repository = createMauiMeasureRepository(source.planPath, source.now)!;
	const app = await createApp({ adminDbPath: ":memory:", allowLegacyAdminActorHeadersForTesting: true, adminApiKey: "controlled-maui-status-key", activeLookupCookieSecret: "controlled-maui-status-cookie-key-long-enough", adminMfaEncryptionKey: "controlled-maui-status-mfa-key-long-enough", mauiMeasureRepository: repository, stateBallotRepository: null, electionReferenceRepository: null, fultonOfficeholderRepository: null, fultonCountyOfficeholderRepository: null, fultonCalendarRepository: null, courtDirectoryRepository: null, magistrateCourtRepository: null, congressClient: null, googleCivicClient: null, openStatesClient: null, openFecClient: null, ldaClient: null, addressEnrichmentService: null, locationGuessOptions: { mode: "disabled" } });
	const server = app.listen(0, "127.0.0.1");
	try {
		await once(server, "listening");
		const address = server.address();
		assert.ok(address && typeof address !== "string");
		const url = `http://127.0.0.1:${address.port}/api/admin/operations`;
		assert.equal((await fetch(url)).status, 401);
		const response = await fetch(url, { headers: { "x-admin-api-key": "controlled-maui-status-key", "x-admin-actor-username": "fixture-admin", "x-admin-actor-display-name": "Fixture Admin", "x-admin-actor-role": "admin" } });
		assert.equal(response.status, 200);
		const data = await response.json();
		const dataset = data.datasets.find((item: { id: string }) => item.id === "hi-maui-charter");
		assert.equal(dataset.records, 2);
		assert.equal(dataset.preparationState, "prepared");
		assert.equal(dataset.lastImportAt, null);
		assert.doesNotMatch(JSON.stringify(data), /originals-|preparationDirectory/u);
	}
	finally {
		await new Promise<void>(resolve => server.close(() => resolve()));
		await app.closeResources();
	}
}));

test("Maui prepared-output tampering and linked configuration stores are rejected without overwriting originals", async () => isolated(async (directory, source) => {
	const first = await runMauiMeasureAutomation(source.planPath, { now: source.now });
	const file = join(source.plan.preparationDirectory, first.lastPrepared!.directory, "assembly/maui-measures-guides.json");
	await writeFile(file, "tampered");
	await assert.rejects(runMauiMeasureAutomation(source.planPath, { now: source.now }), /receipt/u);
	assert.equal(await readFile(file, "utf8"), "tampered");
	const linked = join(directory, "linked-store");
	await symlink(source.plan.preparationDirectory, linked);
	source.plan.preparationDirectory = linked;
	await source.save();
	await assert.rejects(runMauiMeasureAutomation(source.planPath, { now: source.now }), /physical/u);
}));

test("Maui operation inspection distinguishes collection, preparation, source review and import with no writes", async () => isolated(async (_directory, source) => {
	const repository = createMauiMeasureRepository(source.planPath, source.now)!;
	const initial = (await repository.inspectSources())[0]!;
	assert.equal(initial.kind, "measures");
	assert.equal(initial.status, "review");
	assert.equal(initial.lastImportAt, null);
	await runMauiMeasureAutomation(source.planPath, { now: source.now });
	const prepared = (await repository.inspectSources())[0]!;
	assert.equal(prepared.records, 2);
	assert.equal(prepared.preparationState, "prepared");
	assert.equal(prepared.status, "current");
	assert.ok(prepared.lastPreparedAt);
	assert.equal(prepared.lastImportAt, null);
	source.advance();
	await source.seed("2028", true);
	const pending = (await repository.inspectSources())[0]!;
	assert.equal(pending.preparationState, "unreported");
	assert.equal(pending.reviewIssues?.length, 0);
	await runMauiMeasureAutomation(source.planPath, { now: source.now });
	const result = await buildAdminOperations({ measures: repository, candidates: null, references: null, dataDirectory: null, now: source.now() });
	assert.equal(result.datasets[0]?.status, "review");
	assert.match(result.datasets[0]?.reviewIssues?.[0]?.reason ?? "", /question changed/u);
	assert.equal(result.datasets[0]?.lastImportAt, null);
	assert.doesNotMatch(JSON.stringify(result), /originals-|preparationDirectory|\/var\//u);
	await assert.rejects(readMauiMeasureAutomationPlan(new URL("../src/server.ts", import.meta.url).pathname));
}));
