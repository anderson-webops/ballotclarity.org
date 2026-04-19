import type { PersonProfile } from "~/types/civic";

export interface PersonSummaryItem {
	href?: string;
	label: string;
	note?: string;
	value: string | number;
}

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
	return Boolean(person.influence) || person.lobbyingContext.length > 0 || person.publicStatements.length > 0;
}

export function buildPersonSummaryItems(options: {
	dataThroughLabel: string;
	formatCurrency: (value: number) => string;
	fundingHref?: string;
	fundingStatusSummary: string;
	fundingTotalRaised?: number | null;
	hasFunding: boolean;
	hasInfluence: boolean;
	influenceHref?: string;
	influenceNoteCount: number;
	influenceStatusSummary: string;
	officeDisplayLabel: string;
	officeHref?: string;
}): PersonSummaryItem[] {
	return [
		{
			href: options.officeHref,
			label: "Current office",
			note: "Office context attached to this person record.",
			value: options.officeDisplayLabel
		},
		{
			href: options.fundingHref,
			label: "Funding data",
			note: options.hasFunding
				? `Source-backed finance summary available. Data through ${options.dataThroughLabel}.`
				: options.fundingStatusSummary,
			value: options.hasFunding && typeof options.fundingTotalRaised === "number"
				? options.formatCurrency(options.fundingTotalRaised)
				: "Unavailable"
		},
		{
			href: options.influenceHref,
			label: "Influence context",
			note: options.hasInfluence
				? "Lobbying, donor, or disclosure context is attached below."
				: options.influenceStatusSummary,
			value: options.hasInfluence ? `${options.influenceNoteCount} notes` : "Unavailable"
		}
	];
}
