import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const lookupResultsPanel = readFileSync(new URL("../src/components/LookupResultsPanel.vue", import.meta.url), "utf8");

test("lookup availability cards render as a desktop 3x2 grid", () => {
	assert.match(lookupResultsPanel, /xl:grid-cols-3/);
	assert.match(lookupResultsPanel, /auto-rows-fr/);
	assert.doesNotMatch(lookupResultsPanel, /xl:grid-cols-5/);
});

test("lookup availability cards expose page links for actionable categories", () => {
	assert.match(lookupResultsPanel, /href: buildLookupAwareTarget\("\/results"\)[\s\S]+?id: "civic-results"/);
	assert.match(lookupResultsPanel, /href: props\.lookup\.representativeMatches\.length \? buildLookupAwareTarget\("\/representatives"\) : undefined[\s\S]+?id: "representatives"/);
	assert.match(lookupResultsPanel, /href: buildOfficialLogisticsHref\(\)[\s\S]+?id: "official-logistics"/);
	assert.match(lookupResultsPanel, /href: buildCandidateDataHref\(\)[\s\S]+?id: "ballot-candidates"/);
	assert.match(lookupResultsPanel, /href: props\.lookup\.representativeMatches\.length \? buildLookupAwareTarget\("\/representatives"\) : undefined[\s\S]+?id: "finance-influence"/);
	assert.match(lookupResultsPanel, /href: buildLocalGuideHref\(\)[\s\S]+?id: "local-guide"/);
	assert.match(lookupResultsPanel, /const NuxtLinkComponent = resolveComponent\("NuxtLink"\)/);
	assert.match(lookupResultsPanel, /:is="card\.href \? NuxtLinkComponent : 'article'"/);
	assert.doesNotMatch(lookupResultsPanel, /:is="card\.href \? 'NuxtLink' : 'article'"/);
});
