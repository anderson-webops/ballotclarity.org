import type { AddressInfo } from "node:net";
import type { AdditionalCoverageGuide } from "../src/coverage-repository.js";
import type { AdminContentItem, Election, Source } from "../src/types/civic.js";
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

function guide(slug: string, local: boolean): AdditionalCoverageGuide {
	const source: Source = { id: `${slug}-source`, title: "Isolated official question", authority: "official-government", publisher: "Isolated public publisher", sourceSystem: "Isolated public record", type: "official record", date: "", url: `https://www.eac.gov/#${slug}` };
	const seed = buildFultonOfficialLogisticsOnlySnapshot();
	const measure = structuredClone(buildSeedCoverageSnapshot().measures[0]!);
	Object.assign(measure, { slug: `${slug}-measure`, contestSlug: `${slug}-contest`, title: `${slug} question`, location: local ? "Santa Fe County, New Mexico" : "New Mexico", summary: "Isolated sourced proposal", ballotSummary: "", plainLanguageExplanation: "", currentLawOverview: "", currentPractice: [], proposedChanges: [], fiscalSummary: [], potentialImpacts: [], supportArguments: [], opposeArguments: [], argumentsAndConsiderations: [], implementationTimeline: [], whatWeKnow: [], whatWeDoNotKnow: [], sources: [source], ballotOptions: local ? { yes: "For general obligation bonds", no: "Against general obligation bonds" } : { yes: "For", no: "Against" } });
	const election: Election = { ...structuredClone(seed.election!), slug: `${slug}-election`, jurisdictionSlug: slug, date: "2026-11-03", name: `${measure.location} questions`, locationName: measure.location, contests: [{ slug: measure.contestSlug, title: measure.title, type: "measure", jurisdiction: "Ballot measure", office: local ? "County measure" : "Statewide measure", description: "", roleGuide: { summary: "", whyItMatters: "", decisionAreas: [] }, measures: [measure] }] };
	const jurisdiction = { ...structuredClone(seed.jurisdiction!), slug, name: local ? "Santa Fe County" : "New Mexico", state: "New Mexico", displayName: measure.location, jurisdictionType: local ? "county" : "state", nextElectionSlug: election.slug, nextElectionName: election.name, upcomingElections: [election] };
	return { election, jurisdiction, location: { slug, displayName: measure.location, state: "New Mexico", coverageLabel: "Selected questions", lookupMode: "coverage-selection", requiresOfficialConfirmation: true }, coverageLimits: [local ? "Selected local questions only." : "Statewide questions only."] };
}

