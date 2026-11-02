import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { collectFultonCountyOfficeholders } from "../src/collect-fulton-county-officeholders.js";
import { fultonClerkProfileUrl, fultonClerkPublication, parseFultonClerk, verifyFultonClerkPolicy, verifyFultonClerkProfile } from "../src/fulton-clerk-office.js";
import { importFultonCountyOfficeholders, readFultonCountyOfficeholderEnvelope } from "../src/fulton-county-officeholder-storage.js";
import { fultonCountyOfficeholderCsv, fultonCountyOfficeholderPublication, validateFultonCountyOfficeholderSnapshot } from "../src/fulton-county-officeholders.js";
import { countyOfficeHash, countyOfficeTestTime, exampleCompleteCountyOfficeholders, exampleExpandedCountyOfficeholders } from "./helpers/fulton-county-officeholders.js";
import { magistrateTestRobots } from "./helpers/magistrate-robots.js";

const footer = `<footer><a href="/site/copyright">Copyright Notices</a></footer>`;
function pages(name = "Casey Future", identity = 400) {
	const statement = `<p>Led by the Honorable ${name}, we welcome you to the Office of the Fulton County Clerk of Superior and Magistrate Courts, where we serve the public.</p>`;
	const url = `https://www.fultonclerk.org/${identity}/Meet-Clerk-${name.normalize("NFKD").replace(/\p{M}/gu, "").replaceAll(" ", "-")}`;
	return {
		home: `<h1>THE FULTON COUNTY CLERK OF SUPERIOR AND MAGISTRATE COURTS</h1>${statement}<a href="/101/About-Us">About Us</a>${footer}`,
		about: `<h1>About Us</h1>${statement}<a href="${url}">Meet Clerk, ${name}</a>${footer}`,
		profile: `<h1>Meet Clerk, ${name}</h1><div id="moduleContent">Clerk of the Superior &amp; Magistrate Courts of Fulton County</div>${footer}`,
		url
	};
}

test("current Clerk follows actual current statements and offered profiles across future years", () => {
	for (const [name, identity] of [["Casey Future", 400], ["Alexis Successor", 431], ["Ché Example", 502]] as const) {
		const source = pages(name, identity);
		const person = parseFultonClerk(source.home, source.about);
		assert.equal(person.name, name);
		assert.equal(person.officialWebsiteUrl, source.url);
		assert(person.slug);
		verifyFultonClerkProfile(source.profile, person);
		assert.equal("portraitUrl" in person, false);
		assert.equal("party" in person, false);
		assert.equal("electionDate" in person, false);
	}
});

test("a former, vacant, conflicting or unoffered Clerk requires intervention", () => {
	const source = pages();
	for (const about of [source.about.replace("Casey Future", "Different Person"), source.about.replace("Meet Clerk, Casey Future", "Former Clerk, Casey Future"), source.about.replace(source.url, "https://example.org/400/Meet-Clerk-Casey-Future"), source.about.replace("</h1>", `</h1><a href="${source.url}">Meet Clerk, Casey Future</a>`), source.about.replace("Copyright Notices</a>", "Copyright Notices</a><a href='/terms'>Terms of Service</a>")]) assert.throws(() => parseFultonClerk(source.home, about));
	assert.throws(() => parseFultonClerk(source.home.replace("Led by the Honorable", "Formerly led by the Honorable"), source.about));
	const vacant = pages("Vacant");
	assert.throws(() => parseFultonClerk(vacant.home, vacant.about));
	const person = parseFultonClerk(source.home, source.about);
	assert.throws(() => verifyFultonClerkProfile(source.profile.replace("Meet Clerk, Casey Future", "Meet Clerk, Another Person"), person));
});

test("Clerk URLs preserve the offered host, role and bounded identity without queries", () => {
	for (const value of ["https://example.org/400/Meet-Clerk-Casey-Future", "https://www.fultonclerk.org@evil.example/400/Meet-Clerk-Casey-Future", "http://www.fultonclerk.org/400/Meet-Clerk-Casey-Future", "https://www.fultonclerk.org/400/Meet-Clerk-Casey-Future?token=private", "/admin/Meet-Clerk-Casey-Future", "/400/Meet-Former-Clerk-Casey-Future", "/400/Meet-Clerk-Casey-Future#name"]) assert.throws(() => fultonClerkProfileUrl(value));
	assert.equal(fultonClerkProfileUrl("/432/Meet-Clerk-New-Person"), "https://www.fultonclerk.org/432/Meet-Clerk-New-Person");
});

test("reviewed robots and every substantive copyright condition stay bound", () => {
	verifyFultonClerkPolicy(magistrateTestRobots, 0);
	assert.throws(() => verifyFultonClerkPolicy(`${magistrateTestRobots}\nDisallow: /`, 0));
	const notice = (year: number) => `<div id="moduleContent">CivicPlus Content Management System © 1997-${year} CivicPlus. All rights reserved. All content © 2006-${year} Fulton County Superior Court, GA and its representatives. All rights reserved.</div><a href="/182/Legal-Disclaimer">Legal Disclaimer</a>${footer}`;
	verifyFultonClerkPolicy(notice(2030), 1, Date.parse("2030-01-01"));
	for (const body of [notice(2030).replace("All rights reserved.", "All rights transferred."), notice(2030).replace("2006-2030", "2006-2029"), notice(2033), notice(2030).replace("</div>", " Automated access prohibited.</div>"), notice(2030).replace("Copyright Notices</a>", "Copyright Notices</a><a href='/privacy'>Privacy</a>")]) assert.throws(() => verifyFultonClerkPolicy(body, 1, Date.parse("2030-01-01")));
	assert.throws(() => verifyFultonClerkPolicy("Changed legal disclaimer", 2));
	assert.equal(fultonClerkPublication.minimumRequestIntervalMs, 20000);
});

