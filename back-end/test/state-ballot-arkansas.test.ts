import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { serializeStateBallotSnapshots } from "../src/state-ballot-export.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { isActiveStateCandidateRecord, parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { loadBundledStateSnapshot, parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";

const source = stateBallotSources.find(item => item.stateCode === "AR")!;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;");

function fixture(electionDate = source.electionDate) {
	const year = electionDate.slice(0, 4);
	const date = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(electionDate));
	const headers = [
		["Offices Up for Election", "District", "Candidate Name", "Party", "Filing Date", "filing Number", "Ballot order", "Email", "Address", "City", "Zip"],
		["City", "Office", "Candidate Name", "Filing Date", "Time", "Ballot Order", "Email", "Address", "City", "Zip"],
		["Offices Up For Election", "Candidate Name", "Filing Date", "Filing Order", "Ballot Order", "Email", "Address", "City", "Zip"],
		["School District", "School Board Office", "Candidate Name", "filing date", "Ballot Order", "Email", "address", "city", "zip"],
	];
	const main = (office: string, district: string, name: string, party: string, order: string, identifier = "990001") => [office, district, name, party, "11/3/25", identifier, order, "private@example.test", "Excluded home address", "Private City", "00000"];
	const category = (name: string) => [name, ...Array.from<string>({ length: 10 }).fill("")];
	const municipal = (city: string, office: string, name: string, order: string) => [city, office, name, "8/4", "", order, "private@example.test", "Excluded home address", "Private City", "00000"];
	const tables: string[][][] = [
		[
			category("Federal"),
			main("U.S. Senate", "", "Senate First Example", "Democratic", "2"),
			main("", "", "Senate Second Example", "Republican", "1"),
			main("U.S. Congress (House of Representatives)", "3", "Congress First Example", "Democratic", "1"),
			main("", "", "Congress Second Example", "Libertarian", "2"),
			category("State"),
			main("Governor", "", "Governor First Example", "Democratic", "1"),
			main("", "", "Governor Second Example", "Republican", "2"),
			main("Attorney General", "", "Attorney Example", "Republican", "Attorney General-Elect"),
			main("State Senate", "30", "Senator Example", "Democratic", "Senator-Elect"),
			main("State House", "9", "House First Example", "Democratic", "1"),
			main("", "", "House Second Example", "Republican", "2"),
			main("", "11", "House Unopposed Example", "Republican", "Representative-Elect"),
			category("County"),
			main("County Judge", "", "Single Judge Example", "Independent", "1", "12:46 PM"),
			main("County Sheriff", "", "Sheriff Example", "Republican", "Sheriff-Elect", "1:48 PM"),
			main("Circuit Clerk", "", "Circuit Clerk Example", "Republican", "Circuit Clerk-Elect", "1:37 PM"),
			main("Justice of the Peace", "30", "JP Example", "Democratic", "JP-Elect", "12:15 PM"),
			main("Constable", "3", "Constable First Example", "Democratic", "1", "8:50 AM"),
			main("", "", "Constable Second Example", "Republican", "2", "10:48 AM"),
		],
		[
			municipal("First City", "City Mayor", "Mayor Example", "Unopposed"),
			municipal("First City", "City Clerk", "Clerk Example", "Unopposed"),
			municipal("First City", "City Council Member Ward 2 Pos.1", "Council First Example", "1"),
			municipal("First City", "City Councill Member Ward 2 Pos. 1", "Council Second Example", "2"),
			Array.from<string>({ length: 10 }).fill(""),
			municipal("Second City", "Mayor", "Mayor Example", "Unopposed"),
			municipal("Example Water District", "Director Example Water District Board", "Water Board Example", "Unopposed"),
			municipal("Second City", "Special Election Vacancy: City Council Member Ward 2 Pos. 2", "Vacancy First Example", "1"),
			municipal("Second City", "Special Election Vacancy: City Council Member Ward 2 Pos. 2", "Vacancy Second Example", "2"),
		],
		[
			["Circuit Judge, District 4, Division 2", "Runoff First Example", "9/15/25", "990001", "1", "private@example.test", "Excluded home address", "Private City", "00000"],
			["", "Runoff Second Example", "9/16/25", "990002", "2", "private@example.test", "Excluded home address", "Private City", "00000"],
		],
		[
			["Example School District #10", "Zone 2", "School First Example", "11/7/25", "2", "private@example.test", "Excluded home address", "Private City", "00000"],
			["", "", "School Second Example", "11/10/25", "1", "private@example.test", "Excluded home address", "Private City", "00000"],
		],
	];
	const row = (values: string[]) => `<tr>${values.map(value => `<td>${escape(value)}</td>`).join("")}</tr>`;
	return `<h1>Washington County, AR</h1><h2>General Election, Nonpartisan Judicial General Run-Off and Annual School Run-Off Information</h2><h2>Elections to be held on ${date}</h2>
	<p>Office-Elect is for Candidates who are Unopposed in the General Election</p>
	<p>Unopposed Candidates for State Offices will appear on the General Election Ballot</p>
	<p>The Unopposed Candidate for Circuit Clerk will appear on the General Election Ballot</p>
	<p>Unopposed Candidates for all other County Offices will not appear on the General Election Ballot</p>
	<p>Candidate Information is unofficial until the names are certified to the Election Commission by the Secretary of State's Office and County Clerk's Office.</p>
	<p>Certification Deadline is August 20, ${year}</p><p>Updated: 08/21/${year.slice(2)}</p>
	<table>${row(headers[0]!)}${tables[0]!.map(row).join("")}</table>
	<h2>Municipal General Election</h2><p>All Names are Unofficial</p>
	<p>Unopposed Candidates for Mayor will appear on the Ballot</p>
	<p>Unopposed Candidates for City Attorney, City Clerk and City Council Members will not appear on the Ballot</p>
	<table>${row(headers[1]!)}${tables[1]!.map(row).join("")}</table>
	<h2>Nonpartisan Judicial General Election Run Off</h2><table>${row(headers[2]!)}${tables[2]!.map(row).join("")}</table>
	<span>Annual School Election Run-Off</span><table>${row(headers[3]!)}${tables[3]!.map(row).join("")}</table>`;
}

