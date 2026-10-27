import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("record profiles use one source-specific notice or the generic ballot disclaimer", () => {
	const page = readFileSync(new URL("../src/pages/record/[state]/[id].vue", import.meta.url), "utf8");
	assert.match(page, /<p v-if="data\.source\.scopeNotice"[^>]*>\s*\{\{ data\.source\.scopeNotice \}\}\s*<\/p>/u);
	assert.match(page, /<p v-if="!data\.source\.scopeNotice"[^>]*>\s*These records are not a personalized ballot\.\s*<\/p>/u);
});
