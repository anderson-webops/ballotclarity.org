import assert from "node:assert/strict";
import test from "node:test";
import { compareFultonCalendarInventories } from "../src/fulton-election-calendar-storage.js";
import { fultonCalendarCsv, fultonCalendarPublication, parseFultonCalendarPage, readFultonCalendarCapture, readFultonCalendarIndex, verifyFultonCalendarPolicy } from "../src/fulton-election-calendar.js";

const footer = `<footer><a href="/Privacy-Statement">Privacy Statement</a></footer>`;
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function printed(value: string, year = false) {
	const date = new Date(`${value}T00:00:00Z`);
	return `${weekdays[date.getUTCDay()]}, ${months[date.getUTCMonth()]} ${date.getUTCDate()}${year ? `, ${date.getUTCFullYear()}` : ""}`;
}
function markup(year = 2026) {
	const election = year === 2032 ? "2032-11-02" : year === 2028 ? "2028-11-07" : "2026-11-03";
	const runoff = year === 2032 ? "2032-11-30" : year === 2028 ? "2028-12-05" : "2026-12-01";
	const row = (date: string, label: string, note = "") => `${printed(date)}<br>${label}<br>${note ? `${note}<br>` : ""}`;
	const group = (date: string) => [
		row(`${year}-10-05`, "Voter Registration Deadline"),
		row(`${year}-10-13`, "First day for Early Voting"),
		row(`${year}-10-23`, "Last day to request an Absentee Ballot"),
		row(`${year}-10-30`, "Last day for Early Voting"),
		row(date, "Last day for an Absentee Ballot submitted by mail"),
		row(date, "Election Day")
	].join("");
	return `<main><h1>Registration and Elections Key Election Dates</h1><p>Upcoming Elections: ${printed(election, true)} - General Election</p><div class="text "><p>Key Dates for General Election</p><p>${group(election)}${row(`${year}-11-11`, "Logic and Accuracy Testing of Voting Equipment")}</p><hr><p>General Runoff Election<br>${group(runoff)}${row(`${year}-12-07`, "Last day To Return UOCAVA Absentee Ballot", `(must be postmarked by ${months[new Date(runoff).getUTCMonth()]} ${Number(runoff.slice(-2))}, ${year})`)}${printed(`${year}-12-10`)} - ${printed(`${year}-12-14`)}<br>Risk Limiting Audit</p><span id="PING_CONTENT_MB_MAIN" style="display: none;"></span></div></main>${footer}`;
}
const index = (year = 2026) => `<main><a href="${fultonCalendarPublication.calendarUrl}">More about ${year} Key Election dates</a></main>${footer}`;

test("Fulton calendar discovery uses the offered rolling link and explicit edition year", () => {
	assert.equal(readFultonCalendarIndex(index()), 2026);
	assert.equal(readFultonCalendarIndex(index(2028)), 2028);
	for (const body of [index().replace("2026", "upcoming"), index().replace("fultoncountyga.gov", "example.org"), index().replace("</main>", `${index().slice(6, index().indexOf("</main>"))}</main>`), index().replace("</footer>", `<a href="/new-terms">Terms of Use</a></footer>`)]) assert.throws(() => readFultonCalendarIndex(body));
});

test("the calendar keeps printed events, separate elections, ranges and postmark conditions without inventing times", () => {
	const sections = parseFultonCalendarPage(markup(), 2026);
	assert.deepEqual(sections.map(section => [section.electionDate, section.status, section.entries.length]), [["2026-11-03", "parsed", 7], ["2026-12-01", "parsed", 8]]);
	const range = sections[1]!.entries.at(-1)!;
	assert.equal(range.date, "2026-12-10");
	assert.equal(range.endDate, "2026-12-14");
	assert.equal(sections[1]!.entries.find(row => row.note)!.note, "(must be postmarked by December 1, 2026)");
	assert.ok(sections.flatMap(section => section.entries).every(row => row.date?.length === 10));
	assert.deepEqual(sections.map(section => section.entries.map(row => row.id)), parseFultonCalendarPage(markup().replaceAll("<br>", "<br>\n"), 2026).map(section => section.entries.map(row => row.id)));
});

test("a conflicting printed weekday withholds normalized dates and preserves its exact source wording", () => {
	const sections = parseFultonCalendarPage(markup().replace("Wednesday, November 11", "Monday, November 11"), 2026);
	const row = sections[0]!.entries.find(row => row.label === "Logic and Accuracy Testing of Voting Equipment")!;
	assert.equal(sections[0]!.status, "review-required");
	assert.equal(row.printedDate, "Monday, November 11");
	assert.equal(row.date, null);
	assert.equal(row.endDate, null);
	assert.match(row.issues[0]!, /weekday-date-conflict/u);
	assert.equal(sections[1]!.status, "parsed");
});

