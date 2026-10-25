import type { AddressInfo } from "node:net";
import type { AdditionalCoverageGuide, CoverageSnapshot } from "../src/coverage-repository.js";
import type { LocationDistrictMatch, LocationRepresentativeMatch, Source } from "../src/types/civic.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readActiveNationwideLookupContext } from "../src/active-nationwide-lookup.js";
import { buildSeedCoverageSnapshot, createCoverageRepository, parseCoverageSnapshot, writeCoverageSnapshot } from "../src/coverage-repository.js";
import { validateCoverageSnapshotForPublication } from "../src/coverage-snapshot-validation.js";
import { buildFultonOfficialLogisticsOnlySnapshot } from "../src/fulton-reviewed-coverage.js";
import { buildDefaultGuidePackageSeed } from "../src/guide-packages.js";
import { createApp } from "../src/server.js";

function additionalGuide(slug: string, state: string): AdditionalCoverageGuide {
	const primary = buildFultonOfficialLogisticsOnlySnapshot();
	const election = structuredClone(primary.election!);
	const jurisdiction = structuredClone(primary.jurisdiction!);
	const source: Source = { id: `${slug}-source`, title: `${state} measure fixture`, publisher: "Isolated public publisher", authority: "official-government", type: "official record", sourceSystem: "Isolated fixture", date: "", url: `https://www.eac.gov/#${slug}` };
	const measure = structuredClone(buildSeedCoverageSnapshot().measures[0]!);
	Object.assign(measure, { slug: `${slug}-measure`, title: `${state} measure fixture`, contestSlug: `${slug}-contest`, location: state, electionDate: "2024-11-05", summary: `${state} proposal`, ballotSummary: `${state} proposal`, plainLanguageExplanation: "", currentLawOverview: "", currentPractice: [], proposedChanges: [], fiscalSummary: [], potentialImpacts: [], supportArguments: [], opposeArguments: [], argumentsAndConsiderations: [], implementationTimeline: [], whatWeKnow: [], whatWeDoNotKnow: [], sources: [source] });
	Object.assign(election, { slug: `${slug}-election`, jurisdictionSlug: slug, locationName: state, date: "2026-11-03", name: `${state} general election`, contests: [{ slug: measure.contestSlug, title: measure.title, type: "measure", jurisdiction: "Ballot measure", office: "Statewide measure", description: "", roleGuide: { summary: "", whyItMatters: "", decisionAreas: [] }, measures: [measure] }] });
	Object.assign(jurisdiction, { slug, state, name: state, displayName: state, jurisdictionType: "state", nextElectionSlug: election.slug, nextElectionName: election.name, upcomingElections: [election] });
	return { election, jurisdiction, location: { slug, displayName: state, state, coverageLabel: "Statewide measures", lookupMode: "coverage-selection", requiresOfficialConfirmation: true } };
}

function snapshot(): CoverageSnapshot {
	return { ...buildFultonOfficialLogisticsOnlySnapshot(), additionalGuides: [additionalGuide("north-dakota", "North Dakota"), additionalGuide("idaho", "Idaho")] };
}

async function repository(data: CoverageSnapshot) {
	const directory = mkdtempSync(join(tmpdir(), "ballot-multi-guide-"));
	const priorPath = process.env.LIVE_COVERAGE_FILE;
	const priorRequired = process.env.LIVE_COVERAGE_REQUIRED;
	try {
		process.env.LIVE_COVERAGE_FILE = writeCoverageSnapshot(data, join(directory, "coverage.json"));
		process.env.LIVE_COVERAGE_REQUIRED = "true";
		return await createCoverageRepository();
	}
	finally {
		if (priorPath === undefined) delete process.env.LIVE_COVERAGE_FILE;
		else process.env.LIVE_COVERAGE_FILE = priorPath;
		if (priorRequired === undefined) delete process.env.LIVE_COVERAGE_REQUIRED;
		else process.env.LIVE_COVERAGE_REQUIRED = priorRequired;
		rmSync(directory, { recursive: true, force: true });
	}
}

