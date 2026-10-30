import type {
	LocationRepresentativeMatch,
	PersonProfile,
	RepresentativeGovernmentLevel,
	RepresentativeSummary,
} from "~/types/civic";
import {
	buildRepresentativeGovernmentLevelLabel,
	buildRepresentativeGovernmentLevelSectionLabel,
	classifyRepresentative,
	representativeGovernmentLevelOrder,
} from "./representative-classification";

type RepresentativePresentationSource
	= Pick<LocationRepresentativeMatch, "districtLabel" | "governmentLevel" | "officeDisplayLabel" | "officeTitle" | "officeType">
		| Pick<RepresentativeSummary, "districtLabel" | "governmentLevel" | "officeDisplayLabel" | "officeSought" | "officeType">
		| Pick<PersonProfile, "districtLabel" | "governmentLevel" | "officeDisplayLabel" | "officeSought" | "officeType">;

export interface RepresentativePresentation {
	governmentLevel: RepresentativeGovernmentLevel | null;
	levelLabel: string;
	officeDisplayLabel: string;
}

export function resolveRepresentativeContentSummary(value: string | null | undefined) {
	const summary = value?.trim() ?? "";
	return /^(?:Matched from |Ballot Clarity attached |Congress\.gov attached |Congress\.gov confirmed |Congress\.gov lists |.+ is linked here through area results)/u.test(summary) || /Ballot Clarity (?:can attach|keeps available)|local officeholder layer/u.test(summary) ? "" : summary;
}

export function substantiveBiography(person: Pick<PersonProfile, "biography"> | null | undefined) {
	return (person?.biography ?? []).filter(block => Boolean(resolveRepresentativeContentSummary(block.summary)) && !/^(?:Provider-backed officeholder record|Office record|Congress\.gov office context|Federal finance and disclosure crosswalk)$/u.test(block.title));
}

export function resolveRepresentativePresentation(
	representative: RepresentativePresentationSource,
	stateName?: string | null,
): RepresentativePresentation {
	const classification = classifyRepresentative({
		districtLabel: representative.districtLabel,
		governmentLevel: representative.governmentLevel,
		officeSought: "officeSought" in representative ? representative.officeSought : representative.officeDisplayLabel,
		officeTitle: "officeTitle" in representative ? representative.officeTitle : undefined,
		officeType: representative.officeType,
		stateName,
	});

	return {
		governmentLevel: classification.governmentLevel,
		levelLabel: buildRepresentativeGovernmentLevelLabel(classification.governmentLevel),
		officeDisplayLabel: representative.officeDisplayLabel || classification.officeDisplayLabel,
	};
}

export function groupRepresentativeSummariesByGovernmentLevel(
	representatives: RepresentativeSummary[],
	stateName?: string | null,
) {
	const groups: Array<{
		label: string;
		level: RepresentativeGovernmentLevel | null;
		representatives: RepresentativeSummary[];
	}> = representativeGovernmentLevelOrder.map(level => ({
		level,
		label: buildRepresentativeGovernmentLevelSectionLabel(level),
		representatives: representatives.filter((representative) => {
			return resolveRepresentativePresentation(representative, stateName).governmentLevel === level;
		}),
	}))
		.filter(group => group.representatives.length > 0);

	const unclassified = representatives.filter((representative) => {
		return !resolveRepresentativePresentation(representative, stateName).governmentLevel;
	});

	if (unclassified.length) {
		groups.push({
			label: "Other officials",
			level: null,
			representatives: unclassified,
		});
	}

	return groups;
}
