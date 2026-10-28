import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { collectFultonCountyOfficeholders } from "../src/collect-fulton-county-officeholders.js";
import { createFultonCountyOfficeholderRepository, importFultonCountyOfficeholders, readFultonCountyOfficeholderEnvelope, withFultonCountyOfficeholderLock } from "../src/fulton-county-officeholder-storage.js";
import { fultonCountyOfficeholderCsv, parseFultonCountyOffice, prepareFultonCountyOfficeholders, validateFultonCountyOfficeholderSnapshot } from "../src/fulton-county-officeholders.js";
import { importFultonOfficeholders } from "../src/fulton-officeholder-storage.js";
import { countyOfficeHash, countyOfficeTestTime, exampleCountyOfficeholders, exampleCountyOfficePages } from "./helpers/fulton-county-officeholders.js";
import { exampleFultonOfficeholders } from "./helpers/fulton-officeholders.js";

test("county-office cards identify officeholders, not deputy staff or ballot nominees", () => {
	const source = exampleCountyOfficePages()[1]!;
	const page = source.page.replace("</main>", `<div class="bio-card"><h4 class="bio-card__name">Another Person</h4><div class="bio-card__position">Deputy District Attorney</div></div></main>`);
	const parsed = parseFultonCountyOffice(page, source.definition);
	assert.equal(parsed.person!.name, "Jordan Second");
	assert.equal(parsed.person!.slug, "jordan-second");
	assert.equal(parsed.person!.officialWebsiteUrl, source.profileUrl);
	assert.equal("party" in parsed.person!, false);
});

test("future officer changes and explicit vacancies need no election-year or person configuration", () => {
	const now = Date.parse("2030-02-01T00:00:00.000Z");
	const next = exampleCountyOfficeholders("Morgan Successor", false, now);
	validateFultonCountyOfficeholderSnapshot(next, now);
	assert.equal(next.offices[0]!.person!.name, "Morgan Successor");
	const vacant = exampleCountyOfficeholders("Avery First", true, now);
	validateFultonCountyOfficeholderSnapshot(vacant, now);
	assert.deepEqual(vacant.offices[0], { id: "sheriff", status: "vacant" });
	assert.equal(vacant.documents.length, 5);
});

test("ambiguous roles, changed policy inventories and off-host or credentialed links require review", () => {
	const source = exampleCountyOfficePages()[0]!;
	for (const body of [source.page.replace("</main>", `${source.page.match(/<div class="bio-card">.+<\/div>/u)![0]}</main>`), source.page.replace("<div class=\"bio-card__position\">Sheriff</div>", "<div class=\"bio-card__position\">Former Sheriff</div>"), source.page.replace(source.profileUrl, "https://example.org/person"), source.page.replace(source.profileUrl, `${source.profileUrl}?token=private`), source.page.replace("/-/media/Departments/sheriff/portrait.png", "https://example.org/image.png"), source.page.replace("Privacy Statement</a>", "Privacy Statement</a><a href='/new-terms'>Terms of Use</a>"), source.page.replace("Sheriff Avery First", "=FORMULA()")]) assert.throws(() => parseFultonCountyOffice(body, source.definition));
});

test("county-office snapshots reject changed roles, unverified extra fields, clocks and provenance", () => {
	for (const mutate of [
		(value: ReturnType<typeof exampleCountyOfficeholders>) => { value.countyFips = "00000" as "13121"; },
		(value: ReturnType<typeof exampleCountyOfficeholders>) => { value.offices.reverse(); },
		(value: ReturnType<typeof exampleCountyOfficeholders>) => { value.offices[0]!.person!.officialWebsiteUrl += "?secret=token"; },
		(value: ReturnType<typeof exampleCountyOfficeholders>) => { value.offices[0]!.person!.slug = "different-person"; },
		(value: ReturnType<typeof exampleCountyOfficeholders>) => { value.documents[2]!.sha256 = "invalid"; },
		(value: ReturnType<typeof exampleCountyOfficeholders>) => { value.documents[2]!.capturedAt = "2035-01-01T00:00:00Z"; },
		(value: ReturnType<typeof exampleCountyOfficeholders>) => { Object.assign(value.offices[0]!.person!, { party: "inferred" }); }
	]) {
		const value = exampleCountyOfficeholders();
		mutate(value);
		assert.throws(() => validateFultonCountyOfficeholderSnapshot(value, countyOfficeTestTime));
	}
	assert.throws(() => prepareFultonCountyOfficeholders({ schemaVersion: 1, type: "fulton-county-officeholder-capture", documents: [] }));
});

