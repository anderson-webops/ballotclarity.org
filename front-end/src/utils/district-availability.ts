import type { ContestRoleGuide, DistrictSummary } from "../types/civic";

type DistrictPipelineKind = "city" | "county" | "federal" | "other-local" | "state";

interface DistrictDescriptorInput {
	office: string;
	title: string;
	jurisdiction: DistrictSummary["jurisdiction"];
}

function normalizeValue(value: string | null | undefined) {
	return String(value ?? "").trim().toLowerCase();
}

export function deriveDistrictPipelineKind({
	jurisdiction,
	office,
	title
}: DistrictDescriptorInput): DistrictPipelineKind {
	const normalizedOffice = normalizeValue(office);
	const normalizedTitle = normalizeValue(title);

	if (jurisdiction === "Federal")
		return "federal";

	if (jurisdiction === "State")
		return "state";

	if (normalizedOffice.includes("county") || normalizedTitle.includes("county"))
		return "county";

	if (normalizedOffice.includes("city") || normalizedTitle.includes("city"))
		return "city";

	return "other-local";
}

export function buildDistrictRepresentativeCountLabel(
	district: DistrictDescriptorInput,
	representativeCount: number
) {
	if (representativeCount > 0)
		return `${representativeCount} current representative${representativeCount === 1 ? "" : "s"}`;

	const kind = deriveDistrictPipelineKind(district);

	if (kind === "city" || kind === "county")
		return "Officeholder pipeline pending";

	return "No linked official yet";
}

export function buildDistrictRepresentativeAvailabilityNote(
	district: DistrictDescriptorInput,
	representativeCount: number
) {
	if (representativeCount > 0)
		return `${representativeCount} current official${representativeCount === 1 ? "" : "s"} ${representativeCount === 1 ? "is" : "are"} linked to this district.`;

	const kind = deriveDistrictPipelineKind(district);

	if (kind === "county")
		return "No county officeholder data is attached here yet. This does not mean the county has no officials.";

	if (kind === "city")
		return "No city officeholder data is attached here yet. This does not mean the city has no officials.";

	if (kind === "other-local")
		return "No local officeholder data is attached here yet. Use the official election links for verification.";

	return "No current official record is linked to this district yet.";
}

export function buildDistrictCandidateAvailabilityNote(candidateCount: number, hasPublishedGuide: boolean) {
	if (candidateCount > 0)
		return "Candidate records are attached to this district page.";

	if (hasPublishedGuide)
		return "No candidate field is attached to this district page yet.";

	return "Candidate records and local guide pages are not published for this district yet.";
}

export function buildNationwideDistrictRoleGuide(district: DistrictDescriptorInput): ContestRoleGuide {
	const kind = deriveDistrictPipelineKind(district);

	if (kind === "federal") {
		return {
			decisionAreas: [
				"Federal legislation and oversight",
				"Appropriations and district project advocacy",
				"Constituent casework with federal agencies"
			],
			summary: "This district identifies the federal office area for this lookup.",
			whyItMatters: "Federal district matches help confirm the current U.S. House officeholder and the official election links for that geography."
		};
	}

	if (kind === "state") {
		return {
			decisionAreas: [
				"State budget and appropriations",
				"State statutory changes",
				"Committee oversight and constituent services"
			],
			summary: "This district identifies the state legislative office area for this lookup.",
			whyItMatters: "State legislative district matches help orient voters to the current officeholder, district geography, and official election links for that area."
		};
	}

	if (kind === "county") {
		return {
			decisionAreas: [
				"County administration and budgeting",
				"County services and local implementation",
				"Local verification through county election offices"
			],
			summary: "This county geography helps orient the lookup even when county officeholder records are still limited.",
			whyItMatters: "County matches still help users reach the right official county election tools and verify which local government area a lookup resolved into."
		};
	}

	if (kind === "city") {
		return {
			decisionAreas: [
				"City governance and municipal services",
				"Council, mayoral, and local administrative context",
				"Official local verification through municipal or county election tools"
			],
			summary: "This city geography helps orient the lookup even when city officeholder records are still limited.",
			whyItMatters: "City matches still help users verify locality, official tools, and the local jurisdiction tied to the current lookup."
		};
	}

	return {
		decisionAreas: [
			"Jurisdiction verification",
			"District and office matching",
			"Official election tool discovery"
		],
		summary: "This district is part of the current lookup for this location.",
		whyItMatters: "Even when a local guide is not published, this district layer helps orient users around geography, offices, and official election links."
	};
}
