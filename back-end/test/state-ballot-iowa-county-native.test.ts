import type { IowaSampleContext, IowaSampleDocument } from "../src/state-ballot-iowa-county-native.js";
import assert from "node:assert/strict";
import test from "node:test";
import {
	readIowaCountySample,
	readIowaCountySamples,
	readIowaSampleColumns
} from "../src/state-ballot-iowa-county-native.js";
import { iowaCountyNativeFixture } from "./helpers/iowa-county-native-fixture.js";

const now = Date.parse("2026-11-07T00:00:00.000Z");

for (const county of ["Monona", "Woodbury"] as const) {
	test(`${county} sample preserves candidates, teams, literal parties, vote limits and separate retention questions`, () => {
		const fixture = iowaCountyNativeFixture(county);
		const parsed = readIowaCountySample(fixture.bbox, fixture.layout, fixture.context);
		assert.equal(parsed.records.length, 11);
		assert.equal(parsed.contests.length, 9);
		assert.equal(parsed.claims.length, 12);
		assert.equal(parsed.questionLines.length, 5);
		const ticket = parsed.records.find(record => record.recordKind === "joint-ticket")!;
		assert.deepEqual(ticket.members, ["Jordan Example", "Casey Sample"]);
		assert.equal(ticket.name, "Jordan Example / Casey Sample");
		assert.equal(ticket.party, "Republican");
		assert.equal(ticket.voteLimit, 1);
		const unlabeled = parsed.records.find(record => record.name === "Harper Sample")!;
		assert.equal(unlabeled.party, null);
		assert.equal(unlabeled.nonpartisanOffice, false);
		const township = parsed.records.find(record => record.name === "Quinn Example")!;
		assert.equal(township.office, "Concord Township Trustee");
		assert.equal(township.jurisdiction, `${county} County · Concord Township`);
		assert.equal(township.nonpartisanOffice, true);
		assert.equal(township.voteLimit, 2);
		assert.equal(parsed.records.find(record => record.name === "Parker Sample")!.termType, "to-fill-vacancy");
		assert.equal(parsed.records.filter(record => record.recordKind === "judicial-retention-question").length, 2);
		assert.deepEqual(parsed.records.find(record => record.name === "Sage Sample")!.choices, ["Yes", "No"]);
		assert.equal(
			parsed.records.find(record => record.name === "Sage Sample")!.jurisdiction,
			"Iowa Judicial District 3B"
		);
		assert.equal(
			parsed.records.some(record => /write-in|no candidate/iu.test(record.name)),
			false
		);
		assert.equal(
			parsed.records.some(record => record.office === "Concord Township Clerk"),
			false
		);
		assert(parsed.contests.some(contest => contest.office === "Concord Township Clerk"));
	});
}

test("sample names and printed date bind both independent native text inputs", () => {
	const fixture = iowaCountyNativeFixture();
	assert.throws(() =>
		readIowaCountySample(
			fixture.bbox,
			fixture.layout.replace("County of Monona", "County of Woodbury"),
			fixture.context
		)
	);
	assert.throws(() =>
		readIowaCountySample(
			fixture.bbox.replace("County of Monona", "County of Woodbury"),
			fixture.layout,
			fixture.context
		)
	);
	const wrongHeader = fixture.bbox.replace("County of Monona", "County of Woodbury").replace("Public Measures", "Public Measures County of Monona");
	assert.throws(() => readIowaCountySample(wrongHeader, fixture.layout, fixture.context), /native and layout identities/u);
	assert.throws(() =>
		readIowaCountySample(
			fixture.bbox.replace("November 3, 2026", "November 7, 2028"),
			fixture.layout,
			fixture.context
		)
	);
	assert.throws(() =>
		readIowaCountySample(fixture.bbox, fixture.layout, {
			...fixture.context,
			county: "Other" as IowaSampleContext["county"]
		})
	);
});

test("a date-bound future general election uses supplied publication facts", () => {
	const fixture = iowaCountyNativeFixture("Woodbury", "2028-11-07");
	const parsed = readIowaCountySample(fixture.bbox, fixture.layout, fixture.context);
	assert(parsed.records.every(record => record.electionDate === "2028-11-07"));
	assert.throws(() =>
		readIowaCountySample(fixture.bbox, fixture.layout, { ...fixture.context, electionDate: "2027-11-02" })
	);
	assert.throws(() =>
		readIowaCountySample(fixture.bbox, fixture.layout, { ...fixture.context, electionDate: "2028-11-08" })
	);
});

test("a new presidential ticket and statewide retention court retain their explicit roles", () => {
	const fixture = iowaCountyNativeFixture("Monona", "2028-11-07");
	const replace = (value: string) =>
		value
			.replace("Governor / Lieutenant Governor", "President and Vice President")
			.replace("Court of Appeals Judge", "Supreme Court Justice");
	const parsed = readIowaCountySample(replace(fixture.bbox), replace(fixture.layout), fixture.context);
	assert.equal(
		parsed.records.find(record => record.recordKind === "joint-ticket")!.office,
		"President / Vice President"
	);
	assert.equal(parsed.records.find(record => record.name === "Rowan Example")!.scope, "statewide");
});

test("county heading whitespace is normalized without accepting another county", () => {
	const fixture = iowaCountyNativeFixture("Woodbury");
	const parsed = readIowaCountySample(
		fixture.bbox.replace("County of Woodbury", "County of  Woodbury"),
		fixture.layout.replace("County of Woodbury", "County of  Woodbury"),
		fixture.context
	);
	assert.equal(parsed.records.length, 11);
});

