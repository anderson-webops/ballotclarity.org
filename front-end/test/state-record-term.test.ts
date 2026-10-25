import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../src/pages/record/[state]/[id].vue", import.meta.url), "utf8");
test("candidate details show only available term facts and one campaign-site action", () => {
	for (const field of ["termYears", "termEnd", "seats"]) assert.ok(page.includes(`v-if="data.official.${field}"`));
	assert.ok(page.includes("formatDate(data.official.termEnd)"));
	assert.equal(page.match(/Candidate website/gu)?.length, 1);
	assert.doesNotMatch(page, /<details|vote for.*seats/iu);
});
