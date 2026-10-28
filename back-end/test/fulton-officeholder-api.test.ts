import type { AddressInfo } from "node:net";
import type { TestContext } from "node:test";
import type { FultonOfficeholderSnapshot } from "../src/fulton-officeholders.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import process from "node:process";
import test from "node:test";
import { FultonOfficeholderUnavailableError } from "../src/fulton-officeholder-storage.js";
import { createApp } from "../src/server.js";
import { exampleFultonOfficeholders } from "./helpers/fulton-officeholders.js";

process.env.ADMIN_STORE_DRIVER = "sqlite";
delete process.env.ADMIN_DATABASE_URL;
delete process.env.DATABASE_URL;

async function fixture(context: TestContext, getSnapshot: () => FultonOfficeholderSnapshot) {
	const app = await createApp({
		adminDbPath: ":memory:",
		allowLegacyAdminActorHeadersForTesting: true,
		adminApiKey: "controlled-officeholder-test-key",
		activeLookupCookieSecret: "controlled-officeholder-cookie-secret-long-enough",
		adminMfaEncryptionKey: "controlled-officeholder-mfa-secret-long-enough",
		stateBallotRepository: null,
		congressClient: null,
		googleCivicClient: null,
		ldaClient: null,
		openFecClient: null,
		openStatesClient: null,
		fultonOfficeholderRepository: { getSnapshot, inspectSources: async () => [{ id: "ga-fulton-board", label: "Fulton County commissioners", kind: "officeholders", mode: "automatic", stateCode: "GA", electionDate: "", status: "current", records: 6, retrievedAt: getSnapshot().retrievedAt, lastAttemptAt: null, lastImportAt: getSnapshot().retrievedAt, failure: null }] },
		zipLocationService: { async lookupZip(postalCode) { return { postalCode, matches: [{ id: "county:121", locality: "Fulton County", stateAbbreviation: "GA", stateName: "Georgia", postalCode, latitude: 34, longitude: -84.3, sourceSystem: "Controlled geography", districtMatches: [{ id: "county:121", districtType: "county", districtCode: "121", label: "Fulton County", stateFips: "13", sourceSystem: "Controlled geography" }], representativeMatches: [] }] }; } },
	});
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	context.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
	return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

test("Fulton county and individual district pages expose all current board records without guessing party or ballot status", async (context) => {
	const snapshot = exampleFultonOfficeholders();
	const base = await fixture(context, () => snapshot);
	const response = await fetch(`${base}/api/districts/fulton-county`);
	assert.equal(response.status, 200);
	const county = await response.json();
	assert.equal(county.representatives.length, 6);
	assert.deepEqual(county.officeVacancies, ["County Commissioner, District 4"]);
	assert.equal(new Set(county.sources.map((source: { id: string }) => source.id)).size, county.sources.length);
	assert.equal(county.representatives.find((person: { name: string }) => person.name === "Alex One").officeDisplayLabel, "Fulton County Commissioner, District 1");
	assert.equal(county.representatives.find((person: { name: string }) => person.name === "Elliot Six").officeDisplayLabel, "Fulton County Commission Vice Chair, District 6");
	assert(county.representatives.every((person: { summary: string }) => person.summary === ""));
	for (const seat of snapshot.seats.filter(seat => seat.person)) {
		const person = seat.person!;
		const profileResponse = await fetch(`${base}/api/representatives/${person.slug}`);
		assert.equal(profileResponse.status, 200);
		const profile = await profileResponse.json();
		assert.equal(profile.person.name, person.name);
		assert.equal(profile.person.officialWebsiteUrl, person.officialWebsiteUrl);
		assert.equal(profile.person.profileImages[0].url, person.portraitUrl);
		assert.equal(profile.person.party, "");
		assert.equal(profile.person.onCurrentBallot, false);
		assert.equal(profile.person.officeContext?.chamberLabel, "County commission");
		assert.equal(profile.person.provenance.status, "direct");
		assert.deepEqual(profile.person.biography, []);
		assert(profile.person.sources.some((source: { url: string }) => source.url === snapshot.documents[2]!.url));
		if (seat.district) {
			const district = await fetch(`${base}/api/districts/fulton-county-commission-district-${seat.district}`).then(result => result.json());
			assert.equal(district.representatives.length, 1);
			assert.equal(district.representatives[0].name, person.name);
		}
	}
	assert.equal((await fetch(`${base}/api/admin/operations`)).status, 401);
	const operations = await fetch(`${base}/api/admin/operations`, { headers: { "x-admin-api-key": "controlled-officeholder-test-key", "x-admin-actor-username": "fixture-admin", "x-admin-actor-display-name": "Fixture Admin", "x-admin-actor-role": "admin" } }).then(result => result.json());
	assert.equal(operations.datasets.find((item: { id: string }) => item.id === "ga-fulton-board").kind, "officeholders");
	const resident = await fetch(`${base}/api/representatives?lookup=30022`).then(result => result.json());
	assert.deepEqual(resident.representatives.map((person: { name: string }) => person.name), ["Avery Chair"]);
	const countyContext = await fetch(`${base}/api/districts/county-121?lookup=30022`).then(result => result.json());
	assert.equal(countyContext.representatives.length, 6);
	assert.deepEqual(countyContext.officeVacancies, ["County Commissioner, District 4"]);
});

test("Fulton source refresh changes current people, vacancies and source inventory without restarting the API", async (context) => {
	let snapshot = exampleFultonOfficeholders();
	const base = await fixture(context, () => snapshot);
	const oldSources = await fetch(`${base}/api/sources`).then(result => result.json());
	assert.match(JSON.stringify(oldSources), new RegExp(snapshot.sourceSha256, "u"));
	const first = snapshot;
	snapshot = exampleFultonOfficeholders("Jordan Successor", true, Date.now() - 1000);
	const county = await fetch(`${base}/api/districts/fulton-county`).then(result => result.json());
	assert.equal(county.representatives.length, 7);
	assert.deepEqual(county.officeVacancies, []);
	assert(county.representatives.some((person: { name: string }) => person.name === "Jordan Successor"));
	assert(!county.representatives.some((person: { name: string }) => person.name === "Avery Chair"));
	const oldPerson = await fetch(`${base}/api/representatives/avery-chair`).then(result => result.json());
	assert.equal(oldPerson.person.provenance.status, "inferred");
	assert.deepEqual(oldPerson.person.sources, []);
	assert.equal((await fetch(`${base}/api/representatives/morgan-four`)).status, 200);
	const sources = await fetch(`${base}/api/sources`).then(result => result.json());
	assert.match(JSON.stringify(sources), new RegExp(snapshot.sourceSha256, "u"));
	assert(!JSON.stringify(sources).includes(first.sourceSha256));
});

test("a broken configured Fulton repository returns an explicit service error while unrelated local profiles remain available", async (context) => {
	const base = await fixture(context, () => {
		throw new FultonOfficeholderUnavailableError();
	});
	for (const path of ["/api/districts/fulton-county", "/api/representatives/alex-one"]) {
		const response = await fetch(`${base}${path}`);
		assert.equal(response.status, 503);
		assert.equal((await response.json()).message, "Fulton County officeholder records are temporarily unavailable.");
	}
	assert.equal((await fetch(`${base}/api/representatives/john-bradberry`)).status, 200);
});