test("additional guide parsing preserves the primary and rejects ambiguous identities", () => {
	const original = snapshot();
	assert.deepEqual(parseCoverageSnapshot(structuredClone(original)), original);
	assert.deepEqual(parseCoverageSnapshot(buildFultonOfficialLogisticsOnlySnapshot()), buildFultonOfficialLogisticsOnlySnapshot());
	const invalidCases = [
		(data: CoverageSnapshot) => { data.additionalGuides = {} as AdditionalCoverageGuide[]; },
		(data: CoverageSnapshot) => { data.additionalGuides![0]!.election.slug = data.election!.slug; },
		(data: CoverageSnapshot) => { data.additionalGuides![0]!.election.jurisdictionSlug = "idaho"; },
		(data: CoverageSnapshot) => { data.additionalGuides![0]!.location.state = "Georgia"; },
		(data: CoverageSnapshot) => { data.additionalGuides![0]!.location.lookupMode = "address-verified"; },
		(data: CoverageSnapshot) => { data.additionalGuides![0]!.location.lookupInput = "100 Private Address"; },
		(data: CoverageSnapshot) => { data.additionalGuides![0]!.election.date = "2026-02-30"; },
		(data: CoverageSnapshot) => { data.additionalGuides![0]!.election.contests[0]!.measures![0]!.contestSlug = "other"; },
		(data: CoverageSnapshot) => { data.additionalGuides![1]!.election.contests[0]!.slug = data.additionalGuides![0]!.election.contests[0]!.slug; },
		(data: CoverageSnapshot) => { data.additionalGuides![1]!.election.contests[0]!.measures![0]!.slug = data.additionalGuides![0]!.election.contests[0]!.measures![0]!.slug; },
	];
	for (const mutate of invalidCases) {
		const invalid = structuredClone(original);
		mutate(invalid);
		assert.throws(() => parseCoverageSnapshot(invalid));
	}
});

test("repository and draft workflows retain multiple guides without approving them", async () => {
	const data = snapshot();
	const coverage = await repository(data);
	assert.deepEqual(coverage.data.election, data.election);
	assert.deepEqual(coverage.data.jurisdiction, data.jurisdiction);
	for (const guide of data.additionalGuides!) {
		assert.deepEqual(coverage.getElectionBySlug(guide.election.slug), guide.election);
		assert.deepEqual(coverage.getJurisdictionBySlug(guide.jurisdiction.slug), guide.jurisdiction);
		assert.equal(coverage.getMeasureBySlug(guide.election.contests[0]!.measures![0]!.slug)?.location, guide.location.state);
	}
	const workflows = buildDefaultGuidePackageSeed(coverage);
	assert.deepEqual(workflows.map(workflow => workflow.status), ["published", "draft", "draft"]);
	assert.ok(workflows.slice(1).every(workflow => !workflow.reviewer && !workflow.publishedAt));
	coverage.data.election = null;
	coverage.data.jurisdiction = null;
	coverage.data.location = null;
	assert.deepEqual(buildDefaultGuidePackageSeed(coverage).map(workflow => workflow.status), ["draft", "draft"]);
});

test("publication validation inspects nested additional guides, not only the primary", () => {
	const data = snapshot();
	data.additionalGuides![1]!.election.contests[0]!.measures![0]!.sources[0]!.url = "javascript:alert(1)";
	const validation = validateCoverageSnapshotForPublication(data, { status: "reviewed", sourceType: "imported", sourceLabel: "Isolated review", reviewedAt: "2026-10-23T00:00:00Z" });
	assert.equal(validation.ok, false);
	assert.equal(validation.guideContent.length, 3);
	assert.ok(validation.unsafePublicHrefMatches.some(match => match.path.includes("additionalGuides[1]")));
});

