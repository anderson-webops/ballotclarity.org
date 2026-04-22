import { nationwideResultsPath } from "./nationwide-results";

export interface RouteLayerNavigationInput {
	hasNationwideResultContext: boolean;
	hasPublishedGuideContext: boolean;
	selectedElectionSlug?: null | string;
	selectedLocationSlug?: null | string;
}

export interface RouteLayerLink {
	label: string;
	to: string;
}

export interface RouteLayerNavigation {
	backToLayer: RouteLayerLink;
	layerBreadcrumb: RouteLayerLink;
	locationHub: RouteLayerLink;
	openLayer: RouteLayerLink;
	overview: RouteLayerLink;
}

export function buildRouteLayerNavigation(input: RouteLayerNavigationInput): RouteLayerNavigation {
	if (input.hasPublishedGuideContext) {
		const ballotGuidePath = input.selectedElectionSlug ? `/ballot/${input.selectedElectionSlug}` : "/ballot";
		const electionOverviewPath = input.selectedElectionSlug ? `/elections/${input.selectedElectionSlug}` : "/coverage";
		const locationHubPath = input.selectedLocationSlug ? `/locations/${input.selectedLocationSlug}` : "/coverage";

		return {
			backToLayer: {
				label: "Back to ballot",
				to: ballotGuidePath
			},
			layerBreadcrumb: {
				label: "Ballot guide",
				to: ballotGuidePath
			},
			locationHub: {
				label: "Location hub",
				to: locationHubPath
			},
			openLayer: {
				label: "Open ballot guide",
				to: ballotGuidePath
			},
			overview: {
				label: "Election overview",
				to: electionOverviewPath
			}
		};
	}

	if (input.hasNationwideResultContext) {
		return {
			backToLayer: {
				label: "Back to results",
				to: nationwideResultsPath
			},
			layerBreadcrumb: {
				label: "Results",
				to: nationwideResultsPath
			},
			locationHub: {
				label: "Results",
				to: nationwideResultsPath
			},
			openLayer: {
				label: "Open results",
				to: nationwideResultsPath
			},
			overview: {
				label: "Results",
				to: nationwideResultsPath
			}
		};
	}

	return {
		backToLayer: {
			label: "Back to coverage profile",
			to: "/coverage"
		},
		layerBreadcrumb: {
			label: "Coverage profile",
			to: "/coverage"
		},
		locationHub: {
			label: "Coverage profile",
			to: "/coverage"
		},
		openLayer: {
			label: "Open coverage profile",
			to: "/coverage"
		},
		overview: {
			label: "Coverage profile",
			to: "/coverage"
		}
	};
}
