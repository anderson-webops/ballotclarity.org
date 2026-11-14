import type { UnionSampleDocument } from "./union-county-ballots.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { readUnionBallotLocatedCells } from "./union-ballot-witnesses.js";

const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const canonical = (value: string) => clean(value).toLocaleUpperCase("en-US").replace(/[^\p{L}\p{N}]/gu, "");
interface Line { text: string; left: number; right: number; top: number; bottom: number }
interface Office { title: string; selection: string; rows: number[]; top: number; bottom: number }
export interface UnionChoiceContext {
	page: 1;
	position: string;
	observedName: string;
	panel: "general" | "school" | "municipal-nonpartisan";
	printedOffice: string;
	printedSelections: string[];
	printedPartyOrColumn: string;
	congressionalDistrict: number | null;
}
function reject(): never {
	throw new Error("Union sample office or party-column evidence requires review.");
}
export function readUnionChoiceContext(bbox: string, layout: string, document: UnionSampleDocument, electionDate: string): UnionChoiceContext[] {
	const cells = readUnionBallotLocatedCells(bbox, layout, document, electionDate);
	const dom = parseStateHtml(bbox);
	const visible = canonical(layout);
	const lines = descendants(dom, node => node.nodeName === "line").map((node): Line => {
		const line = { text: clean(stateHtmlText(node)), left: Number(attribute(node, "xmin")), right: Number(attribute(node, "xmax")), top: Number(attribute(node, "ymin")), bottom: Number(attribute(node, "ymax")) };
		if (!line.text || ![line.left, line.right, line.top, line.bottom].every(Number.isFinite) || line.left < 0 || line.right > 1824 || line.top < 0 || line.bottom > 1284 || line.left >= line.right || line.top >= line.bottom) return reject();
		return line;
	});
	if (!lines.length || lines.length > 10000) return reject();
	const districtLines = lines.filter(line => line.top > 200 && line.bottom < 270 && /^\d{1,2}(?:st|nd|rd|th) Congressional District - /u.test(line.text));
	if (districtLines.length !== 1 || !visible.includes(canonical(districtLines[0]!.text))) return reject();
	const district = Number(/^\d+/u.exec(districtLines[0]!.text)![0]);
	if (district < 1 || district > 99 || !districtLines[0]!.text.endsWith(`November ${Number(electionDate.slice(8))}, ${electionDate.slice(0, 4)}`)) return reject();
	const columnLetters = descendants(dom, node => node.nodeName === "word" && /^[A-Z]$/u.test(stateHtmlText(node))).map(node => ({ letter: stateHtmlText(node), left: Number(attribute(node, "xmin")), right: Number(attribute(node, "xmax")), top: Number(attribute(node, "ymin")), bottom: Number(attribute(node, "ymax")) })).filter(word => word.top >= 275 && word.top < 305 && word.bottom - word.top > 35 && word.bottom - word.top < 45).sort((left, right) => left.left - right.left);
	if (columnLetters.length < 2 || columnLetters.length > 8 || new Set(columnLetters.map(word => word.letter)).size !== columnLetters.length) return reject();
	const columns = columnLetters.map((column) => {
		const center = (column.left + column.right) / 2;
		const labels = lines.filter(line => line.top >= 315 && line.bottom <= 336 && Math.abs((line.left + line.right) / 2 - center) < 5 && ["Democrat", "Republican", "Nomination by Petition"].includes(line.text));
		if (labels.length !== 1 || !visible.includes(canonical(labels[0]!.text))) return reject();
		return { letter: column.letter, center, label: labels[0]!.text };
	});
	const main = descendants(dom, node => node.nodeName === "line").flatMap((node): Line[] => {
		const top = Number(attribute(node, "ymin"));
		if (top < 350 || top > 780) return [];
		const footer = /^Master \d{1,2}(?:st|nd|rd|th) - .+, Form (\d{1,2})$/u.exec(clean(stateHtmlText(node)));
		if (footer && Number(footer[1]) === document.form && Math.abs(Number(attribute(node, "ymax")) - top - 12.134416) < 0.05) return [];
		const words = descendants(node, child => child.nodeName === "word").map(word => ({ text: clean(stateHtmlText(word)), left: Number(attribute(word, "xmin")), right: Number(attribute(word, "xmax")), top: Number(attribute(word, "ymin")), bottom: Number(attribute(word, "ymax")) }));
		if (words.some(word => word.left < 490 && word.right > 370 && (word.left < 370 || word.right > 490) && [10.692, 8.379].some(size => Math.abs(word.bottom - word.top - size) < 0.05))) return reject();
		const selected = words.filter(word => word.left >= 370 && word.right <= 490);
		return selected.length ? [{ text: clean(selected.map(word => word.text).join(" ")), left: Math.min(...selected.map(word => word.left)), right: Math.max(...selected.map(word => word.right)), top: Math.min(...selected.map(word => word.top)), bottom: Math.max(...selected.map(word => word.bottom)) }] : [];
	}).sort((left, right) => left.top - right.top);
	const offices: Office[] = [];
	let title: Line[] = [];
	let row = 1;
	const counts = new Map([["One", 1], ["Two", 2], ["Three", 3], ["Four", 4], ["Five", 5]]);
	for (const line of main) {
		const size = line.bottom - line.top;
		if (Math.abs(size - 10.692) < 0.05) {
			if ((title.length && line.top - title.at(-1)!.bottom > 6) || !visible.includes(canonical(line.text))) return reject();
			title.push(line);
			continue;
		}
		const selection = /^(?:\d{1,2} Year|Unexpired) Term - Vote for (One|Two|Three|Four|Five)$/u.exec(line.text);
		if (!selection || Math.abs(size - 8.379) >= 0.05 || !title.length || title.length > 4 || line.top - title.at(-1)!.bottom > 12 || line.top < title.at(-1)!.top || !visible.includes(canonical(line.text))) return reject();
		const amount = counts.get(selection[1]!)!;
		offices.push({ title: clean(title.map(part => part.text).join(" ")), selection: line.text, rows: Array.from({ length: amount }, (_, index) => row + index), top: title[0]!.top, bottom: line.bottom });
		row += amount;
		title = [];
	}
	if (title.length || offices.length < 5 || offices.length > 15) return reject();
	const primary = cells.filter(cell => cell.top < 780);
	const positions = [...new Set(primary.map(cell => Number(/^\d+/u.exec(cell.position)?.[0])))].sort((left, right) => left - right);
	if (positions.join(",") !== Array.from({ length: row - 1 }, (_, index) => index + 1).join(",")) return reject();
	for (const office of offices) {
		const rows = primary.filter(cell => office.rows.includes(Number(/^\d+/u.exec(cell.position)?.[0])));
		if (!rows.length || office.top < Math.min(...rows.map(cell => cell.top)) - 15 || office.bottom > Math.max(...rows.map(cell => cell.bottom)) + 15) return reject();
	}
	const lowerHeaders = lines.filter(line => line.top > 750 && line.bottom < 900 && line.text === "OFFICE TITLE").sort((left, right) => left.left - right.left);
	const lower = lowerHeaders.map((header) => {
		const center = (header.left + header.right) / 2;
		const banners = lines.filter(line => line.top >= 775 && line.bottom < header.top && line.left <= center && line.right >= center && /^OFFICIAL (?:SCHOOL|MUNICIPAL NON-PARTISAN) ELECTION BALLOT - /u.test(line.text));
		if (banners.length !== 1 || !canonical(banners[0]!.text).includes(canonical(document.claims[0]!.municipality))) return reject();
		const column = lines.filter(line => line.left >= center - 135 && line.right <= center - 12 && line.top > header.bottom && line.bottom < 1040).sort((left, right) => left.top - right.top);
		const titles = column.filter(line => line.bottom - line.top >= 10 && line.bottom - line.top < 12);
		const selections = column.filter(line => /^(?:\d{1,2} Year|Unexpired) Term - Vote for /u.test(line.text));
		if (!titles.length || titles.length > 4 || !selections.length || selections.length > 3 || [...titles, ...selections].some(line => !visible.includes(canonical(line.text)))) return reject();
		return { header, panel: banners[0]!.text.startsWith("OFFICIAL SCHOOL") ? "school" as const : "municipal-nonpartisan" as const, title: clean(titles.map(line => line.text).join(" ")), selections: selections.map(line => line.text) };
	});
	return cells.map<UnionChoiceContext>((cell) => {
		if (cell.top < 780) {
			const number = Number(/^\d+/u.exec(cell.position)?.[0]);
			const office = offices.find(office => office.rows.includes(number));
			const column = columns.find(column => column.letter === cell.position.replace(/^\d+/u, ""));
			if (!office || !column || cell.left - column.center < 25 || cell.right - column.center > 85) return reject();
			return { page: 1, position: cell.position, observedName: cell.observedName, panel: "general", printedOffice: office.title, printedSelections: [office.selection], printedPartyOrColumn: column.label, congressionalDistrict: canonical(office.title) === "MEMBEROFHOUSEOFREPRESENTATIVES" ? district : null };
		}
		const panel = lower.filter(panel => panel.header.right < cell.left).at(-1);
		if (!panel || cell.top < panel.header.bottom || cell.bottom > 1040) return reject();
		return { page: 1, position: cell.position, observedName: cell.observedName, panel: panel.panel, printedOffice: panel.title, printedSelections: panel.selections, printedPartyOrColumn: panel.panel === "municipal-nonpartisan" ? "Non-Partisan" : "", congressionalDistrict: null };
	});
}

export function unionOfficeCorroborated(expected: string, context: UnionChoiceContext) {
	const normalize = (value: string) => canonical(value).replace(/^MEMBERSOF/u, "MEMBEROF").replace(/^COUNCILMEMBERS/u, "COUNCILMEMBER");
	const wanted = normalize(expected);
	const observed = normalize(context.printedOffice);
	if (wanted === observed) return true;
	if (wanted === "SCHOOLBOARD") return context.panel === "school" && observed === "MEMBEROFBOARDOFEDUCATION";
	const congress = /^MEMBEROFHOUSEOFREPRESENTATIVES(\d{1,2})(?:ST|ND|RD|TH)CONGRESSIONALDISTRICT$/u.exec(wanted);
	if (congress) return observed === "MEMBEROFHOUSEOFREPRESENTATIVES" && context.congressionalDistrict === Number(congress[1]);
	if (wanted.endsWith("UNEXPIRED")) return wanted.slice(0, -9) === observed && context.printedSelections.some(value => value.startsWith("Unexpired Term"));
	if (wanted === "COUNCILMEMBERATLARGE2ND3RDWARDS") return observed === "2ND3RDWARDSCOUNCILMEMBERATLARGE";
	return false;
}
