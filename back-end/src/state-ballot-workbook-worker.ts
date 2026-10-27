import { Buffer } from "node:buffer";
import process from "node:process";
import { crc32, inflateRawSync } from "node:zlib";
import readWorkbook from "read-excel-file/universal";

const maximumBytes = 2 * 1024 * 1024;
const maximumExpandedBytes = 24 * 1024 * 1024;
const maximumEntryBytes = 8 * 1024 * 1024;
const workbookError = () => new Error("The official workbook archive is invalid.");

function assertBooneDisplay(xml: string) {
	for (const tag of xml.matchAll(/<(?:[^"'<>]|"[^"]*"|'[^']*')+>/gu)) {
		const element = /^<(?:[A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)/u.exec(tag[0])?.[1];
		if (!element) continue;
		if (["f", "strike", "conditionalFormatting", "drawing", "legacyDrawing", "rPh"].includes(element)) throw workbookError();
		for (const attribute of tag[0].matchAll(/\b(hidden|state)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gu)) {
			if (attribute[1] === "state" && element !== "sheet") continue;
			const value = attribute[2] ?? attribute[3] ?? attribute[4];
			if (!(attribute[1] === "hidden" ? ["0", "false"] : ["visible"]).includes(value!)) throw workbookError();
		}
	}
}

function assertWorkbookArchive(bytes: Buffer) {
	let end = bytes.length - 22;
	while (end >= Math.max(0, bytes.length - 65557) && bytes.readUInt32LE(end) !== 0x06054B50) end--;
	if (
		end < 0
		|| bytes.readUInt32LE(end) !== 0x06054B50
		|| end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length
		|| bytes.readUInt32LE(end + 4) !== 0
	) {
		throw workbookError();
	}
	const entries = bytes.readUInt16LE(end + 10);
	const centralLength = bytes.readUInt32LE(end + 12);
	const centralOffset = bytes.readUInt32LE(end + 16);
	if (!entries || entries > 128 || entries !== bytes.readUInt16LE(end + 8) || centralOffset + centralLength !== end)
		throw workbookError();
	let offset = centralOffset;
	let expanded = 0;
	const names = new Set<string>();
	const ranges: [number, number][] = [];
	const metadata = new Map<string, string>();
	let printerSettings = false;
	for (let index = 0; index < entries; index++) {
		if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014B50) throw workbookError();
		const flags = bytes.readUInt16LE(offset + 8);
		const method = bytes.readUInt16LE(offset + 10);
		const checksum = bytes.readUInt32LE(offset + 16);
		const compressed = bytes.readUInt32LE(offset + 20);
		const size = bytes.readUInt32LE(offset + 24);
		const nameLength = bytes.readUInt16LE(offset + 28);
		const extraLength = bytes.readUInt16LE(offset + 30);
		const commentLength = bytes.readUInt16LE(offset + 32);
		const local = bytes.readUInt32LE(offset + 42);
		if (
			flags & ~0x080E
			|| ![0, 8].includes(method)
			|| size > maximumEntryBytes
			|| compressed > maximumBytes
			|| bytes.readUInt16LE(offset + 34) !== 0
			|| offset + 46 + nameLength + extraLength + commentLength > end
		) {
			throw workbookError();
		}
		const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength);
		const name = new TextDecoder("utf-8", { fatal: true }).decode(nameBytes);
		const passivePrinter = process.argv[2] === "boone-candidates" && name === "xl/printerSettings/printerSettings1.bin";
		if (
			!name
			|| name.startsWith("/")
			|| name.includes("\\")
			|| name.includes("\0")
			|| name.split("/").some(part => part === ".." || part === ".")
			|| names.has(name)
			|| (!/\.(?:xml|rels)$/u.test(name) && !passivePrinter)
			|| (passivePrinter && (!size || size > 16384))
			|| /vba|activex|embeddings|externallinks|connections/iu.test(name)
		) {
			throw workbookError();
		}
		names.add(name);
		expanded += size;
		if (
			expanded > maximumExpandedBytes
			|| local + 30 > centralOffset
			|| bytes.readUInt32LE(local) !== 0x04034B50
			|| bytes.readUInt16LE(local + 6) !== flags
			|| bytes.readUInt16LE(local + 8) !== method
			|| bytes.readUInt16LE(local + 26) !== nameLength
		) {
			throw workbookError();
		}
		const dataStart = local + 30 + nameLength + bytes.readUInt16LE(local + 28);
		const dataEnd = dataStart + compressed;
		if (
			dataEnd > centralOffset
			|| !bytes.subarray(local + 30, local + 30 + nameLength).equals(nameBytes)
			|| ranges.some(([start, end]) => local < end && dataEnd > start)
		) {
			throw workbookError();
		}
		if (
			!(flags & 8)
			&& (bytes.readUInt32LE(local + 14) !== checksum
				|| bytes.readUInt32LE(local + 18) !== compressed
				|| bytes.readUInt32LE(local + 22) !== size)
		) {
			throw workbookError();
		}
		ranges.push([local, dataEnd]);
		const content
			= method === 0
				? bytes.subarray(dataStart, dataEnd)
				: inflateRawSync(bytes.subarray(dataStart, dataEnd), { maxOutputLength: Math.max(1, size) });
		if (content.length !== size || crc32(content) !== checksum) throw workbookError();
		if (passivePrinter) {
			printerSettings = true;
			offset += 46 + nameLength + extraLength + commentLength;
			continue;
		}
		const xml = new TextDecoder("utf-8", { fatal: true }).decode(content);
		if (["[Content_Types].xml", "xl/worksheets/_rels/sheet1.xml.rels"].includes(name)) metadata.set(name, xml);
		if (/<!DOCTYPE|<!ENTITY/iu.test(xml)) throw workbookError();
		if (process.argv[2] === "boone-candidates" && name.startsWith("xl/")) assertBooneDisplay(xml);
		if (/^xl\/worksheets\/sheet\d+\.xml$/u.test(name)) {
			if (/<f(?:\s|>)/u.test(xml)) throw workbookError();
			const dimension = /<dimension\s[^>]*\bref="([A-Z]+\d+)(?::([A-Z]+\d+))?"/u.exec(xml);
			if (!dimension) throw workbookError();
			for (const reference of [
				dimension[1]!,
				dimension[2] ?? dimension[1]!,
				...[...xml.matchAll(/<c\s[^>]*\br="([A-Z]+\d+)"/gu)].map(match => match[1]!)
			]) {
				const cell = /^([A-Z]+)([1-9]\d*)$/u.exec(reference)!;
				const column = [...cell[1]!].reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0);
				if (column > 32 || Number(cell[2]) > 25001) throw workbookError();
			}
		}
		offset += 46 + nameLength + extraLength + commentLength;
	}
	if (
		offset !== end
		|| !["[Content_Types].xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"].every(name => names.has(name))
	) {
		throw workbookError();
	}
	if (printerSettings && (!(metadata.get("[Content_Types].xml") ?? "").includes("<Default Extension=\"bin\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.printerSettings\"/>") || !/<Relationship Id="[\w-]+" Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/printerSettings" Target="\.\.\/printerSettings\/printerSettings1\.bin"\/>/u.test(metadata.get("xl/worksheets/_rels/sheet1.xml.rels") ?? ""))) throw workbookError();
}

async function run() {
	if (process.argv.length > 3 || (process.argv[2] !== undefined && process.argv[2] !== "boone-candidates")) throw workbookError();
	const chunks: Buffer[] = [];
	let length = 0;
	for await (const chunk of process.stdin) {
		length += chunk.length;
		if (length > maximumBytes) throw workbookError();
		chunks.push(chunk as Buffer);
	}
	const bytes = Buffer.concat(chunks);
	if (bytes.length < 22) throw workbookError();
	assertWorkbookArchive(bytes);
	const sheets = await readWorkbook(new Uint8Array(bytes).buffer);
	if (!sheets.length || sheets.length > 4) throw workbookError();
	let cells = 0;
	for (const sheet of sheets) {
		if (!sheet.sheet || sheet.sheet.length > 100 || sheet.data.length > 25001) throw workbookError();
		for (const row of sheet.data) {
			cells += row.length;
			if (
				row.length > 32
				|| cells > 100000
				|| row.some(value => value !== null && !["string", "number", "boolean"].includes(typeof value))
			) {
				throw workbookError();
			}
		}
	}
	const output = JSON.stringify(sheets);
	if (Buffer.byteLength(output) > 4 * 1024 * 1024) throw workbookError();
	process.stdout.write(output);
}

run().catch(() => {
	process.stderr.write("The official workbook is invalid or exceeds reviewed bounds.\n");
	process.exitCode = 1;
});