test("Arkansas requires an external reviewed import without a publisher request or bundled fallback", async () => {
	assert.equal(source.retrievalPolicy, "manual-snapshot");
	assert.equal(source.snapshotStorage, "external");
	assert.deepEqual(source.documentUrls, [source.url]);
	assert.deepEqual(source.documentLinks?.map(link => link.url), source.documentUrls);
	await assert.rejects(loadBundledStateSnapshot(source), /No bundled/u);
	let requests = 0;
	const fetchText = async () => {
		requests++;
		throw new Error("Publisher request is not permitted.");
	};
	await assert.rejects(fetchStateBallotSourceText(source, fetchText), /manually supplied/u);
	assert.equal(await createStateBallotRepository({ sources: [source], dataDirectory: null, fetchText }).getSnapshot("AR"), null);
	assert.equal(requests, 0);
});

test("An explicitly reviewed future automatic Arkansas configuration uses one public GET without voter identity or contact persistence", async () => {
	const requests: Array<{ url: string; options: unknown }> = [];
	const automatic = { ...source, retrievalPolicy: undefined, snapshotStorage: undefined };
	const body = await fetchStateBallotSourceText(automatic, async (url, options) => {
		requests.push({ url, options });
		return fixture();
	});
	assert.equal(requests.length, 1);
	assert.equal(requests[0]!.url, source.url);
	assert.deepEqual(requests[0]!.options, { allowedHosts: [new URL(source.url).hostname], maxBytes: 12 * 1024 * 1024, maxRedirects: 2, timeoutMs: 12_000, postBody: undefined });
	const records = parseStateCandidateRecords(source, body);
	assert.equal(records.length, 29);
	assert.ok(!JSON.stringify(records).includes("private@example.test"));
	assert.ok(!JSON.stringify(records).includes("Excluded home address"));
	assert.ok(!JSON.stringify(records).includes("Private City"));
	assert.ok(records.every(record => !record.candidateUrl && !record.sourceCandidateId?.includes(":")));
});

test("Arkansas preserves all four tables, literal names, blank parties, jurisdiction identities and ordinary single-candidate records", () => {
	const records = parseStateCandidateRecords(source, fixture());
	assert.deepEqual(Object.fromEntries(["statewide", "congressional", "state-senate", "state-house", "local"].map(scope => [scope, records.filter(record => record.scope === scope).length])), { "statewide": 5, "congressional": 2, "state-senate": 1, "state-house": 3, "local": 18 });
	assert.equal(new Set(records.map(record => record.id)).size, 29);
	assert.equal(records.filter(record => record.name === "Mayor Example").length, 2);
	assert.equal(records.filter(record => record.name === "Mayor Example" && record.jurisdiction === "First City").length, 1);
	assert.equal(records.find(record => record.name === "Single Judge Example")!.sourceStatus, "Unofficial");
	assert.ok(records.filter(record => record.scope === "local" && record.jurisdiction !== "Washington County").every(record => !record.party));
	assert.ok(records.some(record => record.office === "City Councill Member Ward 2 Pos. 1"));
	assert.ok(records.every(record => record.status === "listed" && isActiveStateCandidateRecord(record)));
});

