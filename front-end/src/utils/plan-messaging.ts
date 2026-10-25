import type { LookupContextState } from "./guide-entry";

export interface PlanUnavailableMessaging {
	title: string;
	body: string;
	tone: "info" | "warning";
}

export const planRequiresPublishedGuideTitle = "Ballot plan unavailable";
export const missingGuideContextBody = "";
export const nationwideOnlyGuideBody = "";
export const shellOnlyGuideBody = "";

export function buildPlanUnavailableMessaging(lookupContext: LookupContextState | null | undefined): PlanUnavailableMessaging {
	if (lookupContext?.guideAvailability === "not-published") {
		return {
			body: nationwideOnlyGuideBody,
			title: planRequiresPublishedGuideTitle,
			tone: "info"
		};
	}

	if (lookupContext?.guideAvailability === "published" && !lookupContext?.hasVerifiedContestPackage) {
		return {
			body: shellOnlyGuideBody,
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
		tone: "info"
	};
}
