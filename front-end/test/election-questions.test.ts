import type { PublicBallotQuestion, StateQuestionsResponse } from "../src/types/civic.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { groupBallotQuestions } from "../src/utils/ballot-question-groups.js";
import { electionQuestions } from "../src/utils/election-questions.js";

const question = (id: string, audience: string): PublicBallotQuestion => ({ id, audience, title: `Question ${id}`, officialText: "Shall this question be decided?", choices: ["Yes", "No"], pages: [1], explicitlyAdvisory: false, voterApplicabilityVerified: false });
const source = { stateCode: "GA", sourceId: "ga-fulton-2026" };
const response: StateQuestionsResponse = { available: true, source: { stateCode: "GA", stateName: "Georgia", id: source.sourceId, configured: true, electionDate: "2026-11-03" }, questions: [question("first", "Fulton County")] };

test("question groups preserve exact audience distinctions, source order and original records", () => {
	const questions = [question("first", "To the Voters of the City of Example:"), question("second", "Example School District"), question("third", "To the Voters of the City of Example:")];
	const groups = groupBallotQuestions(questions);
	assert.deepEqual(groups.map(group => group.label), ["City of Example", "Example School District"]);
	assert.deepEqual(groups.map(group => group.questions.map(item => item.id)), [["first", "third"], ["second"]]);
	assert.equal(groups[0]!.questions[0], questions[0]);
	assert.equal(groups[0]!.audience, questions[0]!.audience);
	assert.equal(groups[1]!.questions[0]!.voterApplicabilityVerified, false);
	assert.deepEqual(groupBallotQuestions([]), []);
});

test("election questions require the exact selected state, source and election date", () => {
	assert.equal(electionQuestions(response, source, "2026-11-03"), response.questions);
	for (const changed of [{ ...response, available: false }, { ...response, source: { ...response.source, stateCode: "WA" } }, { ...response, source: { ...response.source, id: "other-source" } }, { ...response, source: { ...response.source, electionDate: "2028-11-07" } }])
		assert.deepEqual(electionQuestions(changed, source, "2026-11-03"), []);
	assert.deepEqual(electionQuestions(null, source, "2026-11-03"), []);
});

test("future elections reuse the selected source without inferring personal applicability or notice choices", () => {
	const notice = { ...question("future", "Future Town"), textKind: "notice" as const, choices: [] as [] };
	const future: StateQuestionsResponse = { available: true, source: { ...response.source, id: "future-source", electionDate: "2030-11-05", questionKind: "notice" }, questions: [notice] };
	assert.deepEqual(electionQuestions(future, { ...source, sourceId: "future-source" }, "2030-11-05"), [notice]);
	assert.deepEqual(notice.choices, []);
	assert.equal(notice.voterApplicabilityVerified, false);
});

test("overview questions use source-bound detail pages and native section links without empty headings", () => {
	const component = readFileSync(new URL("../src/components/ElectionBallotQuestions.vue", import.meta.url), "utf8");
	const overview = readFileSync(new URL("../src/pages/elections/[slug].vue", import.meta.url), "utf8");
	const list = readFileSync(new URL("../src/components/BallotQuestionList.vue", import.meta.url), "utf8");
	assert.match(component, /v-if="error \|\| questions.length"/u);
	assert.match(component, /id="election-questions-heading" tabindex="-1"/u);
	assert.match(component, /watch\(\[mounted, sections\]/u);
	assert.match(component, /Election notices/u);
	assert.doesNotMatch(component + list, /watchEffect|No questions|personalized|target=|<details/u);
	assert.match(overview, /<ElectionBallotQuestions[^>]+@sections="questionSections = \$event"/u);
	assert(overview.indexOf("...questionSections.value") < overview.indexOf("candidateSections.value.slice(1)"));
	assert.match(list, /path: `\/question\/\$\{state\}\/\$\{question.id\}`, query: \{ source \}/u);
	assert.doesNotMatch(list, /officialText|<button/u);
});
