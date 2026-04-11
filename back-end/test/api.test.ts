import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import assert from "node:assert/strict";
import { once } from "node:events";
import test, { after, before } from "node:test";
import { createApp } from "../src/server.js";

let server: Server;
let baseUrl = "";

before(async () => {
	server = createApp().listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address() as AddressInfo;
	baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
	await new Promise<void>((resolve, reject) => {
		server.close(error => error ? reject(error) : resolve());
	});
});

test("GET /health returns a simple readiness payload", async () => {
	const response = await fetch(`${baseUrl}/health`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.deepEqual(body, { ok: true });
});

test("GET /api/location validates short lookups", async () => {
	const response = await fetch(`${baseUrl}/api/location?q=12`);
	const body = await response.json();

	assert.equal(response.status, 400);
	assert.match(body.message, /Enter at least/);
});

test("GET /api/location returns the demo Metro County location for valid lookups", async () => {
	const response = await fetch(`${baseUrl}/api/location?q=30309`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.electionSlug, "2026-metro-county-general");
	assert.equal(body.location.slug, "metro-county-franklin");
	assert.equal(body.location.lookupInput, "30309");
});

test("GET /api/ballot returns the demo election and contests", async () => {
	const response = await fetch(`${baseUrl}/api/ballot?election=2026-metro-county-general`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.demo, true);
	assert.equal(body.election.slug, "2026-metro-county-general");
	assert.equal(body.election.contests.length, 5);
	assert.equal(body.election.contests[0].title, "Federal Race");
});

test("GET /api/ballot returns 404 for unknown elections", async () => {
	const response = await fetch(`${baseUrl}/api/ballot?election=not-real`);
	const body = await response.json();

	assert.equal(response.status, 404);
	assert.match(body.message, /Ballot not found/);
});

test("GET /api/candidates/:slug returns a source-backed candidate profile", async () => {
	const response = await fetch(`${baseUrl}/api/candidates/elena-torres`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.slug, "elena-torres");
	assert.equal(body.officeSought, "U.S. House, District 7");
	assert.ok(body.sources.length >= 4);
});

test("GET /api/measures/:slug returns a ballot measure profile", async () => {
	const response = await fetch(`${baseUrl}/api/measures/charter-amendment-a`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.slug, "charter-amendment-a");
	assert.match(body.yesMeaning, /YES vote/);
});

test("GET /api/compare limits compare results and preserves a shared office when applicable", async () => {
	const response = await fetch(`${baseUrl}/api/compare?slugs=elena-torres,daniel-brooks,sandra-patel,naomi-park`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.deepEqual(body.requestedSlugs, ["elena-torres", "daniel-brooks", "sandra-patel"]);
	assert.equal(body.candidates.length, 3);
	assert.equal(body.office, null);
	assert.match(body.note, /informational only/i);
});
