import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dataSourcesPage = readFileSync(new URL("../src/pages/data-sources.vue", import.meta.url), "utf8");

test("public data-sources page avoids operator-only provider setup details", () => {
	assert.doesNotMatch(dataSourcesPage, /Environment placeholders/i);
	assert.doesNotMatch(dataSourcesPage, /\benvVars\b/);
	assert.doesNotMatch(dataSourcesPage, /Needs API key/i);
	assert.doesNotMatch(dataSourcesPage, /Needs endpoint/i);
});

test("public data-sources page still explains provider access status and links to source material", () => {
	assert.match(dataSourcesPage, /Access status:/);
	assert.match(dataSourcesPage, /Provider site/);
	assert.match(dataSourcesPage, /Technical docs/);
});
