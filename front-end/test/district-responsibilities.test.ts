import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildDistrictResponsibilitiesHeading, buildNationwideDistrictRoleGuide } from "../src/utils/district-availability.ts";

const county = { jurisdiction: "Local", office: "County", title: "County 033" } as const;
const city = { jurisdiction: "Local", office: "City", title: "Seattle city" } as const;

test("responsibility headings identify the correct local government", () => {
	assert.equal(buildDistrictResponsibilitiesHeading(county), "County responsibilities");
	assert.equal(buildDistrictResponsibilitiesHeading(city), "City responsibilities");
	assert.equal(buildDistrictResponsibilitiesHeading({ jurisdiction: "State", office: "State Senate", title: "District 7" }), "Responsibilities");
});

test("responsibility lists omit navigation, matching and unavailable-office commentary", () => {
	assert.deepEqual(buildNationwideDistrictRoleGuide(county).decisionAreas, ["County administration and budgeting", "County services and local implementation"]);
	assert.deepEqual(buildNationwideDistrictRoleGuide(city).decisionAreas, ["City governance and municipal services"]);
	assert.deepEqual(buildNationwideDistrictRoleGuide({ jurisdiction: "Local", office: "Unknown", title: "District" }).decisionAreas, []);
	for (const jurisdiction of ["Federal", "State"] as const) {
		assert.equal(buildNationwideDistrictRoleGuide({ jurisdiction, office: "Legislature", title: "District 7" }).decisionAreas.length, 3);
	}
});

test("district responsibilities use one text color and omit site-process explanations", () => {
	const page = readFileSync(new URL("../src/pages/districts/[slug].vue", import.meta.url), "utf8");
	const block = page.match(/<section\s+v-if="districtPageData.district.roleGuide.decisionAreas.length[\s\S]*?<\/section>/u)?.[0];
	assert.ok(block);
	assert.match(block, /aria-labelledby="district-responsibilities"/u);
	assert.match(block, /<h2 id="district-responsibilities"/u);
	assert.match(block, /\{\{ responsibilitiesHeading \}\}/u);
	assert.match(block, /class="text-base text-app-ink leading-7 dark:text-app-text-dark"/u);
	assert.match(block, /v-if="districtPageData.mode === 'guide' && districtPageData.district.roleGuide.summary"/u);
	assert.doesNotMatch(block, /text-app-muted|whyItMatters|<details|What this office does/u);
});