test("a synthetic offered later cycle reuses the parser while dates, heading, edition and postmark conditions must agree", () => {
	const future = parseFultonCalendarPage(markup(2028), readFultonCalendarIndex(index(2028)));
	assert.deepEqual(future.map(section => section.electionDate), ["2028-11-07", "2028-12-05"]);
	assert.throws(() => parseFultonCalendarPage(markup(2028), 2026));
	assert.throws(() => parseFultonCalendarPage(markup().replace("November 3, 2026 - General", "November 4, 2026 - General"), 2026));
	assert.throws(() => parseFultonCalendarPage(markup().replace("postmarked by December 1", "postmarked by December 2"), 2026));
	assert.throws(() => parseFultonCalendarPage(markup().replace("December 1, 2026)", "December 1, 2027)"), 2026));
});

test("an explicitly offered later November runoff works without calculating an unannounced election", () => {
	const sections = parseFultonCalendarPage(markup(2032), readFultonCalendarIndex(index(2032)));
	assert.deepEqual(sections.map(section => section.electionDate), ["2032-11-02", "2032-11-30"]);
	assert.equal(sections[1]!.entries.find(entry => entry.note)!.note, "(must be postmarked by November 30, 2032)");
	const sameDate = markup(2032).replaceAll("Tuesday, November 30", "Tuesday, November 2").replace("postmarked by November 30", "postmarked by November 2");
	assert.throws(() => parseFultonCalendarPage(sameDate, 2032), /must follow/u);
	const earlierDate = markup(2032).replaceAll("Tuesday, November 30", "Tuesday, October 26").replace("postmarked by November 30", "postmarked by October 26");
	assert.throws(() => parseFultonCalendarPage(earlierDate, 2032));
});

test("missing, duplicated and unfamiliar events, hidden facts and active content require review", () => {
	for (const body of [
		markup().replace("Voter Registration Deadline", "Unsupported deadline"),
		markup().replace("Last day to request an Absentee Ballot", "Voter Registration Deadline"),
		markup().replace("Tuesday, October 13<br>First day for Early Voting<br>", ""),
		markup().replace("PING_CONTENT_MB_MAIN", "other-marker"),
		markup().replace("style=\"display: none;\"></span>", "style=\"display: none;\">Monday, November 2</span>"),
		markup().replace("</div>", "<script>ignored()</script></div>"),
		markup().replace("</div>", "<iframe></iframe></div>"),
		markup().replace("November 11", "November 31")
	]) assert.throws(() => parseFultonCalendarPage(body, 2026));
});

test("unchanged reviewed robots retain their actual route permissions and changed policies remain held", () => {
	verifyFultonCalendarPolicy("\r\n\r\nUser-agent: *\r\nDisallow: /springboard-page*\r\nSitemap: sitemap.xml\r\n", 0);
	assert.throws(() => verifyFultonCalendarPolicy("User-agent: *\nDisallow: /\n", 0));
	assert.throws(() => verifyFultonCalendarPolicy(`<main>Changed privacy policy</main>${footer}`, 1));
	assert.throws(() => readFultonCalendarCapture({ schemaVersion: 1, type: "fulton-election-calendar-capture", documents: [] }));
});

test("calendar CSV keeps a held row's date empty and preserves its condition and issue", () => {
	const sections = parseFultonCalendarPage(markup().replace("Wednesday, November 11", "Monday, November 11"), 2026);
	const csv = fultonCalendarCsv({ schemaVersion: 1, type: "official-election-calendar-inventory", sourceId: fultonCalendarPublication.sourceId, stateCode: "GA", countyFips: "13121", retrievedAt: "2026-11-13T00:00:00.000Z", sourceSha256: "a".repeat(64), sourcePublishedAt: null, publicationApproved: false, electionOccurrenceConfirmed: false, documents: [], sections });
	assert.match(csv, /"Monday, November 11","",""/u);
	assert.match(csv, /weekday-date-conflict/u);
	assert.match(csv, /must be postmarked by December 1, 2026/u);
});

test("rollovers preserve unexpired elections and events, while later actually offered years can replace expired cycles", () => {
	const inventory = (year: number) => ({ schemaVersion: 1 as const, type: "official-election-calendar-inventory" as const, sourceId: fultonCalendarPublication.sourceId, stateCode: "GA" as const, countyFips: "13121" as const, retrievedAt: `${year}-11-01T00:00:00.000Z`, sourceSha256: "a".repeat(64), sourcePublishedAt: null, publicationApproved: false as const, electionOccurrenceConfirmed: false as const, documents: [], sections: parseFultonCalendarPage(markup(year), year) });
	const previous = inventory(2026);
	const changed = structuredClone(previous);
	changed.sections[1]!.entries.pop();
	assert.throws(() => compareFultonCalendarInventories(previous, changed, Date.parse("2026-11-13")), /removed retained/u);
	changed.sections = parseFultonCalendarPage(markup().replace("Wednesday, November 11", "Monday, November 11"), 2026);
	assert.throws(() => compareFultonCalendarInventories(previous, changed, Date.parse("2026-11-01")), /now requires review/u);
	assert.throws(() => compareFultonCalendarInventories(previous, inventory(2028), Date.parse("2026-11-13")), /removed retained/u);
	assert.doesNotThrow(() => compareFultonCalendarInventories(previous, inventory(2028), Date.parse("2028-11-01")));
	changed.retrievedAt = "2026-10-01T00:00:00.000Z";
	assert.throws(() => compareFultonCalendarInventories(previous, changed, Date.parse("2026-11-13")), /older/u);
});
