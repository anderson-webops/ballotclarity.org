import type { FultonMunicipalEvidence } from "../../src/fulton-municipal-evidence.js";
import { fultonMunicipalRenderBox, fultonMunicipalRenderFields } from "../../src/fulton-municipal-evidence.js";

export function municipalNativeFixture(date = "December 02, 2025") {
	const field = (top: number, left: number, text: string, font: number, bold = false) => `<text top="${top}" left="${left}" width="150" height="20" font="${font}">${bold ? `<b>${text}</b>` : text}</text>`;
	return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE pdf2xml SYSTEM "pdf2xml.dtd"><pdf2xml><page number="1" width="918" height="1512">
	<fontspec id="1" size="18" family="ABCDEF+Arial" color="#231f20"/><fontspec id="2" size="17" family="ABCDEF+ArialNarrow" color="#231f20"/>
	<fontspec id="3" size="14" family="ABCDEF+ArialMT" color="#231f20"/><fontspec id="4" size="15" family="ABCDEF+ArialNarrow" color="#231f20"/>
	<fontspec id="5" size="12" family="ABCDEF+ArialMT" color="#231f20"/>
	${field(50, 90, "COMPOSITE SAMPLE BALLOT", 1, true)}${field(80, 90, "Fulton County, Georgia", 1)}${field(110, 90, `Municipal General Runoff Election - ${date}`, 1)}
	${Array.from({ length: 15 }, (_, index) => field(150 + index * 20, 90, "Instruction text", 3)).join("")}
	${field(490, 93, "General Election Runoff", 1, true)}${field(510, 93, "City of Atlanta", 1, true)}
	${field(550, 93, "For Board of Education Member", 2, true)}${field(575, 93, "District 8 At Large", 2, true)}${field(600, 93, "(Vote for One)", 3)}
	${field(630, 107, "First Candidate", 4, true)}${field(680, 107, "Second Candidate", 4, true)}${field(699, 107, "(Incumbent)", 5)}
	${field(490, 356, "General Election Runoff", 1, true)}${field(510, 356, "City of East Point", 1, true)}
	${field(550, 370, "For Mayor", 2, true)}${field(580, 370, "(Vote for One)", 3)}${field(620, 370, "Joshua Example, IV", 4, true)}${field(670, 370, "Another Candidate", 4, true)}
	</page></pdf2xml>`;
}

export function municipalRenderedFixture(printedDate = "December 02, 2025"): FultonMunicipalEvidence {
	const xml = municipalNativeFixture(printedDate);
	const fields = fultonMunicipalRenderFields(xml);
	const boxes = fields.map(field => ({ ...fultonMunicipalRenderBox(field), pngSha256: "a".repeat(64) }));
	const header = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";
	const row = (level: number, page: number, left: number, top: number, width: number, height: number, text = "", confidence = -1) => [level, page, 1, 1, 1, 1, left, top, width, height, confidence, text].join("\t");
	const ocr = `${header}\n${boxes.map((box, index) => [row(1, index + 1, 0, 0, box.width, box.height), row(5, index + 1, 2, 2, box.width - 4, box.height - 4, fields[index]!.text, 95)].join("\n")).join("\n")}\n`;
	const full = `${header}\n${row(1, 1, 0, 0, 2550, 4200)}\n${boxes.map((box, index) => row(5, 1, box.left + 2, box.top + 2, box.width - 4, box.height - 4, fields[index]!.text, 95)).join("\n")}\n`;
	return { schemaVersion: 1, type: "fulton-municipal-rendered-evidence", source: { url: "https://www.fultoncountyga.gov/-/media/elections/runoff.pdf", sha256: "b".repeat(64), bytes: 100, retrievedAt: "2026-11-13T20:38:39.838Z" }, xml, objects: JSON.stringify({ pages: [{ object: "1 0 R" }], qpdf: [{}, { "obj:1 0 R": { value: { "/Type": "/Page", "/MediaBox": [0, 0, 612, 1008] } } }] }), page: { width: 2550, height: 4200, dpi: 300, pngSha256: "c".repeat(64), ocr: full }, fields: boxes, ocr, tools: { xmlSha256: "d".repeat(64), rendererSha256: "e".repeat(64), inspectorSha256: "f".repeat(64), readerSha256: "a".repeat(64), readerVersion: "tesseract 5.5.4" } };
}
