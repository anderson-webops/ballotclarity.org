import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dataSourcesPage = readFileSync(new URL("../src/components/SourceProviders.vue", import.meta.url), "utf8");

test("public data-sources page avoids operator-only provider setup details", () => {
	assert.doesNotMatch(dataSourcesPage, /Environment placeholders/i);
	assert.doesNotMatch(dataSourcesPage, /\benvVars\b/);
	assert.doesNotMatch(dataSourcesPage, /Needs API key/i);
	assert.doesNotMatch(dataSourcesPage, /Needs endpoint/i);
	assert.doesNotMatch(dataSourcesPage, /in this environment/i);
	assert.doesNotMatch(dataSourcesPage, /should still keep/i);
	assert.doesNotMatch(dataSourcesPage, /review and operations/i);
});

test("public data-sources page still explains provider access status and links to source material", () => {
	assert.match(dataSourcesPage, /provider.connectionStatus === 'active' \? 'Connected' : 'Not connected'/);
	assert.match(dataSourcesPage, /:href="provider.setupUrl"/);
	assert.match(dataSourcesPage, /:href="option.links\[0\]!.url"/);
});
