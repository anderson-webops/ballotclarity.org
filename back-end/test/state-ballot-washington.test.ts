import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { serializeStateBallotSnapshots } from "../src/state-ballot-export.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { loadBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { buildWashingtonPageForm, fetchWashingtonCandidatePages, inspectWashingtonCandidatePage } from "../src/state-ballot-washington.js";

const source = stateBallotSources.find(item => item.stateCode === "WA")!;
const now = Date.parse("2026-10-22T12:00:00Z");
const prefix = "ctl00$ContentPlaceHolder1$";
const grid = `${prefix}grdCandidates`;
const columns = ["District Type", "District", "Race", "Term Type", "Term Length", "Name", "Mailing Address", "Email", "Phone", "Filing Date", "Party Preference", "Status", "Election Status", "Ballot Order"];
const filters = ["DistrictType", "Jurisdiction", "Race", "BallotName", "PetitionFilingDate", "PoliticalPartyID"];
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll("\"", "&quot;");
const field = (name: string, value = "", type = "hidden", className = "") => `<input name="${name}" type="${type}" value="${escape(value)}" class="${className}">`;

function candidate(index: number) {
	const values = ["Countywide", "County", "Assessor", "Regular", "4", `Candidate ${index}`, "PRIVATE-CONTACT-ADDRESS", "PRIVATE-CONTACT-EMAIL", "PRIVATE-CONTACT-PHONE", "5/5/2026", "STATES NO PARTY PREFERENCE", "Active", "", "1"];
	if (index === 1) values.splice(0, 6, "Congressional", "Congressional District 1", "U.S. Representative", "Regular", "2", "Congress Example");
	if (index === 2) values.splice(0, 6, "Legislative", "Legislative District 29", "State Senator", "Regular", "4", "Senate Example");
	if (index === 3) values.splice(0, 6, "LEGISLATIVE", "LEGISLATIVE DISTRICT 29", "State Representative Pos. 1", "Short & Full", "2", "House One Example");
	if (index === 4) values.splice(0, 6, "Legislative", "Legislative District 29", "State Representative Pos. 2", "Regular", "2", "House Two Example");
	if (index === 5) values.splice(0, 6, "Judicial", "Supreme Court", "Justice Position #01", "Regular", "6", "Justice Example");
	if (index === 6) values.splice(0, 6, "Judicial", "Court of Appeals, Division 1, District 1", "Judge Position 2", "Regular", "6", "Regional Judge Example");
	if (index === 7) values[10] = "INDEPENDANT";
	if (index === 8) {
		values.splice(0, 6, "Fire", "Fire District 29", "Commissioner No. 2", "Initial Full", "6", "Fire Example");
		values[12] = "In General";
	}
	if (index === 9) values.splice(0, 6, "Port", "Port District 1", "Commissioner No. 1", "Unexpired", "3", "Port Example");
	return `<tr class="${index % 2 ? "rgRow" : "rgAltRow"}">${values.map((value, column) => `<td>${column === 5 ? `<a href="/genericvoterguide.aspx?e=899&amp;c=#/candidates/${1000 + index}/${2000 + index}">${escape(value)}</a>` : escape(value)}</td>`).join("")}</tr>`;
}

function page(number: number, total = 102) {
	const pages = Math.ceil(total / 100);
	const options = `<select name="${prefix}ddlElection"><option value="906">GENERAL 2027 (11/02/2027) (General)</option><option selected value="899">GENERAL 2026 (11/03/2026) (General)</option></select><select name="${prefix}ddlCounty"><option value=""></option><option value="1">Adams</option></select><select name="ctl00$ddlLanguages"><option value="en-us">English</option><option value="es">Español</option></select>`;
	const inputs = field("__VIEWSTATE__", "public-state") + field("__VIEWSTATE") + field("__EVENTVALIDATION", "public-validation") + field(`${prefix}hidElectionDate`, "GENERAL 2026") + field(`${prefix}hidElectionType`, "General");
	const search = filters.map(name => field(`${grid}$ctl00$ctl02$ctl03$FilterTextBox_${name}`, "", "text", "rgFilterBox")).join("");
	const pager = Array.from({ length: pages }, (_, index) => `<a class="${index + 1 === number ? "rgCurrentPage" : ""}" href="javascript:__doPostBack('${grid}$ctl00$ctl03$ctl01$ctl${String(5 + index * 2).padStart(2, "0")}','')">${index + 1}</a>`).join("");
	const rows = Array.from({ length: Math.min(100, total - (number - 1) * 100) }, (_, index) => candidate((number - 1) * 100 + index + 1)).join("");
	return `<form method="post" action="./CandidateList.aspx?e=899">${inputs}${options}${search}<table id="ctl00_ContentPlaceHolder1_grdCandidates_ctl00"><thead><tr>${columns.map(name => `<th class="rgHeader">${name}</th>`).join("")}</tr></thead><tbody>${rows}</tbody><tfoot><tr><td>${pager}<div class="rgInfoPart">${total} items in ${pages} pages</div>${field(`${grid}$ctl00$ctl03$ctl01$PageSizeComboBox`, "100", "text")}</td></tr></tfoot></table></form>`;
}

