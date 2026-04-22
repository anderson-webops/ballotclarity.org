import assert from "node:assert/strict";
import test from "node:test";
import { buildRouteLayerNavigation } from "../src/utils/route-layer-navigation.ts";

test("route layer navigation keeps ballot-guide labels only for published guide context", () => {
	const navigation = buildRouteLayerNavigation({
		hasNationwideResultContext: false,
		hasPublishedGuideContext: true,
		selectedElectionSlug: "2026-utah-county-general",
		selectedLocationSlug: "utah-county-utah"
	});

	assert.deepEqual(navigation, {
		backToLayer: {
			label: "Back to ballot",
			to: "/ballot/2026-utah-county-general"
		},
		layerBreadcrumb: {
			label: "Ballot guide",
			to: "/ballot/2026-utah-county-general"
		},
		locationHub: {
			label: "Location hub",
			to: "/locations/utah-county-utah"
		},
		openLayer: {
			label: "Open ballot guide",
			to: "/ballot/2026-utah-county-general"
		},
		overview: {
			label: "Election overview",
			to: "/elections/2026-utah-county-general"
		}
	});
});

test("route layer navigation switches mixed pages to results when a nationwide context is active", () => {
	const navigation = buildRouteLayerNavigation({
		hasNationwideResultContext: true,
		hasPublishedGuideContext: false,
		selectedElectionSlug: "2026-utah-county-general",
		selectedLocationSlug: "utah-county-utah"
	});

	assert.equal(navigation.openLayer.label, "Open results");
	assert.equal(navigation.openLayer.to, "/results");
	assert.equal(navigation.backToLayer.label, "Back to results");
	assert.equal(navigation.layerBreadcrumb.label, "Results");
	assert.equal(navigation.overview.label, "Results");
	assert.equal(navigation.locationHub.label, "Results");
});

test("route layer navigation falls back to generic coverage labels when no guide or nationwide context is active", () => {
	const navigation = buildRouteLayerNavigation({
		hasNationwideResultContext: false,
		hasPublishedGuideContext: false
	});

	assert.equal(navigation.openLayer.label, "Open coverage profile");
	assert.equal(navigation.openLayer.to, "/coverage");
	assert.equal(navigation.backToLayer.label, "Back to coverage profile");
	assert.equal(navigation.layerBreadcrumb.label, "Coverage profile");
	assert.equal(navigation.overview.label, "Coverage profile");
	assert.equal(navigation.locationHub.label, "Coverage profile");
});
