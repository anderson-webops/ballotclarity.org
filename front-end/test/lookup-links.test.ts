import assert from "node:assert/strict";
import test from "node:test";
import { buildNationwideDistrictHref, buildNationwideRepresentativeHref } from "../src/utils/lookup-links.ts";

test("lookup links keep the active lookup context on district and representative routes", () => {
	const lookup = {
		lookupQuery: "30022",
		selectionId: "zip:30022:johns-creek-georgia"
	};

	assert.equal(
		buildNationwideDistrictHref({
			id: "ga-cd-07",
			label: "Congressional District 7"
		}, lookup),
		"/districts/ga-cd-07?lookup=30022&selection=zip%3A30022%3Ajohns-creek-georgia"
	);
	assert.equal(
		buildNationwideRepresentativeHref({
			id: "ocd-person/rich-mccormick",
			name: "Rich McCormick"
		}, lookup),
		"/representatives/rich-mccormick?lookup=30022&selection=zip%3A30022%3Ajohns-creek-georgia"
	);
});

test("lookup links still resolve without an attached lookup context", () => {
	assert.equal(
		buildNationwideDistrictHref({
			id: "ga-state-house-48",
			label: "State House District 48"
		}),
		"/districts/ga-state-house-48"
	);
	assert.equal(
		buildNationwideRepresentativeHref({
			id: "ocd-person/scott-hilton",
			name: "Scott Hilton"
		}),
		"/representatives/scott-hilton"
	);
});
