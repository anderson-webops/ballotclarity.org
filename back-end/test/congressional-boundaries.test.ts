import type { StateBallotRepository, StateBallotSnapshot } from "../src/state-ballot-repository.js";
import type { LocationDistrictMatch, LocationLookupResponse } from "../src/types/civic.js";
import assert from "node:assert/strict";
import test from "node:test";
import { buildActiveNationwideLookupCookie, buildActiveNationwideLookupResponse, readActiveNationwideLookupContext } from "../src/active-nationwide-lookup.js";
import { currentCongress, currentCongressionalBoundarySession, electionDistrictMatches, generalElectionCongress, matchesCurrentCongress } from "../src/congressional-boundaries.js";
import { attachStateBallotPreview } from "../src/state-ballot-repository.js";

function district(session?: number, code = "10"): LocationDistrictMatch {
	return { id: `congressional:${code}`, label: `Congressional District ${code}`, districtCode: code, districtType: "congressional", sourceSystem: "U.S. Census Geocoder", congressionalSession: session, boundaryVintage: session === 119 ? "ACS2025_Current" : "Current_Current", stateFips: "48" };
}

test("congressional sessions change at the constitutional start, not on election day or January 1", () => {
	assert.equal(currentCongress(Date.parse("2026-11-03T23:00:00Z")), 119);
	assert.equal(currentCongress(Date.parse("2027-01-03T16:59:59Z")), 119);
	assert.equal(currentCongress(Date.parse("2027-01-03T17:00:00Z")), 120);
	assert.equal(currentCongress(Date.parse("2029-01-03T17:00:00Z")), 121);
});

test("regular federal general-election sessions advance automatically while other dates need review", () => {
	assert.equal(generalElectionCongress("2024-11-05"), 119);
	assert.equal(generalElectionCongress("2026-11-03"), 120);
	assert.equal(generalElectionCongress("2028-11-07"), 121);
	assert.equal(generalElectionCongress("2030-11-05"), 122);
	for (const date of ["2026-11-04", "2027-11-02", "2026-02-03", "2026-11-03T00:00:00Z", "invalid"])
		assert.equal(generalElectionCongress(date), null);
});

test("ballot matching keeps current state districts but uses only the election's congressional session", () => {
	const state: LocationDistrictMatch = { id: "state-house:49", label: "State House District 49", districtCode: "49", districtType: "state-house", sourceSystem: "U.S. Census Geocoder" };
	for (const code of ["AL", "CA", "FL", "LA", "NC", "OH", "TN", "TX", "UT", "GA"]) {
		assert.deepEqual(electionDistrictMatches(code, "2026-11-03", [state, district(119, "37")], [district(120)]), [state, district(120)]);
		assert.deepEqual(electionDistrictMatches(code, "2026-11-03", [state, district(119, "37")]), [state]);
		assert.deepEqual(electionDistrictMatches(code, "2026-11-03", [district()]), []);
	}
	assert.deepEqual(electionDistrictMatches("TX", "2028-11-07", [district(120)], [district(121, "20")]), [district(121, "20")]);
	assert.deepEqual(electionDistrictMatches("TX", "2026-11-04", [state, district(120)], [district(120)]), [state]);
});

test("Missouri uses the unchanged 119th plan while uncorrected 120th products stay excluded", () => {
	const missouri = { ...district(119, "3"), stateFips: "29" };
	assert.equal(currentCongressionalBoundarySession(120, "29"), 119);
	assert.equal(matchesCurrentCongress(missouri, 120, 120), true);
	assert.equal(matchesCurrentCongress(missouri, 120, 119), false);
	assert.equal(matchesCurrentCongress(missouri, 120), false);
	assert.equal(matchesCurrentCongress({ ...missouri, congressionalSession: 120 }, 120, 120), false);
	assert.equal(currentCongressionalBoundarySession(121, "29"), 121);
	assert.deepEqual(electionDistrictMatches("MO", "2026-11-03", [district(119, "3")], [district(120, "4")]), [district(119, "3")]);
	assert.deepEqual(electionDistrictMatches("MO", "2026-11-03", [district(120, "4")], [district(120, "4")]), []);
	assert.deepEqual(electionDistrictMatches("MO", "2028-11-07", [district(120)], [district(121)]), [district(121)]);
});

