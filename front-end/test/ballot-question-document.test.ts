import type { PublicBallotQuestion, StateRecordsResponse } from "../src/types/civic.js";
import assert from "node:assert/strict";
import test from "node:test";
import { ballotQuestionDocument } from "../src/utils/ballot-question-document.js";

const source = { url: "https://example.test/index", documentLinks: [{ url: "https://example.test/general.pdf" }, { url: "https://example.test/school.pdf" }] } as StateRecordsResponse["source"];
const question = { pages: [2] } as PublicBallotQuestion;
test("ballot questions cite their own offered publication rather than the first PDF", () => {
	assert.equal(ballotQuestionDocument(source, question), "https://example.test/general.pdf#page=2");
	assert.equal(ballotQuestionDocument(source, { ...question, pages: [1], sourceUrl: source.documentLinks![1]!.url }), "https://example.test/school.pdf#page=1");
	assert.equal(ballotQuestionDocument(source, { ...question, sourceUrl: "https://other.test/injected.pdf" }), source.url);
});
test("question citations retain publisher-specific page anchors and absent-state behavior", () => {
	assert.equal(ballotQuestionDocument({ ...source, documentLinks: [{ url: source.documentLinks![0]!.url, pageAnchor: "page-" }] }, question), "https://example.test/general.pdf#page-2");
	assert.equal(ballotQuestionDocument(undefined, question), undefined);
	assert.equal(ballotQuestionDocument(source, undefined), undefined);
});
