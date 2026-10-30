import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ballotPage = readFileSync(new URL("../src/pages/ballot/[slug].vue", import.meta.url), "utf8");
const electionPage = readFileSync(new URL("../src/pages/elections/[slug].vue", import.meta.url), "utf8");

test("ballot pages without contests send voters to the election overview", () => {
	assert.match(ballotPage, /definePageMeta\(\{[\s\S]*?middleware: async \(to\) =>/u);
	assert.match(ballotPage, /if \(ballot && !ballot\.election\.contests\.length\)\n\t\t\treturn navigateTo\(\{ path: `\/elections\/\$\{slug\}`, query: to\.query \}, \{ redirectCode: 302 \}\);/u);
});

test("office-level jump links stay off small screens so candidates come first", () => {
	assert.match(electionPage, /<ul v-if="section\.children\?\.length" class="ml-3 hidden lg:grid">/u);
});
