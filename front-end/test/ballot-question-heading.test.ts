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

test("printed initiative headings show the distinguishing topic and proposition identifier", () => {
	assert.deepEqual(ballotQuestionHeading("Proposition 1: A CITIZENS’ INITIATIVE PROPOSITION ESTABLISHING MAXIMUM ALLOWABLE TAX REVENUES", "Fairbanks North Star Borough"), { title: "Establishing maximum allowable tax revenues", reference: "Proposition 1" });
	assert.deepEqual(ballotQuestionHeading("Proposition 2: A CITIZENS’ INITIATIVE PROPOSITION CHANGING THE DATE OF THE FAIRBANKS NORTH STAR BOROUGH REGULAR MUNICIPAL ELECTION AND MAKING RELATED CHANGES", "Fairbanks North Star Borough"), { title: "Changing the date of the Fairbanks North Star Borough regular municipal election and making related changes", reference: "Proposition 2" });
});

test("initiative headings preserve the printed municipal name and omit their repeated introductory clause", () => {
	assert.deepEqual(ballotQuestionHeading("Proposition A: A CITIZENS’ INITIATIVE PROPOSITION THAT MOVES THE CITY OF NORTH POLE MUNICIPAL ELECTION.", "City of North Pole"), { title: "Moves the City of North Pole municipal election.", reference: "Proposition A" });
	assert.deepEqual(ballotQuestionHeading("Proposition B: A CITIZENS' INITIATIVE PROPOSITION ESTABLISHING CITY OF FAIRBANKS ELECTION RULES", "City of Fairbanks"), { title: "Establishing City of Fairbanks election rules", reference: "Proposition B" });
});
