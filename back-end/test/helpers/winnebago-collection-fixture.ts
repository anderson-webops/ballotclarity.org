import { winnebagoNativePages } from "../../src/state-ballot-winnebago-native.js";
import { winnebagoField } from "./winnebago-fixture.js";

export function winnebagoSvgFixture(xml: string, page = 1) {
	const uses = winnebagoNativePages(xml)[page - 1]!.flatMap(field => [...field.text.replace(/\s/gu, "")].map((_character, index) => `<use href="#glyph-0-0" x="${field.left / 1.5 + 0.1 + index}" y="${field.top / 1.5 + 2}"/>`));
	return `<svg width="612pt" height="792pt" viewBox="0 0 612 792"><defs><g id="glyph-0-0"><path d="M 0 0 L 1 0 L 1 -1 Z"/></g></defs><g fill="rgb(0%, 0%, 0%)" fill-opacity="1">${uses.join("")}</g></svg>`;
}

export function winnebagoWriteInFixture(year = 2028) {
	const day = year === 2026 ? 3 : 7;
	const row = (office: string, name: string, top: number) => winnebagoField(office, 162, top) + winnebagoField(`- ${name}`, 540, top);
	return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE pdf2xml SYSTEM "pdf2xml.dtd">\n<pdf2xml><page number="1" width="918" height="1188">${[
		winnebagoField("WINNEBAGO COUNTY", 327, 76),
		winnebagoField("VALID WRITE-IN CANDIDATE", 283, 118),
		winnebagoField("GENERAL ELECTION", 333, 161),
		winnebagoField(`NOVEMBER ${day}, ${year}`, 349, 204),
		winnebagoField("GOVERNOR /", 162, 286),
		row("LEIUTENANT GOVERNOR –", "SAMPLE SINGLE", 307),
		row("GOVERNOR -", "SAMPLE UNPAIRED", 369),
		row("GOVERNOR /", "SAMPLE HEAD", 431),
		row("LEIUTENANT GOVERNOR -", "SAMPLE PARTNER", 451),
		row("LEIUTENANT GOVERNOR -", "SAMPLE OTHER", 514),
		row("STATE TREASURER -", "SAMPLE TREASURER", 576),
		winnebagoField("17", 162, 640).replace("width=\"200\"", "width=\"16\""),
		winnebagoField("th", 180, 638).replace("width=\"200\"", "width=\"8\""),
		winnebagoField("CONGRESSIONAL DISTRICT -", 191, 640),
		winnebagoField("- SAMPLE CONGRESS", 540, 640),
		row("COUNTY BOARD DISTRICT 5", "SAMPLE LOCAL", 702)
	].join("")}</page></pdf2xml>`;
}

export function winnebagoFontFixture() {
	return {
		qpdf: [{ jsonversion: 2 }, {
			"obj:1 0 R": { value: { "/Resources": { "/Font": { "/F1": "2 0 R" } } } },
			"obj:2 0 R": { value: { "/Type": "/Font", "/Subtype": "/TrueType", "/BaseFont": "/TimesNewRomanPS-BoldMT", "/Encoding": "/WinAnsiEncoding", "/FontDescriptor": "3 0 R", "/FirstChar": 32, "/LastChar": 126, "/Widths": Array.from({ length: 95 }).fill(500) } },
			"obj:3 0 R": { value: { "/Type": "/FontDescriptor", "/FontName": "/TimesNewRomanPS-BoldMT", "/Flags": 32 } }
		}]
	};
}
