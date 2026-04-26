import assert from "node:assert/strict";
import test from "node:test";
import { lookupAllowsGuideEntryPoints, lookupBlocksGuideEntryPoints } from "../src/utils/guide-entry.ts";

test("guide entry stays available when there is no lookup override or a published guide exists", () => {
	assert.equal(lookupAllowsGuideEntryPoints(null), true);
	assert.equal(lookupAllowsGuideEntryPoints({
		guideAvailability: "published",
		hasPublishedGuideShell: true,
		hasVerifiedContestPackage: true,
		result: "resolved"
	}), true);
	assert.equal(lookupBlocksGuideEntryPoints({
		guideAvailability: "published",
		hasPublishedGuideShell: true,
		hasVerifiedContestPackage: true,
		result: "resolved"
	}), false);
});

test("guide entry stays blocked when only the election overview is published", () => {
	assert.equal(lookupBlocksGuideEntryPoints({
		guideAvailability: "published",
		hasPublishedGuideShell: true,
		hasVerifiedContestPackage: false,
		result: "resolved"
	}), true);
	assert.equal(lookupAllowsGuideEntryPoints({
		guideAvailability: "published",
		hasPublishedGuideShell: true,
		hasVerifiedContestPackage: false,
		result: "resolved"
	}), false);
});

test("guide entry is blocked after nationwide-only or unsupported lookup results", () => {
	assert.equal(lookupBlocksGuideEntryPoints({
		guideAvailability: "not-published",
		result: "resolved"
	}), true);
	assert.equal(lookupAllowsGuideEntryPoints({
		guideAvailability: "not-published",
		result: "resolved"
	}), false);
	assert.equal(lookupBlocksGuideEntryPoints({
		result: "unsupported"
	}), true);
});
