import type { LookupContextState } from "./guide-entry";

export interface PlanUnavailableMessaging {
	title: string;
	body: string;
	tone: "info" | "warning";
}

export const planRequiresPublishedGuideTitle = "Ballot plan requires a local guide";
export const missingGuideContextBody = "A local guide is not attached to this page yet. Return to the lookup and use the results, districts, representatives, and official election tools instead.";
export const nationwideOnlyGuideBody = "The latest lookup succeeded, but a local guide is not available for this area yet. Use the results, districts, representatives, and official election tools instead.";
export const shellOnlyGuideBody = "Official election links are live for this area, but verified contest pages are still under local review. The ballot plan opens after the verified local contest package is published.";

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
			title: "Ballot plan needs verified contest pages",
			tone: "warning"
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
