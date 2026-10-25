import type { Measure, Source } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { hasLongMeasureOptions, measureBallotOptions, measureCardSummary, measureContent, measureDecisionLabel, measureDetailPath, measureGuideLink } from "../src/utils/measure-content.ts";

test("measure cards prefer the concise summary over detail-page explanations", () => {
	assert.equal(measureCardSummary({ summary: "A grocery-tax proposal.", plainLanguageExplanation: "A longer explanation of amendment requirements." }), "A grocery-tax proposal.");
});

test("measure cards retain an explanation only when no summary is available", () => {
	assert.equal(measureCardSummary({ summary: " \n", plainLanguageExplanation: " Available explanation. " }), "Available explanation.");
	assert.equal(measureCardSummary({ summary: " ", plainLanguageExplanation: " " }), "");
});

test("saved measure plans leave detail explanations on linked detail pages", () => {
	const plan = readFileSync(new URL("../src/pages/plan.vue", import.meta.url), "utf8");
	assert.doesNotMatch(plan, /summary: measure\.plainLanguageExplanation/u);
	assert.match(plan, /href: measureDetailPath\(measure, data\.value\?\.election\.slug\)/u);
	assert.match(plan, /<p\s+v-if="entry\.summary"/u);
});

test("printed ballots use concise summaries and the actual ballot labels for both effects", () => {
	const ballot = readFileSync(new URL("../src/pages/ballot/[slug].vue", import.meta.url), "utf8");
	assert.match(ballot, /<p v-if="measureCardSummary\(measure\)" class="mt-2">\s*\{\{ measureCardSummary\(measure\) \}\}/u);
	assert.doesNotMatch(ballot, /\{\{ measure\.plainLanguageExplanation \}\}/u);
	assert.match(ballot, /<strong>\{\{ measureBallotOptions\(measure\)\.yes \}\}:<\/strong> \{\{ measure\.yesMeaning \}\}/u);
	assert.match(ballot, /<strong>\{\{ measureBallotOptions\(measure\)\.no \}\}:<\/strong> \{\{ measure\.noMeaning \}\}/u);
	assert.doesNotMatch(ballot, /<strong>(?:YES|NO):<\/strong>/u);
});

test("printed ballots retain one election heading and omit redundant generic jurisdiction text", () => {
	const ballot = readFileSync(new URL("../src/pages/ballot/[slug].vue", import.meta.url), "utf8");
	assert.match(ballot, /<ElectionHero[\s\S]*?:coverage-limits="data\.coverageLimits"/u);
	assert.doesNotMatch(ballot, /print-guide-header|Ballot Clarity print guide|\{\{ data\.election\.name \}\}/u);
	assert.match(ballot, /v-if="contest\.jurisdiction !== 'Ballot measure'"/u);
});

test("inherited measure links bind an explicit ballot context without changing canonical links", () => {
	const measure = { slug: "state-measure", electionSlug: "state-election" };
	assert.equal(measureDetailPath(measure, "county-election"), "/measure/state-measure?election=county-election");
	assert.equal(measureDetailPath(measure, "state-election"), "/measure/state-measure");
	assert.equal(measureDetailPath(measure), "/measure/state-measure");
	assert.equal(measureDetailPath({ slug: "path/fragment" }, "county-election"), "/measure/path%2Ffragment");
	assert.equal(measure.electionSlug, "state-election");
});

test("long printed binary labels remain intact while navigation uses a short operational heading", () => {
	const measure = { ...fixture(), ballotOptions: { yes: "For general obligation bonds", no: "Against general obligation bonds" } };
	assert.equal(hasLongMeasureOptions(measure), true);
	assert.equal(hasLongMeasureOptions(fixture()), false);
	assert.deepEqual(measureBallotOptions(measure), measure.ballotOptions);
	assert.equal(measureContent(measure).sections.find(section => section.href === "#outcomes")?.label, "Vote options");
	assert.equal(measureDecisionLabel(measure, "no"), "Marked Against general obligation bonds");
});

test("Maryland's full printed labels stay readable without collapsing their vote qualifiers", () => {
	for (const subject of ["the Constitutional Amendment", "Charter Amendment", "the Charter Amendment", "Bond Issue", "the Referred Law"]) {
		const measure = { ...fixture(), ballotOptions: { yes: `For ${subject}`, no: `Against ${subject}` } };
		assert.deepEqual(measureBallotOptions(measure), measure.ballotOptions);
		assert.equal(measureDecisionLabel(measure, "no"), `Marked Against ${subject}`);
		assert.equal(hasLongMeasureOptions(measure), true);
	}
});

