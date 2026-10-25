import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const source = (filename: string) => readFileSync(new URL(`../${filename}`, import.meta.url), "utf8");
test("admin navigation has three primary areas while account and editorial tools remain reachable", () => {
	const layout = source("src/layouts/admin.vue");
	for (const label of ["Operations", "Exceptions", "Settings"]) assert.match(layout, new RegExp(`label: "${label}"`, "u"));
	assert.doesNotMatch(layout, /label: "(?:Dashboard|Guide packages|Content|Review queue|Corrections|Source health|Audit trail|Users)"/u);
	for (const route of ["/admin/account", "/admin/users", "/admin/audit", "/admin/sources", "/admin/datasets"]) assert.ok(source("src/pages/admin/settings.vue").includes(route));
});
test("operations read real dataset status and distinguish loading failures from empty queues", () => {
	assert.match(source("src/pages/admin/index.vue"), /useAdminOperations/u);
	assert.match(source("src/pages/admin/index.vue"), /data && !error && !pending/u);
	assert.match(source("src/pages/admin/exceptions.vue"), /operations\.error\.value/u);
	assert.match(source("src/components/AdminLoadState.vue"), /role="alert"/u);
	assert.match(source("src/pages/admin/review.vue"), /!pending && !error/u);
	assert.match(source("server/api/admin/operations.get.ts"), /getAdminOperations/u);
});
test("publication overview links to a dedicated review, preserving all publication gates and rollback controls", () => {
	const list = source("src/pages/admin/packages/index.vue");
	assert.equal(existsSync(new URL("../src/pages/admin/packages.vue", import.meta.url)), false);
	const detail = source("src/pages/admin/packages/[id].vue");
	assert.doesNotMatch(list, /checklistCategories|reviewRecommendation|publishPackage/u);
	assert.match(detail, /useAdminGuidePackage\(packageId\)/u);
	assert.match(detail, /checklistCategories/u);
	assert.match(detail, /canPublish/u);
	assert.match(detail, /unpublishPackage/u);
	assert.match(detail, /reviewRecommendation/u);
});
test("automation timestamps have separate rows rather than adjoining inline labels", () => {
	assert.match(source("src/pages/admin/index.vue"), /<div class="flex flex-col gap-4 items-start">\s*<UpdatedAt/u);
});
