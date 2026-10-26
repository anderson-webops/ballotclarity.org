import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { tuscolaDiscoveryUrl, tuscolaPolicyReceipts } from "../../src/state-ballot-tuscola-collection.js";

const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export const tuscolaWord = (left: number, top: number, value: string, height = 7.503, width = value.length * 3.8) => `<word xMin="${left}" xMax="${left + width}" yMin="${top}" yMax="${top + height}">${escape(value)}</word>`;
export function tuscolaFixture(year = 2026) {
	const day = year === 2026 ? "03" : "07";
	const page = (number: number, words: string[]) => `<page width="792" height="612">${[
		tuscolaWord(286, 21, "OFFICIAL CANDIDATE LIST", 14.3991, 220),
		tuscolaWord(727, 22, `Page ${number}`, 8.9991, 30),
		tuscolaWord(302, 41, `11/${day}/${year} - STATE GENERAL`, 12.5991, 188),
		tuscolaWord(350, 56, "TUSCOLA (79)", 12.5991, 90),
		...words
	].join("")}</page>`;
	const office = (top: number, title: string, term = "4 Year Term - Vote for not more than 1") => [
		tuscolaWord(38, top, title, 8.9991),
		tuscolaWord(38, top + 15, term),
		tuscolaWord(38, top + 30, "PARTY", 6.75),
		tuscolaWord(142.2, top + 30, "CANDIDATE", 6.75),
		tuscolaWord(686, top + 30, "STATUS", 6.75)
	];
	const person = (top: number, name: string, party: string) => [tuscolaWord(38, top, party), tuscolaWord(142.2, top, name)];
	const listing = `<html><doc>${page(1, [
		...office(85, "GOVERNOR AND LIEUTENANT GOVERNOR"),
		...person(130, "Sample Lead", "DEM"),
		...person(150, "Sample Mate", "DEM"),
		...person(170, "Other Lead", "REP"),
		...person(190, "Other Mate", "REP"),
		...office(220, "UNITED STATES SENATOR", "6 Year Term - Vote for not more than 1"),
		...person(265, "Cassie Piché", "LIB"),
		...office(300, "CLERK (EXAMPLE TOWNSHIP)", `Partial Term Ending 12/01/${year + 2} - Vote for not more than 1`),
		...person(345, "Example Ford (I)", "NP"),
		...office(390, "VIL PRESIDENT (VILLAGE OF EXAMPLE)"),
		tuscolaWord(38, 435, "No candidates on ballot"),
		tuscolaWord(40.5, 480, "PROPOSAL", 10.9991)
	])}${page(2, [tuscolaWord(38, 90, "COUNTY PROPOSAL", 8.9991)])}</doc></html>`;
	const ballot = [
		"Governor and",
		"Lieutenant Governor",
		"Vote for not more than 1",
		"Sample Lead",
		"Sample Mate",
		"Democrat",
		"Other Lead",
		"Other Mate",
		"Republican",
		"Secretary of State",
		"Cassie Piché",
		"Example Ford",
		"OFFICIAL BALLOT",
		"General Election",
		`Tuesday,November ${Number(day)}, ${year}`,
		"Tuscola County, Michigan",
		"VOTE BOTH FRONT AND BACK OF BALLOT",
		"\f",
		"Proposal text",
		"VOTE BOTH FRONT AND BACK OF BALLOT",
		"\f"
	].join("\n");
	return { listing, ballot };
}

export function tuscolaDiscoveryFixture(year = 2026) {
	const day = year === 2026 ? 3 : 7;
	const url = (kind: string) => `https://www.tuscolacounty.org/elections/${year}/11/${encodeURIComponent(kind === "candidates" ? `Official Candidate List - November ${year}.pdf` : `Sample Ballots - November ${day} ${year}.pdf`)}`;
	const body = `${readFileSync(new URL("../fixtures/tuscola-policy.html", import.meta.url), "utf8")}<h2>Tuscola County Election Information</h2><div class="full electionRes"><p>${year}, November ${day}${day === 3 ? "rd" : "th"}</p><ul><li><a href="${url("candidates")}">Official Candidate List - November ${year}</a></li><li><a href="${url("samples")}">Sample Ballots - November ${day} ${year}</a></li></ul></div>`;
	const hash = (value: string) => createHash("sha256").update(value).digest("hex");
	const fixture = tuscolaFixture(year);
	return { schemaVersion: 1, type: "tuscola-discovery", policies: tuscolaPolicyReceipts, index: { url: tuscolaDiscoveryUrl, body, sha256: hash(body), retrievedAt: `${year}-10-20T00:00:00.000Z` }, documents: [[{ url: url("candidates"), text: fixture.listing, sha256: hash(url("candidates")), retrievedAt: `${year}-10-20T00:00:01.000Z` }, { url: url("samples"), text: fixture.ballot, sha256: hash(url("samples")), retrievedAt: `${year}-10-20T00:00:02.000Z` }]] };
}
