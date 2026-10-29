import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("site-authored source attribution is neutral, not a warning", () => {
	const badge = source("components/SourceAuthorityBadge.vue");
	assert.match(badge, /case "ballot-clarity-archive":\s*case "ballot-clarity-source-record":\s*return \{\s*label: "Ballot Clarity source",\s*tone: "neutral"/u);
	assert.match(badge, /case "official-government":\s*return \{\s*label: "Official",\s*tone: "neutral"/u);
	assert.match(badge, /case "candidate-campaign":\s*return \{\s*label: "Candidate-supplied",\s*tone: "warning"/u);
	assert.match(source("components/VerificationBadge.vue"), /v-if="props.tone === 'warning'"/u);
});

test("source status is metadata while the original publication remains a distinct action", () => {
	const list = source("components/SourceList.vue");
	assert.match(list, /<SourceAuthorityBadge :authority="source.authority"/u);
	assert.match(list, /:href="source.url" external-icon/u);
	assert.match(list, />\s*View source\s*</u);
	assert.doesNotMatch(list, /Open source/u);
	assert.match(list, /:to="getSourceRecordHref\(source\)!"/u);
});

test("district and representative pages omit empty source sections and navigation", () => {
	const district = source("pages/districts/[slug].vue");
	assert.match(district, /<section v-if="districtPageData.sources.length" id="sources"/u);
	assert.match(district, /\.\.\.\(districtPageData.value.sources.length\s*\? \[\{ href: "#sources"/u);
	const person = source("pages/representatives/[slug]/index.vue");
	assert.match(person, /<section v-if="person.sources.length" id="sources"/u);
	assert.match(person, /\.\.\.\(person.value.sources.length \? \[\{ href: "#sources"/u);
	assert.match(person, /<SourceDrawer v-if="person.sources.length" :sources="person.sources"/u);
	assert.match(person, /<section v-if="hasBackground" id="biography"/u);
	assert.match(person, /\.\.\.\(hasBackground.value \? \[\{ href: "#biography"/u);
});
