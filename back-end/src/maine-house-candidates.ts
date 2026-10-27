import type { StateHtmlNode } from "./state-ballot-html.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

export interface MaineHouseCandidate {
	id: string;
	name: string;
	district: number;
	party: string;
	partyCode: string;
	residenceMunicipality?: string;
	incumbent: boolean;
}

export const maineHouseCandidateUrl = "https://mainelegislature.org/house/Documents/CandidateList";
const text = (node: StateHtmlNode) => stateHtmlText(node).replace(/\s+/gu, " ").trim();
const hasClass = (node: StateHtmlNode, value: string) => attribute(node, "class").split(/\s+/u).includes(value);
function reject(detail: string): never {
	throw new Error(`The Maine House candidate ${detail} requires review.`);
}
function one(nodes: StateHtmlNode[], detail: string) {
	if (nodes.length !== 1) return reject(detail);
	return nodes[0]!;
}
function safeText(value: string, maximum: number) {
	if (!value || value.length > maximum || containsControlCharacters(value) || /[<>\\]/u.test(value) || !/\p{L}/u.test(value)) return reject("text");
	return value;
}

export function readMaineHouseCandidates(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || body.includes("\uFFFD")) return reject("body bounds");
	const dom = parseStateHtml(body);
	const parents = new Map<StateHtmlNode, StateHtmlNode>();
	const pending = [{ node: dom, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		if (++visited > 40000 || depth > 64) return reject("DOM bounds");
		for (const child of node.childNodes ?? []) {
			parents.set(child, node);
			pending.push({ node: child, depth: depth + 1 });
		}
	}
	function visible(node: StateHtmlNode) {
		for (let ancestor: StateHtmlNode | undefined = node; ancestor; ancestor = parents.get(ancestor)) {
			if (ancestor.attrs?.some(item => item.name === "hidden") || attribute(ancestor, "aria-hidden") === "true" || /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\D|$)|font-size\s*:\s*0(?:\D|$)|color\s*:\s*transparent/iu.test(attribute(ancestor, "style")) || ["d-none", "invisible", "visually-hidden", "sr-only"].some(value => hasClass(ancestor!, value))) return reject("hidden content");
		}
	}
	const heading = one(descendants(dom, node => node.nodeName === "h3" && text(node) === "Candidate List"), "title");
	visible(heading);
	const header = parents.get(heading)!;
	const card = parents.get(header)!;
	const legislature = text(one(descendants(card, node => node.nodeName === "h4"), "legislature"));
	const number = /^(1\d{2}|2\d{2})(?:st|nd|rd|th) Legislature$/u.exec(legislature);
	if (!number) return reject("legislature identity");
	const ordinal = Number(number[1]);
	const suffix = ordinal % 100 >= 11 && ordinal % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[ordinal % 10] ?? "th";
	if (legislature !== `${ordinal}${suffix} Legislature`) return reject("legislature ordinal");
	const notice = one(descendants(card, node => hasClass(node, "alert-info")), "status notice");
	visible(notice);
	if (text(notice) !== "This list has been compiled from a number of sources and represents the most complete and accurate information we could find. It is unofficial until the results can be checked against the official list from the Office of the Secretary of State. From Robert Hunt, Clerk of the House and Michelle Dunphy, Assistant Clerk of the House") return reject("unofficial status or attribution");
	const counts = new Map<string, number>();
	for (const label of ["Total Candidates", "Districts", "Incumbents"]) {
		const caption = one(descendants(dom, node => node.nodeName === "small" && text(node) === label), "summary label");
		const container = parents.get(caption)!;
		visible(container);
		const value = text(one(descendants(container, node => node.nodeName === "h3"), "summary count"));
		if (!/^\d{1,4}$/u.test(value)) return reject("summary count");
		counts.set(label, Number(value));
	}
	const districtCount = counts.get("Districts")!;
	if (districtCount !== 151 || counts.get("Total Candidates")! > 1500 || counts.get("Incumbents")! > districtCount) return reject("summary bounds");
	const districts = descendants(dom, node => attribute(node, "id").startsWith("district-"));
	if (districts.length !== districtCount) return reject("district inventory");
	const records: MaineHouseCandidate[] = [];
	const claims: { district: number; candidateIds: string[]; reportedCandidates: number }[] = [];
	for (const [position, district] of districts.entries()) {
		visible(district);
		const districtNumber = position + 1;
		if (attribute(district, "id") !== `district-${districtNumber}` || text(one(descendants(district, node => node.nodeName === "h5"), "district heading")) !== `District ${districtNumber}`) return reject("district sequence");
		const header = one(descendants(district, node => hasClass(node, "card-header")), "district header");
		const count = text(one(descendants(header, node => node.nodeName === "span" && hasClass(node, "badge")), "district count"));
		const expected = /^(\d{1,2}) Candidates?$/u.exec(count);
		if (!expected || Number(expected[1]) > 20) return reject("district count");
		const list = one(descendants(district, node => node.nodeName === "ul"), "candidate list");
		const items = (list.childNodes ?? []).filter(node => node.nodeName !== "#text" || text(node));
		if (items.length !== Number(expected[1]) || items.some(node => node.nodeName !== "li" || !hasClass(node, "list-group-item"))) return reject("candidate count or structure");
		const candidateIds: string[] = [];
		for (const item of items) {
			visible(item);
			if (item.attrs?.some(value => /^on/iu.test(value.name)) || descendants(item, node => ["script", "style", "iframe", "object", "embed", "template", "svg", "canvas", "img", "input", "select", "textarea", "button"].includes(node.nodeName) || node.attrs?.some(value => /^on/iu.test(value.name)) === true).length) return reject("active candidate content");
			const title = one(descendants(item, node => node.nodeName === "h6"), "candidate name heading");
			const nameNode = one(descendants(title, node => node.nodeName === "strong"), "candidate name");
			const codeNode = one(descendants(title, node => node.nodeName === "span"), "candidate party code");
			const partyNode = one(descendants(item, node => hasClass(node, "text-end")), "candidate party");
			for (const node of [nameNode, codeNode, partyNode]) visible(node);
			const name = safeText(text(nameNode), 250);
			const partyCode = text(codeNode);
			const party = safeText(text(partyNode), 100);
			const partyLabels: Record<string, string> = { D: "Democrat", R: "Republican", U: "Unenrolled", I: "Independent", N: "No Labels" };
			if (partyLabels[partyCode] !== party) return reject("party code or label");
			const municipalityNodes = descendants(item, node => node.nodeName === "p");
			if (municipalityNodes.length > 1) return reject("residence field");
			const residenceMunicipality = municipalityNodes.length ? safeText(text(municipalityNodes[0]!), 200) : undefined;
			if (municipalityNodes.length) visible(municipalityNodes[0]!);
			const stars = descendants(title, node => node.nodeName === "i");
			if (stars.length > 1 || stars.some(node => attribute(node, "title") !== "Incumbent" || !hasClass(node, "fa-star"))) return reject("incumbency marker");
			const incumbent = stars.length === 1;
			if (text(item) !== [name, partyCode, residenceMunicipality, party].filter(Boolean).join(" ")) return reject("unassigned candidate text");
			const id = createHash("sha256").update(JSON.stringify(["maine-house-clerk", Number(number[1]), districtNumber, name, party])).digest("hex").slice(0, 24);
			records.push({ id, name, district: districtNumber, party, partyCode, ...(residenceMunicipality ? { residenceMunicipality } : {}), incumbent });
			candidateIds.push(id);
		}
		claims.push({ district: districtNumber, candidateIds, reportedCandidates: Number(expected[1]) });
	}
	if (records.length !== counts.get("Total Candidates") || records.filter(record => record.incumbent).length !== counts.get("Incumbents") || new Set(records.map(record => record.id)).size !== records.length) return reject("complete candidate or incumbency inventory");
	return { legislature: Number(number[1]), legislatureLabel: legislature, sourceStatus: "Unofficial" as const, electionDateVerified: false as const, records, districts: claims, reportedCandidates: counts.get("Total Candidates")!, reportedDistricts: districtCount, reportedIncumbents: counts.get("Incumbents")! };
}
