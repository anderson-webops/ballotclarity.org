import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import assert from "node:assert/strict";
import { once } from "node:events";
import test, { after, before } from "node:test";
import { buildSeedCoverageSnapshot } from "../src/coverage-repository.js";
import { createApp } from "../src/server.js";

let server: Server;
let baseUrl = "";
const adminApiKey = "test-admin-key";
const coverageSnapshot = buildSeedCoverageSnapshot();
const previousAdminStoreDriver = process.env.ADMIN_STORE_DRIVER;
const previousAdminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousSourceAssetBaseUrl = process.env.SOURCE_ASSET_BASE_URL;

before(async () => {
	process.env.ADMIN_STORE_DRIVER = "sqlite";
	delete process.env.ADMIN_DATABASE_URL;
	delete process.env.DATABASE_URL;
	delete process.env.SOURCE_ASSET_BASE_URL;

	server = (await createApp({
		adminApiKey,
		adminDbPath: ":memory:",
		coverageRepository: {
			data: coverageSnapshot,
			getCandidateBySlug(slug) {
				return coverageSnapshot.candidates.find(candidate => candidate.slug === slug) ?? null;
			},
			getCandidatesBySlugs(slugs) {
				const requested = new Set(slugs);
				return coverageSnapshot.candidates.filter(candidate => requested.has(candidate.slug));
			},
			getElectionBySlug(slug) {
				return coverageSnapshot.election.slug === slug ? coverageSnapshot.election : null;
			},
			getJurisdictionBySlug(slug) {
				return coverageSnapshot.jurisdiction.slug === slug ? coverageSnapshot.jurisdiction : null;
			},
			getMeasureBySlug(slug) {
				return coverageSnapshot.measures.find(measure => measure.slug === slug) ?? null;
			},
			getSourceById(id) {
				return coverageSnapshot.sources.find(source => source.id === id) ?? null;
			},
			mode: "seed",
			snapshotPath: ":memory:"
		},
		googleCivicClient: {
			async lookupVoterInfo() {
				return {
					actions: [
						{
							badge: "Official",
							description: "Open the official ballot or sample-ballot page returned for this address.",
							id: "google-civic:sample-ballot",
							kind: "official-verification",
							title: "Official ballot information",
							url: "https://example.org/ballot"
						}
					],
					note: "Google Civic accepted the address as 5600 Campbellton Fairburn Rd, Union City, GA 30213.",
					verified: true
				};
			}
		}
	})).listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address() as AddressInfo;
	baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
	if (server) {
		await new Promise<void>((resolve, reject) => {
			server.close(error => error ? reject(error) : resolve());
		});
	}

	if (previousAdminStoreDriver === undefined)
		delete process.env.ADMIN_STORE_DRIVER;
	else
		process.env.ADMIN_STORE_DRIVER = previousAdminStoreDriver;

	if (previousAdminDatabaseUrl === undefined)
		delete process.env.ADMIN_DATABASE_URL;
	else
		process.env.ADMIN_DATABASE_URL = previousAdminDatabaseUrl;

	if (previousDatabaseUrl === undefined)
		delete process.env.DATABASE_URL;
	else
		process.env.DATABASE_URL = previousDatabaseUrl;

	if (previousSourceAssetBaseUrl === undefined)
		delete process.env.SOURCE_ASSET_BASE_URL;
	else
		process.env.SOURCE_ASSET_BASE_URL = previousSourceAssetBaseUrl;
});

