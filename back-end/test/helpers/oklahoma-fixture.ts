import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { oklahomaPolicyReceipts } from "../../src/state-ballot-oklahoma-collection.js";
import { oklahomaCandidateUrl, oklahomaCountyNames, oklahomaDiscoveryUrl, oklahomaHash, oklahomaHostingOrigin, oklahomaOrigin, oklahomaSource } from "../../src/state-ballot-oklahoma.js";

const policies = JSON.parse(readFileSync(new URL("../fixtures/oklahoma-policies.json", import.meta.url), "utf8")) as Record<string, string>;
const { shell } = JSON.parse(readFileSync(new URL("../fixtures/oklahoma-policy-shell.json", import.meta.url), "utf8")) as { shell: string };
export const oklahomaStatePage = (content: string) => `<main id="main">${content}</main>${shell}`;
export const oklahomaFixtureTable = (level: number, value: string) => `<table cellspacing="3" border="0" width="1000"><tr>${"<td width=\"10\"></td>".repeat(level - 1)}<td width="${1010 - level * 10}">${value}</td></tr></table>`;

export function oklahomaFixture(electionDate = "2026-11-03") {
	const epoch = Date.parse(`${electionDate}T12:00:00Z`) - 86400000;
	const capturedAt = new Date(epoch).toISOString();
	const year = electionDate.slice(0, 4);
	const calendarUrl = `${oklahomaOrigin}/elections/elections-results/next-election/${year === "2026" ? "" : `${year}-`}voter-information-calendar.html`;
	const index = oklahomaStatePage(`<h1>Next Election</h1><a href="${calendarUrl}">${year} Voter Information Calendar</a>`);
	const headings = ["Election Date", "Voter Registration Deadline", "Absentee Ballot Deadline", "Election Type", "Election Day Hours", "Early Voting Dates and Hours"];
	const calendar = oklahomaStatePage(`<h2>${year} Voter Information Calendar</h2><table><tr>${headings.map(value => `<th>${value}</th>`).join("")}</tr><tr><td>November ${Number(electionDate.slice(-2))} (1st Tuesday after 1st Monday)</td><td>October 9</td><td>October 19</td><td>General Elections</td><td>7 A.M. to 7 P.M.</td><td>October</td></tr></table>`);
	const names = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
	const table = oklahomaFixtureTable;
	const candidateBody = `<html lang="EN"><head><title>NOVEMBER / ${year} List of Elections</title></head><body><a name="00">NOVEMBER / ${year} LIST OF ELECTIONS</a>${oklahomaCountyNames.map((county, index) => `<a name="${String(index + 1).padStart(2, "0")}">${county}</a>${
		table(2, "STATE OFFICERS")}${table(3, "GOVERNOR")}${table(4, "Avery Example, REPUBLICAN")}${table(4, "Blair Sample, DEMOCRAT")
	}${table(2, "CONGRESSIONAL OFFICERS")}${table(3, `UNITED STATES REPRESENTATIVE - DISTRICT ${String(index % 5 + 1).padStart(2, "0")}`)}${table(4, `Morgan ${names[index % 5]}, INDEPENDENT`)
	}${table(2, "LEGISLATIVE, DISTRICT AND COUNTY OFFICERS")}${table(3, "STATE SENATOR - DISTRICT 17 (Unexpired Term)")}${table(4, "Parker Sample, REPUBLICAN")}${table(4, "Reese Example, DEMOCRAT")
	}${table(3, "STATE REPRESENTATIVE - DISTRICT 58")}${table(4, "Jordan Example, LIBERTARIAN")}${table(4, "Casey Sample, REPUBLICAN")
	}${table(3, "COUNTY ASSESSOR")}${table(4, `Taylor ${county}, REPUBLICAN`)}${table(4, `Drew ${county}, DEMOCRAT`)
	}${index < 2 ? table(2, "JUDICIAL OFFICERS") + table(3, "DISTRICT JUDGE - DISTRICT 4, OFFICE 2") + table(4, "Robin Example") + table(4, "Riley Sample") : ""
	}${index === 0 ? table(2, "CITY OF SYNTHETIC") + table(3, "COUNCILMEMBER - COUNCILMEMBER WARD 3 (Unexpired Term)") + table(4, "Harper Example") + table(4, "Skyler Sample") : ""
	}${table(2, "JUDICIAL RETENTION")}${table(3, "SUPREME COURT DISTRICT 1")}${table(2, "STATE QUESTIONS")}${table(3, "STATE QUESTION NO. 845")}`).join("")}<b>This file was created on: 10/1/${year} 8:00:00 AM</b></body></html>`;
	const page = (url: string, body: string) => ({ url, body, status: 200, sha256: oklahomaHash(body), retrievedAt: capturedAt });
	const capture = { schemaVersion: 1, type: "oklahoma-candidate-capture", policies: oklahomaPolicyReceipts, index: page(oklahomaDiscoveryUrl, index), calendar: page(calendarUrl, calendar) as ReturnType<typeof page> | null, candidates: page(oklahomaCandidateUrl, candidateBody) };
	const response = (body: string, contentType = "text/html", status = 200) => ({ body: Buffer.from(body), contentType, status, etag: undefined });
	const responses = new Map([
		[`${oklahomaOrigin}/robots.txt`, response(policies.robots!, "text/plain")],
		[`${oklahomaHostingOrigin}/robots.txt`, response("", "text/html", 404)],
		[`${oklahomaOrigin}/about/policy-disclaimers.html`, response(policies.policies!)],
		[`${oklahomaOrigin}/about/privacy-policy.html`, response(policies.privacy!)],
		[`${oklahomaOrigin}/about/linking-policy.html`, response(policies.linking!)],
		[`${oklahomaOrigin}/about/copyright-and-protection-acts.html`, response(policies.copyright!)],
		[oklahomaDiscoveryUrl, response(index)],
		[oklahomaCandidateUrl, response(candidateBody)],
		[calendarUrl, response(calendar)],
	]);
	return { source: oklahomaSource(electionDate), epoch, capturedAt, calendarUrl, capture, responses, body: () => JSON.stringify(capture) };
}
