import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("government judicial findings stay attributed, visible and separate from vote controls", () => {
	const component = readFileSync(new URL("../src/components/OfficialJudicialEvaluation.vue", import.meta.url), "utf8");
	assert.match(component, /\{\{ evaluation\.issuer \}\} evaluation/u);
	assert.match(component, /No recommendation or institutional performance finding\./u);
	assert.match(component, /Recommends against retention\./u);
	assert.match(component, /evaluation\.criteriaCited\.join/u);
	assert.match(component, /:href="evaluation\.source\.url"/u);
	assert.match(component, /:datetime="evaluation\.publicationDate"/u);
	assert.doesNotMatch(component, /Vote Yes|Vote No|aria-pressed|<details|<summary|collapsible|text-red/u);
});

test("judicial detail uses the exact official ID and source without changing summary rows", () => {
	const page = readFileSync(new URL("../src/pages/record/[state]/[id].vue", import.meta.url), "utf8");
	assert.match(page, /\/judicial-evaluations\/\$\{stateCode\.value\}\/\$\{record\.id\}/u);
	assert.match(page, /query: \{ source: source\.id \}/u);
	assert.match(page, /<OfficialJudicialEvaluation v-if="evaluation"/u);
	assert.match(page, /error\.statusCode === 404\) return null/u);
	assert.match(page, /v-else-if="evaluationError" role="status"/u);
	const directory = readFileSync(new URL("../src/pages/records.vue", import.meta.url), "utf8");
	assert.doesNotMatch(directory, /OfficialJudicialEvaluation|Recommends retention|Recommends against retention/u);
});
