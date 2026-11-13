import type { FultonMunicipalNativeField, FultonMunicipalSource } from "./fulton-municipal-runoff.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { inspectFairbanksPdfGeometry } from "./fairbanks-pdf-geometry.js";
import { fultonMunicipalNativeFields, prepareFultonMunicipalRunoff } from "./fulton-municipal-runoff.js";
import { extractStateBallotPdfXml, inspectStateBallotPdfObjects, resolveStateBallotPdfExtractor, resolveStateBallotPdfObjectInspector, resolveStateBallotPdfXmlExtractor } from "./state-ballot-pdf.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

interface Box { left: number; top: number; width: number; height: number }
interface Word extends Box { text: string; confidence: number }
export interface FultonMunicipalEvidence {
	schemaVersion: 1;
	type: "fulton-municipal-rendered-evidence";
	source: FultonMunicipalSource;
	xml: string;
	objects: string;
	page: { width: 2550; height: 4200; dpi: 300; pngSha256: string; ocr: string };
	fields: (Box & { pngSha256: string })[];
	ocr: string;
	tools: { xmlSha256: string; rendererSha256: string; inspectorSha256: string; readerSha256: string; readerVersion: string };
}
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
const header = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";

export function fultonMunicipalRenderFields(xml: string) {
	const fields = fultonMunicipalNativeFields(xml);
	const beginning = Math.min(...fields.filter(field => field.text === "General Election Runoff").map(field => field.top));
	assert(Number.isFinite(beginning));
	return fields.filter(field => field.size !== 285 && (field.top >= beginning || ["COMPOSITE SAMPLE BALLOT", "Fulton County, Georgia"].includes(field.text) || field.text.startsWith("Municipal General Runoff Election - ")));
}

export function fultonMunicipalRenderBox(field: FultonMunicipalNativeField): Box {
	const scale = 25 / 9;
	const left = Math.floor(field.left * scale) - 2;
	const top = Math.floor((field.top + field.height * 0.1) * scale) - 1;
	const width = Math.ceil((field.left + field.width) * scale) - left + 2;
	const height = Math.ceil((field.top + field.height * 0.95) * scale) - top + 1;
	assert(left >= 0 && top >= 0 && width > 0 && height > 0 && left + width <= 2550 && top + height <= 4200, "The municipal rendered field leaves its page.");
	return { left, top, width, height };
}

function readWords(body: string, boxes: readonly { width: number; height: number }[]) {
	assert(typeof body === "string" && Buffer.byteLength(body) <= 2 * 1024 * 1024 && !body.includes("\uFFFD"));
	const lines = body.replace(/\n+$/u, "").split("\n");
	assert(lines.shift() === header && lines.length > 0 && lines.length <= 30000, "The municipal rendered-text inventory is invalid.");
	const pages = boxes.map(() => [] as Word[]);
	const seen = new Set<number>();
	for (const line of lines) {
		const row = line.split("\t");
		assert(row.length === 12 && row.slice(0, 10).every(value => /^\d{1,6}$/u.test(value)) && /^[\d.-]{1,12}$/u.test(row[10]!));
		const level = Number(row[0]);
		const page = Number(row[1]) - 1;
		const box = boxes[page];
		const word = { left: Number(row[6]), top: Number(row[7]), width: Number(row[8]), height: Number(row[9]), confidence: Number(row[10]), text: row[11]!.trim() };
		assert(level >= 1 && level <= 5 && box && word.left + word.width <= box.width && word.top + word.height <= box.height && Number.isFinite(word.confidence) && word.confidence >= -1 && word.confidence <= 100, "The municipal OCR geometry is invalid.");
		if (level === 1) {
			assert(!seen.has(page) && word.left === 0 && word.top === 0 && word.width === box.width && word.height === box.height);
			seen.add(page);
		}
		if (level === 5 && word.text) {
			assert(seen.has(page) && word.width > 0 && word.height > 0 && word.text.length <= 200);
			pages[page]!.push(word);
		}
	}
	assert(seen.size === boxes.length && pages.every(page => page.length > 0), "The municipal rendered page inventory is incomplete.");
	return pages;
}

