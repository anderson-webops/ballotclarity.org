import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("location office email wraps without truncating the contact or changing its destination", () => {
	const location = readFileSync(new URL("../src/pages/locations/[slug].vue", import.meta.url), "utf8");
	const emailLink = location.match(/<a :href="`mailto:\$\{jurisdiction\.officialOffice\.email\}`"[^>]*>/u)?.[0];
	assert.ok(emailLink);
	assert.match(emailLink, /\bbreak-all\b/u);
	assert.match(location, /\{\{ jurisdiction\.officialOffice\.email \}\}/u);
});

test("unfinished questions use their actual titles and context-preserving detail links", () => {
	const plan = readFileSync(new URL("../src/pages/plan.vue", import.meta.url), "utf8");
	const pending = plan.slice(plan.indexOf("v-if=\"unplannedContests.length\""));
	assert.match(pending, /<NuxtLink v-for="contest in unplannedContests"/u);
	assert.match(pending, /:to="unplannedContestPath\(contest\)"/u);
	assert.match(pending, /\{\{ contest\.title \}\}/u);
	assert.doesNotMatch(pending, /contest\.(?:office|jurisdiction|roleGuide)/u);
	assert.match(plan, /measureDetailPath\(measure, data\.value\?\.election\.slug\)/u);
});

test("printed ballot and saved-plan columns retain a readable minimum width", () => {
	const styles = readFileSync(new URL("../src/assets/styles/main.css", import.meta.url), "utf8");
	assert.match(styles, /\.print-guide-grid,\s*\.print-plan-grid\s*\{[^}]*columns:\s*18rem 2;/u);
});

test("saved-plan progress counts valid entries in the current ballot, not all stored choices", () => {
	const plan = readFileSync(new URL("../src/pages/plan.vue", import.meta.url), "utf8");
	assert.match(plan, /const savedCount = plannedEntries\.value\.length/u);
	assert.match(plan, /const contest = contestsBySlug\.get\(selection\.contestSlug\)/u);
	assert.doesNotMatch(plan, /effectiveBallotPlanCount|\bballotPlanCount\b/u);
});

test("unresolved saved records do not hide a contest from the current review list", () => {
	const plan = readFileSync(new URL("../src/pages/plan.vue", import.meta.url), "utf8");
	assert.match(plan, /new Set\(plannedEntries\.value\.map\(entry => entry\.contest\.slug\)\)/u);
	assert.match(plan, /contests\.filter\(contest => !savedContestSlugs\.has\(contest\.slug\)\)/u);
});

test("statewide guides retain a visible local-coverage limitation", () => {
	const hero = readFileSync(new URL("../src/components/ElectionHero.vue", import.meta.url), "utf8");
	const ballot = readFileSync(new URL("../src/pages/ballot/[slug].vue", import.meta.url), "utf8");
	const election = readFileSync(new URL("../src/pages/elections/[slug].vue", import.meta.url), "utf8");
	assert.match(hero, /props\.scope === "statewide"/);
	assert.match(hero, /areaGuideLabels\.value\.status/);
	assert.match(hero, /areaGuideLabels\.value\.limitation/);
	assert.match(hero, /fullAreaGuideLabels\(props\.location\.state\)/);
	assert.match(ballot, /:scope="data\.scope"/);
	assert.match(election, /data\.value\?\.scope === "statewide"/);
	assert.match(election, /fullAreaGuideLabels\(data\.value\?\.location\.state\)\.limitation/);
	const plan = readFileSync(new URL("../src/pages/plan.vue", import.meta.url), "utf8");
	assert.match(plan, /fullAreaGuideLabels\(data\?\.location\.state\)\.limitation/);
});

