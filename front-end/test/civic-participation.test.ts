import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { findParticipationGuide, participationGuides, participationResources, participationReviewedAt } from "../src/data/civic-participation.ts";

test("participation has three distinct, reachable routes and rejects unknown activities", () => {
	assert.deepEqual(participationGuides.map(guide => guide.slug), ["meetings", "serve", "run"]);
	for (const guide of participationGuides) {
		assert.equal(findParticipationGuide(guide.slug), guide);
		const sections = guide.groups.flatMap(group => group.sections);
		assert.equal(new Set(sections.map(section => section.id)).size, sections.length);
		for (const section of sections) {
			assert.ok(section.summary);
			assert.ok(section.steps.length);
			assert.ok(section.links.length);
			assert.ok(section.links.length <= 3);
		}
	}
	for (const input of [undefined, ["run"], "constructor", "__proto__", "other", "<script>"])
		assert.equal(findParticipationGuide(input), undefined);
});

test("participation resources identify primary publishers and use HTTPS", () => {
	assert.ok(Number.isFinite(Date.parse(participationReviewedAt)));
	for (const resource of Object.values(participationResources)) {
		assert.equal(new URL(resource.href).protocol, "https:");
		assert.ok(resource.publisher);
		assert.ok(resource.label.length < 40);
	}
	const knownResources = new Set(Object.values(participationResources));
	for (const guide of participationGuides) {
		for (const section of guide.groups.flatMap(group => group.sections)) {
			for (const resource of section.links)
				assert.ok(knownResources.has(resource));
		}
	}
});

test("party selection routes remain separate and equally discoverable", () => {
	const served = findParticipationGuide("serve")!;
	const local = served.groups.find(group => group.title === "Fulton County, Georgia")!;
	assert.deepEqual(local.sections.slice(0, 3).map(section => section.id), ["democratic-post-seats", "libertarian-roles", "republican-precincts"]);
	assert.match(local.sections[0].steps.join(" "), /caucus|vacant seat/u);
	assert.match(local.sections[2].steps.join(" "), /precinct meetings/u);
	assert.ok(local.sections.some(section => section.id === "government-board"));
	assert.ok(local.sections.some(section => section.id === "fulton-poll-worker"));
});

test("participation calendars never turn recurrence or historical notices into a next event", () => {
	const serialized = JSON.stringify(participationGuides);
	assert.doesNotMatch(serialized, /next (?:meeting|convention) is|2025-\d{2}-\d{2}|fourth Wednesday|November 24|2027-\d{2}-\d{2}/iu);
	assert.match(serialized, /dated event notice/u);
	assert.match(serialized, /current mass-meeting call/u);
});

test("national starting points remain separate from jurisdiction-specific rules", () => {
	for (const guide of participationGuides) {
		assert.equal(guide.groups[0].title, "Anywhere in the U.S.");
		assert.ok(guide.groups.slice(1).every(group => group.title === "Fulton County, Georgia" || group.title === "Georgia"));
	}
	assert.equal(participationResources.electionOffice.publisher, "USAGov");
	assert.equal(participationResources.federalCandidates.publisher, "Federal Election Commission");
});

test("participation uses detail destinations without dropdowns, party selection, or submissions", () => {
	const page = readFileSync(new URL("../src/pages/get-involved/[activity].vue", import.meta.url), "utf8");
	assert.match(page, /validate: route/u);
	assert.match(page, /<UpdatedAt[^>]+footer/u);
	assert.doesNotMatch(page, /<details|<summary|<form|\$fetch|useCivicStore|localStorage|trackEvent/u);
	const home = readFileSync(new URL("../src/pages/index.vue", import.meta.url), "utf8");
	const footer = readFileSync(new URL("../src/components/AppFooter.vue", import.meta.url), "utf8");
	const sitemap = readFileSync(new URL("../server/routes/sitemap.xml.ts", import.meta.url), "utf8");
	assert.match(home, /to="\/get-involved"/u);
	assert.match(footer, /label: "Get involved", to: "\/get-involved"/u);
	for (const slug of ["", ...participationGuides.map(guide => `/${guide.slug}`)])
		assert.ok(sitemap.includes(`"/get-involved${slug}"`));
});
