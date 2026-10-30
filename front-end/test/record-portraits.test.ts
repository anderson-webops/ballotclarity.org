import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (name: string) => readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");

test("candidate summaries and source records render available portraits without extra client requests", () => {
	for (const name of ["components/ElectionCandidateRecords.vue", "components/CandidateCard.vue", "components/ElectionReferences.vue", "components/CandidateDirectory.vue", "pages/record/[state]/[id].vue"]) {
		const page = source(name);
		assert.match(page, /<ProfileImageStack/u, name);
		assert.match(page, /profileImages/u, name);
		assert.doesNotMatch(page, /api\([^\n]*(?:portrait|image)/iu, name);
	}
});

test("the directory remains in the footer instead of profile and search headers", () => {
	const detail = source("pages/record/[state]/[id].vue");
	assert.doesNotMatch(detail, /Candidate records|backTo/u);
	assert.doesNotMatch(detail, /image\.attribution|image\.sourceLabel|:href="image\.url"/u);
	assert.doesNotMatch(source("pages/search.vue"), /Candidate records list|to="\/records"/u);
	assert.match(source("components/AppFooter.vue"), /label: "Directory", to: "\/search\?type=candidate"/u);
});

test("record portraits are prominent without changing list thumbnails or duplicating source navigation", () => {
	const detail = source("pages/record/[state]/[id].vue");
	assert.match(detail, /size="portrait"/u);
	assert.match(detail, /flex-col[^"]*sm:flex-row/u);
	assert.match(detail, />\s*Citations\s*</u);
	const portrait = source("components/ProfileImageStack.vue");
	assert.match(portrait, /props.size === "portrait"/u);
	assert.match(portrait, /h-60 w-48/u);
	assert.match(portrait, /sm:h-70 sm:w-56/u);
	assert.match(portrait, /h-12 w-12 text-sm/u);
	assert.match(source("components/AppFooter.vue"), /label: "Sources", to: "\/sources"/u);
});

test("photo expansion keeps its source inside a dismissible overlay without links", () => {
	const viewer = source("components/PhotoViewer.vue");
	assert.match(viewer, /<dialog/u);
	assert.match(viewer, /showModal\(\)/u);
	assert.match(viewer, /aria-label="Close photo"/u);
	assert.match(viewer, /@cancel\.prevent/u);
	assert.match(viewer, /@click\.self/u);
	assert.match(viewer, /@keydown\.tab\.prevent="closeButton\?\.focus\(\)"/u);
	assert.match(viewer, /useScrollLock/u);
	assert.match(viewer, /<figcaption v-if="source"/u);
	assert.doesNotMatch(viewer, /<a\b|<NuxtLink|<SafeExternalLink|target=|window\.open/u);
	const thumbnail = source("components/ProfileImageStack.vue");
	assert.match(thumbnail, /activeImage \? 'button' : 'div'/u);
	assert.match(thumbnail, /View photo of/u);
	assert.match(thumbnail, /<PhotoViewer v-if="viewerOpen && activeImage"/u);
	assert.doesNotMatch(thumbnail, /showCaption|<figcaption/u);
});

test("photo buttons are siblings of navigation links, not nested interactive controls", () => {
	for (const name of ["components/CandidateCard.vue", "components/ElectionCandidateRecords.vue", "components/ElectionReferences.vue", "components/CandidateDirectory.vue", "pages/representatives/index.vue"]) {
		const page = source(name);
		assert.doesNotMatch(page, /<NuxtLink\b[^>]*>(?:(?!<\/NuxtLink>)[\s\S])*?<ProfileImageStack/u, name);
		assert.doesNotMatch(page, /<component\b[^>]*>(?:(?!<\/component>)[\s\S])*?<ProfileImageStack/u, name);
	}
});
