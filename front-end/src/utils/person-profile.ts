import type { PersonProfile } from "~/types/civic";

export function buildPersonLinkageConfidence(status: PersonProfile["provenance"]["status"]) {
	if (status === "direct") {
		return {
			label: "High linkage confidence",
			note: "Ballot Clarity linked this person directly to source-backed local records."
		};
	}

	if (status === "crosswalked") {
		return {
			label: "Moderate linkage confidence",
			note: "This page uses a structured crosswalk between person records and local civic data. Verify the attached sources before relying on it."
		};
	}

	return {
		label: "Approximate linkage",
		note: "This page is based on an inferred person match and should be verified carefully against the linked records."
	};
}

export function hasPersonFunding(person: PersonProfile) {
	return Boolean(person.funding);
}

export function hasPersonInfluence(person: PersonProfile) {
	return person.lobbyingContext.length > 0 || person.publicStatements.length > 0;
}