export function readFultonMunicipalEvidence(value: unknown) {
	assert(exact(value, ["schemaVersion", "type", "source", "xml", "objects", "page", "fields", "ocr", "tools"]) && value.schemaVersion === 1 && value.type === "fulton-municipal-rendered-evidence" && typeof value.xml === "string" && typeof value.objects === "string");
	const evidence = value as unknown as FultonMunicipalEvidence;
	const inventory = prepareFultonMunicipalRunoff(evidence.xml, evidence.source);
	const geometry = inspectFairbanksPdfGeometry(evidence.objects, "sample");
	assert(geometry.pages.length === 1, "The municipal inspected page inventory changed.");
	assert(exact(evidence.tools, ["xmlSha256", "rendererSha256", "inspectorSha256", "readerSha256", "readerVersion"]) && Object.entries(evidence.tools).every(([key, entry]) => key === "readerVersion" ? typeof entry === "string" && /^tesseract 5\.\d+\.\d+$/u.test(entry) : digest(entry)), "The municipal native tool inventory requires review.");
	assert(exact(evidence.page, ["width", "height", "dpi", "pngSha256", "ocr"]) && evidence.page.width === 2550 && evidence.page.height === 4200 && evidence.page.dpi === 300 && digest(evidence.page.pngSha256));
	const fields = fultonMunicipalRenderFields(evidence.xml);
	assert(Array.isArray(evidence.fields) && evidence.fields.length === fields.length);
	for (const [index, field] of evidence.fields.entries()) assert(exact(field, ["left", "top", "width", "height", "pngSha256"]) && digest(field.pngSha256) && Object.entries(fultonMunicipalRenderBox(fields[index]!)).every(([key, entry]) => field[key as keyof Box] === entry), "The municipal field crop changed.");
	const crops = readWords(evidence.ocr, evidence.fields);
	for (const [index, words] of crops.entries()) assert(words.every(word => word.confidence >= 70) && words.map(word => word.text).join(" ").toLowerCase() === fields[index]!.text.toLowerCase(), "The rendered and native municipal fields disagree.");
	const fullPage = readWords(evidence.page.ocr, [evidence.page])[0]!;
	const beginning = Math.min(...fields.filter(field => field.text === "General Election Runoff").map(field => field.top)) * 25 / 9;
	const candidates = fields.flatMap((field, index) => field.bold && field.family === "ArialNarrow" && field.size === 15 ? [evidence.fields[index]!] : []);
	const contained = (word: Word, box: Box) => word.left >= box.left - 4 && word.top >= box.top - 4 && word.left + word.width <= box.left + box.width + 4 && word.top + word.height <= box.top + box.height + 4;
	for (const word of fullPage.filter(word => word.top >= beginning)) {
		const mark = ((word.text === "©" && word.width >= 43 && word.width <= 47 && word.height >= 32 && word.height <= 37) || (word.text === "_" && word.width <= 6 && word.height <= 52)) && candidates.some(box => word.left >= box.left - 85 && word.left + word.width <= box.left + 4 && word.top >= box.top - 4 && word.top + word.height <= box.top + box.height + 4);
		assert(mark || evidence.fields.some(box => contained(word, box)), "The municipal page has unaccounted rendered ballot text.");
	}
	return inventory;
}

async function execute(executable: string, arguments_: string[], deadline: number) {
	const remaining = Math.min(30000, deadline - Date.now());
	assert(remaining > 0, "Municipal rendered preparation exceeded its duration bound.");
	return new Promise<string>((resolve, reject) => {
		const child = spawn(executable, arguments_, { stdio: ["ignore", "pipe", "pipe"], env: { PATH: process.env.PATH, LANG: "C.UTF-8", OMP_THREAD_LIMIT: "1", OMP_NUM_THREADS: "1" } });
		const chunks: Buffer[] = [];
		let bytes = 0;
		let errors = 0;
		let failed = false;
		const stop = () => {
			failed = true;
			child.kill("SIGKILL");
		};
		const timer = setTimeout(stop, remaining);
		child.stdout.on("data", (chunk: Buffer) => {
			bytes += chunk.length;
			if (bytes > 2 * 1024 * 1024) stop();
			else chunks.push(chunk);
		});
		child.stderr.on("data", (chunk: Buffer) => {
			errors += chunk.length;
			if (errors > 65536) stop();
		});
		child.once("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.once("close", (code, signal) => {
			clearTimeout(timer);
			if (failed || signal || code !== 0) reject(new Error("Municipal rendered preparation failed within its bounded tool role."));
			else resolve(Buffer.concat(chunks).toString("utf8"));
		});
	});
}