for (const publishedStates of [[], ["north-dakota"], ["north-dakota", "idaho"]]) {
	test(`additional public routes require their own publication: ${publishedStates.join(",") || "none"}`, async () => {
		const data = snapshot();
		const before = structuredClone(data);
		const coverage = await repository(data);
		const workflows = buildDefaultGuidePackageSeed(coverage).map(workflow => publishedStates.includes(workflow.jurisdictionSlug) ? { ...workflow, status: "published" as const } : workflow);
		const application = await createApp({ activeLookupCookieSecret: "synthetic-multi-guide-cookie-not-real", adminMfaEncryptionKey: "synthetic-multi-guide-mfa-not-real", adminDbPath: ":memory:", coverageRepository: coverage, contentSeed: [], guidePackageSeed: workflows, addressEnrichmentService: null, congressClient: null, googleCivicClient: null, ldaClient: null, openFecClient: null, openStatesClient: null, stateBallotRepository: null, electionReferenceRepository: null, locationGuessOptions: { mode: "disabled" }, zipLookupLogger: { enabled: false, logPath: ":memory:", async record() {} }, zipLocationService: {
			async lookupZip(postalCode) {
				const isIdaho = postalCode === "83702";
				return { postalCode, matches: [{ id: postalCode, postalCode, countyName: isIdaho ? "Ada" : "Burleigh", locality: isIdaho ? "Boise" : "Bismarck", stateAbbreviation: isIdaho ? "ID" : "ND", stateName: isIdaho ? "Idaho" : "North Dakota", sourceSystem: "Isolated geography fixture", districtMatches: [], representativeMatches: [] }] };
			},
		} });
		const listener = application.listen(0, "127.0.0.1");
		await once(listener, "listening");
		const base = `http://127.0.0.1:${(listener.address() as AddressInfo).port}`;
		try {
			const elections = await (await fetch(`${base}/api/elections`)).json();
			assert.deepEqual(elections.elections.map((entry: { slug: string }) => entry.slug), [data.election!.slug, ...publishedStates.map(state => `${state}-election`)]);
			for (const guide of data.additionalGuides!) {
				const published = publishedStates.includes(guide.jurisdiction.slug);
				const measure = guide.election.contests[0]!.measures![0]!;
				for (const path of [`/api/jurisdictions/${guide.jurisdiction.slug}`, `/api/measures/${measure.slug}`, `/api/contests/${measure.contestSlug}`, `/api/ballot?election=${guide.election.slug}`]) {
					const response = await fetch(`${base}${path}`);
					assert.equal(response.status, published ? 200 : 404, path);
					if (published && path.startsWith("/api/measures")) assert.equal((await response.json()).electionDate, guide.election.date);
					if (published && path.startsWith("/api/ballot")) assert.equal((await response.json()).location.state, guide.location.state);
				}
				if (published) assert.equal((await fetch(`${base}/api/ballot?election=${guide.election.slug}&location=fulton`)).status, 400);
				const search = await (await fetch(`${base}/api/search?q=${encodeURIComponent(measure.title)}`)).json();
				assert.equal(JSON.stringify(search).includes(`/measure/${measure.slug}`), published);
				const lookup = await (await fetch(`${base}/api/location`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: guide.location.state === "Idaho" ? "83702" : "58501" }) })).json();
				assert.equal(lookup.electionSlug, published ? guide.election.slug : undefined);
				if (published) {
					assert.equal(lookup.location.state, guide.location.state);
					assert.equal(lookup.availability.fullLocalGuide.status, "limited");
					assert.equal(lookup.availability.ballotCandidates.status, "unavailable");
				}
			}
			assert.deepEqual(coverage.data, before);
		}
		finally {
			listener.closeAllConnections();
			await new Promise<void>(accept => listener.close(() => accept()));
			await application.closeResources();
		}
	});
}

