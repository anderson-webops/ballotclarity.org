import assert from "node:assert/strict";
import test from "node:test";
import { readDaneCandidateNotice, readDaneCandidateSample } from "../src/state-ballot-dane.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { daneNotice, daneSample } from "./helpers/dane-fixture.js";

const source = configuredStateBallotSources.find(item => item.id === "wi-town-dane-2026")!;
test("Dane native samples retain joint tickets and literal party, district and county fields", () => {
	const parsed = readDaneCandidateSample(source, daneSample("Lodi"), "Lodi");
	assert.equal(parsed.records.length, 15);
	assert.equal(parsed.namedPeople, 17);
	assert.equal(parsed.pageCount, 2);
	assert.equal(parsed.records.filter(item => item.scope === "statewide").length, 9);
	assert.equal(parsed.records.filter(item => item.jurisdiction === "Dane County").length, 2);
	assert.equal(parsed.records.find(item => item.party === "Wisconsin Green")?.name, "Taylor Example");
	assert.equal(parsed.records.find(item => item.scope === "state-house")?.district, "81");
	assert.ok(parsed.records.every(item => item.status === "listed"));
	for (const style of ["Waunakee", "Sauk"] as const) assert.deepEqual(readDaneCandidateSample(source, daneSample(style), style).records, parsed.records);
});
test("Dane separates column words when native PDF lines cross from instructions into vote limits", () => {
	const body = daneSample("Lodi");
	const vote = /<line xMin="241"[^>]*yMin="260"[^>]*>[\s\S]*?<\/line>/u.exec(body)![0];
	const merged = vote.replace("xMin=\"241\"", "xMin=\"104\"").replace("yMin=\"260\"", "yMin=\"258\"").replace(/(<line[^>]*>)/u, "$1<word xMin=\"104\" xMax=\"120\" yMin=\"258\" yMax=\"267\">instruction</word>");
	assert.deepEqual(readDaneCandidateSample(source, body.replace(vote, merged), "Lodi"), readDaneCandidateSample(source, body, "Lodi"));
});
test("Dane rejects wrong school styles, missing pages, altered dates and unsupported candidates or offices", () => {
	assert.throws(() => readDaneCandidateSample(source, daneSample("Waunakee"), "Lodi"));
	for (const body of [daneSample("Lodi").replaceAll(">2026<", ">2028<"), daneSample("Lodi").replace("(Wisconsin", "(Unreviewed"), daneSample("Lodi").replace("Attorney", "Unsupported"), daneSample("Lodi").replace("width=\"612\"", "width=\"500\""), daneSample("Lodi").replace("</html>", ""), daneSample("Lodi").replace("xMax=\"", "xMax=\"9999")]) {
		assert.notEqual(body, daneSample("Lodi"));
		assert.throws(() => readDaneCandidateSample(source, body, "Lodi"));
	}
});
test("Dane notices independently enumerate the legislative candidates without importing the signer", () => {
	const notice = readDaneCandidateNotice(source, daneNotice());
	const sample = readDaneCandidateSample(source, daneSample("Lodi"), "Lodi");
	assert.equal(notice.records.length, 3);
	for (const record of notice.records) assert.deepEqual(record, sample.records.find(item => item.id === record.id));
	assert.throws(() => readDaneCandidateNotice(source, daneNotice().replace(">Senator<", ">Clerk<")));
});
test("Dane future examples are printed-date compatibility fixtures rather than inferred candidate rosters", () => {
	const future = { ...source, id: "wi-town-dane-general-2030-11-05", electionDate: "2030-11-05" };
	const parsed = readDaneCandidateSample(future, daneSample("Lodi", future.electionDate), "Lodi");
	assert.equal(parsed.records.length, 15);
	assert.notEqual(parsed.records[0]!.id, readDaneCandidateSample(source, daneSample("Lodi"), "Lodi").records[0]!.id);
});

test("Dane new candidate regions on the reverse side or referendum column require review", () => {
	const unexpected = "<line xMin=\"420\" xMax=\"500\" yMin=\"550\" yMax=\"559\"><word xMin=\"420\" xMax=\"480\" yMin=\"550\" yMax=\"559\">(Unreviewed)</word></line>";
	const body = daneSample("Lodi");
	for (const changed of [body.replace("</page>", `${unexpected}</page>`), body.replace("</page></doc>", `${unexpected}</page></doc>`)]) {
		assert.notEqual(changed, body);
		assert.throws(() => readDaneCandidateSample(source, changed, "Lodi"), /secondary candidate regions/u);
	}
});
