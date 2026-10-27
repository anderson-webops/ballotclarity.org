import type { StateBallotSource } from "../../src/state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { chicagoNativePages } from "../../src/state-ballot-chicago-native.js";

const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export const chicagoDraftSource: StateBallotSource = { id: "il-chicago-2026", stateCode: "IL", label: "Synthetic Chicago document", electionDate: "2026-11-03", url: "https://example.com/candidates.pdf", pageUrl: "https://example.com/elections", format: "reviewed-pdf", retrievalPolicy: "manual-snapshot", snapshotStorage: "external" };

export function chicagoFixture(year = 2026, secondQuestion = false, water = false) {
	const day = year === 2026 ? 3 : 7;
	const date = `November ${day}, ${year}`;
	const field = (top: number, left: number, text: string, font = 6, width = 600) => `<text top="${top}" left="${left}" width="${width}" height="15" font="${font}">${escape(text)}</text>`;
	const row = (top: number, number: number, name: string, party: string) => field(top, 125, `(${number})`, 6, 30) + field(top, 170, `${name} (${party})`, 6, 400) + field(top, 735, "Candidate", 6, 60);
	const question = (top: number, audience: string) => field(top, 100, `To the Voters of ${audience}:`, 8) + field(top + 30, 100, "ADVISORY QUESTION REGARDING A LOCAL PROGRAM", 2) + field(top + 60, 72, "\"Should the city continue the local program?\"", 3) + field(top + 90, 416, "Yes", 11, 30) + field(top + 115, 419, "No", 11, 30);
	const fonts = [12, 13, 21, 13, 19, 12, 12, 12, 21, 12, 19, 17].map((size, id) => `<fontspec id="${id}" size="${size}" family="${id === 7 ? "Arial" : `CIDFont+F${id % 5 + 1}`}" color="${id < 2 ? "#000080" : "#000000"}"/>`).join("");
	const pageCount = secondQuestion ? 2 : 1;
	const first = field(114, 92, `This Unofficial candidate list for the ${date} election includes only the offices and the names of candidates whose districts include all or`, 0, 724)
		+ field(128, 92, "part of the City of Chicago. Please note: This list will be updated if filing change.", 0)
		+ field(150, 620, `Status as of 9/11/${year} 3:47:15 PM`, 1, 220)
		+ field(171, 191, `Candidate Filings in Ballot Order, ${date}`, 2)
		+ field(209, 118, "Ballot No. Candidate", 3, 117) + field(209, 771, "Status", 3, 35)
		+ field(243, 89, "United States Senator", 4) + field(271, 106, "Vote for One", 5) + row(290, 1, "Example Senator", "Democratic") + row(315, 2, "Another Senator", "Independent")
		+ field(350, 89, "Governor & Lieutenant Governor", 4) + field(380, 106, "Vote for One", 5) + row(405, 3, "Example Governor & Example Lieutenant", "Republican")
		+ field(450, 89, water ? "Metropolitan Water Reclamation District Commissioners Full 6-Year Term" : "Member of the Chicago Board of Education, Subdistrict 1A", 4, 760)
		+ field(480, 106, water ? "Vote for not more than Three" : "Vote for One", 5) + row(505, 4, "Example Local", "Nonpartisan")
		+ field(555, 100, `General Election Judicial Retention, ${date}`, 8)
		+ field(590, 50, "Judge, Circuit Court (Retention)", 9) + field(620, 298, "Example Judge", 10, 200)
		+ field(659, 302, "(201)", 11, 40) + field(660, 379, "Yes", 11, 40) + field(699, 302, "(202)", 11, 40) + field(700, 379, "No", 11, 40)
		+ field(745, 275, "Referenda and Local Options", 8) + question(780, "the 1st Ward")
		+ field(1132, 422, `Page 1 of ${pageCount}`, 7, 100);
	const pages = `<page number="1" width="918" height="1188">${fonts}${first}</page>${secondQuestion ? `<page number="2" width="918" height="1188">${question(40, "the 2nd Ward")}${field(1132, 422, "Page 2 of 2", 7, 100)}</page>` : ""}`;
	return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE pdf2xml SYSTEM "pdf2xml.dtd"><pdf2xml producer="poppler">${pages}</pdf2xml>`;
}

export function chicagoSvgFixture(xml: string, page = 1) {
	const fields = chicagoNativePages(xml)[page - 1]!;
	const shape = "<g id=\"glyph-0-0\"><path d=\"M 0 0 L 1 0 L 1 -1 L 0 -1 Z M 0 0\"/></g>";
	const glyphs = fields.map((field) => {
		const uses = [...field.text.replace(/\s/gu, "")].map((_, index) => `<use xlink:href="#glyph-0-0" x="${field.left / 1.5 + index * 0.8}" y="${field.top / 1.5 + 3}"/>`).join("");
		return `<g fill="${field.color === "#000080" ? "rgb(0%, 0%, 50.2%)" : "rgb(0%, 0%, 0%)"}" fill-opacity="1">${uses}</g>`;
	}).join("");
	return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="612pt" height="792pt" viewBox="0 0 612 792"><defs>${shape}</defs>${glyphs}</svg>`;
}

export function chicagoFontFixture(subset = false, swap = false) {
	const outline = (width: number) => {
		const body = Buffer.alloc(36);
		body.writeInt16BE(1, 0);
		body.writeInt16BE(width, 6);
		body.writeInt16BE(100, 8);
		body.writeUInt16BE(3, 10);
		for (let index = 0; index < 4; index++) body[14 + index] = 1;
		body.writeInt16BE(width, 20);
		body.writeInt16BE(-width, 24);
		body.writeInt16BE(100, 30);
		return body;
	};
	const first = outline(100);
	const second = subset ? Buffer.alloc(0) : outline(120);
	const composite = Buffer.alloc(20);
	composite.writeInt16BE(-1, 0);
	composite.writeInt16BE(100, 6);
	composite.writeInt16BE(100, 8);
	composite.writeUInt16BE(3, 10);
	composite.writeUInt16BE(2, 12);
	const shapes = [Buffer.alloc(0), Buffer.alloc(0), swap ? second : first, swap ? first : second, composite];
	const offsets = Buffer.alloc(12);
	let length = 0;
	for (const [index, shape] of shapes.entries()) {
		offsets.writeUInt16BE(length / 2, index * 2);
		length += shape.length;
	}
	offsets.writeUInt16BE(length / 2, 10);
	const head = Buffer.alloc(54);
	const maximum = Buffer.alloc(32);
	head.writeUInt32BE(0x00010000, 0);
	head.writeUInt32BE(0x5F0F3CF5, 12);
	head.writeUInt16BE(1000, 18);
	maximum.writeUInt32BE(0x00010000, 0);
	maximum.writeUInt16BE(5, 4);
	const tables = new Map<string, Buffer>([["head", head], ["maxp", maximum], ["loca", offsets], ["glyf", Buffer.concat(shapes)], ["cvt ", Buffer.alloc(2)], ["fpgm", Buffer.from([0])], ["prep", Buffer.from([0])], ["gasp", Buffer.from([0])]]);
	const directory = Buffer.alloc(12 + tables.size * 16);
	directory.writeUInt32BE(0x00010000, 0);
	directory.writeUInt16BE(tables.size, 4);
	const bodies: Buffer[] = [];
	let position = directory.length;
	let index = 0;
	for (const [name, bytes] of tables) {
		const entry = 12 + index++ * 16;
		directory.write(name, entry, "ascii");
		directory.writeUInt32BE(position, entry + 8);
		directory.writeUInt32BE(bytes.length, entry + 12);
		bodies.push(bytes);
		position += bytes.length;
	}
	return Buffer.concat([directory, ...bodies]);
}
