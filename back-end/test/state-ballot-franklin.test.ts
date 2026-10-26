import assert from "node:assert/strict";
import test from "node:test";
import { readFranklinCandidateDocuments } from "../src/state-ballot-franklin.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { franklinFixture as fixture, franklinFixtureRows as rows } from "./helpers/franklin-fixture.js";

const source = stateBallotSources.find(source => source.id === "oh-franklin-2026")!;
function parse(candidates: string, notice: string) {
	return readFranklinCandidateDocuments(source, candidates, notice, createStateCandidateRecord);
}

test("Franklin's synthetic PDF rows preserve joint tickets, write-ins, terms, parties and safe campaign links", () => {
	const { candidates, notice } = fixture();
	const result = parse(candidates, notice);
	assert.equal(result.records.length, 5);
	assert.equal(result.revision, "Revised October 16, 2026");
	assert.equal(result.records[0]!.name, "Alex One and Blair Two");
	assert.equal(result.records[0]!.candidateUrl, "https://www.alexexample.org/");
	assert.equal(result.records[1]!.party, "Other-party");
	assert.match(result.records[1]!.office, /unexpired term ending 1-3-2029/u);
	assert.equal(result.records[2]!.status, "write-in");
	assert.equal(result.records[2]!.sourceStatus, "Registered write-in in county FWAB notice");
	assert.equal(result.records[2]!.district, "15");
	assert.equal(result.records[3]!.sourceStatus, "Registered write-in");
	assert.equal(result.records[4]!.scope, "local");
	assert.equal(result.records[4]!.district, "");
	assert.equal(result.records[4]!.jurisdiction, "Ohio Court of Appeals, 10th District");
	assert.equal(result.records[4]!.party, undefined);
	assert.doesNotMatch(JSON.stringify(result), /private@example|555-555/u);
});

test("Franklin's continuation page does not discard its first candidate when column headings are not repeated", () => {
	const one = fixture();
	const continuation = fixture({ continuation: true });
	assert.deepEqual(parse(continuation.candidates, continuation.notice).records, parse(one.candidates, one.notice).records);
});

test("Franklin's synthetic later election is read from both source documents, not substituted into a current roster", () => {
	const { candidates, notice } = fixture({ year: 2028 });
	const future = { ...source, electionDate: "2028-11-07", id: "oh-franklin-general-2028-11-07" };
	assert.equal(readFranklinCandidateDocuments(future, candidates, notice, createStateCandidateRecord).records.length, 5);
	assert.throws(() => parse(candidates, notice), /election heading/u);
});

test("Franklin's differing name spelling needs exact reviewed election and office evidence", () => {
	const { candidates, notice } = fixture({ alias: true });
	assert.throws(() => parse(candidates, notice), /cannot be reconciled/u);
	const alias = { electionDate: "2026-11-03", name: "Emery Five", noticeName: "Emory Five", office: rows[3]!.office };
	const result = readFranklinCandidateDocuments(source, candidates, notice, createStateCandidateRecord, [alias]);
	assert.equal(result.records[3]!.name, "Emery Five");
	assert.equal(result.records[3]!.status, "write-in");
	for (const invalid of [{ ...alias, electionDate: "2028-11-07" }, { ...alias, office: "COUNTY AUDITOR" }, { ...alias, name: "Another Person" }])
		assert.throws(() => readFranklinCandidateDocuments(source, candidates, notice, createStateCandidateRecord, [invalid]), /spelling evidence|cannot be reconciled/u);
});

test("Franklin's question section cannot produce candidate write-ins", () => {
	const { candidates, notice } = fixture({ questionMarker: true });
	assert.equal(parse(candidates, notice).records.filter(record => record.status === "write-in").length, 2);
});

test("Franklin's complete notice inventory rejects an unmatched ordinary candidate as well as an unmatched write-in", () => {
	const { candidates, notice } = fixture();
	assert.throws(() => parse(candidates, notice.replace(">Alex<", ">Rory<")), /cannot be reconciled/u);
	assert.throws(() => parse(candidates, notice.replace(">Alex<", ">Alex Middle<")), /cannot be reconciled/u);
});

test("Franklin's explicit withdrawn notice entry stays separate and cannot override an active candidate", () => {
	const { candidates, notice } = fixture();
	const entry = "<word xMin=\"42.24\" xMax=\"155\" yMin=\"550\" yMax=\"559\">Taylor Former</word><word xMin=\"45\" xMax=\"100\" yMin=\"563\" yMax=\"572\">withdrawn</word>";
	const changed = notice.replace("</page>", `${entry}</page>`);
	const result = parse(candidates, changed);
	assert.equal(result.records.length, 5);
	assert.equal(result.noticeAudit.namedClaims, 6);
	assert.equal(result.noticeAudit.withdrawn[0]!.name, "Taylor Former");
	const marked = notice.replace("</page>", "<word xMin=\"45\" xMax=\"100\" yMin=\"413\" yMax=\"422\">withdrawn</word></page>");
	assert.throws(() => parse(candidates, marked), /withdrawal sources disagree/u);
});

test("Franklin's reader refuses unknown offices, parties, term dates and write-in states", () => {
	const { candidates, notice } = fixture();
	for (const body of [candidates.replace(">Democratic<", ">Unknown<"), candidates.replace(">02/09/2027<", ">02/31/2027<"), candidates.replace(">Yes<", ">Maybe<")])
		assert.throws(() => parse(body, notice));
	assert.throws(() => parse(candidates.replace("GOVERNOR", "UNKNOWN"), notice), /office requires review/u);
	assert.throws(() => parse(candidates.replace("October", "February").replace(">16,<", ">30,<"), notice), /revision/u);
});

test("Franklin's reader rejects missing or contradictory supplemental evidence", () => {
	const { candidates, notice } = fixture();
	assert.throws(() => parse(candidates, notice.replace("Other-party", "Republican")), /clipped/u);
	assert.throws(() => parse(candidates, notice.replace(/<word\b[^>]*>\(write-in\)<\/word>/gu, "")), /write-in sources disagree/u);
	assert.throws(() => parse(candidates, notice.replace("November", "October")), /FWAB election identity/u);
	assert.throws(() => parse(candidates, notice.replace("Drew", "Rory")), /cannot be reconciled/u);
	assert.throws(() => parse(candidates, notice.replace("Drew", "Drew Middle")), /cannot be reconciled/u);
});

test("Franklin's reader bounds geometry, input size, normalization and candidate identities", () => {
	const { candidates, notice } = fixture();
	assert.throws(() => parse(candidates.replace("width=\"792\"", "width=\"600\""), notice), /dimensions/u);
	assert.throws(() => parse(candidates.replace("xMin=\"52\"", "xMin=\"NaN\""), notice), /geometry/u);
	assert.throws(() => parse("x".repeat(4 * 1024 * 1024 + 1), notice), /bounds/u);
	assert.throws(() => parse("<div>".repeat(65) + candidates + "</div>".repeat(65), notice), /structure/u);
	assert.throws(() => readFranklinCandidateDocuments(source, candidates, notice, () => null), /normalization/u);
	assert.throws(() => readFranklinCandidateDocuments(source, candidates, notice, (source, values) => ({ ...createStateCandidateRecord(source, values)!, id: "same" })), /identities/u);
});
