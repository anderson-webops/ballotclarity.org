import type {
	AlabamaCell,
	AlabamaContent,
	AlabamaGlyph,
	AlabamaPdfDictionary,
	AlabamaPdfDocument,
	AlabamaTextSpan
} from "../../src/state-ballot-alabama-types.js";
import { Buffer } from "node:buffer";
import { readAlabamaContent } from "../../src/state-ballot-alabama-reader.js";
import { nycFontFixture } from "./nyc-native-fixture.js";

export function alabamaPdfFixture(body = ""): AlabamaPdfDocument {
	return {
		version: 2,
		qpdf: [
			{ jsonversion: 2, calledgetallpages: true },
			{
				"obj:1 0 R": { value: { "/Type": "/Catalog", "/Pages": "2 0 R" } },
				"obj:2 0 R": { value: { "/Type": "/Pages", "/Count": 1, "/Kids": ["3 0 R"] } },
				"obj:3 0 R": {
					value: {
						"/Type": "/Page",
						"/Parent": "2 0 R",
						"/Rotate": 0,
						"/MediaBox": [0, 0, 1224, 792],
						"/CropBox": [0, 0, 1224, 792],
						"/Resources": { "/Font": { "/TT1": "5 0 R" } },
						"/Contents": ["4 0 R"]
					}
				},
				"obj:4 0 R": { stream: { dict: {}, data: Buffer.from(body, "latin1").toString("base64") } },
				"obj:5 0 R": { value: { "/Type": "/Font", "/Subtype": "/TrueType", "/BaseFont": "/AAAAAA+ArialMT" } }
			}
		],
		pages: [{ object: "3 0 R", contents: ["4 0 R"] }],
		encrypt: { encrypted: false },
		attachments: {},
		acroform: { needappearances: false, fields: [] }
	};
}
export function alabamaPage(document: AlabamaPdfDocument) {
	return document.qpdf[1]["obj:3 0 R"].value as AlabamaPdfDictionary;
}
export function alabamaGlyph(character = "A", operation = 1, horizontal = 12, vertical = 31): AlabamaGlyph {
	return {
		character,
		font: "/TT1",
		fontParsed: true,
		fontProven: true,
		ink: [horizontal, vertical, horizontal + 1, vertical + 1],
		origin: [horizontal, vertical],
		clip: [0, 0, 1224, 792],
		clipped: false,
		fill: "black",
		alpha: 1,
		blend: "/Normal",
		overprint: false,
		render: 0,
		operation,
		sourceCharacter: 0,
		backgroundProven: true
	};
}
export function alabamaSpan(text: string, operation = 1, baseline = 31): AlabamaTextSpan {
	return {
		text,
		originalText: text,
		operation,
		sourceNonspaceGlyphs: 1,
		visibleGlyphs: 1,
		partialGlyphs: 0,
		fontParsed: true,
		fontProven: true,
		font: "/TT1",
		clip: [0, 0, 1224, 792],
		bounds: [12, baseline, 15, baseline + 1],
		baseline,
		fullyVisible: true,
		glyphs: [alabamaGlyph("A", operation, 12, baseline)]
	};
}
export function alabamaCellsFixture() {
	const cell = (bottom: number, top: number, spans: AlabamaTextSpan[]): AlabamaCell => ({
		bounds: [10, bottom, 50, top],
		borders: {
			left: [9.9, 10.1],
			right: [49.9, 50.1],
			bottom: [bottom - 0.1, bottom + 0.1],
			top: [top - 0.1, top + 0.1]
		},
		spans,
		text: spans.map(span => span.text).join(" ")
	});
	const vote = alabamaSpan("(Vote for One)", 1, 36);
	const header = cell(35, 40, [vote]);
	const candidate = cell(25, 35, [alabamaSpan("ALPHA CANDIDATE", 2, 31), alabamaSpan("Democrat", 3, 27)]);
	const end = cell(20, 25, [alabamaSpan("Write-in", 4, 21)]);
	return { vote, header, candidate, end, cells: [header, candidate, end] };
}
export function alabamaContentFixture(): AlabamaContent {
	return readAlabamaContent(alabamaPdfFixture());
}
export function alabamaFontFixture() {
	const program = nycFontFixture();
	for (let index = 0; index < program.readUInt16BE(4); index++) {
		const entry = 12 + index * 16;
		if (program.subarray(entry, entry + 4).toString("ascii") !== "cmap") continue;
		const start = program.readUInt32BE(entry + 8);
		program.writeUInt16BE(1, start + 6);
		const table = start + program.readUInt32BE(start + 8);
		const segments = program.readUInt16BE(table + 6) / 2;
		for (let segment = 0; segment < segments - 1; segment++) {
			const unicode = program.readUInt16BE(table + 14 + segment * 2) & 255;
			program.writeUInt16BE(unicode, table + 14 + segment * 2);
			program.writeUInt16BE(unicode, table + 16 + segments * 2 + segment * 2);
			program.writeUInt16BE((segment + 1 - unicode) & 65535, table + 16 + segments * 4 + segment * 2);
		}
	}
	return program;
}
