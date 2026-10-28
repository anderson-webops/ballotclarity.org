import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fultonCountyOfficeholderConfigurationSha256, importFultonCountyOfficeholders, readFultonCountyOfficeholderEnvelope } from "../src/fulton-county-officeholder-storage.js";
import { fultonCountyOfficeholderPublication, parseFultonCountyOffice, validateFultonCountyOfficeholderSnapshot } from "../src/fulton-county-officeholders.js";
import { resolveFultonCountySupplementalOfficeholders } from "../src/supplemental-officeholders.js";
import { countyOfficeHash, countyOfficeTestTime, exampleCountyOfficeholders, exampleExpandedCountyOfficeholders as expandedSnapshot } from "./helpers/fulton-county-officeholders.js";

const footer = `<footer><a href="/Privacy-Statement">Privacy Statement</a></footer>`;
const solicitor = fultonCountyOfficeholderPublication.offices[2];
const tax = fultonCountyOfficeholderPublication.offices[3];
const solicitorPage = (name = "morgan Future") => `<main><p>Fulton County</p><h1 class="h3">${name}, Solicitor - General</h1><img alt="Office of the Solicitor‑General banner with text reading “${name.replace(/^m/u, "M")}” and the department seal." src="/-/media/banner.jpg"></main>${footer}`;
const taxPage = (name = "Taylor Future") => `<main><h1 class="h3">Tax Commissioner</h1><p>Fulton County Tax Commissioner Dr. ${name} is elected by the voters of Fulton County.</p></main>${footer}`;

test("department records follow future names without portraits, party or ballot inference", () => {
	const value = expandedSnapshot();
	validateFultonCountyOfficeholderSnapshot(value, countyOfficeTestTime);
	assert.equal(value.offices[2]!.person!.name, "Morgan Future");
	assert.equal(value.offices[3]!.person!.name, "Taylor Future");
	const records = resolveFultonCountySupplementalOfficeholders(value, []);
	assert.equal(records.length, 4);
	for (const record of records.slice(2)) {
		assert.equal(record.party, "");
		assert.equal(record.profileImages?.length, 0);
		assert.equal(record.sources.length, 1);
		assert.equal(record.officialWebsiteUrl, record.sources[0]!.url);
	}
});

test("department identity conflicts, ambiguous statements, staff and changed policies require review", () => {
	for (const body of [solicitorPage().replace("Morgan Future”", "Someone Else”"), solicitorPage().replace("Solicitor - General</h1>", "Former Solicitor - General</h1>"), solicitorPage().replace("</main>", `<h1 class="h3">Another Person, Solicitor - General</h1></main>`), solicitorPage().replace("Privacy Statement</a>", "Privacy Statement</a><a href='/other'>Terms of Use</a>")]) assert.throws(() => parseFultonCountyOffice(body, solicitor));
	for (const body of [taxPage().replace("</main>", `<p>Fulton County Tax Commissioner Another Person is elected by the voters of Fulton County.</p></main>`), taxPage().replace("is elected", "was elected"), taxPage().replace("Tax Commissioner Dr.", "Deputy Tax Commissioner Dr."), taxPage("=FORMULA()")]) assert.throws(() => parseFultonCountyOffice(body, tax));
});

test("only an explicit vacant solicitor heading becomes a vacancy", () => {
	assert.deepEqual(parseFultonCountyOffice(solicitorPage("Vacant"), solicitor), { id: "solicitor-general", status: "vacant" });
	assert.throws(() => parseFultonCountyOffice(taxPage().replace("Taylor Future", "Unknown"), tax));
});

test("legacy two-office envelopes remain exact and upgrade with a recoverable predecessor", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-department-compat-"));
	try {
		const legacy = exampleCountyOfficeholders();
		const legacyDigest = countyOfficeHash(JSON.stringify({ ...fultonCountyOfficeholderPublication, offices: fultonCountyOfficeholderPublication.offices.slice(0, 2) }));
		const bytes = `${JSON.stringify({ sourceConfigurationSha256: legacyDigest, importedAt: legacy.retrievedAt, acquisition: "imported", snapshot: legacy })}\n`;
		await writeFile(join(directory, "fulton-county-offices.json"), bytes);
		assert.deepEqual(readFultonCountyOfficeholderEnvelope(directory).snapshot, legacy);
		assert.equal(await readFile(join(directory, "fulton-county-offices.json"), "utf8"), bytes);
		await importFultonCountyOfficeholders(directory, expandedSnapshot());
		assert.equal(await readFile(join(directory, "fulton-county-offices.previous.json"), "utf8"), bytes);
		assert.equal(readFultonCountyOfficeholderEnvelope(directory).sourceConfigurationSha256, fultonCountyOfficeholderConfigurationSha256);
		assert.equal(readFultonCountyOfficeholderEnvelope(directory).snapshot.offices.length, 4);
		const accepted = await readFile(join(directory, "fulton-county-offices.json"), "utf8");
		await assert.rejects(importFultonCountyOfficeholders(directory, legacy), /cannot be downgraded/u);
		assert.equal(await readFile(join(directory, "fulton-county-offices.json"), "utf8"), accepted);
		const invalid = { sourceConfigurationSha256: legacyDigest, importedAt: legacy.retrievedAt, acquisition: "imported", snapshot: expandedSnapshot() };
		await writeFile(join(directory, "fulton-county-offices.json"), JSON.stringify(invalid));
		assert.throws(() => readFultonCountyOfficeholderEnvelope(directory));
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("an older expanded capture preserves accepted bytes and the recovery predecessor", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-department-clock-"));
	try {
		await importFultonCountyOfficeholders(directory, expandedSnapshot());
		const accepted = await readFile(join(directory, "fulton-county-offices.json"), "utf8");
		const older = expandedSnapshot();
		older.retrievedAt = new Date(countyOfficeTestTime - 1000).toISOString();
		for (const document of older.documents) document.capturedAt = older.retrievedAt;
		older.sourceSha256 = countyOfficeHash(JSON.stringify(older.documents));
		await assert.rejects(importFultonCountyOfficeholders(directory, older), /older county-office capture/u);
		assert.equal(await readFile(join(directory, "fulton-county-offices.json"), "utf8"), accepted);
		await assert.rejects(readFile(join(directory, "fulton-county-offices.previous.json")), /ENOENT/u);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("versioned office inventories reject omitted roles, synthetic portraits and cross-host references", () => {
	for (const mutate of [
		(value: ReturnType<typeof expandedSnapshot>) => { value.schemaVersion = 1; },
		(value: ReturnType<typeof expandedSnapshot>) => { value.offices.pop(); },
		(value: ReturnType<typeof expandedSnapshot>) => { value.offices[2]!.person!.portraitUrl = "https://example.org/logo.png"; },
		(value: ReturnType<typeof expandedSnapshot>) => { value.offices[3]!.person!.officialWebsiteUrl = "https://example.org/taxes"; }
	]) {
		const value = expandedSnapshot();
		mutate(value);
		assert.throws(() => validateFultonCountyOfficeholderSnapshot(value));
	}
});
