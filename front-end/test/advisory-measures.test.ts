import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { measureDecisionEffectLabel } from "../src/utils/measure-content";

test("only explicit advisory metadata adds a non-binding label", () => {
	assert.equal(measureDecisionEffectLabel({}), "");
	assert.equal(measureDecisionEffectLabel({ decisionEffect: "advisory" }), "Non-binding advisory vote");
});

test("advisory status remains visible in cards, details and printed-plan supporting text without a disclosure control", () => {
	for (const path of ["components/MeasureCard.vue", "pages/measure/[slug].vue", "pages/plan.vue"]) {
		const body = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
		assert.match(body, /measureDecisionEffectLabel\(measure\)/u);
		assert.doesNotMatch(body, /<(?:details|summary)\b/u);
	}
	assert.match(readFileSync(new URL("../src/pages/measure/[slug].vue", import.meta.url), "utf8"), /jsonLd: measure\.value && measure\.value\.decisionEffect !== "advisory"/u);
});
