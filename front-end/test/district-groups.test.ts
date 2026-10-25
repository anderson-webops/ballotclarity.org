import type { DistrictSummary } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { groupDistrictSummaries } from "../src/utils/district-groups.ts";

function district(slug: string, jurisdiction: DistrictSummary["jurisdiction"]): DistrictSummary {
	return {
		slug,
		title: slug,
		office: "",
		jurisdiction,
		summary: "",
		representativeCount: 0,
		candidateCount: 0,
		href: `/districts/${slug}`,
		updatedAt: "2026-10-24T12:00:00.000Z"
	};
}

test("district groups keep Federal, State and Local order and each record's identity", () => {
	const districts = [
		district("fulton-county", "Local"),
		district("congressional-7", "Federal"),
		district("state-senate-48", "State"),
		district("state-house-48", "State"),
		district("johns-creek", "Local")
	];
	const before = structuredClone(districts);
	const groups = groupDistrictSummaries(districts);

	assert.deepEqual(groups.map(group => group.jurisdiction), ["Federal", "State", "Local"]);
	assert.deepEqual(groups.map(group => group.districts.map(record => record.slug)), [
		["congressional-7"],
		["state-senate-48", "state-house-48"],
		["fulton-county", "johns-creek"]
	]);
	assert.deepEqual(districts, before);
	for (const record of districts)
		assert.equal(groups.flatMap(group => group.districts).filter(item => item === record).length, 1);
});

test("district groups retain all three categories when no records are available", () => {
	assert.deepEqual(groupDistrictSummaries([]), [
		{ jurisdiction: "Federal", districts: [] },
		{ jurisdiction: "State", districts: [] },
		{ jurisdiction: "Local", districts: [] }
	]);
});

test("district groups keep empty categories in place when only one level is available", () => {
	for (const jurisdiction of ["Federal", "State", "Local"] as const) {
		const record = district("single-district", jurisdiction);
		const groups = groupDistrictSummaries([record]);
		assert.equal(groups.length, 3);
		for (const group of groups)
			assert.deepEqual(group.districts, group.jurisdiction === jurisdiction ? [record] : []);
	}
});

test("district directory renders visible semantic groups, empty states and context-aware links", async () => {
	const page = await readFile(new URL("../src/pages/districts/index.vue", import.meta.url), "utf8");
	assert.match(page, /groupDistrictSummaries\(districts\.value\)/u);
	assert.match(page, /<section v-for="group in districtGroups"[^>]+:aria-labelledby=/u);
	assert.match(page, /<h2[^>]+>[\s\S]*?\{\{ group\.jurisdiction \}\}/u);
	assert.match(page, /<h3[^>]+>[\s\S]*?\{\{ district\.title \}\}/u);
	assert.match(page, /v-for="district in group\.districts"[^>]+:to="buildLookupAwareTarget\(district\.href\)"/u);
	assert.match(page, /<p v-else[^>]+>\s*No records are available yet\./u);
	assert.doesNotMatch(page, /<details|<summary|\{\{ district\.jurisdiction \}\}/u);
});
