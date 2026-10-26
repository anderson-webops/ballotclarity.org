import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pulaskiDiscoveryUrl, pulaskiPolicyReceipts } from "../../src/state-ballot-pulaski-collection.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const footer = readFileSync(new URL("../fixtures/pulaski-policy-footer.html", import.meta.url), "utf8");
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const word = (value: string, left: number, top: number) => `<word xMin="${left}" xMax="${left + Math.min(180, value.length * 1.5)}" yMin="${top}" yMax="${top + 8}">${escape(value)}</word>`;

export function pulaskiNoticeFixture(year = 2026) {
	const day = year === 2028 ? 7 : 3;
	const ordinal = year === 2028 ? "th" : "rd";
	const page = (index: number, rows: [string, number, number][]) => `<page width="612" height="1008">${rows.map(row => word(...row)).join("")}${word(`November ${day}${ordinal} General Election`, 200, 982)}${word(`Page ${index} of 3`, 525, 982)}</page>`;
	return `<doc>${page(1, [
		["NOTICE OF ELECTION", 220, 20],
		[`November ${day}, ${year} General Election`, 180, 40],
		["**Provided by the Pulaski County Board of Election Commissioners**", 160, 60],
		["CANDIDATES FOR THIS ELECTION", 210, 500],
		["U.S. Senate", 36, 525],
		["Sample Senator-DEM", 36, 537],
		["State Representative District 77", 228, 525],
		["Justice of the Peace Example Person-DEM", 228, 537],
		["Little Rock City Director Ward 2", 420, 525],
		["Sample Person-IND", 420, 537],
		["Last Candidate-IND", 420, 960]
	])}${page(2, [
		["Pulaski County Assessor", 36, 20],
		["Pulaski County Assessor, Example Longname", 36, 32],
		["Person-DEM", 36, 44],
		["Unopposed Candidates:", 36, 70],
		["Attorney General", 36, 90],
		["Sample Attorney-REP", 36, 102],
		["Jacksonville Council Member W4 P1", 228, 20],
		["City Clerk-Treasurer Sample Clerk-IND", 228, 32],
		["Wrightsville Mayor", 420, 20],
		["Example Mayor-IND", 420, 32],
		["CONSTITUTIONAL AMENDMENTS (OR OTHER MEASURE) REFERRED TO THE PEOPLE BY THE GENERAL ASSEMBLY", 36, 700]
	])}${page(3, [["CONSTITUTIONAL AMENDMENTS (OR OTHER MEASURE) REFERRED TO THE PEOPLE BY THE GENERAL ASSEMBLY", 36, 20]])}</doc>`;
}
export function pulaskiDiscoveryFixture(year = 2026, pending = false) {
	const day = year === 2028 ? 7 : 3;
	const instant = `${year}-10-20T12:00:00.000Z`;
	const noticeUrl = `${pulaskiDiscoveryUrl}wp-content/uploads/110${day}${year}_Notice-of-Election_v1.pdf`;
	const calendarUrl = `${pulaskiDiscoveryUrl}wp-content/uploads/${year - 1}_${year}_Election-Dates_v1.pdf`;
	const body = `<main><b>${year} GENERAL ELECTION</b>${pending ? "" : `<a href="${noticeUrl}">Notice of Election ${year} General</a>`}<a href="${calendarUrl}">Scheduled Election Dates</a></main>${footer}`;
	return { schemaVersion: 1, type: "pulaski-discovery", policies: pulaskiPolicyReceipts, index: { url: pulaskiDiscoveryUrl, body, sha256: hash(body), retrievedAt: instant }, calendar: { url: calendarUrl, text: `${year} ELECTION DATES\nNovember ${day}, ${year}\nGeneral Election/Annual School Election Runoff\nwww.votepulaskiar.gov\f`, sha256: "a".repeat(64), retrievedAt: instant }, notices: pending ? [] : [{ url: noticeUrl, text: pulaskiNoticeFixture(year), sha256: "b".repeat(64), retrievedAt: instant }] };
}
