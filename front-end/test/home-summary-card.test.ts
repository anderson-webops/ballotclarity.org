import assert from "node:assert/strict";
import test from "node:test";
import { interactiveHomeSummaryCardClass } from "../src/utils/home-summary-card.ts";

test("homepage nationwide summary cards keep a dark-mode-safe hover and focus state", () => {
	assert.match(interactiveHomeSummaryCardClass, /\bdark:hover:bg-app-panel-dark\/95\b/);
	assert.match(interactiveHomeSummaryCardClass, /\bdark:focus-visible:bg-app-panel-dark\/95\b/);
	assert.match(interactiveHomeSummaryCardClass, /\bdark:hover:border-app-line-dark\b/);
	assert.match(interactiveHomeSummaryCardClass, /\bdark:focus-visible:border-app-line-dark\b/);
	assert.match(interactiveHomeSummaryCardClass, /\bfocus-ring\b/);
});