test("county-office imports coexist with unchanged commission data and retain exact previous bytes", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-county-offices-"));
	try {
		await importFultonOfficeholders(directory, exampleFultonOfficeholders());
		const board = await readFile(join(directory, "fulton-board.json"), "utf8");
		await importFultonCountyOfficeholders(directory, exampleCountyOfficeholders());
		const first = await readFile(join(directory, "fulton-county-offices.json"), "utf8");
		await importFultonCountyOfficeholders(directory, exampleCountyOfficeholders("Morgan Successor"));
		assert.equal(await readFile(join(directory, "fulton-county-offices.previous.json"), "utf8"), first);
		assert.equal(await readFile(join(directory, "fulton-board.json"), "utf8"), board);
		assert.equal(createFultonCountyOfficeholderRepository(directory)!.getSnapshot().offices[0]!.person!.name, "Morgan Successor");
		assert.equal((await createFultonCountyOfficeholderRepository(directory)!.inspectSources!())[0]!.records, 2);
		assert.equal(readFultonCountyOfficeholderEnvelope(directory).acquisition, "imported");
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("fresh imports make no publisher requests or successful-clock changes", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-county-warm-"));
	try {
		await importFultonCountyOfficeholders(directory, exampleCountyOfficeholders(), countyOfficeTestTime);
		const before = await readFile(join(directory, "fulton-county-offices.json"), "utf8");
		let requests = 0;
		const result = await collectFultonCountyOfficeholders({ directory, now: () => countyOfficeTestTime + 1000, request: async () => {
			requests++;
			throw new Error("No publisher request expected");
		} });
		assert.equal(result.collected, false);
		assert.equal(requests, 0);
		assert.equal(await readFile(join(directory, "fulton-county-offices.json"), "utf8"), before);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("failed source review preserves accepted data and import clocks, with bounded retry", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-county-failure-"));
	try {
		await importFultonCountyOfficeholders(directory, exampleCountyOfficeholders(), countyOfficeTestTime);
		const before = await readFile(join(directory, "fulton-county-offices.json"), "utf8");
		const now = countyOfficeTestTime + 7 * 3600000;
		let requests = 0;
		const options = { directory, now: () => now, request: async () => {
			requests++;
			return "Changed robots policy";
		} };
		await assert.rejects(collectFultonCountyOfficeholders(options), /policy requires review/u);
		assert.equal(requests, 1);
		await assert.rejects(collectFultonCountyOfficeholders(options), /next permitted retry/u);
		assert.equal(requests, 1);
		assert.equal(await readFile(join(directory, "fulton-county-offices.json"), "utf8"), before);
		const run = JSON.parse(await readFile(join(directory, "county-office-automation/automation-run.json"), "utf8"));
		assert.equal(run.status, "failed");
		assert.equal(run.lastImportAt, new Date(countyOfficeTestTime).toISOString());
		assert.equal(run.lastSuccessAt, null);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("county-office snapshot symlinks, invalid envelopes and overlapping collectors fail closed", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-county-guards-"));
	try {
		const target = join(directory, "target.json");
		await writeFile(target, JSON.stringify(exampleCountyOfficeholders()));
		await symlink(target, join(directory, "fulton-county-offices.json"));
		assert.throws(() => createFultonCountyOfficeholderRepository(directory)!.getSnapshot(), /temporarily unavailable/u);
		await rm(join(directory, "fulton-county-offices.json"));
		await writeFile(join(directory, "fulton-county-offices.json"), "{}");
		assert.throws(() => readFultonCountyOfficeholderEnvelope(directory));
		await withFultonCountyOfficeholderLock(directory, async () => assert.rejects(withFultonCountyOfficeholderLock(directory, async () => {}), /EEXIST/u));
		assert.equal(countyOfficeHash(await readFile(target, "utf8")), countyOfficeHash(JSON.stringify(exampleCountyOfficeholders())));
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("county-office CSV preserves quoted source names without introducing party or ballot status", () => {
	const snapshot = exampleCountyOfficeholders();
	snapshot.offices[0]!.person!.name = "Avery \"First\" Person";
	const csv = fultonCountyOfficeholderCsv(snapshot);
	assert.match(csv, /Avery ""First"" Person/u);
	assert.doesNotMatch(csv, /party|nominee|qualified|filed/iu);
});
