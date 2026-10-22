import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const measurePage = readFileSync(new URL("../src/pages/measure/[slug].vue", import.meta.url), "utf8");
const recordsPage = readFileSync(new URL("../src/pages/records.vue", import.meta.url), "utf8");
const measureList = readFileSync(new URL("../src/components/StateMeasureReferences.vue", import.meta.url), "utf8");

test("voter-guide measures skip the ballot plan control and return to their state list", () => {
	assert.match(measurePage, /<div v-if="measure\.contestSlug" class="measure-decision"/);
	assert.match(measurePage, /\/records\?state=\$\{measure\.value\.slug\.slice\(0, 2\)\.toUpperCase\(\)\}#state-measures-heading/);
	assert.match(measurePage, /:to="backLink\.to"/);
});

test("measure sections without content are not rendered or linked", () => {
	assert.match(measurePage, /v-if="measure\.implementationOverview \|\| measure\.implementationTimeline\.length"/);
	assert.match(measurePage, /implementationTimeline\.length \? \[\{ href: "#implementation"/);
	assert.match(measurePage, /<article v-if="measure\.currentPractice\.length" class="content-block">/);
	assert.match(measurePage, /v-if="measure\.whatWeKnow\.length \|\| measure\.whatWeDoNotKnow\.length"/);
});

test("records page lists a state's measures with the official source", () => {
	assert.match(recordsPage, /<StateMeasureReferences v-if="filters\.stateCode" :data="measureData" \/>/);
	assert.match(measureList, /id="state-measures-heading"/);
	assert.match(measureList, /:to="`\/measure\/\$\{measure\.slug\}`"/);
	assert.match(measureList, /data\.source\.publisher/);
});
