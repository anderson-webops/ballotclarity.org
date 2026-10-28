import type { AddressInfo } from "node:net";
import type { TestContext } from "node:test";
import type { FultonCountyOfficeholderSnapshot } from "../src/fulton-county-officeholders.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import process from "node:process";
import test from "node:test";
import { FultonCountyOfficeholderUnavailableError } from "../src/fulton-county-officeholder-storage.js";
import { createApp } from "../src/server.js";
import { exampleCountyOfficeholders, exampleExpandedCountyOfficeholders } from "./helpers/fulton-county-officeholders.js";
import { exampleFultonOfficeholders } from "./helpers/fulton-officeholders.js";

process.env.ADMIN_STORE_DRIVER = "sqlite";
delete process.env.ADMIN_DATABASE_URL;
delete process.env.DATABASE_URL;

async function fixture(context: TestContext, getSnapshot: () => FultonCountyOfficeholderSnapshot) {
	const app = await createApp({ adminDbPath: ":memory:", allowLegacyAdminActorHeadersForTesting: true, adminApiKey: "controlled-county-office-key", activeLookupCookieSecret: "controlled-county-office-cookie-secret-long-enough", adminMfaEncryptionKey: "controlled-county-office-mfa-secret-long-enough", stateBallotRepository: null, electionReferenceRepository: null, congressClient: null, googleCivicClient: null, ldaClient: null, openFecClient: null, openStatesClient: null, fultonOfficeholderRepository: { getSnapshot: () => exampleFultonOfficeholders() }, fultonCountyOfficeholderRepository: { getSnapshot, inspectSources: async () => [{ id: "ga-fulton-county-offices", label: "Fulton County offices", kind: "officeholders", mode: "automatic", stateCode: "GA", electionDate: "", status: "current", records: 2, retrievedAt: getSnapshot().retrievedAt, lastAttemptAt: null, lastImportAt: getSnapshot().retrievedAt, failure: null }] }, zipLocationService: { async lookupZip(postalCode) {
		const stateAbbreviation = postalCode === "65251" ? "MO" : "GA";
		return { postalCode, matches: [{ id: "county:121", locality: "Fulton County", stateAbbreviation, stateName: stateAbbreviation === "GA" ? "Georgia" : "Missouri", postalCode, latitude: 34, longitude: -84.3, sourceSystem: "Controlled county geography", districtMatches: [{ id: "county:121", districtType: "county", districtCode: "121", label: "Fulton County", stateFips: stateAbbreviation === "GA" ? "13" : "29", sourceSystem: "Controlled county geography" }], representativeMatches: [] }] };
	} } });
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	context.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
	return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

test("current county offices join the county page and exact county lookup without changing commission districts", async (context) => {
	const snapshot = exampleCountyOfficeholders();
	const base = await fixture(context, () => snapshot);
	const response = await fetch(`${base}/api/districts/fulton-county`);
	assert.equal(response.status, 200);
	const county = await response.json();
	assert.equal(county.representatives.length, 8);
	assert.deepEqual(county.officeVacancies, ["County Commissioner, District 4"]);
	for (const office of snapshot.offices) {
		const profile = await fetch(`${base}/api/representatives/${office.person!.slug}`).then(result => result.json());
		assert.equal(profile.person.name, office.person!.name);
		assert.equal(profile.person.party, "");
		assert.equal(profile.person.onCurrentBallot, false);
		assert.deepEqual(profile.person.biography, []);
		assert.equal(profile.person.profileImages[0].url, office.person!.portraitUrl);
		assert.equal(profile.person.officialWebsiteUrl, office.person!.officialWebsiteUrl);
		assert.equal(profile.person.sources.filter((source: { id: string }) => source.id.startsWith("fulton-county-offices:")).length, 2);
		for (const source of profile.person.sources.filter((source: { id: string }) => source.id.startsWith("fulton-county-offices:"))) assert.equal((await fetch(`${base}/api/sources/${encodeURIComponent(source.id)}`)).status, 200);
	}
	assert.equal(county.representatives.find((person: { name: string }) => person.name === "Avery First").officeDisplayLabel, "Fulton County Sheriff");
	assert.equal(county.representatives.find((person: { name: string }) => person.name === "Jordan Second").officeDisplayLabel, "Fulton County District Attorney");
	const lookup = await fetch(`${base}/api/representatives?lookup=30022`).then(result => result.json());
	assert.deepEqual(new Set(lookup.representatives.map((person: { name: string }) => person.name)), new Set(["Avery Chair", "Avery First", "Jordan Second"]));
	const district = await fetch(`${base}/api/districts/fulton-county-commission-district-1`).then(result => result.json());
	assert.deepEqual(district.representatives.map((person: { name: string }) => person.name), ["Alex One"]);
	const operations = await fetch(`${base}/api/admin/operations`, { headers: { "x-admin-api-key": "controlled-county-office-key", "x-admin-actor-username": "fixture-admin", "x-admin-actor-display-name": "Fixture Admin", "x-admin-actor-role": "admin" } }).then(result => result.json());
	assert.equal(operations.datasets.find((dataset: { id: string }) => dataset.id === "ga-fulton-county-offices").kind, "officeholders");
});

test("county-office refresh replaces current profiles and source inventory without restarting the API", async (context) => {
	let snapshot = exampleCountyOfficeholders();
	const base = await fixture(context, () => snapshot);
	const before = snapshot;
	assert.match(JSON.stringify(await fetch(`${base}/api/sources`).then(result => result.json())), new RegExp(before.sourceSha256, "u"));
	snapshot = exampleCountyOfficeholders("Morgan Successor", false, Date.now() - 1000);
	const county = await fetch(`${base}/api/districts/fulton-county`).then(result => result.json());
	assert(county.representatives.some((person: { name: string }) => person.name === "Morgan Successor"));
	assert(!county.representatives.some((person: { name: string }) => person.name === "Avery First"));
	const sources = JSON.stringify(await fetch(`${base}/api/sources`).then(result => result.json()));
	assert.match(sources, new RegExp(snapshot.sourceSha256, "u"));
	assert(!sources.includes(before.sourceSha256));
	const old = await fetch(`${base}/api/representatives/avery-first`).then(result => result.json());
	assert.equal(old.person.provenance.status, "inferred");
	assert.deepEqual(old.person.sources, []);
	snapshot = exampleCountyOfficeholders("Morgan Successor", true, Date.now() - 1000);
	const vacant = await fetch(`${base}/api/districts/fulton-county`).then(result => result.json());
	assert.deepEqual(vacant.officeVacancies, ["County Commissioner, District 4", "Sheriff"]);
});

test("expanded county departments become public without a restart, fabricated portraits or ballot claims", async (context) => {
	let snapshot = exampleCountyOfficeholders();
	const base = await fixture(context, () => snapshot);
	assert.equal((await fetch(`${base}/api/districts/fulton-county`).then(result => result.json())).representatives.length, 8);
	snapshot = exampleExpandedCountyOfficeholders();
	const county = await fetch(`${base}/api/districts/fulton-county`).then(result => result.json());
	assert.equal(county.representatives.length, 10);
	assert.deepEqual(county.officeVacancies, ["County Commissioner, District 4"]);
	for (const office of snapshot.offices.slice(2)) {
		const response = await fetch(`${base}/api/representatives/${office.person!.slug}`);
		assert.equal(response.status, 200);
		const { person } = await response.json();
		assert.equal(person.name, office.person!.name);
		assert.equal(person.party, "");
		assert.equal(person.onCurrentBallot, false);
		assert.deepEqual(person.profileImages ?? [], []);
		assert.deepEqual(person.biography, []);
		assert.equal(person.officialWebsiteUrl, office.person!.officialWebsiteUrl);
		const sources = person.sources.filter((source: { id: string }) => source.id.startsWith("fulton-county-offices:"));
		assert.equal(sources.length, 1);
		assert.equal(sources[0].url, office.person!.officialWebsiteUrl);
		assert.equal((await fetch(`${base}/api/sources/${encodeURIComponent(sources[0].id)}`)).status, 200);
	}
	const lookup = await fetch(`${base}/api/representatives?lookup=30022`).then(result => result.json());
	assert.deepEqual(new Set(lookup.representatives.map((person: { name: string }) => person.name)), new Set(["Avery Chair", "Avery First", "Jordan Second", "Morgan Future", "Taylor Future"]));
});

test("county-office failure is explicit and never attaches Georgia officials to a same-named county in another state", async (context) => {
	const base = await fixture(context, () => {
		throw new FultonCountyOfficeholderUnavailableError();
	});
	for (const path of ["/api/districts/fulton-county", "/api/representatives/avery-first", "/api/representatives?lookup=30022"]) assert.equal((await fetch(base + path)).status, 503);
	assert.equal((await fetch(`${base}/api/representatives/john-bradberry`)).status, 200);
	const other = await fetch(`${base}/api/representatives?lookup=65251`);
	assert.equal(other.status, 200);
	assert.equal((await other.json()).representatives.length, 0);
});
