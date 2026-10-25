import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("About combines editorial standards and neutrality without card stacks or legal navigation", () => {
	const about = source("pages/about.vue");
	assert.match(about, /id="methodology"/);
	assert.match(about, /id="neutrality"/);
	assert.match(about, /supporting records/);
	assert.match(about, /does not endorse, rank, or score/);
	assert.doesNotMatch(about, /surface-panel|content-block|InfoCallout|to="\/(privacy|terms)"/);
});

test("retired information pages redirect permanently to the corresponding consolidated sections", () => {
	for (const [page, destination, anchor] of [["methodology", "about", "methodology"], ["neutrality", "about", "neutrality"], ["data-sources", "sources", "providers"]]) {
		const pageSource = source(`pages/${page}.vue`);
		assert.ok(pageSource.includes(`path: "/${destination}"`));
		assert.ok(pageSource.includes(`hash: "#${anchor}"`));
		assert.match(pageSource, /query: to.query/);
		assert.match(pageSource, /redirectCode: 301/);
	}
});

test("About is a direct link, with secondary destinations preserved in the footer", () => {
	const header = source("components/AppHeader.vue");
	assert.match(header, /<NuxtLink to="\/about"/u);
	assert.doesNotMatch(header, /aboutLinks|toggleAbout|isAboutOpen/u);
	assert.doesNotMatch(header, /to: "\/(privacy|terms|accessibility|methodology|neutrality|data-sources)"/);
	const footer = source("components/AppFooter.vue");
	assert.match(footer, /label: "Privacy", to: "\/privacy"/);
	assert.match(footer, /label: "Terms", to: "\/terms"/);
	for (const destination of ["sources", "coverage", "help", "contact"])
		assert.ok(footer.includes(`"/${destination}"`));
	assert.doesNotMatch(footer, /to: "\/(methodology|neutrality|data-sources)"/);
});

test("source search, provider data and failures remain independent without oversized cards", () => {
	const directory = source("pages/sources/index.vue");
	assert.match(directory, /useSourceDirectory\(\)/);
	assert.match(directory, /<SourceProviders \/>/);
	assert.match(directory, /v-model="searchQuery"/);
	assert.match(directory, /v-else-if="error"/);
	assert.doesNotMatch(directory, /surface-panel|surface-row|Collapsed by default|Open this list when/);
	const providers = source("components/SourceProviders.vue");
	assert.match(providers, /useDataSources\(\)/);
	assert.match(providers, /option.coverage/);
	assert.match(providers, /:href="option.links\[0\].url"/u);
	assert.match(providers, /provider.connectionStatus === "active"/u);
	assert.doesNotMatch(providers, /provider.capabilities|provider.bestUse|Technical docs|<details/u);
	assert.doesNotMatch(providers, /surface-panel|surface-row|roadmap|architectureStages|migrationWatch/);
});

test("contact retains the form and protected email without repeated contact cards", () => {
	const contact = source("pages/contact.vue");
	assert.match(contact, /@submit.prevent="submitForm"/);
	assert.match(contact, /form.pageUrl/);
	assert.match(contact, /form.sourceLinks/);
	assert.equal((contact.match(/<ProtectedEmailLink/g) ?? []).length, 1);
	assert.doesNotMatch(contact, /surface-panel|correctionChecklist|Good-faith standard|Submit online/);
});

test("limited coverage notice is local to resolved results without ballot information", () => {
	const panel = source("components/LookupResultsPanel.vue");
	assert.match(panel, /!electionView.betweenElections && !hasBallotInformation\(displayedLookup\)/);
	assert.match(panel, /\{\{ limitedBallotNotice \}\}/);
	assert.doesNotMatch(source("components/AppHeader.vue"), /limitedBallotNotice|Please check back later/);
	assert.doesNotMatch(source("pages/coverage.vue"), /limitedBallotNotice|Ballot information for your area/);
});