function pngDimensions(png: Buffer, width: number, height: number) {
	assert(png.length >= 33 && png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && png.readUInt32BE(16) === width && png.readUInt32BE(20) === height, "The municipal raster dimensions changed.");
}

export async function prepareFultonMunicipalEvidence(bytes: Buffer, source: FultonMunicipalSource, directory: string): Promise<FultonMunicipalEvidence> {
	assert(bytes.length <= 12 * 1024 * 1024 && bytes.length === source.bytes && hash(bytes) === source.sha256 && bytes.subarray(0, 5).toString("ascii") === "%PDF-", "The municipal original PDF changed.");
	assertExternalStateDataDirectory(directory);
	assert(!/[\r\n]/u.test(directory) && await realpath(directory) === directory, "Use a physical municipal evidence directory.");
	const xmlTool = await resolveStateBallotPdfXmlExtractor();
	const renderer = await resolveStateBallotPdfExtractor(process.env.STATE_BALLOT_PDFTOPPM);
	const inspector = await resolveStateBallotPdfObjectInspector();
	const reader = await resolveStateBallotPdfExtractor(process.env.STATE_BALLOT_TESSERACT);
	const deadline = Date.now() + 180000;
	const version = (await execute(reader, ["--version"], deadline)).split("\n")[0]!;
	assert(/^tesseract 5\.\d+\.\d+$/u.test(version));
	const objects = await inspectStateBallotPdfObjects(bytes, inspector, "metadata");
	assert(inspectFairbanksPdfGeometry(objects, "sample").pages.length === 1);
	const xml = await extractStateBallotPdfXml(bytes, xmlTool);
	prepareFultonMunicipalRunoff(xml, source);
	const temporary = await mkdtemp(join(directory, ".municipal-rendered-"));
	try {
		const pdf = join(temporary, "ballot.pdf");
		await writeFile(pdf, bytes, { flag: "wx", mode: 0o600 });
		const prefix = join(temporary, "page");
		await execute(renderer, ["-r", "300", "-f", "1", "-l", "1", "-singlefile", "-gray", "-png", pdf, prefix], deadline);
		const png = await readBoundedStateDataBytes(`${prefix}.png`, 12 * 1024 * 1024);
		pngDimensions(png, 2550, 4200);
		const pageOcr = await execute(reader, [`${prefix}.png`, "stdout", "-l", "eng", "--psm", "3", "tsv"], deadline);
		const fields: FultonMunicipalEvidence["fields"] = [];
		const paths: string[] = [];
		for (const [index, field] of fultonMunicipalRenderFields(xml).entries()) {
			const box = fultonMunicipalRenderBox(field);
			const path = join(temporary, `field-${index}`);
			await execute(renderer, ["-r", "300", "-f", "1", "-l", "1", "-singlefile", "-gray", "-png", "-x", String(box.left), "-y", String(box.top), "-W", String(box.width), "-H", String(box.height), pdf, path], deadline);
			const crop = await readBoundedStateDataBytes(`${path}.png`, 1024 * 1024);
			pngDimensions(crop, box.width, box.height);
			fields.push({ ...box, pngSha256: hash(crop) });
			paths.push(`${path}.png`);
		}
		const list = join(temporary, "fields.txt");
		await writeFile(list, `${paths.join("\n")}\n`, { flag: "wx", mode: 0o600 });
		const ocr = await execute(reader, [list, "stdout", "-l", "eng", "--psm", "7", "tsv"], deadline);
		const evidence: FultonMunicipalEvidence = { schemaVersion: 1, type: "fulton-municipal-rendered-evidence", source, xml, objects, page: { width: 2550, height: 4200, dpi: 300, pngSha256: hash(png), ocr: pageOcr }, fields, ocr, tools: { xmlSha256: hash(await readFile(xmlTool)), rendererSha256: hash(await readFile(renderer)), inspectorSha256: hash(await readFile(inspector)), readerSha256: hash(await readFile(reader)), readerVersion: version } };
		readFultonMunicipalEvidence(evidence);
		return evidence;
	}
	finally {
		await rm(temporary, { recursive: true, force: true });
	}
}