for (const published of [[], ["state"], ["county"], ["state", "county"]]) {
	for (const hideStateMeasure of [false, true]) {
		test(`state/local public composition requires both approvals: ${published.join(",") || "none"}; hidden=${hideStateMeasure}`, async () => {
			const state = guide("state", false);
			const county = guide("county", true);
			const data = { ...buildFultonOfficialLogisticsOnlySnapshot(), additionalGuides: [state, county] };
			const original = structuredClone(data);
			const directory = mkdtempSync(join(tmpdir(), "ballot-state-local-test-"));
			const previous = process.env.LIVE_COVERAGE_FILE;
			let application;
			let listener;
			try {
				process.env.LIVE_COVERAGE_FILE = writeCoverageSnapshot(data, join(directory, "coverage.json"));
				const coverage = await createCoverageRepository();
				const workflows = buildDefaultGuidePackageSeed(coverage).map(workflow => published.includes(workflow.jurisdictionSlug) ? { ...workflow, status: "published" as const } : workflow);
				const stateMeasureSlug = state.election.contests[0]!.measures![0]!.slug;
				const contentSeed: AdminContentItem[] = hideStateMeasure ? [{ id: "hidden-state-measure", title: "Hidden state question", entityType: "measure", entitySlug: stateMeasureSlug, status: "draft", priority: "low", updatedAt: "2026-10-23T00:00:00Z", assignedTo: "", summary: "", publicSummary: "", sourceCoverage: "", published: false }] : [];
				application = await createApp({
					activeLookupCookieSecret: "synthetic-state-local-cookie-not-real",
					adminMfaEncryptionKey: "synthetic-state-local-mfa-not-real",
					adminDbPath: ":memory:",
					coverageRepository: coverage,
					contentSeed,
					guidePackageSeed: workflows,
					addressEnrichmentService: null,
					congressClient: null,
					googleCivicClient: null,
					ldaClient: null,
					openFecClient: null,
					openStatesClient: null,
					stateBallotRepository: null,
					electionReferenceRepository: null,
					locationGuessOptions: { mode: "disabled" },
					zipLookupLogger: { enabled: false, logPath: ":memory:", async record() {} },
					zipLocationService: {
						async lookupZip(postalCode) {
							return { postalCode, matches: [{ id: postalCode, postalCode, countyName: "Santa Fe", locality: "Santa Fe", stateAbbreviation: "NM", stateName: "New Mexico", sourceSystem: "Isolated geography fixture", districtMatches: [], representativeMatches: [] }] };
						},
					},
				});
				listener = application.listen(0, "127.0.0.1");
				await once(listener, "listening");
				const base = `http://127.0.0.1:${(listener.address() as AddressInfo).port}`;
				const stateMeasure = state.election.contests[0]!.measures![0]!;
				const countyMeasure = county.election.contests[0]!.measures![0]!;
				const both = published.length === 2 && !hideStateMeasure;
				const localResponse = await fetch(`${base}/api/ballot?election=${county.election.slug}`);
				assert.equal(localResponse.status, published.includes("county") ? 200 : 404);
				if (localResponse.ok) {
					const local = await localResponse.json();
					assert.equal(local.election.contests.length, both ? 2 : 1);
					assert.equal(local.guideContent.measures.count, both ? 2 : 1);
					assert.equal(local.scope, "local");
					assert.deepEqual(local.election.contests.at(-1).measures[0].ballotOptions, countyMeasure.ballotOptions);
					if (both) {
						assert.deepEqual(local.election.includedStatewideElectionSlugs, [state.election.slug]);
						assert.match(local.coverageLimits[0], /other local races and measures are not included/u);
					}
				}
				const stateResponse = await fetch(`${base}/api/ballot?election=${state.election.slug}`);
				assert.equal(stateResponse.status, published.includes("state") ? 200 : 404);
				if (stateResponse.ok) {
					const response = await stateResponse.json();
					assert.equal(response.election.contests.length, hideStateMeasure ? 0 : 1);
					if (!hideStateMeasure) assert.equal(response.election.contests[0].measures[0].slug, stateMeasure.slug);
				}
				const contextual = await fetch(`${base}/api/measures/${stateMeasure.slug}?election=${county.election.slug}`);
				assert.equal(contextual.status, both ? 200 : 404);
				if (contextual.ok) {
					const measure = await contextual.json();
					assert.equal(measure.electionSlug, county.election.slug);
					assert.equal(measure.location, "New Mexico");
					assert.deepEqual(measure.sources, stateMeasure.sources);
				}
				assert.equal((await fetch(`${base}/api/measures/${countyMeasure.slug}?election=${state.election.slug}`)).status, 404);
				assert.equal((await fetch(`${base}/api/measures/${stateMeasure.slug}?election=${data.election!.slug}`)).status, 404);
				for (const query of ["election=", "election=state-election&election=county-election", "election=path%2Ffragment"])
					assert.equal((await fetch(`${base}/api/measures/${stateMeasure.slug}?${query}`)).status, 400);
				const lookup = await (await fetch(`${base}/api/location`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: "87501" }) })).json();
				assert.equal(lookup.electionSlug, published.includes("county") ? county.election.slug : published.includes("state") ? state.election.slug : undefined);
				if (both) {
					assert.equal(lookup.guideContent.measures.count, 2);
					assert.equal(lookup.availability.fullLocalGuide.status, "limited");
				}
				assert.deepEqual(coverage.data, original);
			}
			finally {
				if (listener?.listening) {
					listener.closeAllConnections();
					await new Promise<void>(accept => listener!.close(() => accept()));
				}
				if (application) await application.closeResources();
				if (previous === undefined) delete process.env.LIVE_COVERAGE_FILE;
				else process.env.LIVE_COVERAGE_FILE = previous;
				rmSync(directory, { recursive: true, force: true });
			}
		});
	}
}