const envelope = () => JSON.stringify({ pages: [page(1), page(2)] });
const options = { allowedHosts: ["voter.votewa.gov"], maxBytes: 12 * 1024 * 1024, maxRedirects: 2, timeoutMs: 12000 };

test("Washington uses the selected automatic public general list without a bundled snapshot", async () => {
	assert.equal(source.format, "washington-html");
	assert.equal(source.retrievalPolicy, undefined);
	assert.equal(new URL(source.url).search, "?e=899");
	await assert.rejects(loadBundledStateSnapshot(source), /No bundled/u);
	await assert.rejects(fetchStateBallotSourceText({ ...source, retrievalPolicy: "manual-snapshot" }), /manually supplied/u);
});

test("Washington reconciles every page and preserves positions, preferences and distinct term types", () => {
	const records = parseStateCandidateRecords(source, envelope());
	assert.equal(records.length, 102);
	assert.equal(new Set(records.map(record => record.id)).size, 102);
	assert.ok(records.every(record => record.status === "filed"));
	assert.equal(records[2]!.office, "State Representative Pos. 1 (Short & Full)");
	assert.equal(records[3]!.office, "State Representative Pos. 2");
	assert.equal(records[4]!.office, "Supreme Court - Justice Position #01");
	assert.equal(records[6]!.party, "INDEPENDANT");
	assert.equal(records[7]!.sourceStatus, "Active; In General");
	assert.equal(records[8]!.ballotDesignation, "Unexpired; listed term length: 3; ballot order: 1");
	assert.equal(records[8]!.office, "Commissioner No. 1 (Unexpired)");
	assert.ok(!JSON.stringify(records).includes("PRIVATE-CONTACT"));
	assert.ok(records.every(record => record.candidateUrl === undefined));
	const varied = parseStateCandidateRecords(source, JSON.stringify({ pages: [page(1).replace("Congressional District 1", "CONGRESSIONAL DISTRICT 1"), page(2)] }));
	assert.equal(varied[0]!.id, records[0]!.id);
	assert.equal(varied[0]!.sourceDistrictLabel, "CONGRESSIONAL DISTRICT 1");
	assert.equal(varied[0]!.district, records[0]!.district);
});

test("Washington only matches typed congressional and legislative districts, not regional courts or local numbers", () => {
	const records = parseStateCandidateRecords(source, envelope());
	const snapshot = { source, records, retrievedAt: new Date(now).toISOString(), sha256: "a".repeat(64) };
	const unlocated = buildStateBallotPreview(snapshot, { districtMatches: [] })!;
	assert.equal(unlocated.candidateCount, 1);
	const preview = buildStateBallotPreview(snapshot, { districtMatches: [{ id: "cd1", label: "Congressional 1", districtType: "congressional", districtCode: "1", sourceSystem: "Controlled fixture" }, { id: "upper29", label: "Senate 29", districtType: "state-senate", districtCode: "29", sourceSystem: "Controlled fixture" }, { id: "lower29", label: "House 29", districtType: "state-house", districtCode: "29", sourceSystem: "Controlled fixture" }] })!;
	assert.equal(preview.candidateCount, 5);
	assert.equal(preview.contests.length, 5);
	assert.ok(!preview.contests.some(contest => contest.candidates.some(record => /Regional Judge|Fire Example|Port Example/u.test(record.name))));
	assert.ok(preview.disclaimer.includes("preferences, not nominations"));
});