test("partial local guides retain their limitation on ballot, overview and printed plan", () => {
	const hero = readFileSync(new URL("../src/components/ElectionHero.vue", import.meta.url), "utf8");
	const ballot = readFileSync(new URL("../src/pages/ballot/[slug].vue", import.meta.url), "utf8");
	const overview = readFileSync(new URL("../src/pages/elections/[slug].vue", import.meta.url), "utf8");
	const plan = readFileSync(new URL("../src/pages/plan.vue", import.meta.url), "utf8");
	assert.match(hero, /Partial ballot information/u);
	assert.match(hero, /props\.coverageLimits\?\.length/u);
	assert.match(ballot, /:coverage-limits="data\.coverageLimits"/u);
	assert.match(overview, /data\.value\?\.coverageLimits\?\.\[0\]/u);
	assert.ok(overview.indexOf("? limitedBallotNotice") < overview.indexOf("data.value?.coverageLimits?.[0]"));
	assert.match(plan, /v-else-if="data\?\.coverageLimits\?\.length"/u);
	assert.match(plan, /\{\{ data\.coverageLimits\[0\] \}\}/u);
});

test("direct guide entry restores saved choices before persisting its context", () => {
	const store = readFileSync(new URL("../src/stores/civic.ts", import.meta.url), "utf8");
	const action = store.slice(store.indexOf("setGuideSurfaceContext("));
	assert.match(action, /if \(import\.meta\.client && !this\.isHydrated\)\s*this\.hydrateFromStorage\(\);/u);
	assert.ok(action.indexOf("this.hydrateFromStorage();") < action.indexOf("this.selectedElection = election;"));
});

test("short measure guides use direct summaries rather than redundant disclosure controls", () => {
	const section = readFileSync(new URL("../src/components/ContestSection.vue", import.meta.url), "utf8");
	const card = readFileSync(new URL("../src/components/MeasureCard.vue", import.meta.url), "utf8");
	const ballot = readFileSync(new URL("../src/pages/ballot/[slug].vue", import.meta.url), "utf8");
	assert.match(section, /<div v-if="contest\.type === 'measure'"[^>]*>\s*<MeasureCard/);
	assert.match(section, /<ExpandableSection\s+v-else/);
	assert.match(card, /measureCardSummary\(measure\)/u);
	assert.doesNotMatch(card, /measure\.plainLanguageExplanation \|\| measure\.summary/u);
	assert.match(ballot, /v-if="needsGuideNavigation" id="guide-controls"/);
	assert.match(ballot, /ballotContentsGroups\.length && needsGuideNavigation/);
});

test("contest navigation comes from its own election, not a previously selected guide", () => {
	const contest = readFileSync(new URL("../src/pages/contest/[slug].vue", import.meta.url), "utf8");
	assert.match(contest, /to: `\/ballot\/\$\{data\.value\.election\.slug\}`/);
	assert.match(contest, /to: `\/elections\/\$\{data\.value\.election\.slug\}`/);
	assert.match(contest, /<h1[^>]*>\s*\{\{ displayTitle \}\}/);
});

test("unknown election-office contacts do not render empty labels or mail links", () => {
	const location = readFileSync(new URL("../src/pages/locations/[slug].vue", import.meta.url), "utf8");
	assert.match(location, /v-if="hasOfficeContact"/);
	for (const field of ["address", "phone", "email", "hours"])
		assert.ok(location.includes(`v-if="jurisdiction.officialOffice.${field}.trim()"`));
});

test("long guide locations can shrink without squeezing header controls", () => {
	const header = readFileSync(new URL("../src/components/AppHeader.vue", import.meta.url), "utf8");
	const tools = header.match(/<div class="([^"]+)">\s*<ClientOnly>/u)?.[1].split(/\s+/u) ?? [];
	assert.ok(tools.includes("min-w-0"));
	assert.ok(!tools.includes("shrink-0"));
	const location = header.slice(header.indexOf("v-if=\"effectiveSelectedLocation\""), header.indexOf(":title="));
	assert.match(location, /\bmin-w-0\b/u);
	assert.match(header, /class="truncate">\{\{ effectiveSelectedLocation\.displayName \}\}/u);
	assert.match(header, /class="shrink-0 h-10 w-10"/u);
});
