import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appFooter = readFileSync(new URL("../src/components/AppFooter.vue", import.meta.url), "utf8");

test("footer contact card stays consolidated with the brand column", () => {
	const brandDescriptionIndex = appFooter.indexOf("Ballot Clarity is a nonprofit civic-information site");
	const contactHeadingIndex = appFooter.indexOf("Contact");
	const linkGridIndex = appFooter.indexOf("gap-x-8 gap-y-7 grid");

	assert.ok(brandDescriptionIndex !== -1);
	assert.ok(contactHeadingIndex !== -1);
	assert.ok(linkGridIndex !== -1);
	assert.ok(contactHeadingIndex > brandDescriptionIndex);
	assert.ok(contactHeadingIndex < linkGridIndex);
	assert.doesNotMatch(appFooter, /sm:col-span-2/);
});