test("GET /health returns readiness and coverage metadata", async () => {
	const response = await fetch(`${baseUrl}/health`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.ok, true);
	assert.equal(body.ready, true);
	assert.equal(body.driver, "sqlite");
	assert.equal(body.coverageMode, "seed");
	assert.equal(body.assetMode, "public-mirror");
	assert.equal(body.providerSummary.total >= 6, true);
	assert.match(body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
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

test("POST /api/location validates incomplete numeric ZIP fragments", async () => {
	const response = await fetch(`${baseUrl}/api/location`, {
		body: JSON.stringify({ q: "3030" }),
		headers: {
			"Content-Type": "application/json"
		},
		method: "POST"
	});
	const body = await response.json();

	assert.equal(response.status, 400);
	assert.match(body.message, /full 5-digit ZIP code/i);
});

test("POST /api/location returns ZIP lookup choices instead of pretending to have an exact ballot", async () => {
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
	assert.equal(body.result, "selection-required");
	assert.equal(body.inputKind, "zip");
	assert.equal(body.actions[0].kind, "ballot-guide");
	assert.equal(body.actions[0].location.slug, "fulton-county-georgia");
	assert.equal(body.actions[0].location.lookupMode, "zip-preview");
	assert.equal(body.actions.some((item: { kind: string; title: string }) => item.kind === "official-verification" && /My Voter Page/i.test(item.title)), true);
});

test("POST /api/location returns the current Fulton County launch location for full addresses", async () => {
	const response = await fetch(`${baseUrl}/api/location`, {
		body: JSON.stringify({ q: "5600 Campbellton Fairburn Road, Union City, GA 30213" }),
		headers: {
			"Content-Type": "application/json"
		},
		method: "POST"
	});
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(response.headers.get("cache-control"), "no-store");
	assert.equal(body.result, "resolved");
	assert.equal(body.inputKind, "address");
	assert.equal(body.electionSlug, "2026-fulton-county-general");
	assert.equal(body.location.slug, "fulton-county-georgia");
	assert.equal(body.location.lookupMode, "address-verified");
	assert.equal(body.location.requiresOfficialConfirmation, false);
	assert.equal(body.actions[0].kind, "official-verification");
	assert.match(body.note, /Google Civic accepted the address/i);
	assert.equal(body.location.lookupInput, undefined);
});

test("GET /api/ballot returns the election guide and contests", async () => {
	const response = await fetch(`${baseUrl}/api/ballot?election=2026-fulton-county-general`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.election.slug, "2026-fulton-county-general");
	assert.equal(body.election.jurisdictionSlug, "fulton-county-georgia");
	assert.equal(body.election.contests.length, 5);
	assert.equal(body.election.contests[0].title, "Federal Race");
	assert.equal(body.election.contests[0].roleGuide.decisionAreas.length, 3);
	assert.match(body.election.contests[0].roleGuide.summary, /federal law/i);
	assert.match(body.note, /current release/i);
	assert.match(body.election.name, /Fulton County/i);
});

test("GET /api/jurisdictions returns the demo jurisdiction summary", async () => {
	const response = await fetch(`${baseUrl}/api/jurisdictions`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.jurisdictions.length, 1);
	assert.equal(body.jurisdictions[0].slug, "fulton-county-georgia");
	assert.equal(body.jurisdictions[0].nextElectionSlug, "2026-fulton-county-general");
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
	assert.equal(body.launchTarget.displayName, "Fulton County, Georgia");
	assert.ok(body.categories[0].options[0].links.length >= 1);
	assert.equal(body.coverageMode, "seed");
	assert.equal(body.assetMode, "public-mirror");
});

test("GET /api/coverage returns the public launch profile for Fulton County, Georgia", async () => {
	const response = await fetch(`${baseUrl}/api/coverage`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.launchTarget.displayName, "Fulton County, Georgia");
	assert.equal(body.launchTarget.currentElectionDate, "2026-05-19");
	assert.equal(body.launchTarget.nextElectionDate, "2026-11-03");
	assert.equal(body.supportedContentTypes.length, 5);
	assert.equal(body.collections[0].href, "/coverage");
	assert.equal(body.coverageMode, "seed");
});

test("GET /api/status returns public source-health and launch notices", async () => {
	const response = await fetch(`${baseUrl}/api/status`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.overallStatus, "degraded");
	assert.equal(body.coverageMode, "seed");
	assert.equal(body.sourceSummary.healthy, 1);
	assert.equal(body.sourceSummary.incident, 1);
	assert.ok(body.notes.length >= 2);
	assert.ok(body.sources.some((item: { label: string }) => item.label === "Fulton County Registration and Elections site"));
});

test("GET /api/corrections returns the public corrections log", async () => {
	const response = await fetch(`${baseUrl}/api/corrections`);
	const body = await response.json();
	const coverageItem = body.corrections.find((item: { pageUrl?: string }) => item.pageUrl === "/coverage");

	assert.equal(response.status, 200);
	assert.equal(body.corrections.length, 3);
	assert.ok(coverageItem);
	assert.ok(body.corrections.some((item: { outcome: string }) => /launch state explicit/i.test(item.outcome)));
});

test("GET /api/jurisdictions/:slug returns the official office and voting-method data", async () => {
	const response = await fetch(`${baseUrl}/api/jurisdictions/fulton-county-georgia`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.officialOffice.name, "Fulton County Registration and Elections");
	assert.equal(body.votingMethods.length, 3);
	assert.ok(body.officialResources.length >= 3);
	assert.equal(body.officialResources[0].authority, "official-government");
	assert.match(body.officialResources[0].sourceSystem, /Fulton County elections contacts/i);
});

test("GET /api/contests/:slug returns a canonical contest page payload with sources", async () => {
	const response = await fetch(`${baseUrl}/api/contests/us-house-district-7`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.contest.slug, "us-house-district-7");
	assert.equal(body.election.slug, "2026-fulton-county-general");
	assert.equal(body.jurisdiction.slug, "fulton-county-georgia");
	assert.ok(body.sourceCount >= 4);
	assert.ok(body.relatedContests.length >= 1);
	assert.equal(body.sources[0].authority, "official-government");
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

test("GET /api/search includes contest results when a contest office matches", async () => {
	const response = await fetch(`${baseUrl}/api/search?q=School Board`);
	const body = await response.json();
	const contestGroup = body.groups.find((group: { type: string }) => group.type === "contest");

	assert.equal(response.status, 200);
	assert.ok(contestGroup);
	assert.ok(contestGroup.items.some((item: { href: string }) => item.href === "/contest/county-school-board-at-large"));
});

test("GET /api/sources and /api/sources/:id include contest citations", async () => {
	const directoryResponse = await fetch(`${baseUrl}/api/sources`);
	const directoryBody = await directoryResponse.json();
	const sourceWithContestCitation = directoryBody.sources.find((item: { citedBy: Array<{ type: string }> }) => item.citedBy.some(citation => citation.type === "contest"));

	assert.equal(directoryResponse.status, 200);
	assert.ok(sourceWithContestCitation);

	const recordResponse = await fetch(`${baseUrl}/api/sources/${sourceWithContestCitation.id}`);
	const recordBody = await recordResponse.json();

	assert.equal(recordResponse.status, 200);
	assert.ok(recordBody.source.citedBy.some((citation: { type: string }) => citation.type === "contest"));
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
	const electionItem = reviewBody.items.find((item: { entityType: string; title: string }) => item.entityType === "election");
	const blockedCandidate = reviewBody.items.find((item: { blocker?: string; entityType: string }) => item.entityType === "candidate" && item.blocker);
	const officialSourceLabels = sourcesBody.sources
		.filter((item: { authority: string }) => item.authority === "official-government")
		.map((item: { label: string }) => item.label);
	const incidentSource = sourcesBody.sources.find((item: { health: string }) => item.health === "incident");

	assert.equal(reviewResponse.status, 200);
	assert.equal(sourcesResponse.status, 200);
	assert.equal(electionItem?.title, "Fulton County launch coverage profile");
	assert.match(blockedCandidate?.blocker || "", /crosswalk/i);
	assert.ok(officialSourceLabels.includes("Fulton County Registration and Elections site"));
	assert.equal(incidentSource?.health, "incident");
});

test("PATCH /api/admin/content updates public content fields and publish gating", async () => {
	const isolatedServer = (await createApp({
		adminApiKey,
		adminDbPath: ":memory:"
	})).listen(0, "127.0.0.1");

	await once(isolatedServer, "listening");
	const isolatedAddress = isolatedServer.address() as AddressInfo;
	const isolatedBaseUrl = `http://127.0.0.1:${isolatedAddress.port}`;

	try {
		const contentResponse = await fetch(`${isolatedBaseUrl}/api/admin/content`, {
			headers: {
				"x-admin-api-key": adminApiKey
			}
		});
		const contentBody = await contentResponse.json();
		const elenaRecord = contentBody.items.find((item: { entitySlug: string }) => item.entitySlug === "elena-torres");

		assert.equal(contentResponse.status, 200);
		assert.equal(typeof elenaRecord?.publicSummary, "string");
		assert.equal(typeof elenaRecord?.publicBallotSummary, "string");

		const updatedSummary = "Updated public summary for production editorial testing.";
		const updatedBallotSummary = "Updated short ballot summary for editorial control.";

		const patchResponse = await fetch(`${isolatedBaseUrl}/api/admin/content/content-elena-torres`, {
			body: JSON.stringify({
				publicBallotSummary: updatedBallotSummary,
				publicSummary: updatedSummary,
				published: true,
				status: "published"
			}),
			headers: {
				"Content-Type": "application/json",
				"x-admin-api-key": adminApiKey
			},
			method: "PATCH"
		});

		assert.equal(patchResponse.status, 200);

		const candidateResponse = await fetch(`${isolatedBaseUrl}/api/candidates/elena-torres`);
		const candidateBody = await candidateResponse.json();

		assert.equal(candidateResponse.status, 200);
		assert.equal(candidateBody.summary, updatedSummary);
		assert.equal(candidateBody.ballotSummary, updatedBallotSummary);

		const unpublishResponse = await fetch(`${isolatedBaseUrl}/api/admin/content/content-elena-torres`, {
			body: JSON.stringify({
				published: false,
				status: "draft"
			}),
			headers: {
				"Content-Type": "application/json",
				"x-admin-api-key": adminApiKey
			},
			method: "PATCH"
		});

		assert.equal(unpublishResponse.status, 200);

		const hiddenCandidateResponse = await fetch(`${isolatedBaseUrl}/api/candidates/elena-torres`);
		const ballotResponse = await fetch(`${isolatedBaseUrl}/api/ballot?election=2026-fulton-county-general`);
		const ballotBody = await ballotResponse.json();
		const houseContest = ballotBody.election.contests.find((contest: { slug: string }) => contest.slug === "us-house-district-7");

		assert.equal(hiddenCandidateResponse.status, 404);
		assert.equal(ballotResponse.status, 200);
		assert.equal(houseContest.candidates.length, 1);
		assert.equal(houseContest.candidates[0].slug, "daniel-brooks");
	}
	finally {
		await new Promise<void>((resolve, reject) => {
			isolatedServer.close(error => error ? reject(error) : resolve());
		});
	}
});

test("POST /api/admin/auth/login authenticates a configured user and throttles repeated failures", async () => {
	const isolatedServer = (await createApp({
		adminApiKey,
		adminDbPath: ":memory:",
		bootstrapDisplayName: "Operations Admin",
		bootstrapPassword: "correct-horse-battery-staple",
		bootstrapUsername: "ops-admin"
	})).listen(0, "127.0.0.1");

	await once(isolatedServer, "listening");
	const isolatedAddress = isolatedServer.address() as AddressInfo;
	const isolatedBaseUrl = `http://127.0.0.1:${isolatedAddress.port}`;

	try {
		const successResponse = await fetch(`${isolatedBaseUrl}/api/admin/auth/login`, {
			body: JSON.stringify({
				password: "correct-horse-battery-staple",
				username: "ops-admin"
			}),
			headers: {
				"Content-Type": "application/json",
				"x-forwarded-for": "203.0.113.10"
			},
			method: "POST"
		});
		const successBody = await successResponse.json();

		assert.equal(successResponse.status, 200);
		assert.equal(successBody.authenticated, true);
		assert.equal(successBody.username, "ops-admin");

		for (let index = 0; index < 5; index += 1) {
			const failureResponse = await fetch(`${isolatedBaseUrl}/api/admin/auth/login`, {
				body: JSON.stringify({
					password: "wrong-password",
					username: "ops-admin"
				}),
				headers: {
					"Content-Type": "application/json",
					"x-forwarded-for": "203.0.113.10"
				},
				method: "POST"
			});

			assert.equal(failureResponse.status, 401);
		}

		const throttledResponse = await fetch(`${isolatedBaseUrl}/api/admin/auth/login`, {
			body: JSON.stringify({
				password: "wrong-password",
				username: "ops-admin"
			}),
			headers: {
				"Content-Type": "application/json",
				"x-forwarded-for": "203.0.113.10"
			},
			method: "POST"
		});
		const throttledBody = await throttledResponse.json();

		assert.equal(throttledResponse.status, 429);
		assert.match(throttledBody.message, /Too many failed admin login attempts/i);
		assert.ok(Number(throttledResponse.headers.get("retry-after")) >= 1);
	}
	finally {
		await new Promise<void>((resolve, reject) => {
			isolatedServer.close(error => error ? reject(error) : resolve());
		});
	}
});