test("Arkansas treats Office-Elect as unopposed shorthand, not an outcome, and preserves each source ballot-appearance exception", () => {
	const records = parseStateCandidateRecords(source, fixture());
	assert.equal(records.filter(record => record.sourceStatus?.includes("Unopposed")).length, 10);
	assert.equal(records.filter(record => record.sourceStatus?.includes("Printed on ballot")).length, 6);
	assert.equal(records.filter(record => record.sourceStatus?.includes("Not printed on ballot")).length, 3);
	assert.equal(records.filter(record => record.sourceStatus?.includes("not specified")).length, 1);
	assert.ok(records.find(record => record.name === "Attorney Example")!.ballotDesignation?.includes("Attorney General-Elect"));
	assert.ok(records.find(record => record.name === "Circuit Clerk Example")!.sourceStatus?.includes("Printed on ballot"));
	assert.ok(records.find(record => record.name === "Sheriff Example")!.sourceStatus?.includes("Not printed on ballot"));
	assert.ok(!records.some(record => ["qualified", "elected", "defeated", "unopposed"].includes(record.status)));
});

test("Arkansas keeps regional judicial and school runoffs, special vacancies and local wards out of legislative and statewide eligibility", () => {
	const records = parseStateCandidateRecords(source, fixture());
	const snapshot = { source, records, retrievedAt: "2026-10-21T22:12:19.526Z", sha256: hash(fixture()) };
	const previewFor = (districtType: string, districtCode: string) => buildStateBallotPreview(snapshot, { districtMatches: [{ id: `${districtType}:${districtCode}`, districtType, districtCode, label: districtCode, sourceSystem: "Synthetic typed geography" }] })!;
	assert.equal(previewFor("congressional", "3").candidateCount, 7);
	assert.equal(previewFor("state-senate", "30").candidateCount, 6);
	assert.equal(previewFor("state-house", "9").candidateCount, 7);
	assert.equal(previewFor("state-house", "11").candidateCount, 6);
	for (const type of ["ward", "county", "judicial", "school"]) assert.equal(previewFor(type, "30").candidateCount, 5);
	for (const [type, district] of [["state-senate", "4"], ["state-house", "10"], ["state-house", "2"]]) assert.equal(previewFor(type!, district!).candidateCount, 5);
	assert.equal(records.filter(record => record.ballotDesignation?.includes("Nonpartisan Judicial General Election Run Off")).length, 2);
	assert.equal(records.find(record => record.name === "Runoff First Example")!.sourceDivision, "2");
	assert.equal(records.filter(record => record.office.startsWith("Special Election Vacancy:")).length, 2);
	assert.equal(records.filter(record => record.ballotDesignation?.includes("Annual School Election Run-Off")).length, 2);
	assert.ok(previewFor("state", "AR").disclaimer.includes(source.scopeNotice!));
});

test("Arkansas supports reviewed future date/URL configuration without accepting an old election or certification year", () => {
	const future = { ...source, id: "ar-washington-2028", electionDate: "2028-11-07", url: "https://www.washingtoncountyar.gov/reviewed-future-election", pageUrl: "https://www.washingtoncountyar.gov/reviewed-future-election" };
	assert.equal(parseStateCandidateRecords(future, fixture(future.electionDate)).length, 29);
	assert.throws(() => parseStateCandidateRecords(future, fixture()), /configured general election/u);
	assert.throws(() => parseStateCandidateRecords(future, fixture(future.electionDate).replace("August 20, 2028", "August 20, 2026")), /notices/u);
	assert.throws(() => parseStateCandidateRecords({ ...source, electionDate: "2026-02-31" }, fixture()), /configuration/u);
});