test("Florida's reviewed qualifiers remain visible in choices and saved decisions", () => {
	const pairs = [
		{ yes: "Yes - For the ½ Cent Sales Tax", no: "No - Against the ½ Cent Sales Tax", long: true },
		{ yes: "Yes - For Renewal Of Millage", no: "No - Against Renewal Of Millage", long: true },
		{ yes: "Yes - For the Renewal of the Half-Cent Sales Tax", no: "No - Against the Renewal of the Half-Cent Sales Tax", long: true },
		{ yes: "Yes - In Favor", no: "No - Opposed", long: false },
		{ yes: "Yes - For Approval", no: "No - For Rejection", long: true },
		{ yes: "Yes - For Bonds", no: "No - Against Bonds", long: true },
	];
	for (const pair of pairs) {
		const measure = { ...fixture(), ballotOptions: { yes: pair.yes, no: pair.no } };
		assert.deepEqual(measureBallotOptions(measure), measure.ballotOptions);
		assert.equal(hasLongMeasureOptions(measure), pair.long);
		assert.equal(measureDecisionLabel(measure, "yes"), `Marked ${pair.yes}`);
		assert.equal(measureDecisionLabel(measure, "no"), `Marked ${pair.no}`);
		if (pair.long) assert.equal(measureContent(measure).sections.find(section => section.href === "#outcomes")?.label, "Vote options");
	}
});

function fixture(): Measure {
	return {
		slug: "test-measure",
		title: "Test measure",
		contestSlug: "test-question",
		location: "Test state",
		summary: "A sourced proposal.",
		ballotSummary: "",
		plainLanguageExplanation: "",
		currentLawOverview: "",
		currentPractice: [],
		proposedChanges: [],
		yesMeaning: "Approve the proposal.",
		noMeaning: "Reject the proposal.",
		yesHighlights: [],
		noHighlights: [],
		fiscalContextNote: "",
		implementationOverview: "",
		implementationTimeline: [],
		fiscalSummary: [],
		potentialImpacts: [],
		supportArguments: [],
		opposeArguments: [],
		argumentsDisclaimer: "",
		argumentsAndConsiderations: [],
		whatWeKnow: [],
		whatWeDoNotKnow: [],
		sources: [],
		updatedAt: "2026-10-23T00:00:00Z",
		freshness: { contentLastVerifiedAt: "2026-10-23T00:00:00Z", nextReviewAt: "2026-10-24T00:00:00Z", status: "incomplete", statusLabel: "Partial record", statusNote: "" },
	};
}

test("printed ballot labels drive navigation and saved-choice labels", () => {
	for (const ballotOptions of [{ yes: "For", no: "Against" }, { yes: "Approve", no: "Reject" }, { yes: "YES/FOR", no: "NO/AGAINST" }, { yes: "For the Measure", no: "Against the Measure" }]) {
		const measure = { ...fixture(), ballotOptions };
		assert.deepEqual(measureBallotOptions(measure), ballotOptions);
		assert.equal(measureContent(measure).sections.find(section => section.href === "#outcomes")?.label, ballotOptions.yes === "For the Measure" ? "Vote options" : `${ballotOptions.yes} / ${ballotOptions.no}`);
		assert.equal(measureDecisionLabel(measure, "yes"), `Marked ${ballotOptions.yes}`);
		assert.equal(measureDecisionLabel(measure, "no"), `Marked ${ballotOptions.no}`);
		assert.equal(measureDecisionLabel(measure, "review"), "Marked for review");
	}
});

test("legacy measures retain Yes/No controls and saved-choice labels", () => {
	assert.deepEqual(measureBallotOptions(null), { yes: "Yes", no: "No" });
	assert.equal(measureDecisionLabel(fixture(), "yes"), "Marked YES");
	assert.equal(measureDecisionLabel(fixture(), "no"), "Marked NO");
});

test("measure guide links use explicit parent context rather than a saved location", () => {
	assert.deepEqual(measureGuideLink({ electionSlug: "id-statewide-measures-2026-11-03" }), { label: "Ballot guide", to: "/ballot/id-statewide-measures-2026-11-03" });
	assert.deepEqual(measureGuideLink({ electionSlug: "nd-statewide-measures-2026-11-03" }), { label: "Ballot guide", to: "/ballot/nd-statewide-measures-2026-11-03" });
});

test("legacy or missing measure parent context leaves the existing fallback available", () => {
	for (const measure of [undefined, null, {}, { electionSlug: "" }, { electionSlug: "  " }]) assert.equal(measureGuideLink(measure), null);
});

test("measure parent paths encode the slug without modifying the source record", () => {
	const measure = { electionSlug: "id/2026?mode=x#view" };
	assert.equal(measureGuideLink(measure)?.to, "/ballot/id%2F2026%3Fmode%3Dx%23view");
	assert.equal(measure.electionSlug, "id/2026?mode=x#view");
});

test("measure navigation includes only populated sections, without invented arguments or timelines", () => {
	assert.deepEqual(measureContent(null).sections, []);
	assert.deepEqual(measureContent(fixture()).sections.map(section => section.href), ["#outcomes", "#sources"]);
	const measure = fixture();
	measure.implementationOverview = "  ";
	measure.fiscalContextNote = "\n";
	assert.deepEqual(measureContent(measure).sections.map(section => section.href), ["#outcomes", "#sources"]);
});

