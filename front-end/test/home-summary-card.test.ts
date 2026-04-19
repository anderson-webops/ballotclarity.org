import assert from "node:assert/strict";
import test from "node:test";
import { interactiveHomeSummaryCardClass } from "../src/utils/home-summary-card.ts";

test("homepage nationwide summary cards keep a dark-mode-safe hover and focus state", () => {
	assert.match(interactiveHomeSummaryCardClass, /\bhome-summary-card-link\b/);
	assert.match(interactiveHomeSummaryCardClass, /\bfocus-ring\b/);
});
