import type { AddressInfo } from "node:net";
import type { TestContext } from "node:test";
import type { CourtDirectoryRepository } from "../src/court-directory-storage.js";
import type { MagistrateCourtRepository } from "../src/magistrate-court-storage.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import process from "node:process";
import test from "node:test";
import { buildAdminOperations } from "../src/admin-operations.js";
import { MagistrateCourtUnavailableError } from "../src/magistrate-court-storage.js";
import { createApp } from "../src/server.js";
import { courtFixture } from "./helpers/court-directory.js";
import { magistrateFixture, magistrateTestTime } from "./helpers/magistrate-court.js";

process.env.ADMIN_STORE_DRIVER = "sqlite";
delete process.env.ADMIN_DATABASE_URL;
delete process.env.DATABASE_URL;

async function fixture(context: TestContext, magistrateCourtRepository: MagistrateCourtRepository | null, courtDirectoryRepository: CourtDirectoryRepository | null = null) {
	const app = await createApp({ adminDbPath: ":memory:", activeLookupCookieSecret: "controlled-magistrate-cookie-secret-long-enough", adminMfaEncryptionKey: "controlled-magistrate-mfa-secret-long-enough", stateBallotRepository: null, electionReferenceRepository: null, congressClient: null, googleCivicClient: null, ldaClient: null, openFecClient: null, openStatesClient: null, fultonOfficeholderRepository: null, fultonCountyOfficeholderRepository: null, courtDirectoryRepository, magistrateCourtRepository });
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	context.after(async () => {
		await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
		await app.closeResources();
	});
	return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

test("Magistrate records stay independent of State Court, representatives, election candidates and noncounty districts", async (context) => {
	const state = courtFixture().snapshot;
	let snapshot = magistrateFixture().snapshot;
	const base = await fixture(context, { getSnapshot: async () => snapshot, inspectSources: async () => [] }, { getSnapshot: async () => state, inspectSources: async () => [] });
	const index = await fetch(`${base}/api/courts`).then(response => response.json());
	assert.deepEqual(index.courts.map((court: { slug: string }) => court.slug), ["fulton-state", "fulton-magistrate"]);
	assert.deepEqual(await fetch(`${base}/api/courts/fulton-magistrate`).then(response => response.json()), snapshot);
	const county = await fetch(`${base}/api/districts/fulton-county`).then(response => response.json());
	assert.equal(county.courtDirectory.slug, "fulton-state");
	assert.deepEqual(county.courtDirectories, index.courts);
	assert(!county.representatives.some((person: { name: string }) => person.name === "Morgan Current"));
	assert(!county.candidates.some((person: { name: string }) => person.name === "Morgan Current"));
	const commission = await fetch(`${base}/api/districts/fulton-county-commission-district-1`).then(response => response.json());
	assert.equal(commission.courtDirectories, undefined);
	snapshot = magistrateFixture("Jordan Successor").snapshot;
	assert.equal((await fetch(`${base}/api/courts/fulton-magistrate`).then(response => response.json())).judges[1].name, "Jordan Successor");
	assert.equal((await fetch(`${base}/api/courts/unknown`)).status, 404);
});

test("Unconfigured Magistrate data creates no link, placeholder or fabricated current officials", async (context) => {
	const base = await fixture(context, null);
	assert.deepEqual(await fetch(`${base}/api/courts`).then(response => response.json()), { courts: [] });
	assert.equal((await fetch(`${base}/api/courts/fulton-magistrate`)).status, 404);
	assert.equal((await fetch(`${base}/api/districts/fulton-county`).then(response => response.json())).courtDirectories, undefined);
});

test("Magistrate dependency failure stays explicit while the county and independent State Court remain useful", async (context) => {
	const state = courtFixture().snapshot;
	const base = await fixture(context, { getSnapshot: async () => {
		throw new MagistrateCourtUnavailableError();
	}, inspectSources: async () => [] }, { getSnapshot: async () => state, inspectSources: async () => [] });
	assert.equal((await fetch(`${base}/api/courts/fulton-magistrate`)).status, 503);
	assert.equal((await fetch(`${base}/api/courts/fulton-state`)).status, 200);
	const response = await fetch(`${base}/api/districts/fulton-county`);
	assert.equal(response.status, 200);
	const county = await response.json();
	assert.deepEqual(county.courtDirectories.map((court: { slug: string }) => court.slug), ["fulton-state"]);
});

test("Admin Operations reports the configured Magistrate dataset independently rather than a healthy empty queue", async () => {
	const dataset = { id: "ga-fulton-magistrate-court", label: "Fulton County Magistrate Court", stateCode: "GA", electionDate: "", kind: "officeholders" as const, mode: "automatic" as const, status: "error" as const, records: 23, retrievedAt: new Date(magistrateTestTime).toISOString(), lastAttemptAt: null, lastImportAt: null, failure: "source-unavailable" };
	const operations = await buildAdminOperations({ candidates: null, references: null, dataDirectory: null, magistrateCourts: { getSnapshot: async () => magistrateFixture().snapshot, inspectSources: async () => [dataset] }, now: magistrateTestTime });
	assert(operations.datasets.some(record => record.id === dataset.id && record.status === "error" && record.records === 23));
});
