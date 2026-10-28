import type { AddressInfo } from "node:net";
import type { TestContext } from "node:test";
import type { CoverageRepository } from "../src/coverage-repository.js";
import type { StateBallotSource } from "../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import process from "node:process";
import test from "node:test";
import { buildFultonOfficialLogisticsOnlySnapshot } from "../src/fulton-reviewed-coverage.js";
import { createApp } from "../src/server.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";

process.env.ADMIN_STORE_DRIVER = "sqlite";
delete process.env.ADMIN_DATABASE_URL;
delete process.env.DATABASE_URL;

async function fixture(context: TestContext, sources: readonly StateBallotSource[]) {
	const data = buildFultonOfficialLogisticsOnlySnapshot();
	const coverage: CoverageRepository = {
		data,
		mode: "snapshot",
		configuredSnapshotMissing: false,
		loadedAt: data.updatedAt,
		snapshotPath: ":memory:",
		snapshotMetadata: { status: "reviewed", sourceType: "imported", sourceLabel: "Controlled official logistics" },
		getCandidateBySlug: () => null,
		getCandidatesBySlugs: () => [],
		getMeasureBySlug: () => null,
		getSourceById: () => null,
		getElectionBySlug: slug => data.election?.slug === slug ? data.election : null,
		getJurisdictionBySlug: slug => data.jurisdiction?.slug === slug ? data.jurisdiction : null
	};
	const app = await createApp({ coverageRepository: coverage, adminDbPath: ":memory:", adminMfaEncryptionKey: "controlled-overview-mfa-key-long-enough", stateBallotRepository: { sources, getSnapshot: async () => {
		throw new Error("The overview must not collect or load candidates before rendering logistics.");
	} }, electionReferenceRepository: null, fultonOfficeholderRepository: null, fultonCountyOfficeholderRepository: null, congressClient: null, googleCivicClient: null, openStatesClient: null, openFecClient: null, ldaClient: null });
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	context.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
	return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

test("a published election exposes its exact candidate source without a ZIP, search or provider wait", async (context) => {
	const source = configuredStateBallotSources.find(item => item.id === "ga-fulton-2026")!;
	const base = await fixture(context, [source]);
	const response = await fetch(`${base}/api/ballot?election=2026-fulton-county-general`);
	assert.equal(response.status, 200);
	const body = await response.json();
	assert.deepEqual(body.candidateRecordSource, { stateCode: "GA", sourceId: "ga-fulton-2026" });
	assert(body.election.keyDates.length > 0);
	assert.equal(body.guideContent.verifiedContestPackage, false);
	assert.equal((await fetch(`${base}/api/ballot?election=unknown-election`)).status, 404);
});

test("an election with no enabled matching candidate source keeps its logistics without a misleading source", async (context) => {
	const base = await fixture(context, []);
	const response = await fetch(`${base}/api/ballot?election=2026-fulton-county-general`);
	assert.equal(response.status, 200);
	assert.equal((await response.json()).candidateRecordSource, undefined);
});
