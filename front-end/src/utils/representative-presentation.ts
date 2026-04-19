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
