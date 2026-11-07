import assert from "node:assert/strict";
import test from "node:test";
import { ballotQuestionParagraphs } from "../src/utils/ballot-question-paragraphs.js";

test("official question, effects and fiscal statements remain intact in separate paragraphs", () => {
	const text = "Published summary. Question: Shall the proposal pass? A YES vote supports the proposal. A NO vote retains current law. Funding Source Statement: Published funding. Fiscal Impact Statement: Published estimate.";
	const paragraphs = ballotQuestionParagraphs(text);
	assert.equal(paragraphs.length, 6);
	assert.equal(paragraphs.join(""), text);
});
test("native disclosure lines, existing paragraphs and empty states retain their structure", () => {
	const text = "Purpose Amount\nSchool staff $2,680,000\nSafety $65,000";
	assert.deepEqual(ballotQuestionParagraphs(text), [text]);
	assert.deepEqual(ballotQuestionParagraphs("Official question.\n\nOfficial effects."), ["Official question.", "Official effects."]);
	assert.deepEqual(ballotQuestionParagraphs(""), []);
});