test("public ballot attachment uses election districts while leaving current representatives and source holds intact", async () => {
	const snapshot: StateBallotSnapshot = { source: { id: "synthetic-nc-general", stateCode: "NC", electionDate: "2026-11-03", label: "Synthetic official source", format: "csv", url: "https://example.gov/candidates.csv", pageUrl: "https://example.gov/election" }, retrievedAt: "2026-10-25T00:00:00Z", sha256: "a".repeat(64), records: [
		{ id: "statewide", name: "Statewide Example", office: "United States Senate", district: "", scope: "statewide", status: "qualified" },
		{ id: "current", name: "Current District Example", office: "United States House", district: "37", scope: "congressional", status: "qualified" },
		{ id: "election", name: "Election District Example", office: "United States House", district: "10", scope: "congressional", status: "qualified" },
	] };
	const repository = {
		async getSnapshot() {
			return snapshot;
		},
	} as unknown as StateBallotRepository;
	for (const [inputKind, detectedFromIp, expected] of [["address", false, 2], ["zip", false, 1], ["address", true, 1]] as const) {
		const lookup = { result: "resolved", inputKind, detectedFromIp, location: { state: "NC" }, districtMatches: [district(119, "37")], electionDistrictMatches: [district(120)] } as LocationLookupResponse;
		await attachStateBallotPreview(lookup, repository);
		assert.equal(lookup.ballotContentPreviews?.[0].candidateCount, expected);
		assert.equal(lookup.districtMatches?.[0].districtCode, "37");
		assert.equal(JSON.stringify(lookup.ballotContentPreviews).includes("Current District Example"), false);
	}
	snapshot.source.withheldDistrictScopes = ["congressional"];
	const held = { result: "resolved", inputKind: "address", location: { state: "NC" }, districtMatches: [district(119, "37")], electionDistrictMatches: [district(120)] } as LocationLookupResponse;
	await attachStateBallotPreview(held, repository);
	assert.equal(held.ballotContentPreviews?.[0].candidateCount, 1);
});

test("sealed active lookup preserves separate congressional sessions and rejects legacy or future current districts", () => {
	const congress = currentCongress();
	const lookup: LocationLookupResponse = { result: "resolved", inputKind: "address", note: "", guideAvailability: "not-published", location: { coverageLabel: "", displayName: "Austin, Texas", slug: "austin-texas", state: "TX" }, districtMatches: [district(congress, "37")], electionDistrictMatches: [district(congress + 1)], representativeMatches: [] };
	const secret = "disposable-boundary-test-cookie-key";
	const cookie = buildActiveNationwideLookupCookie(lookup, secret);
	assert.ok(cookie);
	const context = readActiveNationwideLookupContext(`ballot-clarity-nationwide-lookup=${encodeURIComponent(cookie)}`, secret);
	assert.ok(context);
	const restored = buildActiveNationwideLookupResponse(context);
	assert.equal(restored.districtMatches?.[0].congressionalSession, congress);
	assert.equal(restored.electionDistrictMatches?.[0].congressionalSession, congress + 1);
	assert.equal(restored.electionDistrictMatches?.[0].boundaryVintage, "Current_Current");
	assert.equal(restored.electionDistrictMatches?.[0].stateFips, "48");
	for (const invalid of [undefined, congress + 1, congress - 1]) {
		const oldCookie = buildActiveNationwideLookupCookie({ ...lookup, districtMatches: [district(invalid)] }, secret);
		assert.ok(oldCookie);
		assert.equal(readActiveNationwideLookupContext(`ballot-clarity-nationwide-lookup=${encodeURIComponent(oldCookie)}`, secret), null);
	}
});
