import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../src/", import.meta.url));
const source = (path: string) => readFileSync(join(root, path), "utf8");
function vueFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? vueFiles(join(directory, entry.name)) : entry.name.endsWith(".vue") ? [join(directory, entry.name)] : []);
}

test("shared content sections cannot become disclosure controls", () => {
	const section = source("components/ExpandableSection.vue");
	assert.match(section, /<section\s/u);
	assert.match(section, /<header class="expandable-section__summary">/u);
	assert.doesNotMatch(section, /collapsible|open\??:|<component\b|<details\b|<summary\b/u);
});

test("ordinary content does not use disclosure controls", () => {
	const operationalPopovers = new Set(["components/AppHeader.vue", "components/ThemeSchemePicker.vue"]);
	for (const file of vueFiles(root)) {
		const path = relative(root, file);
		if (/faq/iu.test(path)) continue;
		const content = readFileSync(file, "utf8");
		assert.doesNotMatch(content, /<(?:details|summary)\b|\bcollapsible[\s=?]/u, path);
		if (!operationalPopovers.has(path))
			assert.doesNotMatch(content, /\baria-expanded\s*=/u, path);
	}
});

test("reusable interface guidance does not recommend content dropdowns", () => {
	const guidance = readFileSync(new URL("../../docs/interface-simplicity.md", import.meta.url), "utf8");
	assert.match(guidance, /Do not use collapsible dropdowns or accordions as the default/u);
	assert.match(guidance, /rare, justified exceptions, such as independent FAQ answers/u);
	assert.doesNotMatch(guidance, /Use a disclosure only when it meaningfully reduces substantial optional content/u);
});

test("lookup results omit matching commentary without hiding voting information", () => {
	const panel = source("components/LookupResultsPanel.vue");
	assert.doesNotMatch(panel, /How this result was matched|SourceProvenanceStrip/u);
	assert.match(panel, /<section v-if="hasElectionLogistics && electionLogistics"/u);
	for (const field of ["pollingLocations", "earlyVoteSites", "dropOffLocations", "officialSourceNote"])
		assert.ok(panel.includes(`electionLogistics.${field}`));
});

test("candidate record details move collection documents to the source page", () => {
	const page = source("pages/record/[state]/[id].vue");
	assert.match(page, /:to="sourcesTarget"/u);
	assert.doesNotMatch(page, /v-for="document in documentLinks"/u);
	assert.doesNotMatch(page, /v-for="document in data\.source\.documentLinks"/u);
});

test("source directory rows link to details instead of hiding groups", () => {
	const directory = source("pages/sources/index.vue");
	assert.match(directory, /<section v-for="section in sections"/u);
	assert.match(directory, /:to="`\/sources\/\$\{source.id\}`"/u);
	assert.doesNotMatch(directory, /\{\{ source\.(?:citationCount|geographicScope|summary)\b/u);
});

test("long record document lists have a reachable source page", () => {
	const page = source("pages/records.vue");
	const documents = source("pages/record-sources.vue");
	assert.match(page, /path: '\/record-sources'/u);
	assert.match(documents, /stateRecordSourceMismatch/u);
	assert.match(documents, /v-for="document in group.documents"/u);
	assert.match(documents, /:href="document.url"/u);
	assert.doesNotMatch(documents, /Candidate records list|recordsTarget|path: "\/records"/u);
	assert.match(documents, /data.source.retrievedAt/u);
	assert.match(documents, /recordSourceNotice/u);
	assert.match(documents, /recordSourceTitle/u);
});

test("comparisons link to profiles instead of repeating their secondary material", () => {
	const page = source("pages/compare.vue");
	assert.doesNotMatch(page, /Candidate links and statements|candidate\.publicStatements|<SourceList/u);
	assert.match(source("components/CompareTable.vue"), /:to="`\/candidate\/\$\{candidate.slug\}`"/u);
});

test("representative profiles show records directly without a duplicate availability summary", () => {
	const page = source("pages/representatives/[slug]/index.vue");
	assert.doesNotMatch(page, /Records available|moduleStatusItems|availableModuleStatusItems|person\.enrichmentStatus/u);
	for (const section of ["office-context", "biography", "actions", "funding", "influence", "sources"])
		assert.ok(page.includes(`id="${section}"`));
	assert.match(page, /<SourceList :sources="person\.sources"/u);
	assert.match(page, /person\.value\.funding\.committeeName/u);
	assert.match(page, /person\.value\.funding\.coverageLabel/u);
	assert.match(page, /influence\.value\.matchMode/u);
});

test("representative correction links sit after the profile rather than inside Sources", () => {
	const page = source("pages/representatives/[slug]/index.vue");
	const sources = page.slice(page.indexOf("id=\"sources\""), page.indexOf("data-representative-sidebar=\"record-details\""));
	assert.doesNotMatch(sources, /reportIssueTo|Report an issue/u);
	assert.equal(page.match(/Report an issue/gu)?.length, 1);
	assert.ok(page.indexOf("data-profile-actions=\"footer\"") > page.indexOf("<PageSectionNav"));
	assert.match(page, /data-profile-actions="footer">\s*<NuxtLink :to="reportIssueTo"/u);
	assert.match(page, /pageUrl: `\/representatives\/\$\{person\.value\?\.slug \?\? representativeSlug\.value\}`/u);
	assert.match(page, /type: "correction"/u);
});

test("representative content omits cached matching summaries while retaining Sources", () => {
	const profile = source("pages/representatives/[slug]/index.vue");
	const district = source("pages/districts/[slug].vue");
	assert.match(profile, /resolveRepresentativeContentSummary\(person\.value\?\.summary\)/u);
	assert.match(profile, /<p v-if="profileSummary"/u);
	assert.doesNotMatch(profile, /\{\{ person\.summary \}\}/u);
	assert.match(profile, /<SourceList :sources="person\.sources"/u);
	assert.match(district, /v-if="resolveRepresentativeContentSummary\(representative\.summary\)"/u);
	assert.doesNotMatch(district, /\{\{ representative\.summary \}\}/u);
});
