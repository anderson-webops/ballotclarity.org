import type { AddressInfo } from "node:net";
import type { AdditionalCoverageGuide, CoverageSnapshot } from "../src/coverage-repository.js";
import type { Measure } from "../src/types/civic.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildSeedCoverageSnapshot, createCoverageRepository, writeCoverageSnapshot } from "../src/coverage-repository.js";
import { buildFultonOfficialLogisticsOnlySnapshot } from "../src/fulton-reviewed-coverage.js";
import { buildDefaultGuidePackageSeed } from "../src/guide-packages.js";
import { createApp } from "../src/server.js";

function guide(slug: string, state = "Georgia", date = "2026-11-03"): AdditionalCoverageGuide {
	const seed = buildSeedCoverageSnapshot();
	const measure: Measure = { slug: `${slug}-measure`, contestSlug: `${slug}-question`, title: `${slug} public question`, location: state, summary: "Proposed public change fixture.", ballotSummary: "", plainLanguageExplanation: "A sourced fixture explanation.", currentLawOverview: "", currentPractice: [], proposedChanges: [], yesMeaning: "Adopt the fixture proposal.", noMeaning: "Reject the fixture proposal.", yesHighlights: [], noHighlights: [], fiscalContextNote: "", implementationOverview: "", implementationTimeline: [], fiscalSummary: [], potentialImpacts: [], supportArguments: [], opposeArguments: [], argumentsDisclaimer: "", argumentsAndConsiderations: [], whatWeKnow: [], whatWeDoNotKnow: [], sources: [{ id: `${slug}-source`, title: "Official question fixture", publisher: "Public election office", authority: "official-government", type: "official record", sourceSystem: "Isolated public source", date: "", url: "https://www.eac.gov/" }], updatedAt: seed.updatedAt, freshness: { contentLastVerifiedAt: seed.updatedAt, dataLastUpdatedAt: seed.updatedAt, nextReviewAt: "2027-01-01T00:00:00Z", status: "incomplete", statusLabel: "Partial fixture", statusNote: "" } };
	const election = structuredClone(seed.election!);
	Object.assign(election, { slug: `${slug}-election`, jurisdictionSlug: slug, locationName: state, date, contests: [{ slug: measure.contestSlug, title: measure.title, office: "Statewide measure", jurisdiction: state, type: "measure", description: "", roleGuide: { summary: "", whyItMatters: "", decisionAreas: [] }, measures: [measure] }] });
	const jurisdiction = structuredClone(seed.jurisdiction!);
	Object.assign(jurisdiction, { slug, state, name: state, displayName: state, jurisdictionType: "state", nextElectionSlug: election.slug, nextElectionName: election.name, upcomingElections: [election] });
	return { election, jurisdiction, location: { slug, displayName: state, state, coverageLabel: "Statewide questions", lookupMode: "coverage-selection", requiresOfficialConfirmation: true } };
}

const cases = [
	{ name: "published state content wins over a same-date local logistics shell", statePublished: true, expected: "state" },
	{ name: "draft state content cannot displace the local guide", statePublished: false, expected: "local" },
	{ name: "different election dates still require a choice", statePublished: true, date: "2027-04-06", expected: "choice" },
	{ name: "two logistics-only guides still require a choice", statePublished: true, stateEmpty: true, expected: "choice" },
	{ name: "same-date state measures and local questions open one composed local guide", statePublished: true, localContent: true, rollup: true, expected: "local" },
	{ name: "an empty statewide shell cannot displace local questions", statePublished: true, stateEmpty: true, localContent: true, expected: "local" },
	{ name: "multiple local areas still require a choice", statePublished: true, extraLocal: true, expected: "choice" },
	{ name: "multiple state guides still require a choice", statePublished: true, extraState: true, expected: "choice" },
	{ name: "another state cannot displace the local guide", statePublished: true, state: "Idaho", expected: "local" },
	{ name: "a selected partial local guide never claims full local coverage", statePublished: false, localContent: true, localPartial: true, expected: "local" },
] as const;

