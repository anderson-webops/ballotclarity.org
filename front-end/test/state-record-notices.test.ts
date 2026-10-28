import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("record profiles link to collection sources instead of repeating collection-wide caveats", () => {
	const page = readFileSync(new URL("../src/pages/record/[state]/[id].vue", import.meta.url), "utf8");
	assert.doesNotMatch(page, /data\.source\.scopeNotice|not a personalized ballot/u);
	assert.match(page, /path: "\/record-sources"/u);
	const sources = readFileSync(new URL("../src/pages/record-sources.vue", import.meta.url), "utf8");
	assert.match(sources, /data\.source\.scopeNotice/u);
});
