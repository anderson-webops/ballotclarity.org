import type { Election, Jurisdiction } from "../src/types/civic.js";
import assert from "node:assert/strict";
import test from "node:test";
import { hasStatewideMeasureRollup, includeStatewideMeasures } from "../src/ballot-guide-scope.js";
import { buildSeedCoverageSnapshot } from "../src/coverage-repository.js";

function fixture() {
	const seed = buildSeedCoverageSnapshot();
	const makeJurisdiction = (slug: string, state: string, kind: string): Jurisdiction => ({ ...structuredClone(seed.jurisdiction!), slug, state, jurisdictionType: kind });
	const makeElection = (slug: string, jurisdictionSlug: string): Election => {
		const measure = { ...structuredClone(seed.measures[0]!), slug: `${slug}-measure`, contestSlug: `${slug}-contest`, location: jurisdictionSlug };
		return { ...structuredClone(seed.election!), slug, jurisdictionSlug, date: "2026-11-03", contests: [{ ...structuredClone(seed.election!.contests.find(contest => contest.type === "measure")!), slug: measure.contestSlug, measures: [measure] }] };
	};
	const county = makeElection("county-election", "county");
	const state = makeElection("state-election", "state");
	const jurisdictions = [makeJurisdiction("county", "New Mexico", "County"), makeJurisdiction("state", "NM", "state")];
	return { county, state, jurisdictions };
}

test("published same-state same-date measures are a response-only addition to a nonempty local guide", () => {
	const { county, state, jurisdictions } = fixture();
	const original = structuredClone({ county, state, jurisdictions });
	const combined = includeStatewideMeasures(county, jurisdictions, [county, state]);
	assert.deepEqual(combined.includedStatewideElectionSlugs, [state.slug]);
	assert.deepEqual(combined.contests.map(contest => contest.slug), [state.contests[0]!.slug, county.contests[0]!.slug]);
	assert.equal(combined.contests[0]!.measures![0]!.electionSlug, state.slug);
	assert.equal(combined.contests[0]!.measures![0]!.electionDate, state.date);
	assert.equal(combined.contests[0]!.measures![0]!.location, "state");
	assert.equal(hasStatewideMeasureRollup(combined), true);
	assert.deepEqual({ county, state, jurisdictions }, original);
});

test("explicit local and district guides retain common statewide measures", () => {
	for (const kind of ["township", "village", "school-district", "intermediate-school-district", "special-district"]) {
		const { county, state, jurisdictions } = fixture();
		jurisdictions[0]!.jurisdictionType = kind;
		const combined = includeStatewideMeasures(county, jurisdictions, [county, state]);
		assert.deepEqual(combined.contests.map(contest => contest.slug), [state.contests[0]!.slug, county.contests[0]!.slug], kind);
	}
});

test("different states, dates, local siblings and absent publication cannot add content", () => {
	for (const change of ["state", "date", "kind", "publication", "unknown-state", "unknown-local-kind", "invalid-date"]) {
		const { county, state, jurisdictions } = fixture();
		if (change === "state") jurisdictions[1]!.state = "Arizona";
		if (change === "date") state.date = "2026-11-04";
		if (change === "kind") jurisdictions[1]!.jurisdictionType = "county";
		if (change === "unknown-state") jurisdictions[0]!.state = "Unknown";
		if (change === "unknown-local-kind") jurisdictions[0]!.jurisdictionType = "school district";
		if (change === "invalid-date") county.date = state.date = "2026-02-30";
		const combined = includeStatewideMeasures(county, jurisdictions, change === "publication" ? [county] : [county, state]);
		assert.equal(hasStatewideMeasureRollup(combined), false, change);
		assert.deepEqual(combined, county, change);
	}
});

test("statewide routes, empty local shells and statewide candidate races are not re-scoped", () => {
	const { county, state, jurisdictions } = fixture();
	assert.deepEqual(includeStatewideMeasures(state, jurisdictions, [county, state]), state);
	county.contests = [];
	assert.deepEqual(includeStatewideMeasures(county, jurisdictions, [county, state]), county);
	county.contests = structuredClone(state.contests);
	county.contests[0]!.slug = "local-only";
	state.contests[0]!.type = "candidate";
	assert.deepEqual(includeStatewideMeasures(county, jurisdictions, [county, state]), county);
	state.contests.push({ ...structuredClone(county.contests[0]!), slug: "another-state-question" });
	assert.deepEqual(includeStatewideMeasures(county, jurisdictions, [county, state]), county);
});

test("conflicting identities fail closed instead of silently replacing a question", () => {
	const { county, state, jurisdictions } = fixture();
	state.contests[0]!.measures![0]!.slug = county.contests[0]!.measures![0]!.slug;
	assert.throws(() => includeStatewideMeasures(county, jurisdictions, [county, state]), /conflicting/u);
});

test("stored response metadata never grants inheritance", () => {
	const { county, jurisdictions } = fixture();
	Object.assign(county, { includedStatewideElectionSlugs: ["unpublished-state"] });
	const combined = includeStatewideMeasures(county, jurisdictions, [county]);
	assert.equal(hasStatewideMeasureRollup(combined), false);
	assert.equal("includedStatewideElectionSlugs" in combined, false);
});

test("independent-city guides inherit only published same-state same-date measures", () => {
	const { county: city, state, jurisdictions } = fixture();
	jurisdictions[0]!.jurisdictionType = "independent-city";
	const original = structuredClone(city);
	assert.equal(includeStatewideMeasures(city, jurisdictions, [city, state]).contests.length, 2);
	assert.deepEqual(includeStatewideMeasures(city, jurisdictions, [city]), city);
	state.date = "2026-11-04";
	assert.deepEqual(includeStatewideMeasures(city, jurisdictions, [city, state]), city);
	assert.deepEqual(city, original);
});