test("unreviewed offices, missing party labels and incomplete tickets stop parsing", () => {
	const fixture = iowaCountyNativeFixture();
	for (const [before, after] of [
		["For County Treasurer", "For County Unreviewed Office"],
		["Avery Example REP", "Avery Example"],
		["Casey Sample", ""],
		["District 4", "District 9"],
		["no more than Two", "no more than Eleven"]
	]) {
		assert.throws(() =>
			readIowaCountySample(fixture.bbox.replace(before!, after!), fixture.layout, fixture.context)
		);
	}
});

test("unknown judicial courts and missing Yes/No choices stop parsing", () => {
	const fixture = iowaCountyNativeFixture();
	assert.throws(() =>
		readIowaCountySample(
			fixture.bbox.replace("Court of Appeals Judge", "Unknown Court Judges"),
			fixture.layout,
			fixture.context
		)
	);
	assert.throws(() =>
		readIowaCountySample(fixture.bbox.replace(">YES</word>", ">MAYBE</word>"), fixture.layout, fixture.context)
	);
	assert.throws(() =>
		readIowaCountySample(fixture.bbox.replace(">NO</word>", "></word>"), fixture.layout, fixture.context)
	);
});

test("missing candidate, retention and measure columns are review exceptions", () => {
	const fixture = iowaCountyNativeFixture();
	for (const removed of ["For County Supervisor", "Judicial Ballot", "Public Measures"]) {
		assert.throws(() =>
			readIowaCountySample(fixture.bbox.replace(removed, "Unreviewed Section"), fixture.layout, fixture.context)
		);
	}
});

test("native geometry, page count, large-font layers and control characters remain bounded", () => {
	const fixture = iowaCountyNativeFixture();
	assert.throws(() => readIowaSampleColumns(fixture.bbox.replace("width=\"612\"", "width=\"700\""), "Monona"));
	assert.throws(() => readIowaSampleColumns(fixture.bbox.replace("xMin=\"24\"", "xMin=\"NaN\""), "Monona"));
	assert.throws(() => readIowaSampleColumns(fixture.bbox.replace("xMax=\"184\"", "xMax=\"999\""), "Monona"));
	assert.throws(() => readIowaSampleColumns(fixture.bbox.replace("yMax=\"310\"", "yMax=\"350\""), "Monona"));
	assert.throws(() => readIowaSampleColumns(fixture.bbox.replace(/<page [\s\S]+?<\/page>/u, ""), "Monona"));
	assert.throws(() =>
		readIowaCountySample(fixture.bbox, fixture.layout, { ...fixture.context, style: "Unknown\u0000style" })
	);
	assert.throws(() => readIowaSampleColumns(" ".repeat(4 * 1024 * 1024 + 1), "Monona"));
	assert.throws(() => readIowaSampleColumns(`<doc>${"<div>".repeat(70)}${"</div>".repeat(70)}</doc>`, "Monona"));
});

test("multi-style reconciliation keeps shared choices and every style-specific claim", () => {
	const first = iowaCountyNativeFixture();
	const second = {
		...first.document,
		url: first.document.url.replace("style_1", "style_2"),
		style: "Second printed style",
		retrievedAt: "2026-11-06T21:00:00.000Z"
	};
	const parsed = readIowaCountySamples([first.document, second], first.context, now);
	assert.equal(parsed.records.length, 11);
	assert.equal(parsed.claims.length, 24);
	assert.equal(parsed.contests.length, 18);
	assert.equal(parsed.questionLines.length, 10);
	assert.deepEqual(
		parsed.documents.map(document => document.includedRecordCount),
		[11, 0]
	);
	assert.equal(parsed.retrievedAt, first.document.retrievedAt);
	assert.equal(new Set(parsed.claims.map(claim => claim.style)).size, 2);
	assert.notEqual(
		parsed.collectionIndexSha256,
		readIowaCountySamples([first.document], first.context, now).collectionIndexSha256
	);
});

test("contradictory parties or vote limits for a shared choice stop reconciliation", () => {
	const fixture = iowaCountyNativeFixture();
	const second = { ...fixture.document, url: fixture.document.url.replace("style_1", "style_2") };
	assert.throws(() =>
		readIowaCountySamples(
			[fixture.document, { ...second, bbox: second.bbox.replace("Avery Example REP", "Avery Example DEM") }],
			fixture.context,
			now
		)
	);
	assert.throws(() =>
		readIowaCountySamples(
			[fixture.document, { ...second, bbox: second.bbox.replace("no more than Two", "no more than Three") }],
			fixture.context,
			now
		)
	);
});

test("document identity, original clocks, hashes and collection bounds require review", () => {
	const fixture = iowaCountyNativeFixture();
	for (const altered of [
		{ url: fixture.document.url.replace("mononacountyiowa.gov", "example.com") },
		{ url: `${fixture.document.url}?token=example` },
		{ url: `${fixture.document.url}#page=1` },
		{ url: fixture.document.url.replace("sample_ballots", "private") },
		{ sha256: "invalid" },
		{ retrievedAt: "2026-11-08T20:00:00.000Z" },
		{ retrievedAt: "2026-11-06T20:00:00Z" }
	])
		assert.throws(() => readIowaCountySamples([{ ...fixture.document, ...altered }], fixture.context, now));
	assert.throws(() => readIowaCountySamples([], fixture.context, now));
	assert.throws(() => readIowaCountySamples([fixture.document, fixture.document], fixture.context, now));
	assert.throws(() =>
		readIowaCountySamples(Array.from<IowaSampleDocument>({ length: 101 }).fill(fixture.document), fixture.context, now)
	);
});
