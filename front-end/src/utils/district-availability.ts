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
		return `${representativeCount} current official${representativeCount === 1 ? "" : "s"} ${representativeCount === 1 ? "is" : "are"} linked from the active nationwide lookup for this district.`;

	const kind = deriveDistrictPipelineKind(district);

	if (kind === "county")
		return "No county officeholder data is connected for this area yet. This does not mean the county has no officials, only that the current nationwide provider set does not yet publish a county officeholder pipeline here.";

	if (kind === "city")
		return "City officeholder data is not yet available from the current nationwide provider set. This does not mean the city has no officials, only that Ballot Clarity cannot yet attach them here.";

	if (kind === "other-local")
		return "Local officeholder data is not yet fully connected for this area. Official local election tools remain the verification path until a local officeholder pipeline is attached.";

	return "No current official record is linked from the active nationwide provider set for this district yet.";
}

export function buildDistrictCandidateAvailabilityNote(candidateCount: number, hasPublishedGuide: boolean) {
	if (candidateCount > 0)
		return "Candidate field records are attached to this district page from the published local guide.";

	if (hasPublishedGuide)
		return "No source-backed candidate field is attached to this district page yet.";

	return "Candidate field records, contest summaries, and local ballot-guide pages remain unavailable here because Ballot Clarity does not currently have a published local guide for this district.";
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
			summary: "This district identifies the federal office area tied to the current nationwide lookup.",
			whyItMatters: "Federal district matches help confirm the current U.S. House officeholder and the official election tools tied to that geography."
		};
	}

	if (kind === "state") {
		return {
			decisionAreas: [
				"State budget and appropriations",
				"State statutory changes",
				"Committee oversight and constituent services"
			],
			summary: "This district identifies the state legislative office area tied to the current nationwide lookup.",
			whyItMatters: "State legislative district matches help orient voters to the current officeholder, the district geography, and the official election tools tied to that area."
		};
	}

	if (kind === "county") {
		return {
			decisionAreas: [
				"County administration and budgeting",
				"County services and local implementation",
				"Local verification through county election offices"
			],
			summary: "This county geography is attached as a lookup orientation layer, even when Ballot Clarity does not yet have a county officeholder pipeline for it.",
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
			summary: "This city geography is attached as a lookup orientation layer, even when Ballot Clarity does not yet have city officeholder records for it.",
			whyItMatters: "City matches still help users verify locality, official tools, and the local jurisdiction tied to the current lookup."
		};
	}

	return {
		decisionAreas: [
			"Jurisdiction verification",
			"District and office matching",
			"Official election tool discovery"
		],
		summary: "This district is part of the active nationwide lookup context for the current location.",
		whyItMatters: "Even when Ballot Clarity does not yet have a published local guide, this district layer helps orient the user around geography, offices, and official verification tools."
	};
}
