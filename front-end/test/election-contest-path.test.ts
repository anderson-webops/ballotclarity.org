import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { electionContestPath } from "../src/utils/election-contest-path.ts";

test("single-question overview links open the measure with its viewed election context", () => {
	const contest = { slug: "rent-question", type: "measure" as const, measures: [{ slug: "rent-increases" }] } as Parameters<typeof electionContestPath>[0];
	assert.equal(electionContestPath(contest, "elizabeth-2030"), "/measure/rent-increases?election=elizabeth-2030");
	assert.equal(electionContestPath(contest, "other-local-guide"), "/measure/rent-increases?election=other-local-guide");
	assert.equal(electionContestPath({ ...contest, measures: [{ ...contest.measures![0]!, slug: "question/one" }] }, "guide&one"), "/measure/question%2Fone?election=guide%26one");
});

test("candidate, empty and multi-question contests keep their full contest page", () => {
	assert.equal(electionContestPath({ slug: "city-council", type: "candidate" }, "city-2030"), "/contest/city-council");
	assert.equal(electionContestPath({ slug: "questions", type: "measure", measures: [] }, "city-2030"), "/contest/questions");
	const measures = [{ slug: "one" }, { slug: "two" }] as NonNullable<Parameters<typeof electionContestPath>[0]["measures"]>;
	assert.equal(electionContestPath({ slug: "questions", type: "measure", measures }, "city-2030"), "/contest/questions");
});

test("the election overview uses the scope-aware ballot-item link", () => {
	const page = readFileSync(new URL("../src/pages/elections/[slug].vue", import.meta.url), "utf8");
	assert.match(page, /:to="electionContestPath\(contest, data\.election\.slug\)"/u);
});
