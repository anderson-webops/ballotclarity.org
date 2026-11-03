import type { StateBallotTablePage } from "../../src/state-ballot-pdf-grid.js";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { bucksPolicyReceipts } from "../../src/state-ballot-bucks-collection.js";
import { bucksHash, bucksIndexUrl, bucksNoticeUrl, bucksOrigin, bucksSource } from "../../src/state-ballot-bucks.js";

const policies = JSON.parse(readFileSync(new URL("../fixtures/bucks-policies.json", import.meta.url), "utf8")) as Record<string, string>;

export function bucksFixture(electionDate = "2026-11-03") {
	const epoch = Date.parse(`${electionDate}T12:00:00Z`) - 86400000;
	const capturedAt = new Date(epoch).toISOString();
	const year = electionDate.slice(0, 4);
	const day = Number(electionDate.slice(-2));
	const offeredUrl = `${bucksOrigin}/DocumentCenter/View/27847`;
	const canonicalUrl = `${offeredUrl}/${year}-General-Election---Official-Candidate-Listing---UPD-09-17-${year}?bidId=`;
	const index = `<div id="mainWrapTS"><h1 id="versionHeadLine">Running For Office</h1><a href="${offeredUrl}">${year} General Election Unofficial Candidate Listing - Updated 08.11.${year}</a></div>${policies.indexLegal}`;
	const notice = `<div id="mainWrapTS"><a href="/DocumentCenter/View/28541">UMOVA Notice for the November ${day}, ${year} General Election</a><p>The County of Bucks announces that the General Election will be held on November ${day} , ${year}.</p></div>${policies.noticeLegal}`;
	const pdf = Buffer.from("%PDF-controlled-bucks-fixture");
	const columns = [50, 499, 619, 814, 924];
	const cells: StateBallotTablePage["cells"] = [];
	const add = (column: number, top: number, bottom: number, text: string) => cells.push({ bounds: [columns[column]!, top, columns[column + 1]!, bottom], text, logicalText: text });
	for (const [index, label] of ["Election:", "Vote for:", "Candidate's Name:", "Political Party:"].entries()) add(index, 54, 69, label);
	let top = 69;
	for (const group of [
		{ label: "Pennsylvania Governor and Lieutenant Governor - 4 Year Term (Vote for 1)", ticket: true, rows: [["Alex Sample, For Governor", "Democratic"], ["Blair Example, For Lieutenant Governor", "Democratic"], ["Casey Sample, For Governor", "Republican"], ["Devon Example, For Lieutenant Governor", "Republican"]] },
		{ label: "1st Congressional District - Representative in U.S. Congress - 2 Year Term (Vote for 1)", rows: [["Evan Sample", "Democratic"], ["Finley Example", "Republican"]] },
		{ label: "6th Senatorial District - Senator in the General Assembly - 4 Year Term (Vote for 1)", rows: [["Gray Sample", "Democratic"], ["Harper Example", "Republican"]] },
		{ label: "18th Legislative District - Representative in the General Assembly - 2 Year Term (Vote for 1)", rows: [["Indigo Sample", "Forward Independent"], ["Jules Example", "Independent Party"], ["Kai Sample", "Republican"]] }
	]) {
		const bottom = top + group.rows.length * 18;
		add(0, top, bottom, group.label);
		add(1, top, bottom, group.ticket ? "Vote for the Candidates of One Party for Governor and Lieutenant Governor" : "Vote for One");
		for (const [index, row] of group.rows.entries()) {
			add(2, top + index * 18, top + (index + 1) * 18, row[0]!);
			add(3, top + index * 18, top + (index + 1) * 18, row[1]!);
		}
		top = bottom;
	}
	const tables: StateBallotTablePage[] = [{ number: 1, width: 1008, height: 612, text: cells.map(cell => cell.text).join(" "), cells }];
	const page = (url: string, body: string) => ({ url, body, sha256: bucksHash(body), retrievedAt: capturedAt });
	const capture = { schemaVersion: 1, type: "bucks-candidate-capture", policies: bucksPolicyReceipts, index: page(bucksIndexUrl, index), notice: page(bucksNoticeUrl, notice), document: { url: canonicalUrl, sha256: bucksHash(pdf), retrievedAt: capturedAt, tables, redirect: { url: offeredUrl, status: 301, location: `${new URL(canonicalUrl).pathname}?bidId=`, retrievedAt: capturedAt } } };
	const responses = new Map([
		[`${bucksOrigin}/robots.txt`, { status: 200, body: Buffer.from(policies.robots!), contentType: "text/plain", etag: undefined }],
		[`${bucksOrigin}/copyright`, { status: 200, body: Buffer.from(policies.copyright!), contentType: "text/html", etag: undefined }],
		[`${bucksOrigin}/privacy`, { status: 200, body: Buffer.from(policies.privacy!), contentType: "text/html", etag: undefined }],
		[bucksIndexUrl, { status: 200, body: Buffer.from(index), contentType: "text/html", etag: undefined }],
		[bucksNoticeUrl, { status: 200, body: Buffer.from(notice), contentType: "text/html", etag: undefined }],
		[offeredUrl, { status: 301, body: Buffer.alloc(0), contentType: "text/html", etag: undefined, location: capture.document.redirect.location }],
		[canonicalUrl, { status: 200, body: pdf, contentType: "application/pdf", etag: undefined }]
	]);
	return { epoch, source: bucksSource(electionDate), capturedAt, offeredUrl, canonicalUrl, pdf, capture, tables, responses, body: () => JSON.stringify(capture) };
}
