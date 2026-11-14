import type { StateHtmlNode } from "./state-ballot-html.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";

export const unionCandidateOrigin = "https://unioncountyvotes.com";
export const unionCandidateIndexUrl = `${unionCandidateOrigin}/whos-running/`;
export const unionCandidatePolicyUrls = [`${unionCandidateOrigin}/robots.txt`, `${unionCandidateOrigin}/privacy-policy/`] as const;
export const unionCandidateHash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const text = (node: StateHtmlNode) => clean(stateHtmlText(node));
const hashValue = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
function reject(): never {
	throw new Error("The Union County candidate research source requires review.");
}

export interface UnionCandidateCapture { url: string; body: Buffer; sha256: string; capturedAt: string }
export interface UnionCandidateEdition {
	year: number;
	documents: { kind: "general" | "school"; url: string; sourceAsOfDate: string }[];
}
export interface UnionCandidateReference {
	page: number;
	position: string;
	name: string;
	office: string;
	jurisdictionLabel: string;
	partyCode: string;
	termLabel: string;
}
interface UnionCandidatePageInventory {
	page: number;
	jurisdictionLabel: string;
	records: number;
	sourceNotice?: string;
	contextLines?: string[];
	selectionInstructions?: string[];
	notices?: { text: string; partyCode: string; office: string; position: string }[];
}

function legalLinks(document: StateHtmlNode) {
	return [...new Set(descendants(document, node => node.nodeName === "a" && /privacy|terms|copyright|disclaimer|licen[cs]e/iu.test(`${text(node)} ${attribute(node, "href")}`)).map(node => new URL(attribute(node, "href"), unionCandidateOrigin).href))].sort();
}
function main(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) return reject();
	const document = parseStateHtml(body);
	if (legalLinks(document).join("\n") !== unionCandidatePolicyUrls[1]) return reject();
	const regions = descendants(document, node => attribute(node, "class").split(" ").includes("entry-content"));
	if (regions.length !== 1) return reject();
	return regions[0]!;
}
export function unionCandidatePolicyHash(body: string, kind: "robots" | "privacy") {
	if (kind === "robots") {
		if (clean(body) !== "User-agent: * Crawl-delay: 30") return reject();
		return unionCandidateHash(clean(body));
	}
	const content = text(main(body));
	if (!content.startsWith("COUNTY OF UNION, NEW JERSEY Thank you for reviewing our Privacy Notice.") || !content.includes("Section F. Disclaimer") || !content.includes("Section G. Contact Information")) return reject();
	return unionCandidateHash(content);
}
export function unionCandidateDocumentUrl(url: string, year: number) {
	const address = new URL(url);
	if (address.href !== url || address.origin !== unionCandidateOrigin || address.username || address.password || address.port || address.search || address.hash || !new RegExp(`^/wp-content/uploads/${year}/(?:0[1-9]|1[0-2])/[A-Za-z0-9_-]+\\.pdf$`, "u").test(address.pathname)) return reject();
	return address.href;
}
export function readUnionCandidateEdition(body: string): UnionCandidateEdition {
	const region = main(body);
	const children = (region.childNodes ?? []).filter(node => node.nodeName !== "#text" || text(node));
	const editions = children.flatMap((node, index) => {
		const match = /^(20\d{2}) General Election$/u.exec(text(node));
		return match ? [{ year: Number(match[1]), index }] : [];
	});
	if (!editions.length || editions.length > 20 || new Set(editions.map(edition => edition.year)).size !== editions.length) return reject();
	const selected = editions.reduce((latest, edition) => edition.year > latest.year ? edition : latest);
	if (selected.year < 2026 || selected.year > 2099) return reject();
	const list = children[selected.index + 1];
	if (!list || list.nodeName !== "ul") return reject();
	const rows = (list.childNodes ?? []).filter(node => node.nodeName === "li");
	if (rows.length !== 2) return reject();
	const documents = rows.map((row, index) => {
		const anchors = descendants(row, node => node.nodeName === "a");
		const kind = index === 0 ? "general" : "school";
		if (anchors.length !== 1 || text(anchors[0]!) !== (kind === "general" ? "General Election Candidates" : "School Board Candidates")) return reject();
		const match = / A ?s of (\d{1,2})-(\d{1,2})-(20\d{2})$/u.exec(text(row));
		const sourceAsOfDate = match ? `${match[3]}-${match[1]!.padStart(2, "0")}-${match[2]!.padStart(2, "0")}` : "";
		if (!sourceAsOfDate || match?.[3] !== String(selected.year) || new Date(`${sourceAsOfDate}T00:00:00Z`).toISOString().slice(0, 10) !== sourceAsOfDate) return reject();
		return { kind: kind as "general" | "school", url: unionCandidateDocumentUrl(new URL(attribute(anchors[0]!, "href"), unionCandidateIndexUrl).href, selected.year), sourceAsOfDate };
	});
	if (new Set(documents.map(document => document.url)).size !== 2) return reject();
	return { year: selected.year, documents };
}

