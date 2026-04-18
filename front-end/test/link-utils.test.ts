import assert from "node:assert/strict";
import test from "node:test";
import { isExternalHref } from "../src/utils/link.ts";

test("isExternalHref detects external links", () => {
	assert.equal(isExternalHref("https://openstates.org/person/test"), true);
	assert.equal(isExternalHref("http://example.com"), true);
	assert.equal(isExternalHref("/candidate/example"), false);
	assert.equal(isExternalHref("candidate/example"), false);
	assert.equal(isExternalHref("mailto:foo@example.com"), false);
});
