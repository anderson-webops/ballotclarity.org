import type { MeasureReferenceSource } from "../src/measure-reference-sources.js";
import type { MeasureReferenceRecord, MeasureReferenceSnapshot } from "../src/measure-references.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import express from "express";
import { registerMeasureReferenceRoutes } from "../src/measure-reference-routes.js";
import { measureReferenceSources } from "../src/measure-reference-sources.js";
import { buildMeasureFromReference, createMeasureReferenceRepository, createMeasureReferenceStorage, parseMeasureReferenceSnapshot, selectMeasureReferenceSources } from "../src/measure-references.js";

const source = measureReferenceSources.find(item => item.id === "co-blue-book-2026")!;
const beforeElection = Date.parse("2026-10-25T12:00:00.000Z");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function record(index: number, overrides: Partial<MeasureReferenceRecord> = {}): MeasureReferenceRecord {
	return {
		id: hash(`fixture/${index}`).slice(0, 24),
		slug: `co-2026-proposition-${900 + index}`,
		designation: `Proposition ${900 + index}`,
		title: `Fixture measure ${index}`,
		origin: "citizen-initiative",
		lawChanged: "statutes",
		passage: "majority",
		ballotTitle: "Shall there be a change to the fixture statutes?",
		yesMeaning: `A “yes” vote on Proposition ${900 + index} changes the fixture law.`,
		noMeaning: `A “no” vote on Proposition ${900 + index} keeps the fixture law.`,
		summary: "Changes a fixture law.",
		explanation: "Explains the fixture change.",
		currentLaw: "Describes the fixture law.",
		proposedChanges: ["Changes one fixture rule."],
		fiscal: [{ label: "State spending", value: "Minimal", scope: "State", horizon: "Ongoing", note: "Fixture estimate." }],
		argumentsFor: [{ title: "Fixture benefit", summary: "A fixture argument for." }],
		argumentsAgainst: [{ title: "Fixture cost", summary: "A fixture argument against." }],
		considerations: [],
		pages: { guide: 7, analysis: 15, arguments: 16, fiscal: 17, text: 69 },
		...overrides,
	};
}

function snapshot(records: MeasureReferenceRecord[] = [record(1), record(2)]): MeasureReferenceSnapshot {
	return {
		schemaVersion: 1,
		type: "measure-references",
		stateCode: "CO",
		sourceId: source.id,
		electionDate: source.electionDate,
		document: { url: source.document.url, sha256: hash("fixture pdf"), bytes: 2048, capturedAt: "2026-10-22T15:26:02.000Z" },
		recordCount: records.length,
		records,
	};
}

test("Colorado Blue Book collection is pinned to the official publication", () => {
	assert.equal(source.stateCode, "CO");
	assert.equal(source.electionDate, "2026-11-03");
	assert.equal(new URL(source.document.url).origin, "https://content.leg.colorado.gov");
	assert.equal(source.document.publisher, "Colorado Legislative Council Staff");
	assert.deepEqual(selectMeasureReferenceSources(measureReferenceSources, "co", beforeElection), [source]);
	assert.deepEqual(selectMeasureReferenceSources(measureReferenceSources, "CO", Date.parse("2026-11-06T00:00:00.000Z")), []);
});

test("snapshots fail closed on mismatched provenance, invalid fields and duplicate identities", () => {
	const valid = snapshot();
	assert.deepEqual(parseMeasureReferenceSnapshot(source, JSON.stringify(valid), beforeElection), valid);
	const invalid: unknown[] = [
		{ ...valid, sourceId: "other" },
		{ ...valid, document: { ...valid.document, url: "https://example.com/blue-book.pdf" } },
		{ ...valid, document: { ...valid.document, capturedAt: "2026-09-01T00:00:00.000Z" } },
		{ ...valid, recordCount: 3 },
		snapshot([record(1, { slug: "ga-2026-proposition-901" })]),
		snapshot([record(1, { pages: { guide: 7, analysis: 15, arguments: 16, fiscal: 17, text: 105 } })]),
		snapshot([record(1, { argumentsFor: [] })]),
		snapshot([record(1, { summary: " padded" })]),
		snapshot([record(1), record(2, { slug: record(1).slug })]),
		{ ...valid, extra: true },
	];
	for (const body of invalid)
		assert.throws(() => parseMeasureReferenceSnapshot(source, JSON.stringify(body), beforeElection));
	assert.throws(() => parseMeasureReferenceSnapshot(source, JSON.stringify({ ...valid, document: { ...valid.document, capturedAt: "2026-10-30T00:00:00.000Z" } }), beforeElection));
});

