import type { AddressInfo } from "node:net";
import type { TestContext } from "node:test";
import type { CourtDirectoryRepository } from "../src/court-directory-storage.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import process from "node:process";
import test from "node:test";
import { CourtDirectoryUnavailableError } from "../src/court-directory-storage.js";
import { createApp } from "../src/server.js";
import { courtFixture } from "./helpers/court-directory.js";

process.env.ADMIN_STORE_DRIVER = "sqlite";
delete process.env.ADMIN_DATABASE_URL;
delete process.env.DATABASE_URL;

async function fixture(context: TestContext, courtDirectoryRepository: CourtDirectoryRepository | null) {
	const app = await createApp({ adminDbPath: ":memory:", activeLookupCookieSecret: "controlled-court-cookie-secret-long-enough", adminMfaEncryptionKey: "controlled-court-mfa-secret-long-enough", stateBallotRepository: null, electionReferenceRepository: null, congressClient: null, googleCivicClient: null, ldaClient: null, openFecClient: null, openStatesClient: null, fultonOfficeholderRepository: null, fultonCountyOfficeholderRepository: null, courtDirectoryRepository });
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	context.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
	return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

test("public court records are reachable from their county and stay separate from representative and candidate records", async (context) => {
	let snapshot = courtFixture().snapshot;
	const base = await fixture(context, { getSnapshot: async () => snapshot, inspectSources: async () => [] });
	assert.deepEqual((await fetch(`${base}/api/courts`).then(response => response.json())).courts, [{ slug: "fulton-state", title: "Fulton County State Court", count: 2 }]);
	assert.deepEqual(await fetch(`${base}/api/courts/fulton-state`).then(response => response.json()), snapshot);
	const county = await fetch(`${base}/api/districts/fulton-county`).then(response => response.json());
	assert.equal(county.courtDirectory.count, 2);
	assert.equal(county.courtDirectory.slug, "fulton-state");
	assert(!county.representatives.some((person: { name: string }) => person.name === "Avery Future"));
	assert(!county.candidates.some((person: { name: string }) => person.name === "Avery Future"));
	const other = await fetch(`${base}/api/districts/fulton-county-commission-district-1`).then(response => response.json());
	assert.equal(other.courtDirectory, undefined);
	snapshot = courtFixture("Taylor Successor").snapshot;
	assert.equal((await fetch(`${base}/api/courts/fulton-state`).then(response => response.json())).judges[0].name, "Taylor Successor");
	assert.equal((await fetch(`${base}/api/courts/unknown`)).status, 404);
});

test("an unconfigured court source has no county link and cannot fabricate an available directory", async (context) => {
	const base = await fixture(context, null);
	assert.deepEqual(await fetch(`${base}/api/courts`).then(response => response.json()), { courts: [] });
	assert.equal((await fetch(`${base}/api/courts/fulton-state`)).status, 404);
	assert.equal((await fetch(`${base}/api/districts/fulton-county`).then(response => response.json())).courtDirectory, undefined);
});

test("court dependency failures are explicit without breaking unrelated county records", async (context) => {
	const base = await fixture(context, { getSnapshot: async () => {
		throw new CourtDirectoryUnavailableError();
	}, inspectSources: async () => [] });
	assert.equal((await fetch(`${base}/api/courts/fulton-state`)).status, 503);
	assert.equal((await fetch(`${base}/api/courts`)).status, 503);
	const response = await fetch(`${base}/api/districts/fulton-county`);
	assert.equal(response.status, 200);
	assert.equal((await response.json()).courtDirectory, undefined);
});
