import { createHash } from "node:crypto";

const headings = ["SENATOR IN CONGRESS", "GOVERNOR AND LIEUTENANT GOVERNOR", "ATTORNEY GENERAL", "SECRETARY OF STATE", "TREASURER", "AUDITOR", "REPRESENTATIVE IN CONGRESS", "COUNCILLOR", "SENATOR IN GENERAL COURT", "REPRESENTATIVE IN GENERAL COURT", "DISTRICT ATTORNEY", "REGISTER OF PROBATE"];
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export function everettFixture(date = "2026-11-03", style = "WD. 2 PCTS. 1, 2A", house = "ELEVENTH SUFFOLK DISTRICT") {
	const fields: { text: string; left: number; top: number; font: number; width: number }[] = [];
	const add = (text: string, left: number, top: number, font: number) => fields.push({ text, left, top, font, width: text.length * 3.75 });
	const printed = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
	add("EVERETT", 68, 120, 0);
	add(style, 68, 150, 0);
	add(`${printed} / Synthetic date`, 203, 260, 4);
	add("Card No. 100", 342, 278, 4);
	add("STATE ELECTION", 350, 300, 4);
	for (const [index, heading] of headings.entries()) {
		const top = 420 + index * 110;
		add(heading, 68, top, 0);
		if (index >= 6) add(["SEVENTH DISTRICT", "SIXTH DISTRICT", "MIDDLESEX AND SUFFOLK DISTRICT", house, "NORTHERN DISTRICT", "MIDDLESEX COUNTY"][index - 6]!, 68, top + 12, 0);
		add("Vote for not more than ONE", 180, top + 24, 0);
		add(index === 1 ? "ALPHA AND BETA" : "ALICE ONE", 68, top + 40, 1);
		add("Independent / I", 240, top + 43, 2);
		if (index === 0) add("Candidate for Re-election / I", 140, top + 52, 2);
	}
	const characters = [...new Set(fields.flatMap(field => [...field.text.replace(/\s/gu, "")]))];
	const paths = new Map(characters.map(character => [character, `M 0 -4 L ${1 + character.codePointAt(0)! / 1000} -4 L 1 0 L 0 0 Z`]));
	const catalog = Object.fromEntries([...paths].map(([character, path]) => [character, [createHash("sha256").update(path).digest("hex")]]));
	const identifiers = new Map(characters.map((character, index) => [character, `glyph-0-${index}`]));
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="612pt" height="1296pt" viewBox="0 0 612 1296"><defs>${[...paths].map(([character, path]) => `<g id="${identifiers.get(character)}"><path d="${path}"/></g>`).join("")}</defs>${fields.map(field => `<g fill="${field.font === 4 ? "rgb(13.729858%, 12.159729%, 12.548828%)" : "rgb(0%, 0%, 0%)"}" fill-opacity="1">${[...field.text].flatMap((character, position) => /\s/u.test(character) ? [] : [`<use xlink:href="#${identifiers.get(character)}" x="${field.left / 1.5 + position * 2.5}" y="${field.top / 1.5 + 4}"/>`]).join("")}</g>`).join("")}</svg>`;
	const fonts = [["HelveticaLTStd", 9], ["HelveticaLTStd", 13], ["HelveticaLTStd-LightCond", 8], ["Arial", 13], ["ABCDEF+HelveticaNeueLTStd-Bd", 18]].map(([family, size], index) => `<fontspec id="${index}" size="${size}" family="${family}" color="${index === 4 ? "#231f20" : "#000000"}"/>`).join("");
	const xml = `<pdf2xml>${[1, 2, 3, 4, 5, 6].map(page => `<page number="${page}" width="918" height="1944">${page === 1 ? fonts + fields.map(field => `<text left="${field.left}" top="${field.top}" width="${field.width}" height="10" font="${field.font}">${escape(field.text)}</text>`).join("") : ""}</page>`).join("")}</pdf2xml>`;
	return { xml, svg, catalog, fields };
}
