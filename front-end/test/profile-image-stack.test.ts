import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const profileImageStack = readFileSync(new URL("../src/components/ProfileImageStack.vue", import.meta.url), "utf8");

test("profile portraits overpaint the rounded frame edge", () => {
	for (const utility of ["relative", "isolate", "overflow-hidden", "leading-none"])
		assert.match(profileImageStack, new RegExp(`profile-image-frame[^"]*${utility}`));

	for (const utility of ["absolute", "inset-\\[-1px\\]", "block", "h-\\[calc\\(100%\\+2px\\)\\]", "w-\\[calc\\(100%\\+2px\\)\\]", "object-cover", "object-center"])
		assert.match(profileImageStack, new RegExp(`class="[^"]*${utility}`));

	assert.match(profileImageStack, /<span v-else class="relative z-10"/);
});