interface Field { text: string; left: number; right: number; top: number; bottom: number }
function positionedPages(body: string) {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024) return reject();
	const document = parseStateHtml(body);
	const pages = descendants(document, node => node.nodeName === "page");
	if (!pages.length || pages.length > 50) return reject();
	return pages.map((page) => {
		if (Number(attribute(page, "width")) !== 1008 || Number(attribute(page, "height")) !== 612) return reject();
		const fields = descendants(page, node => node.nodeName === "line").flatMap((node): Field[] => {
			const words = descendants(node, child => child.nodeName === "word");
			const value = clean(words.map(stateHtmlText).join(" "));
			const groups = /^.+ [1-9] Yrs$/u.test(value) ? [words.slice(0, -2), words.slice(-2)] : [words];
			return groups.map((group) => {
				const field = { text: clean(group.map(stateHtmlText).join(" ")), left: Math.min(...group.map(word => Number(attribute(word, "xmin")))), right: Math.max(...group.map(word => Number(attribute(word, "xmax")))), top: Math.min(...group.map(word => Number(attribute(word, "ymin")))), bottom: Math.max(...group.map(word => Number(attribute(word, "ymax")))) };
				if (!field.text || field.text.length > 1000 || ![field.left, field.right, field.top, field.bottom].every(Number.isFinite) || field.left < 0 || field.right > 1008 || field.left >= field.right || field.top < 0 || field.bottom > 612 || field.top >= field.bottom) return reject();
				return field;
			});
		});
		if (!fields.length || fields.length > 3000) return reject();
		const fragments = fields.filter(field => /^(?:st|nd|rd|th)$/u.test(field.text));
		for (const fragment of fragments) {
			const matches = fields.filter(field => /^\d+ /u.test(field.text) && fragment.left >= field.left && fragment.right <= field.right && Math.abs(fragment.top - field.top) < 2);
			if (matches.length !== 1) return reject();
			matches[0]!.text = matches[0]!.text.replace(/^(\d+) /u, `$1${fragment.text} `);
		}
		return fields.filter(field => !fragments.includes(field));
	});
}
function dateLabel(value: string) {
	const match = /^NOVEMBER (\d{1,2}), (20\d{2})$/u.exec(value);
	const date = match ? `${match[2]}-11-${match[1]!.padStart(2, "0")}` : "";
	if (!date || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return reject();
	return date;
}
export function readUnionCandidateReferences(body: string, layout: string, kind: "general" | "school", edition: UnionCandidateEdition) {
	const pages = positionedPages(body);
	const visiblePages = layout.split("\f").filter(page => page.trim());
	const descriptor = edition.documents.find(document => document.kind === kind);
	if (!descriptor || visiblePages.length !== pages.length || Buffer.byteLength(layout) > 4 * 1024 * 1024) return reject();
	const references: UnionCandidateReference[] = [];
	const inventory: UnionCandidatePageInventory[] = [];
	let electionDate = "";
	for (const [pageIndex, fields] of pages.entries()) {
		const page = pageIndex + 1;
		const visible = clean(visiblePages[pageIndex]!);
		const title = `CANDIDATE LIST FOR THE ${kind === "general" ? "GENERAL" : "SCHOOL BOARD"} ELECTION`;
		if (fields.filter(field => field.text === title).length !== 1 || !visible.includes(title) || !visible.includes("UNION COUNTY DEPUTY CLERK") || !visible.includes("REFRAIN FROM PUBLISHING LITERATURE UNTIL POSITIONS ARE CONFIRMED")) return reject();
		const dates = fields.filter(field => /^NOVEMBER \d{1,2}, 20\d{2}$/u.test(field.text));
		if (dates.length !== 1) return reject();
		const date = dateLabel(dates[0]!.text);
		if (!visible.includes(dates[0]!.text) || date.slice(0, 4) !== String(edition.year) || (electionDate && electionDate !== date) || descriptor.sourceAsOfDate > date) return reject();
		electionDate = date;
		const revisions = fields.filter(field => field.top > 550 && /^\d{1,2}\/\d{1,2}\/20\d{2}$/u.test(field.text));
		const revision = revisions[0]?.text.split("/");
		if (revisions.length !== 1 || `${revision?.[2]}-${revision?.[0]!.padStart(2, "0")}-${revision?.[1]!.padStart(2, "0")}` !== descriptor.sourceAsOfDate) return reject();
		const positions = fields.filter(field => /^POSITIONS?$/u.test(field.text));
		if (positions.length !== 1) return reject();
		const header = positions[0]!;
		const columns = fields.filter(field => Math.abs(field.top - header.top) < 1).sort((left, right) => left.left - right.left);
		const expected = kind === "school" ? "POSITION,CANDIDATE,ADDRESS,SLOGAN,TERM,EMAIL ADDRESS" : columns.some(field => field.text === "OFFICE") ? "POSITION,CANDIDATE,ADDRESS,PARTY,OFFICE,SLOGAN,EMAIL ADDRESS" : "POSITION,CANDIDATE,ADDRESS,PARTY,SLOGAN,TERM,EMAIL ADDRESS";
		if (columns.map(field => field.text.replace(/^POSITIONS$/u, "POSITION")).join(",") !== expected) return reject();
		const context = fields.filter(field => field.top > dates[0]!.bottom && field.bottom < header.top).sort((left, right) => left.top - right.top || left.left - right.left);
		if (context.some(field => !visible.replace(/\s/gu, "").includes(field.text.replace(/\s/gu, "")))) return reject();
		const jurisdiction = context.find(field => /^(?:TOWNSHIP|TOWN|BOROUGH|CITY) OF [A-Z ]+$/u.test(field.text));
		const heading = context.find(field => /^(?:UNITED STATES SENATOR|MEMBER OF HOUSE OF REPRESENTATIVES|SHERIFF|COUNTY CLERK|MEMBERS OF BOARD OF COUNTY COMMISSIONERS)/u.test(field.text));
		if ((kind === "school" || expected.includes("OFFICE")) ? !jurisdiction || heading : !heading || jurisdiction) return reject();
		const headingParts = heading ? context.filter(field => Math.abs(field.top - heading.top) < 6).sort((left, right) => left.left - right.left).map(field => field.text).join(" ") : "";
		const columnFor = (field: Field) => {
			const center = (field.left + field.right) / 2;
			const centers = columns.map(column => (column.left + column.right) / 2);
			return centers.findIndex((value, index) => center >= (index ? (centers[index - 1]! + value) / 2 : 0) && center < (index < centers.length - 1 ? (value + centers[index + 1]!) / 2 : 1008));
		};
		const bodyFields = fields.filter(field => field.top > header.bottom && field.top < 550);
		const markerFields = bodyFields.filter(field => (columnFor(field) === 0 && /^\d{1,2}(?:[A-Z]|-\d{1,2})$/u.test(field.text)) || (columnFor(field) === 1 && field.text === "No Nomination Made"));
		const markers = markerFields.filter(field => columnFor(field) === 0 || !markerFields.some(other => columnFor(other) === 0 && Math.abs(field.top - other.top) < 2)).sort((left, right) => left.top - right.top);
		if (!markers.length) {
			const empty = kind === "general" ? "NO LOCAL CANDIDATES" : "NO PETITION FILED";
			if (!bodyFields.some(field => field.text === empty) || !visible.includes(empty) || bodyFields.some(field => columnFor(field) === 0 && /^\d{1,2}(?:[A-Z]|-\d{1,2})(?:\s|$)/u.test(field.text))) throw new Error(`Union ${kind} page ${page} has an unrecognized empty roster.`);
			inventory.push({ page, jurisdictionLabel: jurisdiction!.text, records: 0, sourceNotice: empty });
			continue;
		}
		if (markers.length > 100) return reject();
		const firstInstruction = bodyFields.filter(field => /\b(?:YEAR TERM|VOTE FOR)\b/u.test(field.text)).sort((left, right) => left.top - right.top)[0];
		if (!firstInstruction || firstInstruction.top <= markers[markers.length - 1]!.bottom) return reject();
		const data = bodyFields.filter(field => field.top < firstInstruction.top);
		const consumed = new Set<Field>();
		const notices: { text: string; partyCode: string; office: string; position: string }[] = [];
		const before = references.length;
		for (const [rowIndex, marker] of markers.entries()) {
			const end = markers[rowIndex + 1]?.top ?? firstInstruction.top;
			const row = data.filter(field => field.top >= marker.top - 2 && field.top < end - 2);
			const values = columns.map((column, columnIndex) => row.filter(field => columnFor(field) === columnIndex).sort((left, right) => left.top - right.top || left.left - right.left).map(field => field.text).join(" "));
			if (values[1] === "No Nomination Made") {
				const allowedColumns = [0, 1, 3, ...(expected.includes("OFFICE") ? [4] : [])];
				if (kind !== "general" || (values[0] && values[0] !== marker.text) || !["Dem", "Rep", "Ind"].includes(values[3]!) || values.some((value, index) => !allowedColumns.includes(index) && value)) return reject();
				for (const field of row) consumed.add(field);
				notices.push({ text: values[1], partyCode: values[3]!, office: expected.includes("OFFICE") ? values[4]! : headingParts, position: values[0]! });
				continue;
			}
			if (values[0] !== marker.text) return reject();
			const name = values[1]!;
			if (!name || name.length > 150 || !/^[\p{L}\p{M} .,'’"()/-]+$/u.test(name) || /\b(?:NO PETITION|CANDIDATE|ADDRESS|WITHDRAWN|NONE)\b/u.test(name) || row.filter(field => columnFor(field) === 1).some(field => !visible.includes(field.text))) return reject();
			const partyCode = kind === "general" ? values[3]! : "";
			if (kind === "general" && !["", "Dem", "Rep", "Ind"].includes(partyCode)) throw new Error(`Union general page ${page} row ${rowIndex + 1} requires party-column review.`);
			const office = kind === "school" ? "School Board" : expected.includes("OFFICE") ? values[4]! : headingParts;
			if (!office || office.length > 200 || /@|\b(?:ADDRESS|SLOGAN)\b/u.test(office)) throw new Error(`Union ${kind} page ${page} row ${rowIndex + 1} requires office-column review.`);
			const termLabel = expected.includes("TERM") ? values[columns.findIndex(column => column.text === "TERM")]! : "";
			if (expected.includes("TERM") && !/^[1-9] ?Yrs$/u.test(termLabel)) throw new Error(`Union ${kind} page ${page} row ${rowIndex + 1} requires term-column review.`);
			const relevantColumns = [1, ...(kind === "general" ? [3] : []), ...(expected.includes("OFFICE") ? [4] : []), ...(expected.includes("TERM") ? [columns.findIndex(column => column.text === "TERM")] : [])];
			if (row.filter(field => relevantColumns.includes(columnFor(field))).some(field => !visible.replace(/\s/gu, "").includes(field.text.replace(/\s/gu, "")))) return reject();
			for (const field of row) consumed.add(field);
			const reference = { page, position: marker.text, name, office, jurisdictionLabel: jurisdiction?.text ?? "UNION COUNTY", partyCode, termLabel };
			if (references.some(existing => JSON.stringify(existing) === JSON.stringify(reference))) return reject();
			references.push(reference);
		}
		if (data.some(field => !consumed.has(field))) return reject();
		const selectionInstructions = bodyFields.filter(field => field.top >= firstInstruction.top - 2).sort((left, right) => left.top - right.top || left.left - right.left).map(field => field.text);
		if (selectionInstructions.some(instruction => !visible.replace(/\s/gu, "").includes(instruction.replace(/\s/gu, "")))) return reject();
		inventory.push({ page, jurisdictionLabel: jurisdiction?.text ?? "UNION COUNTY", contextLines: context.map(field => field.text), selectionInstructions, records: references.length - before, ...(notices.length ? { notices } : {}) });
	}
	if (!references.length || references.length > 2000) return reject();
	return { electionDate, references, inventory, sourceAsOfDate: descriptor.sourceAsOfDate, positionConfirmationVerified: false, qualificationVerified: false, personalApplicabilityVerified: false };
}

export async function collectUnionCandidateDocuments(review: { robots: string; privacy: string }, options: { fetchDocument?: typeof fetchRemoteSourceDocument; sleep?: (milliseconds: number) => Promise<void>; now?: () => number; onCapture?: (capture: UnionCandidateCapture) => Promise<void> } = {}) {
	if (!review || Object.keys(review).sort().join(",") !== "privacy,robots" || !hashValue(review.robots) || !hashValue(review.privacy)) return reject();
	const captures: UnionCandidateCapture[] = [];
	let previous = -Infinity;
	const now = options.now ?? Date.now;
	async function request(url: string, pdf = false) {
		await (options.sleep ?? wait)(Math.max(0, 31000 - (now() - previous)));
		previous = now();
		const result = await (options.fetchDocument ?? fetchRemoteSourceDocument)(url, { allowedHosts: ["unioncountyvotes.com"], maxBytes: pdf ? 12 * 1024 * 1024 : 2 * 1024 * 1024, timeoutMs: 20000 });
		if (result.status !== 200 || !result.body.length || (pdf ? !result.body.subarray(0, 5).equals(Buffer.from("%PDF-")) || !/application\/pdf/iu.test(result.contentType) : !/text\/(?:html|plain)/iu.test(result.contentType))) return reject();
		const capture = { url, body: result.body, sha256: unionCandidateHash(result.body), capturedAt: new Date(now()).toISOString() };
		await options.onCapture?.(capture);
		captures.push(capture);
		return capture;
	}
	const robots = await request(unionCandidatePolicyUrls[0]);
	if (unionCandidatePolicyHash(robots.body.toString("utf8"), "robots") !== review.robots) return reject();
	const index = await request(unionCandidateIndexUrl);
	const edition = readUnionCandidateEdition(index.body.toString("utf8"));
	if (edition.documents.some(document => document.sourceAsOfDate > index.capturedAt.slice(0, 10))) return reject();
	const privacy = await request(unionCandidatePolicyUrls[1]);
	if (unionCandidatePolicyHash(privacy.body.toString("utf8"), "privacy") !== review.privacy) return reject();
	for (const document of edition.documents) await request(document.url, true);
	return { edition, captures, imported: false, publicationApproved: false, automaticImportApproved: false };
}