for (const [label, change] of [
	["wrong date", (body: string) => body.replace("Elections to be held on November 3, 2026", "Elections to be held on June 1, 2026")],
	["missing unofficial notice", (body: string) => body.replace("All Names are Unofficial", "Certified Candidates")],
	["reversed ballot-appearance rule", (body: string) => body.replace("all other County Offices will not appear", "all other County Offices will appear")],
	["missing table", (body: string) => body.replace(/<table>[\s\S]*?<\/table>/u, "")],
	["changed headers", (body: string) => body.replace("filing Number", "Private identifier")],
	["changed party", (body: string) => body.replace("Democratic", "Unreviewed Party")],
	["merged cells", (body: string) => body.replace("<td>Senate First Example", "<td rowspan=2>Senate First Example")],
	["paginated content", (body: string) => `${body}<a rel="next" href="?page=2">Next</a>`],
	["restricted table filter", (body: string) => body.replace("<td>Senate First Example", "<td><select><option>Subset</option></select>Senate First Example")],
	["missing name", (body: string) => body.replace("Senate First Example", "")],
	["unnamed vacancy", (body: string) => body.replace("Senate First Example", "No Candidate Filed")],
	["unreviewed withdrawal", (body: string) => body.replace("Senate First Example", "Senate First Example (Withdrawn)")],
	["missing ballot-order row", (body: string) => body.replace(/<tr><td>U\.S\. Senate[\s\S]*?<\/tr>/u, "")],
	["duplicate ballot order", (body: string) => body.replace("<td>2</td><td>private@example.test", "<td>1</td><td>private@example.test")],
	["unknown Office-Elect label", (body: string) => body.replace("Attorney General-Elect", "Winner-Elect")],
	["countywide district contamination", (body: string) => body.replace("<td>County Sheriff</td><td></td>", "<td>County Sheriff</td><td>30</td>")],
	["missing municipal jurisdiction", (body: string) => body.replace("<td>First City</td>", "<td></td>")],
] as const) {
	test(`Arkansas rejects ${label} rather than presenting a partial or misclassified candidate set`, () => {
		assert.throws(() => parseStateCandidateRecords(source, change(fixture())));
	});
}

function reviewedPayload() {
	const records = parseStateCandidateRecords(source, fixture());
	const retrievedAt = "2026-10-21T22:12:19.526Z";
	const documents = [{ url: source.url, sha256: hash(fixture()), retrievedAt, includedRecordCount: records.length }];
	return { schemaVersion: 1, stateCode: "AR", sourceId: source.id, electionDate: source.electionDate, sourceUrl: source.pageUrl, retrievalPolicy: "manual-snapshot", retrievedAt, sourceSha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: records.length, records, documents };
}

test("Arkansas binds the reviewed HTML document, contribution counts, capture time and public fields", () => {
	const data = reviewedPayload();
	assert.equal(parseBundledStateSnapshot(source, JSON.stringify(data)).records.length, 29);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...data, documents: [] })), /document set/u);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...data, sourceSha256: "a".repeat(64) })), /provenance/u);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...data, documents: [{ ...data.documents[0], includedRecordCount: 28 }] })), /provenance/u);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...data, documents: [{ ...data.documents[0], url: "https://unconfigured.example.test/" }] })), /provenance/u);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...data, records: data.records.map(record => ({ ...record, residentialAddress: "excluded" })) })), /layout/u);
});

test("Arkansas reviewed imports preserve exact timestamps/export after restart and reject invalid replacements without fetching", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-arkansas-cache-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const now = Date.parse("2026-10-21T22:12:19.526Z");
	let requests = 0;
	const fetchText = async () => {
		requests++;
		throw new Error("Publisher request is not permitted.");
	};
	const data = reviewedPayload();
	const original = parseBundledStateSnapshot(source, JSON.stringify(data));
	await createStateBallotStorage(directory).write(original);
	const stored = join(directory, `${source.id}.json`);
	const body = await readFile(stored, "utf8");
	assert.ok(!body.includes("private@example.test") && !body.includes("Excluded home address"));
	const restarted = await createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => now + 1, fetchText }).getSnapshot("AR");
	assert.deepEqual(restarted, original);
	assert.equal(serializeStateBallotSnapshots([restarted!]), serializeStateBallotSnapshots([original]));
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...data, sourceSha256: "a".repeat(64) })), /provenance/u);
	assert.equal(await readFile(stored, "utf8"), body);
	await assert.rejects(fetchStateBallotSourceText(source, fetchText), /manually supplied/u);
	assert.equal(await readFile(stored, "utf8"), body);
	const unavailable = await createStateBallotRepository({ sources: [source], dataDirectory: null, fetchText }).getSnapshot("AR");
	assert.equal(unavailable, null);
	assert.equal(requests, 0);
});