test("measure guides retain precise civic directories without mixing guide areas", async () => {
	const coverage = await repository(snapshot());
	const workflows = buildDefaultGuidePackageSeed(coverage).map(workflow => ({ ...workflow, status: "published" as const }));
	const cookieSecret = "synthetic-measure-directory-cookie-not-real";
	const matches = (stateName: string): { districtMatches: LocationDistrictMatch[]; representativeMatches: LocationRepresentativeMatch[] } => ({
		districtMatches: [{ id: `${stateName}-district`, districtType: "state-house", districtCode: "1", label: `${stateName} District 1`, sourceSystem: "Isolated geography fixture" }],
		representativeMatches: [{ id: `${stateName}-official`, name: `${stateName} fixture official`, officeTitle: "State Representative", districtLabel: `${stateName} District 1`, sourceSystem: "Isolated official fixture", governmentLevel: "state", officeDisplayLabel: `${stateName} State Representative`, officeType: "state_house" }]
	});
	const application = await createApp({
		activeLookupCookieSecret: cookieSecret,
		adminMfaEncryptionKey: "synthetic-measure-directory-mfa-not-real",
		adminDbPath: ":memory:",
		coverageRepository: coverage,
		contentSeed: [],
		guidePackageSeed: workflows,
		congressClient: null,
		googleCivicClient: null,
		ldaClient: null,
		openFecClient: null,
		openStatesClient: null,
		stateBallotRepository: null,
		electionReferenceRepository: null,
		locationGuessOptions: { mode: "disabled" },
		zipLookupLogger: { enabled: false, logPath: ":memory:", async record() {} },
		addressEnrichmentService: { async lookupAddress() {
			return { benchmark: "Isolated address fixture", fromCache: false, normalizedAddress: "100 Private Fixture Street, ND 58501", state: "ND", vintage: "Isolated fixture", zip5: "58501", ...matches("North Dakota") };
		} },
		zipLocationService: { async lookupZip(postalCode) {
			const isIdaho = postalCode === "83702";
			return { postalCode, matches: [{ id: postalCode, postalCode, countyName: isIdaho ? "Ada" : "Burleigh", locality: isIdaho ? "Boise" : "Bismarck", stateAbbreviation: isIdaho ? "ID" : "ND", stateName: isIdaho ? "Idaho" : "North Dakota", sourceSystem: "Isolated geography fixture", ...matches(isIdaho ? "Idaho" : "North Dakota") }] };
		} }
	});
	const listener = application.listen(0, "127.0.0.1");
	await once(listener, "listening");
	const base = `http://127.0.0.1:${(listener.address() as AddressInfo).port}`;
	try {
		for (const query of ["58501", "100 Private Fixture Street, ND 58501"]) {
			const lookupResponse = await fetch(`${base}/api/location`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: query }) });
			const lookup = await lookupResponse.json();
			assert.equal(lookup.guideContent.verifiedContestPackage, true);
			assert.equal(lookup.electionSlug, "north-dakota-election");
			const setCookie = lookupResponse.headers.get("set-cookie") ?? "";
			const cookie = setCookie.split(";")[0]!;
			assert.match(setCookie, /HttpOnly/);
			assert.match(setCookie, /SameSite=Strict/i);
			assert.ok(cookie.length < 3800);
			assert.ok(!cookie.includes("Private"));
			assert.equal(readActiveNationwideLookupContext(cookie, cookieSecret)?.representativeMatches[0]?.name, "North Dakota fixture official");
			assert.equal(readActiveNationwideLookupContext(cookie, "wrong-key"), null);
			for (const suffix of ["", "?lookup=58501"]) {
				const representatives = await (await fetch(`${base}/api/representatives${suffix}`, { headers: { cookie } })).json();
				assert.equal(representatives.mode, "nationwide");
				assert.deepEqual(representatives.representatives.map((entry: { name: string }) => entry.name), ["North Dakota fixture official"]);
				const districts = await (await fetch(`${base}/api/districts${suffix}`, { headers: { cookie } })).json();
				assert.equal(districts.districts[0].title, "North Dakota District 1");
			}
			const person = await (await fetch(`${base}/api/representatives/north-dakota-fixture-official`, { headers: { cookie } })).json();
			assert.equal(person.person.name, "North Dakota fixture official");
			const district = await (await fetch(`${base}/api/districts/state-house-1`, { headers: { cookie } })).json();
			assert.equal(district.district.title, "North Dakota District 1");
			const other = await (await fetch(`${base}/api/representatives?lookup=83702`, { headers: { cookie } })).json();
			assert.deepEqual(other.representatives.map((entry: { name: string }) => entry.name), ["Idaho fixture official"]);
			for (const path of ["representatives", "districts"]) {
				const explicitArea = await (await fetch(`${base}/api/${path}?area=idaho`, { headers: { cookie } })).json();
				assert.equal(explicitArea.mode, "guide");
				assert.deepEqual(explicitArea.districts, []);
				assert.ok(!JSON.stringify(explicitArea).includes("North Dakota fixture official"));
			}
		}
	}
	finally {
		listener.closeAllConnections();
		await new Promise<void>(accept => listener.close(() => accept()));
		await application.closeResources();
	}
});
