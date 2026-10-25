import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildDistrictRepresentativeSection } from "../src/utils/district-availability.ts";
import { buildCivicDirectoryApiQuery } from "../src/utils/nationwide-route-context.ts";

test("local officeholder sections describe their own jurisdiction, not the entire directory", () => {
	assert.deepEqual(buildDistrictRepresentativeSection({ jurisdiction: "Local", office: "County", title: "County 033" }), { heading: "County officials", emptyNote: "County officials are not listed here yet." });
	assert.deepEqual(buildDistrictRepresentativeSection({ jurisdiction: "Local", office: "City", title: "Seattle city" }), { heading: "City officials", emptyNote: "City officials are not listed here yet." });
	assert.deepEqual(buildDistrictRepresentativeSection({ jurisdiction: "Local", office: "Unknown", title: "District" }), { heading: "District representatives", emptyNote: "Representatives for this district are not listed here yet." });
});

test("state, federal and published-guide sections remain district-specific", () => {
	for (const jurisdiction of ["Federal", "State"] as const) {
		assert.equal(buildDistrictRepresentativeSection({ jurisdiction, office: "Representative", title: "District 7" }).heading, "District representatives");
	}
	const guide = buildDistrictRepresentativeSection({ jurisdiction: "Local", office: "School board", title: "County school board" }, "guide");
	assert.equal(guide.heading, "District representatives");
	assert.equal(guide.emptyNote, "Representatives for this district are not listed here yet.");
});

test("directory navigation retains ZIP selection or guide area without exposing addresses", () => {
	assert.deepEqual(buildCivicDirectoryApiQuery({ lookupQuery: "30303" }, { lookup: "98101", selection: "zip:98101:seattle-wa" }), { lookup: "98101", selection: "zip:98101:seattle-wa" });
	assert.deepEqual(buildCivicDirectoryApiQuery(null, { area: "guide-area" }), { area: "guide-area" });
	assert.equal(buildCivicDirectoryApiQuery(null, { lookup: "101 Main Street, Seattle, WA" }), null);
});

test("the district section has no contradictory all-representatives link or coverage warning", () => {
	const page = readFileSync(new URL("../src/pages/districts/[slug].vue", import.meta.url), "utf8");
	const section = page.match(/<section id="representatives"[\s\S]*?<\/section>/u)?.[0];
	assert.ok(section);
	assert.match(section, /\{\{ representativeSection.heading \}\}/u);
	assert.match(section, /Representative directory/u);
	assert.match(section, /:to="representativeDirectoryTarget"/u);
	assert.match(section, /\{\{ representativeSection.emptyNote \}\}/u);
	assert.doesNotMatch(section, /All representatives|Current representatives|No linked official|InfoCallout|tone="warning"/u);
	assert.match(page, /buildCivicDirectoryApiQuery\(buildLookupContextFromNationwideResult\(activeNationwideLookupResult.value\), route.query\)/u);
});
