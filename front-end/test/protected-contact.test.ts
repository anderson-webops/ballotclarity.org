import assert from "node:assert/strict";
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
