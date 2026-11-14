import type { StateBallotQuestion } from "../src/state-ballot-questions.js";
import type { StateBallotSource } from "../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import test from "node:test";
import { publishedBallotQuestionArea } from "../src/public-ballot-question-area.js";

const source: Pick<StateBallotSource, "stateCode" | "format"> = { stateCode: "GA", format: "fulton-pdf" };
const question = (title: string, officialText: string): StateBallotQuestion => ({ id: "a".repeat(24), audience: "Fulton County consolidated sample ballot", title, officialText, choices: ["Yes", "No"], pages: [3], explicitlyAdvisory: false, voterApplicabilityVerified: false });

test("printed constitutional and county area names preserve exact source evidence without changing records", () => {
	for (const item of [question("Synthetic amendment (House Resolution 12)", "Shall the Constitution of Georgia be amended in the stated way?"), question("Education tax", "Shall a majority of the qualified voters residing in Fulton County approve the described debt?")]) {
		const before = structuredClone(item);
		const area = publishedBallotQuestionArea(source, item)!;
		assert.equal(area.name, item.title.startsWith("Synthetic") ? "Georgia" : "Fulton County");
		assert.equal(area.basis, "printed-question");
		assert.ok(item.officialText.includes(area.evidence));
		assert.deepEqual(item, before);
		assert.equal(item.voterApplicabilityVerified, false);
	}
});

test("printed partial-county areas retain the named municipality exclusion across compatible future wording", () => {
	for (const city of ["Atlanta", "Example Town"]) {
		const item = question("Transportation tax", `Shall a tax be imposed in that part of Fulton County, Georgia, outside of the City of ${city}, for five years?`);
		const area = publishedBallotQuestionArea(source, item)!;
		assert.equal(area.kind, "county-area");
		assert.equal(area.name, `Fulton County outside ${city}`);
		assert.deepEqual(area.excludedMunicipalities, [city]);
		assert.ok(item.officialText.includes(area.evidence));
	}
});

test("printed city areas require concordant title and body names and keep tax beneficiaries separate from voters", () => {
	const authority = question("City of Example Town Redevelopment Powers", "Shall the Act be approved which authorizes the City of Example Town, Georgia, to exercise redevelopment powers?");
	assert.equal(publishedBallotQuestionArea(source, authority)!.name, "Example Town");
	const residence = question("City of Example Town Tax Exemption", "Shall persons age 65 who are a resident of Example Town, Georgia who own and occupy as a primary residence a home situated in the City of Example Town qualify for the exemption?");
	const area = publishedBallotQuestionArea(source, residence)!;
	assert.equal(area.kind, "city");
	assert.equal(area.name, "Example Town");
	assert.equal(residence.voterApplicabilityVerified, false);
	assert.equal("age" in area, false);
	assert.equal(publishedBallotQuestionArea(source, { ...authority, title: "City of Another Town Redevelopment Powers" }), undefined);
	assert.equal(publishedBallotQuestionArea(source, { ...residence, officialText: residence.officialText.replace("City of Example Town qualify", "City of Another Town qualify") }), undefined);
});

test("unrecognized or conflicting areas and other source families retain the original audience fallback", () => {
	const state = question("Synthetic amendment (House Resolution 12)", "Shall the Constitution of Georgia be amended in the stated way?");
	for (const changed of [{ ...state, audience: "Different sample" }, { ...state, textKind: "notice" as const }, { ...state, title: "Unknown question type" }, { ...state, officialText: `${state.officialText} A majority of the qualified voters residing in Fulton County are also described.` }, question("Transportation tax", "Shall a tax be imposed in that part of Fulton County, Georgia, outside of the City of Atlanta and Example Town, for five years?"), question("Local tax", "Shall a tax be imposed in a locality mentioned elsewhere?")]) assert.equal(publishedBallotQuestionArea(source, changed), undefined);
	assert.equal(publishedBallotQuestionArea({ ...source, stateCode: "AL" }, state), undefined);
	assert.equal(publishedBallotQuestionArea({ ...source, format: "csv" }, state), undefined);
});