test("repeated summaries are omitted while distinct substantive text is preserved", () => {
	const measure = fixture();
	measure.ballotSummary = " A SOURCED   proposal! ";
	measure.plainLanguageExplanation = "A different, sourced explanation.";
	assert.deepEqual(measureContent(measure).summaries, [{ title: "Explanation", text: measure.plainLanguageExplanation }]);
	measure.ballotSummary = "Official question text.";
	measure.plainLanguageExplanation = "Official question text";
	assert.deepEqual(measureContent(measure).summaries, [{ title: "Official ballot summary", text: measure.ballotSummary }]);
});

test("baseline labels reflect available current-law and proposal content", () => {
	const measure = fixture();
	measure.proposedChanges = [{ id: "change", text: "Sourced change.", sources: [] }];
	assert.equal(measureContent(measure).sections.find(section => section.href === "#baseline")?.label, "Proposed changes");
	measure.currentPractice = [{ id: "baseline", text: "Sourced current rule.", sources: [] }];
	assert.equal(measureContent(measure).sections.find(section => section.href === "#baseline")?.label, "Current law and changes");
	measure.proposedChanges = [];
	assert.equal(measureContent(measure).sections.find(section => section.href === "#baseline")?.label, "Current law");
});

test("one-sided sourced arguments remain explicitly partial without invented opposition", () => {
	const measure = fixture();
	measure.supportArguments = [{ id: "support", title: "Attributed view", summary: "A sourced argument.", attribution: "Proponent", sources: [] }];
	assert.ok(measureContent(measure).sections.some(section => section.href === "#arguments"));
	assert.deepEqual(measure.opposeArguments, []);
});

test("section links follow the visible limitations, outcomes and explanation order", () => {
	const measure = fixture();
	measure.whatWeDoNotKnow = [{ id: "limit", text: "A material source conflict.", sources: [] }];
	measure.plainLanguageExplanation = "Distinct explanation.";
	assert.deepEqual(measureContent(measure).sections.map(section => section.href), ["#limitations", "#outcomes", "#at-a-glance", "#sources"]);
});

test("fiscal estimates precede their limitations and longer explanatory sections", () => {
	const measure = fixture();
	measure.fiscalSummary = [{ id: "cost", label: "Projection", value: "A range", scope: "State", horizon: "Two years", note: "", sources: [] }];
	measure.whatWeDoNotKnow = [{ id: "scope", text: "A limited projection, not a net total.", sources: [] }];
	measure.plainLanguageExplanation = "Distinct explanation.";
	assert.deepEqual(measureContent(measure).sections.map(section => section.href), ["#fiscal", "#limitations", "#outcomes", "#at-a-glance", "#sources"]);
});

test("all nested citations remain accessible in one deduplicated source list", () => {
	const measure = fixture();
	const source = (id: string): Source => ({ id, title: id, publisher: "Official publisher", authority: "official-government", sourceSystem: "Test", type: "official record", date: "", url: `https://www.sos.nd.gov/${id}` });
	measure.sources = [source("top")];
	measure.currentPractice = [{ id: "baseline", text: "Baseline.", sources: [source("baseline"), source("top")] }];
	measure.proposedChanges = [{ id: "proposal", text: "Change.", sources: [source("proposal")] }];
	measure.implementationTimeline = [{ id: "start", label: "Start", timing: "Relative date", summary: "", sources: [source("timeline")] }];
	measure.fiscalSummary = [{ id: "cost", label: "Cost", value: "Estimate", scope: "State", horizon: "Two years", note: "", sources: [source("fiscal")] }];
	measure.potentialImpacts = [{ id: "impact", title: "Effect", summary: "Effect.", sources: [source("impact")] }];
	measure.supportArguments = [{ id: "support", title: "For", summary: "Attributed argument.", attribution: "Proponent", sources: [source("support")] }];
	measure.opposeArguments = [{ id: "oppose", title: "Against", summary: "Attributed argument.", attribution: "Opponent", sources: [source("oppose")] }];
	measure.argumentsAndConsiderations = [{ id: "consideration", title: "Consideration", summary: "Consideration.", sources: [source("consideration")] }];
	measure.whatWeKnow = [{ id: "known", text: "Evidence.", sources: [source("known")] }];
	measure.whatWeDoNotKnow = [{ id: "unknown", text: "Source disagreement.", sources: [source("unknown")] }];
	assert.deepEqual(measureContent(measure).sources.map(item => item.id), ["top", "baseline", "proposal", "timeline", "fiscal", "impact", "support", "oppose", "consideration", "known", "unknown"]);
	assert.ok(measureContent(measure).sections.some(section => section.href === "#limitations"));
	assert.ok(measureContent(measure).sections.some(section => section.href === "#arguments"));
});
