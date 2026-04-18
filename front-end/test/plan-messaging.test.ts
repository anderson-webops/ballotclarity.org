import assert from "node:assert/strict";
import test from "node:test";
import {
	buildPlanUnavailableMessaging,
	missingGuideContextBody,
	nationwideOnlyGuideBody,
	planRequiresPublishedGuideTitle
} from "../src/utils/plan-messaging.ts";

const oldPlanUnavailableTitle = "Ballot plan unavailable";
const oldGuideFirstBody = "The plan page needs a ballot context. Open a published local guide first so Ballot Clarity can load the current election and location.";

test("plan messaging keeps nationwide-only lookup results in a guide-only success state", () => {
	const message = buildPlanUnavailableMessaging({
		guideAvailability: "not-published",
		result: "resolved"
	});

	assert.equal(message.title, planRequiresPublishedGuideTitle);
	assert.equal(message.body, nationwideOnlyGuideBody);
	assert.equal(message.tone, "info");
	assert.notEqual(message.title, oldPlanUnavailableTitle);
	assert.notEqual(message.body, oldGuideFirstBody);
});

test("plan messaging uses permanent missing-guide copy when guide context is absent", () => {
	const message = buildPlanUnavailableMessaging(null);

	assert.equal(message.title, planRequiresPublishedGuideTitle);
	assert.equal(message.body, missingGuideContextBody);
	assert.equal(message.tone, "info");
	assert.notEqual(message.title, oldPlanUnavailableTitle);
	assert.notEqual(message.body, oldGuideFirstBody);
});

test("plan messaging does not fall back to the old guide-first text even with published guide context", () => {
	const message = buildPlanUnavailableMessaging({
		guideAvailability: "published",
		result: "resolved"
	});

	assert.equal(message.title, planRequiresPublishedGuideTitle);
	assert.equal(message.body, missingGuideContextBody);
	assert.equal(message.tone, "warning");
	assert.notEqual(message.title, oldPlanUnavailableTitle);
	assert.notEqual(message.body, oldGuideFirstBody);
});
