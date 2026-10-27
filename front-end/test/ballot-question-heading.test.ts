import assert from "node:assert/strict";
import test from "node:test";
import { ballotQuestionHeading } from "../src/utils/ballot-question-heading.js";

test("question headings separate printed question and resolution identifiers without rewriting the topic", () => {
	assert.deepEqual(ballotQuestionHeading("1. Increases the qualifying acreage. (House Resolution 32)"), { title: "Increases the qualifying acreage.", reference: "Question 1 · House Resolution 32" });
	assert.deepEqual(ballotQuestionHeading("12. Preserves the published future topic. (House Resolution 9876)"), { title: "Preserves the published future topic.", reference: "Question 12 · House Resolution 9876" });
});

test("other states and local question headings retain their exact identity", () => {
	for (const title of ["City of Palmetto Ad Valorem Tax Exemption", "Question 1", "Proposition 2", "Charter Amendment 4", "House Resolution 32", "1. Unknown citation (Other Resolution 32)"])
		assert.deepEqual(ballotQuestionHeading(title), { title, reference: "" });
});
