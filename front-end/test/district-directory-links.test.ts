import type { RepresentativeSummary } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import test from "node:test";
import {
	buildDistrictRepresentativeBadgeHref,
	buildDistrictRepresentativeBadgeTitle,
	buildDistrictRepresentativePopoverLinks
} from "../src/utils/district-directory-links.ts";

function createRepresentativeSummary(overrides: Partial<RepresentativeSummary>): RepresentativeSummary {
	return {
		ballotStatusLabel: "Not on current ballot",
		districtLabel: "District 1",
		districtSlug: "district-1",
		fundingAvailable: false,
		fundingSummary: "",
		governmentLevel: "state",
		href: "/representatives/example",
		influenceAvailable: false,
		influenceSummary: "",
		incumbent: true,
		location: "Georgia",
		name: "Example Official",
		officeDisplayLabel: "Georgia State Senator for District 1",
		officeSought: "Senator",
		officeType: "state_senate",
		officeholderLabel: "Current officeholder",
		onCurrentBallot: false,
		openstatesUrl: undefined,
		party: "Nonpartisan",
		provenance: null,
		sourceCount: 0,
		sources: [],
		slug: "example-official",
		summary: "",
		updatedAt: "2026-04-18T12:43:00.000Z",
		...overrides
	};
}

test("district directory representative badge links directly to one representative and falls back to the district for many", () => {
	assert.equal(buildDistrictRepresentativeBadgeHref([], "/districts/congressional-7"), undefined);
	assert.equal(
		buildDistrictRepresentativeBadgeHref(
			[createRepresentativeSummary({ href: "/representatives/rich-mccormick" })],
			"/districts/congressional-7"
		),
		"/representatives/rich-mccormick"
	);
	assert.equal(
		buildDistrictRepresentativeBadgeHref(
			[
				createRepresentativeSummary({ href: "/representatives/jon-ossoff", name: "Jon Ossoff" }),
				createRepresentativeSummary({ href: "/representatives/raphael-warnock", name: "Raphael Warnock" })
			],
			"/districts/senator-georgia"
		),
		"/districts/senator-georgia"
	);
});

test("district directory representative popover links preserve representative identity and external/internal routing", () => {
	const links = buildDistrictRepresentativePopoverLinks([
		createRepresentativeSummary({
			href: "/representatives/shawn-still",
			name: "Shawn Still",
			officeDisplayLabel: "Georgia State Senator for District 48",
			party: "Republican"
		}),
		createRepresentativeSummary({
			href: "https://openstates.org/person/rich-mccormick/",
			name: "Rich McCormick",
			officeDisplayLabel: "U.S. Representative for Georgia's 7th Congressional District",
			party: "Republican"
		})
	]);

	assert.deepEqual(links, [
		{
			external: false,
			href: "/representatives/shawn-still",
			name: "Shawn Still",
			officeDisplayLabel: "Georgia State Senator for District 48",
			party: "Republican"
		},
		{
			external: true,
			href: "https://openstates.org/person/rich-mccormick/",
			name: "Rich McCormick",
			officeDisplayLabel: "U.S. Representative for Georgia's 7th Congressional District",
			party: "Republican"
		}
	]);
});

test("district directory representative badge titles stay specific to the district and linked official count", () => {
	assert.equal(
		buildDistrictRepresentativeBadgeTitle(
			{ title: "Fulton County" },
			[createRepresentativeSummary({ name: "Robb Pitts" })]
		),
		"Open Robb Pitts for Fulton County"
	);
	assert.equal(
		buildDistrictRepresentativeBadgeTitle(
			{ title: "Georgia Senate" },
			[
				createRepresentativeSummary({ name: "Jon Ossoff" }),
				createRepresentativeSummary({ name: "Raphael Warnock" })
			]
		),
		"Open Georgia Senate and review 2 linked representatives"
	);
});
