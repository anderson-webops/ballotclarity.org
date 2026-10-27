import type { OrangeProofField } from "../../src/state-ballot-orange-proof.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { orangePathCommands } from "../../src/state-ballot-orange-shapes.js";
import { nycFontFixture, nycUnicodeFixture } from "./nyc-native-fixture.js";

export function orangeFontFixture() {
	const objects: Record<string, { value?: unknown; stream?: { data: string } }> = {};
	const fonts: Record<string, string> = {};
	for (const [index, style] of ["Arial-BoldItalic", "Arial-Bold", "Arial-Unicode-MS-Bold", "Arial-Italic", "Arial"].entries()) {
		const reference = index * 4 + 2;
		const name = `AAAAAA+${style}`;
		fonts[`/F${index}`] = `${reference} 0 R`;
		objects[`obj:${reference} 0 R`] = { value: { "/Type": "/Font", "/Subtype": "/TrueType", "/BaseFont": `/${name}`, "/FirstChar": 32, "/LastChar": 192, "/FontDescriptor": `${reference + 1} 0 R`, "/ToUnicode": `${reference + 2} 0 R`, "/Widths": Array.from({ length: 161 }).fill(600) } };
		objects[`obj:${reference + 1} 0 R`] = { value: { "/Type": "/FontDescriptor", "/FontName": `/${name}`, "/Flags": style.endsWith("Italic") ? 69 : 5, "/ItalicAngle": style.endsWith("Italic") ? -12 : 0, "/FontFile2": `${reference + 3} 0 R` } };
		objects[`obj:${reference + 2} 0 R`] = { stream: { data: Buffer.from(nycUnicodeFixture().replaceAll("AAAAAA+Arial", name)).toString("base64") } };
		objects[`obj:${reference + 3} 0 R`] = { stream: { data: nycFontFixture().toString("base64") } };
	}
	objects["obj:1 0 R"] = { value: { "/Type": "/Page", "/Resources": { "/Font": fonts } } };
	return { pages: [{ object: "1 0 R" }], qpdf: [{ jsonversion: 2 }, objects], acroform: { fields: [], needappearances: false }, encrypt: { encrypted: false } };
}

export function orangeVisualFixture(fields: OrangeProofField[] = [{ text: "SYNTHETIC NAME", left: 90, top: 30, width: 180, height: 15, font: 13 }, { text: "Republican", left: 300, top: 30, width: 100, height: 15, font: 14 }, { text: "8/7/2026", left: 90, top: 60, width: 100, height: 15, font: 19 }]) {
	const definitions = new Map<string, { id: string; path: string }>();
	const approvals: Record<string, string[]> = {};
	const groups: string[] = [];
	const fieldUses: string[][] = [];
	for (const field of fields) {
		let left = field.left / 1.5;
		const top = field.top / 1.5 + 8;
		const uses: string[] = [];
		const strokes: string[] = [];
		for (const character of field.text) {
			if (character.trim()) {
				const path = `M 0 -5 L ${1 + character.codePointAt(0)! / 1000} -5 L 1 0 L 0 0 Z`;
				if (!definitions.has(character)) definitions.set(character, { id: `glyph-0-${definitions.size}`, path });
				const definition = definitions.get(character)!;
				approvals[character] = [createHash("sha256").update(path).digest("hex")];
				uses.push(`<use xlink:href="#${definition.id}" x="${left}" y="${top}"/>`);
				strokes.push(...orangePathCommands(path, left, top).map(command => `${command.kind} ${command.values.join(" ")}`));
			}
			left += 2;
		}
		fieldUses.push(uses);
		const color = [1, 13, 14].includes(field.font) ? "rgb(0%, 0%, 100%)" : [3, 4].includes(field.font) ? "rgb(100%, 100%, 100%)" : field.font === 6 ? "rgb(50.196078%, 0%, 0%)" : "rgb(0%, 0%, 0%)";
		groups.push(`<g fill="${color}" fill-opacity="1">${uses.join("")}</g>`);
		if (field.font === 5) groups.push(`<path fill="none" stroke-width="0.3" stroke-linecap="butt" stroke-linejoin="miter" stroke="rgb(0%, 0%, 0%)" stroke-opacity="1" stroke-miterlimit="10" d="${strokes.join(" ")}"/>`);
	}
	const svg = `<svg width="792pt" height="612pt" viewBox="0 0 792 612"><defs><g>${[...definitions.values()].map(definition => `<g id="${definition.id}"><path d="${definition.path}"/></g>`).join("")}</g></defs>${groups.join("")}</svg>`;
	return { fields, svg, approvals, fieldUses };
}
