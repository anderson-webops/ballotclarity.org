import type { SourceDirectoryItem, SourcePublicationKind, SourcePublisherType } from "~/types/civic";

const sectionMetadata: Record<SourcePublicationKind, { description: string; heading: string }> = {
	"curated-global": {
		description: "Major official, public-interest, and source systems Ballot Clarity relies on across results and public person pages.",
		heading: "Core source systems"
	},
	"published-provenance": {
		description: "Standalone citation records Ballot Clarity has intentionally published because they are used on public pages and resolve as real source records.",
		heading: "Published page source records"
	}
};

export function formatSourcePublicationKind(kind: SourcePublicationKind) {
	return kind === "curated-global" ? "Curated global record" : "Published page record";
}

export function formatSourcePublisherType(type: SourcePublisherType) {
	switch (type) {
		case "ballot-clarity archive":
			return "Ballot Clarity archive";
		case "campaign":
			return "Campaign source";
		case "nonprofit":
			return "Nonprofit";
		case "official":
			return "Official";
		case "public-interest":
			return "Public-interest";
		case "third-party civic infrastructure":
		default:
			return "Third-party civic infrastructure";
	}
}

export function formatSourceCitationType(type: SourceDirectoryItem["citedBy"][number]["type"]) {
	switch (type) {
		case "candidate":
			return "Candidate page";
		case "contest":
			return "Contest page";
		case "election":
			return "Election page";
		case "jurisdiction":
			return "Location page";
		case "measure":
			return "Measure page";
		case "page":
		default:
			return "Route layer";
	}
}

export function groupSourceDirectoryItems(items: SourceDirectoryItem[]) {
	return (["curated-global", "published-provenance"] as const)
		.map(kind => ({
			description: sectionMetadata[kind].description,
			heading: sectionMetadata[kind].heading,
			items: items.filter(item => item.publicationKind === kind),
			kind,
		}))
		.filter(section => section.items.length > 0);
}
