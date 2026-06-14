import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const contentPage = readFileSync(resolve("src/pages/admin/content.vue"), "utf8");
const contentHistoryPage = readFileSync(resolve("src/pages/admin/content/[id].vue"), "utf8");

test("admin content publishing exposes reviewer approval controls", () => {
	assert.match(contentPage, /Publish approval/);
	assert.match(contentPage, /v-model="item\.publishApprovedBy"/);
	assert.match(contentPage, /v-model="item\.publishApprovalNote"/);
	assert.match(contentPage, /Unpublishing clears the approval/);
	assert.match(contentHistoryPage, /Publish approved by/);
	assert.match(contentHistoryPage, /Publish approval note/);
});
