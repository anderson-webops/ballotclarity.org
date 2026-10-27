import type { StateBallotSource } from "../../src/state-ballot-sources.js";
import { nycBoroughs } from "../../src/state-ballot-nyc.js";

export const nycDraftSource: StateBallotSource = { id: "ny-nyc-reader-2026", stateCode: "NY", label: "NYC synthetic reader fixture", electionDate: "2026-11-03", url: "https://www.vote.nyc/page/list-candidates", pageUrl: "https://www.vote.nyc/page/list-candidates", format: "reviewed-pdf", retrievalPolicy: "manual-snapshot", snapshotStorage: "external" };
const escaped = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
function field(text: string, left: number, top: number, font = 3, width = 500) {
	const bold = [0, 1, 2, 3, 5].includes(font);
	const value = escaped(text);
	return `<text top="${top}" left="${left}" width="${width}" height="16" font="${font}">${bold ? `<b>${value}</b>` : value}</text>`;
}
export function nycDocumentFixture(year = "2026", day = "03") {
	const pages: string[] = [];
	const date = `9/11/${year} 10:26:11AM`;
	const election = `General Election ${year} - 11/${day}/${year}`;
	const fonts = [24, 16, 18, 13, 12, 21, 13, 11].map((size, id) => `<fontspec id="${id}" size="${size}" family="AAAAAA+Arial${[0, 1, 2, 3, 5].includes(id) ? ",Bold" : ""}" color="#000000"/>`).join("");
	pages.push(fonts + field("THE CONTEST LIST", 476, 373, 0) + field(election, 442, 415, 2) + field(`Printed On: ${date}`, 466, 462, 1));
	for (const [index, borough] of nycBoroughs.entries()) {
		const maximum = index ? 2 : 3;
		const header = field("THE CONTEST LIST", 483, 31, 2) + field(election, 421, 56, 2) + field(`${borough} All Parties and Independent Bodies`, 398, 81, 1) + field("TENTATIVE", 977, 30, 3, 71) + field("SUBJECT TO CHANGE", 905, 48, 3, 143) + field("BOARD OF ELECTIONS", 8, 30) + field("IN THE CITY OF NEW YORK", 8, 48) + field("PRINTED AS OF:", 8, 66) + field(date, 8, 84) + field("Party\\Ind. Body", 26, 129, 4, 83) + field("Name", 260, 129, 4, 36) + field("Address", 575, 129, 4, 47);
		const footer = (number: number) => field(`Page ${number} of ${maximum}`, 1056, 874, 6, 76);
		const intro = field("All Parties and Independent Bodies", 399, 373, 5) + field("Nominations for the following offices and positions:", 417, 410) + field("Governor/Lieutenant Governor", 258, 462, 6) + field("State Senator", 308, 480, 6) + field("Judge of the Civil Court - County", 253, 498, 6);
		pages.push(header + intro + footer(index ? 1 : 2));
		const candidate = (party: string, name: string, top: number) => field(party, 26, top, 7, 150) + field(name, 260, top, 7, 300) + field("Private fixture mailing field", 575, top, 7);
		const content = field("Governor/Lieutenant Governor - Citywide, # to be elected: 1", 17, 157) + candidate("Democratic", "Example Governor / Example Lieutenant", 194) + candidate("Working Families", "Example Governor / Example Lieutenant", 215) + field(`State Senator - ${index + 1}th Senatorial District, # to be elected: 1`, 17, 273) + candidate("New Civic Party", `Example Senator ${borough}`, 310) + field(`Judge of the Civil Court - County - ${borough}, # to be elected: 3`, 17, 369) + candidate("Democratic", `Example Judge ${borough}`, 406) + field("Proposal Number 1, a Question: Proposed Charter Amendment: Example policy - Citywide, # to be elected: 1", 17, 460) + field("The official proposal changes a city policy.", 14, 504, 6) + field("Yes", 260, 548, 7) + field("No", 260, 569, 7);
		pages.push(header + content + footer(maximum));
	}
	return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE pdf2xml SYSTEM "pdf2xml.dtd">\n<pdf2xml>${pages.map((body, index) => `<page number="${index + 1}" width="1188" height="918">${body}</page>`).join("")}</pdf2xml>`;
}
export function nycIndexFixture(year = "2026", day = "3") {
	const prefix = `November ${day}, ${year}`;
	return `<div id="block-basic-content"><div class="group-right"><h2>${prefix} General Election Contest List</h2><a href="/sites/default/files/pdf/candidates/${year}/actually-published-${year}.pdf">${prefix} General Contest List - (PDF)</a><a href="/sites/default/files/pdf/candidates/${year}/actual-other-name.rtf">${prefix} General Contest List - (DOC)</a></div></div>`;
}