for (const scenario of cases) {
	test(scenario.name, async () => {
		const data: CoverageSnapshot = buildFultonOfficialLogisticsOnlySnapshot();
		const statewide = guide("ga-statewide", "state" in scenario ? scenario.state : "Georgia", "date" in scenario ? scenario.date : undefined);
		data.additionalGuides = [statewide];
		if ("stateEmpty" in scenario) statewide.election.contests = [];
		if ("localContent" in scenario) data.election!.contests = guide("local-content").election.contests;
		if ("extraLocal" in scenario) {
			const extra = guide("atlanta-local");
			Object.assign(extra.jurisdiction, { jurisdictionType: "city", name: "Atlanta", displayName: "Atlanta" });
			extra.election.contests = [];
			data.additionalGuides.push(extra);
		}
		if ("extraState" in scenario) data.additionalGuides.push(guide("ga-second-statewide"));
		const directory = mkdtempSync(join(tmpdir(), "ballot-guide-priority-"));
		const priorPath = process.env.LIVE_COVERAGE_FILE;
		const priorRequired = process.env.LIVE_COVERAGE_REQUIRED;
		let application: Awaited<ReturnType<typeof createApp>> | undefined;
		let listener: ReturnType<Awaited<ReturnType<typeof createApp>>["listen"]> | undefined;
		try {
			process.env.LIVE_COVERAGE_FILE = writeCoverageSnapshot(data, join(directory, "coverage.json"));
			process.env.LIVE_COVERAGE_REQUIRED = "true";
			const coverage = await createCoverageRepository();
			const before = structuredClone(coverage.data);
			const workflows = buildDefaultGuidePackageSeed(coverage).map(workflow => workflow.jurisdictionSlug === statewide.jurisdiction.slug && !scenario.statePublished ? workflow : { ...workflow, status: "published" as const });
			if ("localPartial" in scenario) {
				const localWorkflow = workflows.find(workflow => workflow.electionSlug === data.election!.slug)!;
				localWorkflow.coverageLimits = ["Selected local questions only; other races and ballot questions are not included."];
			}
			application = await createApp({ activeLookupCookieSecret: "synthetic-priority-cookie-not-real", adminMfaEncryptionKey: "synthetic-priority-mfa-not-real", adminDbPath: ":memory:", coverageRepository: coverage, contentSeed: [], guidePackageSeed: workflows, addressEnrichmentService: null, congressClient: null, googleCivicClient: null, ldaClient: null, openFecClient: null, openStatesClient: null, stateBallotRepository: null, electionReferenceRepository: null, locationGuessOptions: { mode: "disabled" }, zipLookupLogger: { enabled: false, logPath: ":memory:", async record() {} }, zipLocationService: {
				async lookupZip(postalCode) {
					return { postalCode, matches: [{ id: postalCode, postalCode, countyName: "Fulton", locality: "Atlanta", stateAbbreviation: "GA", stateName: "Georgia", sourceSystem: "Controlled geography fixture", districtMatches: [], representativeMatches: [] }] };
				},
			} });
			listener = application.listen(0, "127.0.0.1");
			await once(listener, "listening");
			const origin = `http://127.0.0.1:${(listener.address() as AddressInfo).port}`;
			const result = await (await fetch(`${origin}/api/location`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: "30303" }) })).json();
			const expected = scenario.expected === "state" ? statewide.election.slug : scenario.expected === "local" ? data.election!.slug : undefined;
			assert.equal(result.electionSlug, expected);
			assert.equal(result.guideAvailability, expected ? "published" : "not-published");
			const guideActions = result.actions.filter((action: { kind: string }) => action.kind === "ballot-guide");
			if (scenario.expected === "choice") assert.ok(guideActions.length > 1);
			for (const action of guideActions) {
				const ballot = await (await fetch(`${origin}/api/ballot?election=${action.electionSlug}`)).json();
				assert.deepEqual(action.guideContent, ballot.guideContent);
				assert.equal(action.electionDate, ballot.election.date);
				assert.equal(action.description, ballot.election.name);
				assert.equal(action.guideContent.publishedGuideShell, true);
				assert.equal(action.location.slug, ballot.location.slug);
			}
			if (scenario.expected === "state") {
				assert.equal(result.location.state, "Georgia");
				assert.equal(result.location.requiresOfficialConfirmation, true);
				assert.equal(result.availability.fullLocalGuide.status, "limited");
				assert.equal(result.availability.ballotCandidates.status, "unavailable");
				assert.equal(result.actions.filter((action: { kind: string }) => action.kind === "ballot-guide").length, 0);
			}
			const primary = await (await fetch(`${origin}/api/ballot?election=${data.election!.slug}`)).json();
			if ("rollup" in scenario) {
				assert.deepEqual(primary.election.includedStatewideElectionSlugs, [statewide.election.slug]);
				assert.deepEqual(primary.election.contests.map((contest: { slug: string }) => contest.slug), [...statewide.election.contests, ...data.election!.contests].map(contest => contest.slug));
				assert.equal(primary.election.contests[0].measures[0].electionSlug, statewide.election.slug);
				assert.deepEqual(primary.election.contests.slice(1), data.election!.contests);
				assert.equal(primary.guideContent.measures.count, 2);
				assert.match(primary.coverageLimits[0], /other local races and measures are not included/u);
			}
			else {
				assert.deepEqual(primary.election, data.election);
			}
			assert.deepEqual(primary.location, data.location);
			assert.equal(primary.scope, "local");
			if ("localPartial" in scenario) {
				assert.equal(result.availability.fullLocalGuide.status, "limited");
				assert.equal(primary.guideContent.verifiedContestPackage, true);
				assert.deepEqual(primary.coverageLimits, ["Selected local questions only; other races and ballot questions are not included."]);
			}
			const stateResponse = await fetch(`${origin}/api/ballot?election=${statewide.election.slug}`);
			assert.equal(stateResponse.status, scenario.statePublished ? 200 : 404);
			assert.deepEqual(coverage.data, before);
		}
		finally {
			if (listener) {
				listener.closeAllConnections();
				await new Promise<void>(accept => listener!.close(() => accept()));
			}
			if (application) await application.closeResources();
			if (priorPath === undefined) delete process.env.LIVE_COVERAGE_FILE;
			else process.env.LIVE_COVERAGE_FILE = priorPath;
			if (priorRequired === undefined) delete process.env.LIVE_COVERAGE_REQUIRED;
			else process.env.LIVE_COVERAGE_REQUIRED = priorRequired;
			rmSync(directory, { recursive: true, force: true });
		}
	});
}
