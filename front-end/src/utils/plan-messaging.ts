import type { LookupContextState } from "./guide-entry";

export interface PlanUnavailableMessaging {
	title: string;
	body: string;
	tone: "info" | "warning";
}

export const planRequiresPublishedGuideTitle = "Ballot plan requires a published local guide";
export const missingGuideContextBody = "Ballot Clarity did not carry a published local guide into this page. The ballot plan stays guide-only for now, so return to the lookup and use the nationwide civic results and official tools instead.";
export const nationwideOnlyGuideBody = "The latest lookup succeeded nationwide, but a published local Ballot Clarity guide is not available for this area yet. The ballot plan stays guide-only for now, so use the nationwide civic results and official tools instead.";

export function buildPlanUnavailableMessaging(lookupContext: LookupContextState | null | undefined): PlanUnavailableMessaging {
	if (lookupContext?.guideAvailability === "not-published") {
		return {
			body: nationwideOnlyGuideBody,
			title: planRequiresPublishedGuideTitle,
			tone: "info"
		};
	}

	if (lookupContext?.guideAvailability !== "published") {
		return {
			body: missingGuideContextBody,
			title: planRequiresPublishedGuideTitle,
			tone: "info"
		};
	}

	return {
		body: missingGuideContextBody,
		title: planRequiresPublishedGuideTitle,
		tone: "warning"
	};
}
