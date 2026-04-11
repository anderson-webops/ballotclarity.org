import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import assert from "node:assert/strict";
import { once } from "node:events";
import test, { after, before } from "node:test";
import { createApp } from "../src/server.js";

let server: Server;
let baseUrl = "";
const adminApiKey = "test-admin-key";

before(async () => {
	server = createApp({
		adminApiKey
	}).listen(0, "127.0.0.1");
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

test("POST /api/location validates short lookups", async () => {
	const response = await fetch(`${baseUrl}/api/location`, {
		body: JSON.stringify({ q: "12" }),
		headers: {
			"Content-Type": "application/json"
		},
		method: "POST"
	});
	const body = await response.json();

	assert.equal(response.status, 400);
	assert.match(body.message, /Enter at least/);
});

test("POST /api/location returns the demo Metro County location for valid lookups", async () => {
	const response = await fetch(`${baseUrl}/api/location`, {
		body: JSON.stringify({ q: "30309" }),
		headers: {
			"Content-Type": "application/json"
		},
		method: "POST"
	});
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(response.headers.get("cache-control"), "no-store");
	assert.equal(body.electionSlug, "2026-metro-county-general");
	assert.equal(body.location.slug, "metro-county-franklin");
	assert.equal(body.location.lookupInput, undefined);
});

test("GET /api/ballot returns the demo election and contests", async () => {
	const response = await fetch(`${baseUrl}/api/ballot?election=2026-metro-county-general`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.demo, true);
	assert.equal(body.election.slug, "2026-metro-county-general");
	assert.equal(body.election.jurisdictionSlug, "metro-county-franklin");
	assert.equal(body.election.contests.length, 5);
	assert.equal(body.election.contests[0].title, "Federal Race");
	assert.equal(body.election.contests[0].roleGuide.decisionAreas.length, 3);
	assert.match(body.election.contests[0].roleGuide.summary, /federal law/i);
});

test("GET /api/jurisdictions returns the demo jurisdiction summary", async () => {
	const response = await fetch(`${baseUrl}/api/jurisdictions`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.jurisdictions.length, 1);
	assert.equal(body.jurisdictions[0].slug, "metro-county-franklin");
	assert.equal(body.jurisdictions[0].nextElectionSlug, "2026-metro-county-general");
});

test("GET /api/data-sources returns the live-data roadmap and migration notes", async () => {
	const response = await fetch(`${baseUrl}/api/data-sources`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.ok(body.categories.length >= 5);
	assert.equal(body.categories[0].slug, "address-and-districts");
	assert.equal(body.categories[1].options[0].authority, "official-government");
	assert.match(body.categories[3].options[0].name, /FEC OpenFEC/i);
	assert.match(body.migrationWatch[0].title, /April 30, 2025/);
	assert.match(body.migrationWatch[1].title, /June 30, 2026/);
	assert.equal(body.roadmap.length, 6);
});

test("GET /api/jurisdictions/:slug returns the official office and voting-method data", async () => {
	const response = await fetch(`${baseUrl}/api/jurisdictions/metro-county-franklin`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.officialOffice.name, "Metro County Elections Office");
	assert.equal(body.votingMethods.length, 3);
	assert.ok(body.officialResources.length >= 3);
	assert.equal(body.officialResources[0].authority, "official-government");
	assert.match(body.officialResources[0].sourceSystem, /Elections Office/i);
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
	assert.equal(body.freshness.status, "up-to-date");
	assert.equal(body.whatWeKnow.length, 2);
	assert.ok(body.whatWeKnow[0].sources.length >= 1);
	assert.equal(body.sources[0].authority, "official-government");
	assert.ok(body.sources[0].sourceSystem);
});

test("GET /api/measures/:slug returns a ballot measure profile", async () => {
	const response = await fetch(`${baseUrl}/api/measures/charter-amendment-a`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.slug, "charter-amendment-a");
	assert.match(body.yesMeaning, /YES vote/);
	assert.match(body.currentLawOverview, /state public-records law/i);
	assert.equal(body.currentPractice.length, 2);
	assert.equal(body.proposedChanges.length, 3);
	assert.equal(body.yesHighlights.length, 3);
	assert.equal(body.noHighlights.length, 3);
	assert.equal(body.implementationTimeline.length, 3);
	assert.equal(body.fiscalSummary.length, 3);
	assert.equal(body.supportArguments.length, 2);
	assert.equal(body.opposeArguments.length, 2);
	assert.match(body.supportArguments[0].attribution, /Supporters/);
	assert.match(body.argumentsDisclaimer, /not Ballot Clarity endorsements/i);
	assert.equal(body.freshness.status, "up-to-date");
	assert.equal(body.whatWeDoNotKnow.length, 2);
});

test("GET /api/compare limits compare results and preserves a shared office when applicable", async () => {
	const response = await fetch(`${baseUrl}/api/compare?slugs=elena-torres,daniel-brooks,sandra-patel,naomi-park`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.deepEqual(body.requestedSlugs, ["elena-torres", "daniel-brooks", "sandra-patel"]);
	assert.equal(body.candidates.length, 3);
	assert.equal(body.sameContest, false);
	assert.equal(body.contestSlug, null);
	assert.equal(body.office, null);
	assert.match(body.note, /informational only/i);
});

test("GET /api/compare returns a same-contest questionnaire-first comparison payload", async () => {
	const response = await fetch(`${baseUrl}/api/compare?slugs=elena-torres,daniel-brooks`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.deepEqual(body.requestedSlugs, ["elena-torres", "daniel-brooks"]);
	assert.equal(body.sameContest, true);
	assert.equal(body.contestSlug, "us-house-district-7");
	assert.equal(body.office, "U.S. House, District 7");
	assert.equal(body.candidates.length, 2);
	assert.equal(body.candidates[0].comparison.ballotStatus.label, "On ballot (verified)");
	assert.equal(body.candidates[0].comparison.questionnaireResponses.length, 3);
	assert.equal(body.candidates[1].comparison.questionnaireResponses[2].responseStatus, "no-response");
	assert.match(body.note, /do not rank candidates/i);
});

test("GET /api/admin/overview rejects unauthenticated access", async () => {
	const response = await fetch(`${baseUrl}/api/admin/overview`);
	const body = await response.json();

	assert.equal(response.status, 401);
	assert.match(body.message, /Unauthorized admin request/i);
});

test("GET /api/admin/overview returns operational metrics for authorized requests", async () => {
	const response = await fetch(`${baseUrl}/api/admin/overview`, {
		headers: {
			"x-admin-api-key": adminApiKey
		}
	});
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.metrics.length, 4);
	assert.equal(body.metrics[0].label, "Open corrections");
	assert.ok(body.needsAttention.length >= 2);
	assert.equal(body.recentActivity[0].type, "publish");
});

test("GET /api/admin/review and /api/admin/sources return protected operational queues", async () => {
	const [reviewResponse, sourcesResponse] = await Promise.all([
		fetch(`${baseUrl}/api/admin/review`, {
			headers: {
				"x-admin-api-key": adminApiKey
			}
		}),
		fetch(`${baseUrl}/api/admin/sources`, {
			headers: {
				"x-admin-api-key": adminApiKey
			}
		})
	]);
	const reviewBody = await reviewResponse.json();
	const sourcesBody = await sourcesResponse.json();

	assert.equal(reviewResponse.status, 200);
	assert.equal(sourcesResponse.status, 200);
	assert.equal(reviewBody.items[0].entityType, "election");
	assert.match(reviewBody.items[1].blocker, /finance/i);
	assert.equal(sourcesBody.sources[0].authority, "official-government");
	assert.equal(sourcesBody.sources[2].health, "incident");
});
