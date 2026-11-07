import type { FairbanksCandidateDocument } from "../../src/fairbanks-ballot-candidates.js";
import type { FairbanksPublicationCapture } from "../../src/fairbanks-election-publications.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFairbanksBallotCandidates } from "../../src/fairbanks-ballot-candidates.js";
import { fairbanksElectionIndexUrl, fairbanksPublicationAccessReview } from "../../src/fairbanks-election-publications.js";

export const fairbanksFixtureClock = "2026-11-07T08:00:00.000Z";
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const fixture = (name: string) => readFileSync(new URL(`./fairbanks-publication-${name}`, import.meta.url), "utf8");
const columns = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";
interface Line { text: string; left: number; top: number; right: number; bottom: number }
export function fairbanksOval(left: number, top: number) {
	return `<path fill="none" stroke="rgb(0%,0%,0%)" stroke-width="0.6" d="M 5 0 C 5 2.25 2.75 4 0 4 C -2.75 4 -5 2.25 -5 0 C -5 -2.25 -2.75 -4 0 -4 C 2.75 -4 5 -2.25 5 0" transform="matrix(1,0,0,-1,${left - 10},${top + 4})"/>`;
}
export function fairbanksNativeSample(year = 2026) {
	const electionDate = year === 2026 ? "2026-10-06" : "2027-10-05";
	const printed = year === 2026 ? "October 6, 2026" : "October 5, 2027";
	const current = year === 2026 ? fairbanksFixtureClock : "2027-10-01T08:00:00.000Z";
	const urls = ["https://www.fnsb.gov/DocumentCenter/View/28941/FNSB-Sample-Ballot-PDF", "https://www.fnsb.gov/DocumentCenter/View/29012/Notice-of-Election-PDF"];
	const page = (url: string, body: string) => ({ url, body, sha256: hash(body), capturedAt: current, checkedAt: current });
	const index = `<html><div id="page"><h1>Election Information</h1><p>Municipal elections are conducted each year on the first Tuesday in October.</p><table><tr><td>Regular Municipal Election Day</td><td>Tuesday, ${printed} Polls Open from 7:00 a.m. to 8:00 p.m.</td></tr></table><a href="${urls[0]}">FNSB Sample Ballot (PDF)</a><a href="${urls[1]}">Notice of Election (PDF)</a></div>${fixture("legal.html")}</html>`;
	const capture: FairbanksPublicationCapture = {
		schemaVersion: 1,
		type: "fairbanks-election-publication-capture",
		accessReview: { ...fairbanksPublicationAccessReview, reviewedAt: new Date(Date.parse(current) - 1000).toISOString() },
		policies: [page("https://www.fnsb.gov/robots.txt", fixture("robots.txt").replace(/\n/gu, "\r\n")), page("https://www.fnsb.gov/accessibility", fixture("accessibility.html"))],
		index: page(fairbanksElectionIndexUrl, index),
		documents: urls.map((url, position) => {
			const body = `%PDF-1.7\nSynthetic native ${position}`;
			return { ...page(url, body), body: Buffer.from(body).toString("base64"), kind: position === 0 ? "sample" : "notice", text: `${position ? `Notice of Elections\nTuesday, ${printed}` : `REGULAR ELECTION - ${printed.toUpperCase()}`}\nFairbanks North Star Borough\f${position ? "Other page\fOther page\fOther page\f" : ""}` };
		})
	};
	const line = (text: string, left: number, top: number, width = 170): Line => ({ text, left, top, right: left + width, bottom: top + 8 });
	const borough = [line("OFFICIAL BALLOT", 260, 100), line(`REGULAR ELECTION - ${printed.toUpperCase()}`, 200, 120, 220), line("FAIRBANKS NORTH STAR BOROUGH", 210, 140, 200), line("BOROUGH ASSEMBLY SEAT D", 105, 205), line(`${3}-Year Term (${year}-${year + 3})`, 130, 220, 120), line("Vote For Not More Than One (1)", 115, 235, 150), line("Jordan Avery", 96, 260, 90), line("Write-In", 96, 280, 60), line("INTERIOR ALASKA NATURAL GAS", 328, 205, 190), line("UTILITY (IGU) BOARD", 350, 218), line("AT-LARGE SEAT C", 350, 231), line(`3-Year Term (${year}-${year + 3})`, 360, 245, 120), line("Vote For Not More Than One (1)", 350, 260, 160), line("Alex Morgan", 330, 280, 90), line("Write-In", 330, 300, 60), line("END OF BALLOT", 260, 700)];
	const city = (north: boolean) => [line("OFFICIAL BALLOT", 360, 100), line(`REGULAR ELECTION - ${printed.toUpperCase()}`, 310, 120, 220), line(north ? "CITY OF NORTH POLE" : "CITY OF FAIRBANKS", 355, 140), line(north ? "NORTH POLE CITY COUNCIL" : "FAIRBANKS CITY COUNCIL SEAT E", 218, 205, 180), line(`3-Year Term (${year}-${year + 3})`, 250, 220), line(`Vote For Not More Than ${north ? "Two (2)" : "One (1)"}`, 237, 235), line(north ? "Morgan Lane" : "Casey Reed", 222, 260, 80), ...(north ? [line("Taylor Park", 222, 280, 80)] : []), line("Write-In", 222, 300, 60), ...(north ? [line("Write-In", 222, 320, 60)] : []), line("END OF BALLOT", 350, 700)];
	borough.push(line("may ask for a new ballot.", 80, 165, 160));
	const withInstructions = (north: boolean) => [...city(north), line("may ask for a new ballot.", 210, 165, 160)];
	const asXml = (lines: Line[], width = 792, height = 792) => `<page width="${width}" height="${height}">${lines.map(value => `<line xmin="${value.left}" ymin="${value.top}" xmax="${value.right}" ymax="${value.bottom}">${value.text}</line>`).join("")}</page>`;
	const proof = (lines: Line[], number: number, width = 792, height = 792) => ({ page: number, width, height, dpi: 300 as const, pngSha256: hash("Synthetic rendered fixture"), ocr: `${columns}\n${lines.map((value, index) => `5\t1\t1\t1\t${index + 1}\t1\t${value.left * 300 / 72}\t${value.top * 300 / 72}\t${(value.right - value.left) * 300 / 72}\t${(value.bottom - value.top) * 300 / 72}\t96\t${value.text}`).join("\n")}\n`, svg: `<svg width="${width}pt" height="${height}pt" viewBox="0 0 ${width} ${height}">${lines.filter(value => /^(?:Jordan Avery|Alex Morgan|Casey Reed|Morgan Lane|Taylor Park|Write-In)$/u.test(value.text)).map(value => fairbanksOval(value.left, value.top)).join("")}</svg>` });
	const documents: FairbanksCandidateDocument[] = [
		{ kind: "sample", geometry: geometryData("sample", 1), sourceSha256: capture.documents[0]!.sha256, bbox: `<doc>${asXml(borough, 612, 1008)}</doc>`, pages: [proof(borough, 1, 612, 1008)] },
		{ kind: "notice", geometry: geometryData("notice", 4), sourceSha256: capture.documents[1]!.sha256, bbox: `<doc>${asXml([line("Notice", 50, 50)])}${asXml(borough)}${asXml(withInstructions(false))}${asXml(withInstructions(true))}</doc>`, pages: [proof(borough, 2), proof(withInstructions(false), 3), proof(withInstructions(true), 4)] }
	];
	return { capture, documents, now: Date.parse(current), electionDate };
}

function geometryData(kind: "sample" | "notice", count: number) {
	const mediaBox = kind === "sample" ? [0, 0, 612, 1008] : [0, 0, 792, 792];
	return { schemaVersion: 1 as const, objectsSha256: hash(`Synthetic inspected metadata ${kind}`), pages: Array.from({ length: count }, (_value, index) => ({ page: index + 1, mediaBox, cropBox: mediaBox, rotation: 0 as const, userUnit: 1 as const })) };
}
export function fairbanksSyntheticCandidateCapture(year = 2026) {
	const data = fairbanksNativeSample(year);
	const native = { tools: { textSha256: hash("Synthetic text tool"), rendererSha256: hash("Synthetic raster tool"), vectorSha256: hash("Synthetic vector tool"), inspectorSha256: hash("Synthetic metadata tool"), readerSha256: hash("Synthetic recognition tool"), readerVersion: "tesseract 5.5.4" }, prepared: readFairbanksBallotCandidates(data.capture, data.documents, data.now), documents: data.documents };
	return { ...data, native, body: JSON.stringify({ schemaVersion: 1, type: "fairbanks-candidate-capture", capture: data.capture, native }) };
}
