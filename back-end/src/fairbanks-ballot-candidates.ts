import type { FairbanksPublicationCapture } from "./fairbanks-election-publications.js";
import type { inspectFairbanksPdfGeometry } from "./fairbanks-pdf-geometry.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { inspectFairbanksSelectionMarks } from "./fairbanks-ballot-marks.js";
import { readFairbanksPublicationCapture } from "./fairbanks-election-publications.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

interface NativeLine { text: string; left: number; top: number; right: number; bottom: number }
interface NativePage { page: number; width: number; height: number; lines: NativeLine[] }
export interface FairbanksRenderedPage { page: number; width: number; height: number; dpi: 300; pngSha256: string; ocr: string; svg: string }
export interface FairbanksCandidateDocument { kind: "sample" | "notice"; sourceSha256: string; geometry: ReturnType<typeof inspectFairbanksPdfGeometry>; bbox: string; pages: FairbanksRenderedPage[] }
export interface FairbanksPreparedCandidate {
	electionDate: string;
	jurisdiction: string;
	office: string;
	name: string;
	party: null;
	status: "listed";
	scope: "local";
	voteLimit: number;
	termYears: number;
	termEndYear: number;
	sourceUrl: string;
	sourcePage: number;
	sourceSha256: string;
	capturedAt: string;
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const comparable = (value: string) => clean(value).replace(/[.\s]/gu, "").replace(/[–—]/gu, "-").replace(/[‘’]/gu, "'").toLocaleLowerCase("en-US");
function requireValue(condition: unknown, detail: string): asserts condition {
	if (!condition) throw new Error(`The Fairbanks native ballot requires review: ${detail}.`);
}
export function readFairbanksNativePages(body: string): NativePage[] {
	requireValue(typeof body === "string" && Buffer.byteLength(body) <= 4 * 1024 * 1024, "native text bounds");
	const tree = parseStateHtml(body);
	const pending = [{ node: tree, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const current = pending.pop()!;
		requireValue(++visited <= 80000 && current.depth <= 64, "native structure bounds");
		for (const child of current.node.childNodes ?? []) pending.push({ node: child, depth: current.depth + 1 });
	}
	const pages = descendants(tree, node => node.nodeName === "page");
	requireValue(pages.length > 0 && pages.length <= 20, "page inventory");
	return pages.map((node, index) => {
		const width = Number(attribute(node, "width"));
		const height = Number(attribute(node, "height"));
		requireValue((width === 612 && height === 1008) || (width === 792 && height === 792), "reviewed media dimensions");
		const lines = descendants(node, item => item.nodeName === "line" && Boolean(clean(stateHtmlText(item)))).map((line) => {
			const value = { text: clean(stateHtmlText(line)), left: Number(attribute(line, "xmin")), top: Number(attribute(line, "ymin")), right: Number(attribute(line, "xmax")), bottom: Number(attribute(line, "ymax")) };
			requireValue(value.text && !containsControlCharacters(value.text) && [value.left, value.top, value.right, value.bottom].every(Number.isFinite) && value.left >= 0 && value.top >= 0 && value.right > value.left && value.bottom > value.top && value.right <= width && value.bottom <= height, `native line geometry on page ${index + 1} ${JSON.stringify(value)}`);
			return value;
		});
		requireValue(lines.length > 0 && lines.length <= 5000, "native line inventory");
		return { page: index + 1, width, height, lines };
	});
}

export function fairbanksCandidateRenderPages(body: string, kind: "sample" | "notice") {
	requireValue(kind === "sample" || kind === "notice", "publication kind");
	const pages = readFairbanksNativePages(body).filter(page => page.lines.some(line => line.text === "OFFICIAL BALLOT"));
	requireValue(pages.length === (kind === "sample" ? 1 : 3), "offered ballot page inventory");
	return pages.map(({ page, width, height }) => ({ page, width, height }));
}

function renderedWords(proof: FairbanksRenderedPage, page: NativePage) {
	requireValue(proof && proof.page === page.page && proof.width === page.width && proof.height === page.height && proof.dpi === 300 && digest(proof.pngSha256) && typeof proof.ocr === "string" && Buffer.byteLength(proof.ocr) <= 4 * 1024 * 1024, "rendered page binding");
	const rows = proof.ocr.trimEnd().split(/\r?\n/u);
	requireValue(rows.shift() === "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext" && rows.length <= 50000, "rendered word columns");
	return rows.flatMap((row) => {
		const cells = row.split("\t");
		requireValue(cells.length === 12, "rendered word structure");
		if (cells[0] !== "5" || !cells[11]!.trim()) return [];
		const [left, top, width, height, confidence] = cells.slice(6, 11).map(Number);
		requireValue([left, top, width, height, confidence].every(value => Number.isFinite(value)) && left! >= 0 && top! >= 0 && width! > 0 && height! > 0 && confidence! >= 0 && confidence! <= 100 && left! + width! <= page.width * 300 / 72 + 1 && top! + height! <= page.height * 300 / 72 + 1, "rendered word geometry");
		return [{ text: cells[11]!, left: left! * 72 / 300, top: top! * 72 / 300, right: (left! + width!) * 72 / 300, bottom: (top! + height!) * 72 / 300, confidence: confidence! }];
	});
}
function corroborate(lines: NativeLine[], words: ReturnType<typeof renderedWords>, minimumConfidence = 70) {
	const assigned = new Set<(typeof words)[number]>();
	for (const line of lines) {
		const matched = words.filter(word => (word.left + word.right) / 2 >= line.left - 1 && (word.left + word.right) / 2 <= line.right + 1 && (word.top + word.bottom) / 2 >= line.top - 1 && (word.top + word.bottom) / 2 <= line.bottom + 1).sort((first, second) => first.left - second.left);
		requireValue(matched.length > 0 && matched.every(word => word.confidence >= (line.text === "Write-In" ? 0 : minimumConfidence)) && comparable(matched.map(word => word.text).join(" ")) === comparable(line.text), `printed field disagreement at ${line.left}/${line.top}`);
		for (const word of matched) {
			requireValue(!assigned.has(word), "overlapping native field assignment");
			assigned.add(word);
		}
	}
	return assigned;
}
function office(lines: NativeLine[], position: number, jurisdiction: string) {
	const line = lines[position]!;
	let caption = line.text;
	let consumed = 1;
	if (caption === "INTERIOR ALASKA NATURAL GAS") {
		requireValue(jurisdiction === "Fairbanks North Star Borough" && lines[position + 1]?.text === "UTILITY (IGU) BOARD" && /^AT-LARGE SEAT [A-Z]$/u.test(lines[position + 2]?.text ?? ""), "utility office caption");
		caption = `Interior Alaska Natural Gas Utility Board ${lines[position + 2]!.text.replace("AT-LARGE SEAT", "At-Large Seat")}`;
		consumed = 3;
	}
	else if (jurisdiction === "Fairbanks North Star Borough") {
		const matched = /^(BOROUGH ASSEMBLY|SCHOOL BOARD) SEAT ([A-Z])$/u.exec(caption);
		requireValue(matched, `borough office caption ${caption}`);
		caption = `${matched[1] === "BOROUGH ASSEMBLY" ? "Borough Assembly" : "School Board"} Seat ${matched[2]}`;
	}
	else if (jurisdiction === "City of Fairbanks") {
		const matched = /^FAIRBANKS CITY COUNCIL SEAT ([A-Z])$/u.exec(caption);
		requireValue(matched, "Fairbanks office caption");
		caption = `City Council Seat ${matched[1]}`;
	}
	else {
		requireValue(caption === "NORTH POLE CITY COUNCIL" && jurisdiction === "City of North Pole", "North Pole office caption");
	}
	if (jurisdiction === "City of North Pole") caption = "City Council";
	return { caption, consumed };
}
function parseOffices(lines: NativeLine[], jurisdiction: string, electionDate: string) {
	const candidates: Array<{ name: string; office: string; voteLimit: number; termYears: number; termEndYear: number }> = [];
	const fields: NativeLine[] = [];
	const decisions: NativeLine[] = [];
	let position = 0;
	while (position < lines.length) {
		const heading = office(lines, position, jurisdiction);
		fields.push(...lines.slice(position, position + heading.consumed));
		position += heading.consumed;
		const term = /^(\d)-Year Term \((20\d{2})-(20\d{2})\)$/u.exec(lines[position]?.text ?? "");
		requireValue(term && Number(term[1]) > 0 && Number(term[2]) === Number(electionDate.slice(0, 4)) && Number(term[3]) - Number(term[2]) === Number(term[1]), "printed office term");
		const limit = /^Vote For Not More Than (One|Two|Three|Four|Five|Six|Seven|Eight|Nine) \(([1-9])\)$/u.exec(lines[position + 1]?.text ?? "");
		requireValue(limit && ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"].indexOf(limit[1]!) + 1 === Number(limit[2]), "printed selection limit");
		fields.push(lines[position]!, lines[position + 1]!);
		position += 2;
		let count = 0;
		while (position < lines.length && lines[position]!.text !== "Write-In") {
			const name = lines[position]!.text;
			requireValue(/^\p{L}[\p{L}\p{M} .,'’"()-]{2,160}$/u.test(name) && name.includes(" ") && !/\b(?:SEAT|BOARD|COUNCIL|BOROUGH|Vote|Term|Instructions|PROPOSITION|BALLOT)\b/u.test(name), "candidate line");
			candidates.push({ name, office: heading.caption, voteLimit: Number(limit[2]), termYears: Number(term[1]), termEndYear: Number(term[3]) });
			decisions.push(lines[position]!);
			fields.push(lines[position++]!);
			requireValue(++count <= 50, "office candidate bound");
		}
		requireValue(count > 0, "empty candidate office");
		let writeIns = 0;
		while (lines[position]?.text === "Write-In") {
			decisions.push(lines[position]!);
			fields.push(lines[position++]!);
			writeIns++;
		}
		requireValue(writeIns === Number(limit[2]), "blank write-in inventory");
	}
	return { candidates, fields, decisions };
}

export function readFairbanksBallotCandidates(capture: FairbanksPublicationCapture, documents: FairbanksCandidateDocument[], now = Date.now()) {
	const inventory = readFairbanksPublicationCapture(capture, now);
	requireValue(Array.isArray(documents) && documents.length === 2, "native document set");
	const records: FairbanksPreparedCandidate[] = [];
	const proof: Array<{ kind: string; page: number; jurisdiction: string; fields: number; candidates: number; selectionMarks: number; bboxSha256: string; pngSha256: string; ocrSha256: string; svgSha256: string }> = [];
	const year = inventory.electionDate.slice(0, 4);
	const day = Number(inventory.electionDate.slice(-2));
	const month = inventory.electionDate.slice(5, 7) === "10" ? "OCTOBER" : "NOVEMBER";
	for (const [position, document] of documents.entries()) {
		const original = capture.documents[position]!;
		requireValue(document.kind === original.kind && document.sourceSha256 === original.sha256 && Array.isArray(document.pages), "original document binding");
		const pages = readFairbanksNativePages(document.bbox);
		requireValue(pages.length === original.text.split("\f").filter(value => value.trim()).length && new Set(document.pages.map(page => page.page)).size === document.pages.length, "native and rendered page inventory");
		const requiredPages = fairbanksCandidateRenderPages(document.bbox, document.kind);
		requireValue(document.pages.length === requiredPages.length && document.pages.every((proof, index) => proof.page === requiredPages[index]!.page), "complete ordered rendered ballot set");
		const selected = pages.filter(page => requiredPages.some(required => required.page === page.page));
		for (const page of selected) {
			const heading = page.lines.filter(line => line.text === "OFFICIAL BALLOT");
			requireValue(heading.length === 1, "unique ballot heading");
			const dates = page.lines.filter(line => line.text === `REGULAR ELECTION - ${month} ${day}, ${year}` && line.top > heading[0]!.top && line.top < heading[0]!.bottom + 25);
			requireValue(dates.length === 1, "printed election date");
			const scopes = page.lines.filter(line => ["FAIRBANKS NORTH STAR BOROUGH", "CITY OF FAIRBANKS", "CITY OF NORTH POLE"].includes(line.text) && line.top > dates[0]!.top && line.top < dates[0]!.bottom + 25);
			requireValue(scopes.length === 1, "printed municipal scope");
			const jurisdiction = scopes[0]!.text === "FAIRBANKS NORTH STAR BOROUGH" ? "Fairbanks North Star Borough" : scopes[0]!.text === "CITY OF FAIRBANKS" ? "City of Fairbanks" : "City of North Pole";
			requireValue(document.kind === "notice" || jurisdiction === "Fairbanks North Star Borough", "sample jurisdiction");
			const rendered = document.pages.find(proof => proof.page === page.page);
			requireValue(rendered, "missing rendered page");
			const words = renderedWords(rendered, page);
			const marks = inspectFairbanksSelectionMarks(rendered.svg, page.width, page.height);
			const duplicate = document.kind === "notice" && jurisdiction === "Fairbanks North Star Borough";
			const endings = page.lines.filter(line => line.text === "END OF BALLOT" || line.text === "CONTINUE VOTING ON NEXT SIDE");
			requireValue(endings.length === 1 && endings[0]!.top > scopes[0]!.bottom, "printed ballot ending");
			const instructions = page.lines.filter(line => line.text === "may ask for a new ballot." && line.top > scopes[0]!.bottom && line.bottom < scopes[0]!.bottom + 100);
			requireValue(instructions.length === 1, "candidate-region instruction boundary");
			corroborate(instructions, words, 0);
			let columns = [[200, 600]];
			if (jurisdiction === "Fairbanks North Star Borough") {
				const assembly = page.lines.find(line => /^BOROUGH ASSEMBLY SEAT [A-Z]$/u.test(line.text));
				const utility = page.lines.find(line => line.text === "INTERIOR ALASKA NATURAL GAS");
				requireValue(assembly && utility && Math.abs(assembly.top - utility.top) < 1, "borough column anchors");
				const first = (assembly.left + assembly.right) / 2;
				const second = (utility.left + utility.right) / 2;
				const scale = (second - first) / 233.25;
				requireValue(scale >= 0.5 && scale <= 1.2, "borough column scale");
				columns = [[first - 120 * scale, (first + second) / 2], [(first + second) / 2, second + 120 * scale]];
			}
			let candidateCount = 0;
			let fieldCount = 0;
			let selectionCount = 0;
			corroborate([dates[0]!, scopes[0]!], words, duplicate ? 0 : 70);
			for (const [left, right] of columns) {
				const ordered = page.lines.filter(line => line.left >= left! && line.right <= right! && line.top > scopes[0]!.bottom + 25 && line.top < endings[0]!.top).sort((first, second) => first.top - second.top || first.left - second.left);
				const start = ordered.findIndex(line => /^(?:BOROUGH ASSEMBLY|SCHOOL BOARD|INTERIOR ALASKA NATURAL GAS|FAIRBANKS CITY COUNCIL|NORTH POLE CITY COUNCIL)/u.test(line.text));
				requireValue(start >= 0, "missing candidate column");
				const tail = ordered.slice(start);
				const last = tail.findIndex(line => line.text === "CITY OF NORTH POLE" || line.text === "END OF BALLOT" || /CONTINUE VOTING ON NEXT SIDE/u.test(line.text));
				const lines = last < 0 ? tail : tail.slice(0, last);
				const parsed = parseOffices(lines, jurisdiction, inventory.electionDate);
				const assigned = corroborate(parsed.fields, words, duplicate ? 0 : 70);
				const regionLeft = Math.min(...parsed.fields.map(line => line.left)) - 1;
				const regionBottom = last < 0 ? endings[0]!.top : tail[last]!.top;
				const visible = marks.filter(mark => (mark.left + mark.right) / 2 >= left! && (mark.left + mark.right) / 2 < right! && (mark.top + mark.bottom) / 2 > instructions[0]!.bottom && (mark.top + mark.bottom) / 2 < regionBottom);
				const decisions = new Set<(typeof marks)[number]>();
				for (const line of parsed.decisions) {
					const matched = visible.filter(mark => mark.right <= line.left + 1 && mark.right >= line.left - 30 && (mark.top + mark.bottom) / 2 >= line.top - 1 && (mark.top + mark.bottom) / 2 <= line.bottom + 1);
					requireValue(matched.length === 1 && !decisions.has(matched[0]!), "candidate selection correspondence");
					decisions.add(matched[0]!);
				}
				requireValue(decisions.size === visible.length, "unaccounted printed candidate selection");
				selectionCount += visible.length;
				const unexpected = words.filter(word => (word.left + word.right) / 2 >= regionLeft && (word.left + word.right) / 2 < right! && (word.top + word.bottom) / 2 > instructions[0]!.bottom && (word.top + word.bottom) / 2 < regionBottom && !assigned.has(word));
				requireValue(unexpected.length === 0, `unaccounted printed candidate-region words ${JSON.stringify(unexpected.slice(0, 5).map(word => ({ text: word.text, left: word.left, top: word.top })))}`);
				candidateCount += parsed.candidates.length;
				fieldCount += parsed.fields.length;
				if (document.kind === "notice" && jurisdiction === "Fairbanks North Star Borough") {
					for (const candidate of parsed.candidates) requireValue(records.some(record => record.jurisdiction === jurisdiction && record.name === candidate.name && record.office === candidate.office && record.voteLimit === candidate.voteLimit && record.termYears === candidate.termYears && record.termEndYear === candidate.termEndYear), "borough publication disagreement");
				}
				else {
					records.push(...parsed.candidates.map(candidate => ({ ...candidate, electionDate: inventory.electionDate, jurisdiction, party: null, status: "listed" as const, scope: "local" as const, sourceUrl: original.url, sourcePage: page.page, sourceSha256: original.sha256, capturedAt: original.capturedAt })));
				}
			}
			if (document.kind === "notice" && jurisdiction === "Fairbanks North Star Borough") requireValue(candidateCount === records.filter(record => record.jurisdiction === jurisdiction).length, "borough publication completeness disagreement");
			proof.push({ kind: document.kind, page: page.page, jurisdiction, fields: fieldCount + 3, candidates: candidateCount, selectionMarks: selectionCount, bboxSha256: hash(document.bbox), pngSha256: rendered.pngSha256, ocrSha256: hash(rendered.ocr), svgSha256: hash(rendered.svg) });
		}
	}
	requireValue(proof.length === 4 && new Set(proof.map(page => page.jurisdiction)).size === 3 && records.length > 0 && records.length <= 500 && new Set(records.map(record => `${record.jurisdiction}|${record.office}|${record.name}`)).size === records.length, "complete municipal candidate inventory");
	return { schemaVersion: 1 as const, type: "fairbanks-prepared-candidates" as const, electionDate: inventory.electionDate, records, proof, indexSha256: capture.index.sha256, sourceDocuments: inventory.sourceDocuments, importApproved: false as const, publicationApproved: false as const, resultsInferred: false as const };
}