test("five-office snapshots reject fabricated Clerk status, images, party, clocks and omitted evidence", () => {
	validateFultonCountyOfficeholderSnapshot(exampleCompleteCountyOfficeholders(), countyOfficeTestTime);
	for (const mutate of [
		(value: ReturnType<typeof exampleCompleteCountyOfficeholders>) => { value.schemaVersion = 2; },
		(value: ReturnType<typeof exampleCompleteCountyOfficeholders>) => { value.offices[4] = { id: "clerk", status: "vacant" }; },
		(value: ReturnType<typeof exampleCompleteCountyOfficeholders>) => { value.offices[4]!.person!.portraitUrl = "https://example.org/portrait.png"; },
		(value: ReturnType<typeof exampleCompleteCountyOfficeholders>) => { Object.assign(value.offices[4]!.person!, { party: "guessed" }); },
		(value: ReturnType<typeof exampleCompleteCountyOfficeholders>) => { value.documents.pop(); },
		(value: ReturnType<typeof exampleCompleteCountyOfficeholders>) => { value.offices[4]!.person!.officialWebsiteUrl += "?private=token"; },
		(value: ReturnType<typeof exampleCompleteCountyOfficeholders>) => { value.offices[4]!.person!.slug = "someone-else"; }
	]) {
		const value = exampleCompleteCountyOfficeholders();
		mutate(value);
		assert.throws(() => validateFultonCountyOfficeholderSnapshot(value, countyOfficeTestTime));
	}
});

test("both historical four-office bindings remain readable and upgrade with exact recovery bytes", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-clerk-upgrade-"));
	try {
		const legacy = exampleExpandedCountyOfficeholders();
		const configuration = countyOfficeHash(JSON.stringify({ ...fultonCountyOfficeholderPublication, offices: fultonCountyOfficeholderPublication.offices.slice(0, 4) }));
		const before = `${JSON.stringify({ sourceConfigurationSha256: configuration, importedAt: legacy.retrievedAt, acquisition: "imported", snapshot: legacy })}\n`;
		await writeFile(join(directory, "fulton-county-offices.json"), before);
		assert.deepEqual(readFultonCountyOfficeholderEnvelope(directory).snapshot, legacy);
		await importFultonCountyOfficeholders(directory, exampleCompleteCountyOfficeholders());
		assert.equal(await readFile(join(directory, "fulton-county-offices.previous.json"), "utf8"), before);
		assert.equal(readFultonCountyOfficeholderEnvelope(directory).snapshot.offices.length, 5);
		const accepted = await readFile(join(directory, "fulton-county-offices.json"), "utf8");
		await assert.rejects(importFultonCountyOfficeholders(directory, legacy), /cannot be downgraded/u);
		assert.equal(await readFile(join(directory, "fulton-county-offices.json"), "utf8"), accepted);
		await writeFile(join(directory, "fulton-county-offices.json"), JSON.stringify({ sourceConfigurationSha256: configuration, importedAt: legacy.retrievedAt, acquisition: "imported", snapshot: exampleCompleteCountyOfficeholders() }));
		assert.throws(() => readFultonCountyOfficeholderEnvelope(directory));
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("an interrupted county collection waits without new requests or clock changes", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-clerk-interruption-"));
	try {
		await importFultonCountyOfficeholders(directory, exampleCompleteCountyOfficeholders(), countyOfficeTestTime);
		const before = await readFile(join(directory, "fulton-county-offices.json"), "utf8");
		const journal = join(directory, "county-office-automation");
		await mkdir(journal);
		const startedAt = new Date(countyOfficeTestTime + 7 * 3600000).toISOString();
		const bytes = `${JSON.stringify({ schemaVersion: 1, type: "ballot-automation-run", status: "running", startedAt, finishedAt: null, lastImportAt: new Date(countyOfficeTestTime).toISOString(), lastSuccessAt: null, nextRunAt: null, results: [] })}\n`;
		await writeFile(join(journal, "automation-run.json"), bytes);
		let requests = 0;
		await assert.rejects(collectFultonCountyOfficeholders({ directory, now: () => Date.parse(startedAt) + 1000, request: async () => {
			requests++;
			throw new Error("Unexpected publisher request");
		} }), /next permitted retry/u);
		assert.equal(requests, 0);
		assert.equal(await readFile(join(journal, "automation-run.json"), "utf8"), bytes);
		assert.equal(await readFile(join(directory, "fulton-county-offices.json"), "utf8"), before);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("CSV identifies retrieval time rather than implying a publication date", () => {
	const csv = fultonCountyOfficeholderCsv(exampleCompleteCountyOfficeholders());
	assert.match(csv.split("\n")[0]!, /"retrievedAt"/u);
	assert.doesNotMatch(csv, /sourceAsOf|nominee|qualified|appointed|party/iu);
});
