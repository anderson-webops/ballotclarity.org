import type { GoffstownField } from "../../src/state-ballot-goffstown-native.js";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { fetchGoffstownCycleDiscovery } from "../../src/state-ballot-goffstown-discovery.js";

const fixture: Record<string, string> = JSON.parse(readFileSync(new URL("../fixtures/goffstown-discovery-policy.json", import.meta.url), "utf8"));
export const goffstownFixtureClock = Date.parse("2026-10-27T04:00:00.000Z");
function field(text: string, left: number, top: number, overrides: Partial<GoffstownField> = {}): GoffstownField {
	return { text, left, top, width: 80, height: 10, family: "HelveticaNeueLTStd-BdCn", size: 18, color: "#000000", ...overrides };
}
export function goffstownFieldsFixture() {
	const rules = [299.25, 376.875, 454.5, 532.125, 591.75, 821.25, 949.5, 1009.125, 1068.75, 1128.375, 1188, 1265.625, 1343.25];
	const labels = ["Governor", "United States Senator", "Representative in Congress", "Executive Councilor", "State Senator", "State Representatives Hillsborough District 29", "State Representatives Hillsborough District 44", "Sheriff", "County Attorney", "County Treasurer", "Register of Deeds", "Register of Probate", "County Commissioner"];
	const suffixes = ["Able", "Baker", "Civic", "Dove", "Elm", "Fir", "Grove", "Hill", "Ivy", "Juniper", "Kite", "Lake", "Maple"];
	const first = [field("GOFFSTOWN", 535, 105), field("GENERAL ELECTION", 532, 140), field("NOVEMBER 3, 2026", 534, 165), field("SAMPLE", 728, 90)];
	for (const [text, left, top] of [["Other", 258, 199], ["Republican", 407, 199], ["Democratic", 580, 199], ["Write-in", 756, 199], ["Offices", 95, 208], ["Candidates", 234, 217], ["Candidates", 407, 217], ["Candidates", 581, 217], ["Candidates", 743, 217]] as const) first.push(field(text, left, top, { color: "#ffffff" }));
	const marks: { left: number; top: number }[] = [];
	let top = 242;
	for (const [index, bottom] of rules.entries()) {
		const label = labels[index]!;
		const limit = index === 5 ? 4 : index === 6 ? 2 : 1;
		const center = (top + bottom) / 2;
		first.push(field(label, 40, top + 2));
		first.push(field(limit === 1 ? "Vote for not more than 1" : `Vote for up to ${limit}; ${limit === 4 ? "Four" : "Two"} will be elected`, 40, bottom - 12, { family: "Helvetica-Condensed", size: 12 }));
		for (const [column, left] of [427, 554].entries()) {
			const name = index === 7 ? "Dana Civic" : `${column ? "Bob" : "Ada"} ${suffixes[index]}`;
			first.push(field(name, left, center - 5));
			marks.push({ left: column ? 699.1875 : 525.9375, top: center });
		}
		if (index < 2) {
			first.push(field(`Casey ${suffixes[index]}`, 236, center - 5));
			first.push(field(index ? "Constitution" : "Libertarian", 236, center - 20, { family: "Helvetica-Condensed", size: 12 }));
			marks.push({ left: 352.6875, top: center });
		}
		for (let position = 0; position < limit; position++) {
			const center = top + (bottom - top) * (position + 1) / (limit + 1);
			marks.push({ left: 846.5625, top: center });
			first.push(field(label, 740, center - 5, { family: "Helvetica-Condensed", size: 12 }));
		}
		top = bottom + 1;
	}
	const second: GoffstownField[] = [];
	const questionMarks: { left: number; top: number }[] = [];
	for (const number of [1, 2]) {
		const top = number * 100;
		second.push(field(number === 1 ? "CONSTITUTIONAL QUESTIONS" : "STATUTORY QUESTION", 60, top - 30));
		second.push(field(`${number}. <Should this synthetic test question be approved by the voters for this fixture?=`, 55, top, { family: "Helvetica-Condensed", size: 12 }));
		second.push(field("Yes", 717, top + 20, { width: 24 }));
		second.push(field("No", 815, top + 20, { width: 19 }));
		questionMarks.push({ left: 760, top: top + 25 }, { left: 852, top: top + 25 });
	}
	second.push(field("GOFFSTOWN", 422, 1441));
	return { pages: [first, second], geometry: [{ marks, horizontalRules: rules }, { marks: questionMarks, horizontalRules: [] }] };
}
export function goffstownVisualFixture() {
	const fields = Array.from({ length: 10 }, (_, index) => `<text top="50" left="${50 + 20 * index}" width="15" height="18" font="0">A</text>`).join("");
	const xml = `<?xml version="1.0"?><!DOCTYPE pdf2xml SYSTEM "pdf2xml.dtd"><pdf2xml><page number="1" width="918" height="1512"><fontspec id="0" family="ABCDEF+HelveticaNeueLTStd-BdCn" size="18" color="#000000"/>${fields}</page><page number="2" width="918" height="1512">${fields}</page></pdf2xml>`;
	const glyphs = Array.from({ length: 10 }, (_, index) => `<use xlink:href="#glyph-0-0" x="${(50 + 20 * index) / 1.5}" y="40"/>`).join("");
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="612pt" height="1008pt" viewBox="0 0 612 1008"><defs><g id="glyph-0-0"><path d="M 0 0 L 6 0 L 6 -8 L 0 -8 Z"/></g></defs>${glyphs}</svg>`;
	return { xml, svg };
}
export async function goffstownPendingDiscovery(year = 2026) {
	const date = year === 2026 ? "November 3, 2026" : "November 2, 2032";
	const body = fixture.index!.replace(/<a href="\/DocumentCenter\/View\/6157\/[^"]+">[^<]+<\/a>/u, "").replace("November 3, 2026", date);
	const pages: Record<string, string> = { ...fixture, index: body };
	return fetchGoffstownCycleDiscovery({ now: () => year === 2026 ? goffstownFixtureClock : Date.parse("2032-10-01T00:00:00.000Z"), sleep: async () => {}, requestDocument: async (url) => {
		const name = url.endsWith("/325/Elections") ? "index" : url.split("/").at(-1)!.replace(".txt", "");
		return { status: 200, contentType: name === "robots" ? "text/plain" : "text/html", body: Buffer.from(pages[name]!), etag: undefined };
	} });
}
