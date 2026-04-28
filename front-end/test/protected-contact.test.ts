import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildProtectedContactHref, getProtectedContactEmail } from "../src/utils/protected-contact.ts";

test("protected contact utility assembles the project inbox only at runtime", () => {
	assert.equal(getProtectedContactEmail(), "hello@ballotclarity.org");
	assert.equal(
		buildProtectedContactHref("Ballot Clarity privacy question"),
		"mailto:hello@ballotclarity.org?subject=Ballot%20Clarity%20privacy%20question"
	);
	assert.equal(buildProtectedContactHref(), "mailto:hello@ballotclarity.org");
});

test("protected contact source avoids static email exposure and click-to-reveal friction", () => {
	const utilitySource = readFileSync(new URL("../src/utils/protected-contact.ts", import.meta.url), "utf8");
	const componentSource = readFileSync(new URL("../src/components/ProtectedEmailLink.vue", import.meta.url), "utf8");

	assert.equal(utilitySource.includes("hello@ballotclarity.org"), false);
	assert.equal(utilitySource.includes("mailto:hello"), false);
	assert.equal(componentSource.includes("@click"), false);
	assert.equal(componentSource.includes("onMounted"), true);
});
