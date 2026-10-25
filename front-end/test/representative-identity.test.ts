import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("representative lists show compact portraits without hiding names or offices", () => {
	for (const path of ["pages/representatives/index.vue", "components/graphics/RepresentativeGrid.vue", "pages/districts/[slug].vue"]) {
		const source = read(path);
		assert.match(source, /<ProfileImageStack/u);
		assert.match(source, /\.profileImages/u);
		assert.match(source, /<RepresentativeWebsite/u);
	}
	assert.match(read("pages/representatives/index.vue"), /size="sm"/u);
	assert.match(read("components/graphics/RepresentativeGrid.vue"), /size="sm"/u);
});

test("one safe website link falls back to an honestly labelled provider record", () => {
	const source = read("components/RepresentativeWebsite.vue");
	assert.match(source, /normalizeExternalHref\(props.websiteUrl\)/u);
	assert.match(source, /website.value \|\| normalizeExternalHref\(props.providerUrl\)/u);
	assert.match(source, /website \? "Website" : "Provider record"/u);
	assert.match(source, /<SafeExternalLink v-if="href"/u);
});
