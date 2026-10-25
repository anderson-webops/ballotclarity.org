import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appFooter = readFileSync(new URL("../src/components/AppFooter.vue", import.meta.url), "utf8");

test("footer keeps identity, contact, and the official-site disclaimer", () => {
	assert.match(appFooter, /Ballot Clarity/);
	assert.doesNotMatch(appFooter, /Nonpartisan public-interest project/);
	assert.match(appFooter, /<ProtectedEmailLink/);
	assert.match(appFooter, /\{\{ ballotInformationDisclaimer \}\}/);
	assert.match(appFooter, /to="\/contact"/);
});

test("footer link groups are navigation landmarks", () => {
	assert.equal((appFooter.match(/<nav /g) ?? []).length, 3);
	assert.doesNotMatch(appFooter, /sm:col-span-2/);
});
