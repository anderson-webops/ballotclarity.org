import assert from "node:assert/strict";
import test from "node:test";
import {
	formatSourceCitationType,
	formatSourcePublicationKind,
	formatSourcePublisherType,
	groupSourceDirectoryItems
} from "../src/utils/source-directory.ts";

test("source directory helpers format source metadata for the public directory", () => {
	assert.equal(formatSourcePublicationKind("curated-global"), "Curated global record");
	assert.equal(formatSourcePublicationKind("published-provenance"), "Published page record");
	assert.equal(formatSourcePublisherType("official"), "Official");
	assert.equal(formatSourcePublisherType("third-party civic infrastructure"), "Third-party civic infrastructure");
	assert.equal(formatSourceCitationType("page"), "Route layer");
	assert.equal(formatSourceCitationType("candidate"), "Candidate page");
});

test("groupSourceDirectoryItems keeps curated records ahead of published provenance records", () => {
	const sections = groupSourceDirectoryItems([
		{
			authority: "official-government",
			citationCount: 2,
			citedBy: [],
			date: "2026-04-19T00:00:00.000Z",
			geographicScope: "United States",
			id: "published-item",
			limitations: ["Needs parent page context."],
			publicationKind: "published-provenance",
			publisher: "Example Publisher",
			publisherType: "official",
			reviewNote: "Published because it is cited.",
			routeFamilies: ["Candidate pages"],
			sourceSystem: "Example system",
			summary: "Published source record.",
			title: "Published item",
			type: "official record",
			url: "https://example.com/published",
			usedFor: "Candidate evidence."
		},
		{
			authority: "nonprofit-provider",
			citationCount: 3,
			citedBy: [],
			date: "2026-04-19T00:00:00.000Z",
			geographicScope: "United States",
			id: "curated-item",
			limitations: ["Coverage varies by place."],
			publicationKind: "curated-global",
			publisher: "Example Nonprofit",
			publisherType: "public-interest",
			reviewNote: "Reviewed for source-directory publication.",
			routeFamilies: ["Representative pages"],
			sourceSystem: "Example provider",
			summary: "Core provider record.",
			title: "Curated item",
			type: "research brief",
			url: "https://example.com/curated",
			usedFor: "Representative identity."
		},
	]);

	assert.equal(sections.length, 2);
	assert.equal(sections[0]?.kind, "curated-global");
	assert.equal(sections[0]?.items[0]?.id, "curated-item");
	assert.equal(sections[1]?.kind, "published-provenance");
	assert.equal(sections[1]?.items[0]?.id, "published-item");
});
