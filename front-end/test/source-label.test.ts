import assert from "node:assert/strict";
import test from "node:test";
import { formatSourceCountLabel } from "../src/utils/source-label.ts";

test("formatSourceCountLabel uses singular only for one source", () => {
	assert.equal(formatSourceCountLabel(0), "0 sources");
	assert.equal(formatSourceCountLabel(1), "1 source");
	assert.equal(formatSourceCountLabel(2), "2 sources");
});
