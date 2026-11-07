import type { CountyAreaScope, JurisdictionSummary } from "../src/types/civic.js";
import assert from "node:assert/strict";
import test from "node:test";
import { countyAreaIdentity, countyAreaLabel, isCountyAreaScope } from "../src/county-area-scope.js";
import { buildEmptyCoverageSnapshot, parseCoverageSnapshot } from "../src/coverage-repository.js";
import { validateCoverageSnapshotForPublication } from "../src/coverage-snapshot-validation.js";
import { findSupportedCoverageSummaries } from "../src/location-lookup.js";

const scope: CountyAreaScope = { kind: "county-excluding-municipalities", stateCode: "GA", countyName: "Fulton County", excludedMunicipalities: ["Atlanta"], matching: "reference-only" };
const summary: JurisdictionSummary = { slug: "fulton-partial-fixture", name: countyAreaLabel(scope), displayName: `${countyAreaLabel(scope)}, Georgia`, state: "Georgia", jurisdictionType: "county-area", countyAreaScope: scope, description: "", nextElectionName: "Scoped fixture", nextElectionSlug: "scoped-fixture", updatedAt: "2026-11-01T00:00:00Z" };

test("partial-county scope has a complete area label and order-independent identity", () => {
	assert.equal(countyAreaLabel(scope), "Fulton County outside Atlanta");
	assert.equal(isCountyAreaScope(scope, "Georgia"), true);
	assert.equal(isCountyAreaScope(scope, "GA"), true);
	assert.equal(isCountyAreaScope(scope, "ND"), false);
	const first = { ...scope, excludedMunicipalities: ["Atlanta", "Example"] };
	const second = { ...scope, excludedMunicipalities: ["EXAMPLE", "Atlanta"] };
	assert.equal(countyAreaIdentity(first), countyAreaIdentity(second));
	assert.notEqual(countyAreaIdentity(scope), countyAreaIdentity(first));
});

test("partial-county scope rejects missing, ambiguous, oversized and automatic-match contracts", () => {
	for (const changed of [
		{ matching: "address" },
		{ matching: undefined },
		{ kind: "county" },
		{ stateCode: "XX" },
		{ stateCode: "ND" },
		{ countyName: " " },
		{ countyName: "Fulton\nCounty" },
		{ countyName: "!" },
		{ countyName: "F".repeat(121) },
		{ excludedMunicipalities: [] },
		{ excludedMunicipalities: ["Atlanta", "ATLANTA"] },
		{ excludedMunicipalities: [" Atlanta"] },
		{ excludedMunicipalities: ["!"] },
		{ excludedMunicipalities: [null] },
		{ excludedMunicipalities: Array.from({ length: 11 }, (_, index) => `Area ${index}`) },
		{ countyFips: "13121" },
	]) assert.equal(isCountyAreaScope({ ...scope, ...changed }, "Georgia"), false, JSON.stringify(changed));
});

test("coverage refuses loss or broadening of a partial-county scope on every jurisdiction surface", () => {
	for (const placement of ["primary", "summary"] as const) {
		for (const change of [{ countyAreaScope: undefined }, { countyAreaScope: { ...scope, matching: "address" } }, { jurisdictionType: "county" }, { name: "Fulton County" }, { state: "North Dakota" }]) {
			const snapshot = buildEmptyCoverageSnapshot(summary.updatedAt);
			const changed = { ...summary, ...change };
			if (placement === "primary") Object.assign(snapshot, { jurisdiction: changed });
			else Object.assign(snapshot, { jurisdictionSummaries: [changed] });
			assert.throws(() => parseCoverageSnapshot(snapshot), /County-area|partial-county/u, `${placement}: ${JSON.stringify(change)}`);
			const validation = validateCoverageSnapshotForPublication(snapshot, { status: "unknown", sourceType: "imported", sourceLabel: "Isolated scope fixture" });
			assert.equal(validation.ok, false);
			assert.ok(validation.errors.some(message => /County-area|partial-county/u.test(message)));
		}
	}
});

test("reference-only county areas never become inferred ZIP, postal-city or address coverage", () => {
	for (const locality of ["Atlanta", "Alpharetta", "College Park", "Palmetto", undefined]) {
		const context = { stateAbbreviation: "GA", countyName: "Fulton County", countyFips: "13121", locality, postalCode: "30022", normalizedAddress: "Fixture address" };
		assert.deepEqual(findSupportedCoverageSummaries([summary], context), []);
		assert.deepEqual(findSupportedCoverageSummaries([{ ...summary, jurisdictionType: "county", name: "Fulton County" }], context), []);
		assert.deepEqual(findSupportedCoverageSummaries([{ ...summary, jurisdictionType: "state" }], context), []);
		const fullCounty = { ...summary, name: "Fulton County", displayName: "Fulton County, Georgia", jurisdictionType: "county", countyAreaScope: undefined };
		assert.deepEqual(findSupportedCoverageSummaries([fullCounty, summary], context), [fullCounty]);
	}
});
