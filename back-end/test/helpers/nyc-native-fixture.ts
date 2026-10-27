import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "../../src/state-ballot-html.js";
import { chicagoFontFixture } from "./chicago-fixture.js";
import { nycDocumentFixture } from "./nyc-fixture.js";

export function nycFontFixture(extended = false, swap = false) {
	const original = chicagoFontFixture(false, swap);
	const tables = new Map<string, Buffer>();
	for (let index = 0; index < original.readUInt16BE(4); index++) {
		const start = 12 + index * 16;
		const name = original.subarray(start, start + 4).toString("ascii");
		if (name !== "gasp") tables.set(name, Buffer.from(original.subarray(original.readUInt32BE(start + 8), original.readUInt32BE(start + 8) + original.readUInt32BE(start + 12))));
	}
	if (extended) {
		tables.get("maxp")!.writeUInt16BE(6, 4);
		const offsets = tables.get("loca")!;
		tables.set("loca", Buffer.concat([offsets, offsets.subarray(-2)]));
	}
	const entries = [[0xF020, 1], [0xF041, 2], [0xF042, 3], [0xF0C0, 4], [0xFFFF, 0]];
	const start = 12;
	const segments = entries.length;
	const cmap = Buffer.alloc(start + 16 + segments * 8);
	cmap.writeUInt16BE(1, 2);
	cmap.writeUInt16BE(3, 4);
	cmap.writeUInt32BE(start, 8);
	cmap.writeUInt16BE(4, start);
	cmap.writeUInt16BE(cmap.length - start, start + 2);
	cmap.writeUInt16BE(segments * 2, start + 6);
	for (const [index, [character, glyph]] of entries.entries()) {
		cmap.writeUInt16BE(character!, start + 14 + index * 2);
		cmap.writeUInt16BE(character!, start + 16 + segments * 2 + index * 2);
		cmap.writeUInt16BE((glyph! - character!) & 0xFFFF, start + 16 + segments * 4 + index * 2);
	}
	tables.set("cmap", cmap);
	const directory = Buffer.alloc(12 + tables.size * 16);
	directory.writeUInt32BE(0x00010000, 0);
	directory.writeUInt16BE(tables.size, 4);
	let position = directory.length;
	let index = 0;
	for (const [name, bytes] of tables) {
		const entry = 12 + index++ * 16;
		directory.write(name, entry, "ascii");
		directory.writeUInt32BE(position, entry + 8);
		directory.writeUInt32BE(bytes.length, entry + 12);
		position += bytes.length;
	}
	return Buffer.concat([directory, ...tables.values()]);
}

export function nycUnicodeFixture() {
	return "/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (AAAAAA+Arial) /Ordering (UCS) /Supplement 0 >> def /CMapName /AAAAAA+Arial def 1 begincodespacerange <42> <c0> endcodespacerange 4 beginbfrange <20> <20> <0020> <41> <41> <0041> <42> <42> <0042> <c0> <c0> <00c0> endbfrange endcmap CMapName currentdict /CMap defineresource pop end end";
}

export function nycVisualFixture(firstLabel = "THE CONTEST LIST") {
	const xml = nycDocumentFixture().replace("THE CONTEST LIST", firstLabel);
	const page = descendants(parseStateHtml(xml), node => node.nodeName === "page")[0]!;
	const definitions = new Map<string, { id: string; path: string }>();
	const approvals: Record<string, string[]> = {};
	const uses: string[] = [];
	let firstFieldUses: string[] = [];
	for (const node of descendants(page, node => node.nodeName === "text")) {
		let position = Number(attribute(node, "left")) / 1.5;
		const before = uses.length;
		const baseline = Number(attribute(node, "top")) / 1.5 + 8;
		for (const character of stateHtmlText(node)) {
			if (character.trim()) {
				const path = `M 0 -5 L ${1 + character.codePointAt(0)! / 1000} -5 L 1 0 L 0 0 Z`;
				if (!definitions.has(character)) definitions.set(character, { id: `glyph-0-${definitions.size}`, path });
				const definition = definitions.get(character)!;
				approvals[character] = [createHash("sha256").update(path).digest("hex")];
				uses.push(`<use xlink:href="#${definition.id}" x="${position}" y="${baseline}"/>`);
			}
			position += 2;
		}
		if (!before) firstFieldUses = uses.slice();
	}
	const svg = `<svg width="792pt" height="612pt" viewBox="0 0 792 612"><defs>${[...definitions.values()].map(definition => `<g id="${definition.id}"><path d="${definition.path}"/></g>`).join("")}</defs><g fill="rgb(0%, 0%, 0%)" fill-opacity="1">${uses.join("")}</g></svg>`;
	return { xml, svg, approvals, firstFieldUses };
}