test("reference records become measure pages with page-anchored official sources", () => {
	const fixture = snapshot();
	const measure = buildMeasureFromReference(source, fixture, fixture.records[0]!);
	assert.equal(measure.slug, "co-2026-proposition-901");
	assert.equal(measure.title, "Proposition 901: Fixture measure 1");
	assert.equal(measure.contestSlug, "");
	assert.equal(measure.ballotSummary, "Shall there be a change to the fixture statutes?");
	assert.equal(measure.argumentsDisclaimer, source.argumentsNote);
	assert.deepEqual(measure.sources.map(item => item.url), [7, 15, 16, 17, 69].map(page => `${source.document.url}#page=${page}`));
	assert.ok(measure.sources.every(item => item.type === "voter guide" && item.authority === "official-government"));
	assert.equal(measure.supportArguments[0]!.sources[0]!.url, `${source.document.url}#page=16`);
	assert.equal(measure.fiscalSummary[0]!.sources[0]!.url, `${source.document.url}#page=17`);
});

test("storage round-trips through the management command and rejects stale configuration", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-measure-references-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const input = join(directory, "input.json");
	await writeFile(input, JSON.stringify(snapshot()));
	const script = fileURLToPath(new URL("../src/manage-election-references.ts", import.meta.url));
	const command = (...args: string[]) => spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), script, ...args], { env: { PATH: process.env.PATH, HOME: process.env.HOME, STATE_BALLOT_DATA_DIR: join(directory, "data") }, encoding: "utf8" });
	const imported = command("import-measures", input);
	assert.equal(imported.status, 0, imported.stderr);
	assert.deepEqual(JSON.parse(imported.stdout), { state: "CO", sourceId: source.id, action: "imported", measures: 2, capturedAt: "2026-10-22T15:26:02.000Z" });
	const exported = command("export-measures", "CO");
	assert.equal(exported.status, 0, exported.stderr);
	assert.deepEqual(JSON.parse(exported.stdout), snapshot());
	assert.notEqual(command("export-measures", "WA").status, 0);
	const changed: MeasureReferenceSource = { ...source, argumentsNote: "Changed." };
	await assert.rejects(createMeasureReferenceStorage(join(directory, "data")).read(changed));
	assert.match(await readFile(join(directory, "data", `measures-${source.id}.json`), "utf8"), /sourceConfigurationSha256/u);
});

test("repository serves measures by slug and the route lists them per state", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-measure-routes-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	await createMeasureReferenceStorage(directory).write(source, snapshot());
	const repository = createMeasureReferenceRepository({ dataDirectory: directory, now: () => beforeElection });
	assert.equal((await repository.getMeasure("co-2026-proposition-902"))?.title, "Proposition 902: Fixture measure 2");
	assert.equal(await repository.getMeasure("co-2026-proposition-999"), null);
	assert.equal(await createMeasureReferenceRepository({ dataDirectory: directory, now: () => Date.parse("2026-11-06T00:00:00.000Z") }).getMeasure("co-2026-proposition-902"), null);

	const app = express();
	registerMeasureReferenceRoutes(app, repository);
	const server = app.listen(0, "127.0.0.1");
	context.after(() => server.close());
	await once(server, "listening");
	const address = server.address();
	assert.ok(address && typeof address === "object");
	const origin = `http://127.0.0.1:${address.port}/api/measure-references`;
	const listed = await (await fetch(`${origin}/co`)).json();
	assert.equal(listed.available, true);
	assert.equal(listed.source.publisher, "Colorado Legislative Council Staff");
	assert.deepEqual(listed.measures.map((item: { slug: string }) => item.slug), ["co-2026-proposition-901", "co-2026-proposition-902"]);
	assert.deepEqual(await (await fetch(`${origin}/WA`)).json(), { available: false, stateCode: "WA", measures: [] });
	assert.equal((await fetch(`${origin}/ZZ`)).status, 400);
	assert.equal((await fetch(`${origin}/CO?q=x`)).status, 400);
});
