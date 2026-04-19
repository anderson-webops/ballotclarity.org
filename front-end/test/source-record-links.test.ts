import assert from "node:assert/strict";
import test from "node:test";
import { buildSourceRecordHref } from "../src/utils/source-record-links.ts";

test("buildSourceRecordHref returns a detail path only for published source ids", () => {
	assert.equal(buildSourceRecordHref("official-candidate-list", new Set(["official-candidate-list"])), "/sources/official-candidate-list");
	assert.equal(buildSourceRecordHref("supplemental:shawn-still:bio", new Set(["supplemental:shawn-still:bio"])), "/sources/supplemental:shawn-still:bio");
	assert.equal(buildSourceRecordHref("district:state-senate-48", new Set(["official-candidate-list"])), null);
});