test("configured source limitations appear once in previews for automatic and reviewed sources", () => {
	for (const configured of stateBallotSources.filter(item => item.scopeNotice)) {
		const records = [{ id: "a".repeat(24), name: "Example", office: "Example office", district: "", scope: "statewide" as const, status: "listed" as const }];
		const preview = buildStateBallotPreview({ source: configured, retrievedAt: new Date(now).toISOString(), sha256: "b".repeat(64), records }, { districtMatches: [] })!;
		assert.equal(preview.disclaimer.split(configured.scopeNotice!).length, 2, configured.stateCode);
		if (configured.retrievalPolicy !== "manual-snapshot") {
			assert.ok(preview.disclaimer.includes("Filing does not establish ballot qualification."));
			assert.ok(!preview.disclaimer.includes("State records; local contests may be missing."));
		}
	}
});

test("Washington validates the form target, selected general election, county and language", () => {
	for (const changed of [page(1).replace("action=\"./CandidateList.aspx?e=899\"", "action=\"https://example.com/\""), page(1).replace("GENERAL 2026 (11/03/2026) (General)", "PRIMARY 2026 (08/04/2026) (Primary)"), page(1).replace("selected value=\"899\"", "selected value=\"906\""), page(1).replace("value=\"1\">Adams", "selected value=\"1\">Adams"), page(1).replace("value=\"es\">Español", "selected value=\"es\">Español"), page(1).replace("value=\"General\"", "value=\"Primary\"")])
		assert.throws(() => inspectWashingtonCandidatePage(source, changed, 1), /Washington/u);
});

test("Washington refuses nonempty filters, unexpected columns, page sizes and incomplete rows", () => {
	for (const changed of [page(1).replace("value=\"\" class=\"rgFilterBox\"", "value=\"limited\" class=\"rgFilterBox\""), page(1).replace("class=\"rgHeader\">Name", "class=\"rgHeader\">Changed Name"), page(1).replace("value=\"100\"", "value=\"50\""), page(1).replace(candidate(100), "")])
		assert.throws(() => inspectWashingtonCandidatePage(source, changed, 1), /Washington/u);
});

test("Washington refuses missing, repeated, reordered or count-changing pages", () => {
	for (const pages of [[page(1)], [page(1), page(1)], [page(2), page(1)], [page(1), page(2, 103)]])
		assert.throws(() => parseStateCandidateRecords(source, JSON.stringify({ pages })), /Washington/u);
	assert.throws(() => parseStateCandidateRecords(source, JSON.stringify({ pages: [], ignored: true })), /Washington/u);
	assert.throws(() => inspectWashingtonCandidatePage(source, page(1, 2501), 1), /bounds/u);
});

test("Washington fails closed on unfamiliar statuses, terms, district types or mismatched legislative offices", () => {
	for (const changed of [page(1).replace(">Active<", ">Withdrawn<"), page(1).replace(">Regular<", ">Unknown term<"), page(1).replace(">Countywide<", ">Unknown district<"), page(1).replace(">U.S. Representative<", ">Governor<"), page(1).replace(">Congressional District 1<", ">Congressional District 11<"), page(1).replace(">In General<", ">Elected<")])
		assert.throws(() => parseStateCandidateRecords(source, JSON.stringify({ pages: [changed, page(2)] })), /Washington/u);
});

test("Washington refuses duplicate or redirected public record identifiers", () => {
	const second = page(2).replace("/candidates/1101/2101", "/candidates/1001/2001");
	assert.throws(() => parseStateCandidateRecords(source, JSON.stringify({ pages: [page(1), second] })), /duplicate/u);
	const foreign = page(1).replace("/genericvoterguide.aspx?e=899&amp;c=#/candidates/1001/2001", "https://example.com/genericvoterguide.aspx?e=899&amp;c=#/candidates/1001/2001");
	assert.throws(() => parseStateCandidateRecords(source, JSON.stringify({ pages: [foreign, page(2)] })), /identifiers/u);
});

test("Washington follows only the published next-page control and echoes the public view state", async () => {
	const calls: { url: string; postBody?: string; maxRedirects: number }[] = [];
	let pauses = 0;
	const result = await fetchWashingtonCandidatePages(source, async (url, settings) => {
		calls.push({ url, postBody: settings.postBody, maxRedirects: settings.maxRedirects });
		return page(calls.length);
	}, options, async () => { pauses++; });
	assert.equal(parseStateCandidateRecords(source, result).length, 102);
	assert.equal(calls.length, 2);
	assert.equal(pauses, 1);
	assert.ok(calls.every(call => call.url === source.url && call.maxRedirects === 0));
	const fields = new URLSearchParams(calls[1]!.postBody);
	assert.equal(fields.get("__VIEWSTATE__"), "public-state");
	assert.equal(fields.get("__EVENTTARGET"), `${grid}$ctl00$ctl03$ctl01$ctl07`);
	assert.equal(fields.get(`${prefix}ddlElection`), "899");
	assert.equal(fields.get(`${prefix}ddlCounty`), "");
	assert.ok(![...fields.keys()].some(name => /Export/u.test(name)));
	assert.throws(() => buildWashingtonPageForm(source, page(2), 2), /no next/u);
	assert.throws(() => buildWashingtonPageForm(source, page(1).replace("ctl07','')", "ExportToCsvButton','')"), 1), /pagination control/u);
});

test("Washington stops pagination after a denied page and does not return a partial list", async () => {
	let requests = 0;
	await assert.rejects(fetchWashingtonCandidatePages(source, async () => {
		requests++;
		if (requests === 2) throw new Error("HTTP 403");
		return page(1);
	}, options, async () => {}), /403/u);
	assert.equal(requests, 2);
});

test("Washington enforces aggregate and individual response bounds", async () => {
	await assert.rejects(fetchWashingtonCandidatePages(source, async () => page(1), { ...options, maxBytes: 100 }, async () => {}), /size limit/u);
	assert.throws(() => inspectWashingtonCandidatePage(source, " ".repeat(2 * 1024 * 1024 + 1), 1), /size limit/u);
});

test("Washington election rollover is driven by reviewed source configuration rather than a hardcoded year", () => {
	const future = { ...source, id: "wa-general-2028", electionDate: "2028-11-07", url: source.url.replace("899", "999"), pageUrl: source.pageUrl.replace("899", "999") };
	const pages = [page(1), page(2)].map(body => body.replaceAll("GENERAL 2026", "GENERAL 2028").replaceAll("11/03/2026", "11/07/2028").replaceAll("899", "999"));
	assert.equal(parseStateCandidateRecords(future, JSON.stringify({ pages })).length, 102);
	assert.throws(() => parseStateCandidateRecords(future, envelope()), /Washington/u);
});

test("Washington persists and exports the complete list with no private contacts or restart downloads", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-washington-test-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	let downloads = 0;
	const repository = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => now, fetchText: async () => {
		downloads++;
		return envelope();
	} });
	const [first, concurrent] = await Promise.all([repository.getSnapshot("WA"), repository.getSnapshot("WA")]);
	assert.deepEqual(first, concurrent);
	assert.equal(downloads, 1);
	assert.equal(first!.records.length, 102);
	const restarted = await createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => now + 1, fetchText: async () => {
		throw new Error("No restart download permitted.");
	} }).getSnapshot("WA");
	assert.deepEqual(restarted, JSON.parse(JSON.stringify(first)));
	const exported = serializeStateBallotSnapshots([restarted!]);
	assert.equal(exported.trim().split("\n").length, 103);
	assert.ok(!exported.includes("PRIVATE-CONTACT"));
	assert.match(exported, /INDEPENDANT/u);
	assert.match(exported, /Unexpired; listed term length/u);
});

test("Washington leaves accepted disk data unchanged when a later incomplete refresh fails", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-washington-invalid-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const first = await createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => now, fetchText: async () => envelope() }).getSnapshot("WA");
	assert.ok(first);
	const path = join(directory, `${source.id}.json`);
	const original = await readFile(path, "utf8");
	const result = await createStateBallotRepository({ sources: [source], dataDirectory: directory, ttlMs: 1, now: () => now + 2, fetchText: async () => JSON.stringify({ pages: [page(1)] }) }).getSnapshot("WA");
	assert.equal(result, null);
	assert.equal(await readFile(path, "utf8"), original);
	assert.deepEqual(await createStateBallotStorage(directory).read(source), JSON.parse(JSON.stringify(first)));
});
