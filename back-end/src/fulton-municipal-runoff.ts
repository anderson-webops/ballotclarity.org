import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

interface NativeField { text: string; left: number; top: number; width: number; height: number; size: number; family: string; bold: boolean }
export interface FultonMunicipalContest {
	id: string;
	municipality: string;
	office: string;
	district: string;
	voteLimit: 1;
	candidates: { id: string; name: string; incumbent?: true }[];
}
export interface FultonMunicipalSource { url: string; sha256: string; bytes: number; retrievedAt: string }
export interface FultonMunicipalRunoffInventory {
	schemaVersion: 1;
	type: "fulton-municipal-runoff-inventory";
	sourceId: string;
	stateCode: "GA";
	countyFips: "13121";
	electionDate: string;
	retrievedAt: string;
	sourcePublishedAt: null;
	source: FultonMunicipalSource;
	nativeTextSha256: string;
	publicationApproved: false;
	voterApplicabilityVerified: false;
	automaticCollectionConfigured: false;
	contests: FultonMunicipalContest[];
}
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();

function nativeFields(body: string): NativeField[] {
	assert(Buffer.byteLength(body) <= 2 * 1024 * 1024 && !body.includes("\uFFFD") && !containsControlCharacters(body.replace(/[\r\n\t]/gu, "")), "The municipal ballot text exceeds its bounds.");
	assert(/^<\?xml[^>]+>\s*<!DOCTYPE pdf2xml SYSTEM "pdf2xml.dtd">/u.test(body) && /<\/pdf2xml>\s*$/u.test(body) && !/<!ENTITY|<!DOCTYPE[^>]*\[|<(?:script|style|image|img|iframe|object|foreignObject|animate|set)\b/iu.test(body), "The municipal native document is unsupported.");
	const tree = parseStateHtml(body);
	const pages = descendants(tree, node => node.nodeName === "page");
	assert.equal(pages.length, 1, "The municipal runoff reader supports the reviewed single-page layout.");
	const page = pages[0]!;
	assert(attribute(page, "number") === "1" && attribute(page, "width") === "918" && attribute(page, "height") === "1512", "The municipal page geometry requires review.");
	const fonts = new Map<string, { size: number; family: string }>();
	for (const node of descendants(page, node => node.nodeName === "fontspec")) {
		const id = attribute(node, "id");
		const family = attribute(node, "family").replace(/^[A-Z]{6}\+/u, "");
		const size = Number(attribute(node, "size"));
		assert(/^\d{1,2}$/u.test(id) && !fonts.has(id) && ["Arial", "ArialMT", "ArialNarrow"].includes(family) && Number.isInteger(size) && size >= 8 && size <= 300 && attribute(node, "color") === "#231f20", "The municipal ballot font requires review.");
		fonts.set(id, { size, family });
	}
	assert(fonts.size >= 4 && fonts.size <= 20);
	const fields = descendants(page, node => node.nodeName === "text").map((node) => {
		const font = fonts.get(attribute(node, "font"));
		assert(font && !descendants(node, child => !["b", "i", "#text"].includes(child.nodeName)).length, "The municipal text markup requires review.");
		const text = clean(stateHtmlText(node));
		const geometry = { left: Number(attribute(node, "left")), top: Number(attribute(node, "top")), width: Number(attribute(node, "width")), height: Number(attribute(node, "height")) };
		assert(text && text.length <= 2000 && Object.values(geometry).every(Number.isFinite) && geometry.left >= 0 && geometry.top >= 0 && geometry.width > 0 && geometry.height > 0 && geometry.height <= 500, "The municipal text geometry is invalid.");
		if (!(font.size === 285 && font.family === "Arial" && text === "SAMPLE")) assert(geometry.left + geometry.width <= 919 && geometry.top + geometry.height <= 1513, "The municipal ballot field leaves the page.");
		return { text, ...geometry, ...font, bold: descendants(node, child => child.nodeName === "b").length === 1 };
	});
	assert(fields.length >= 30 && fields.length <= 500);
	return fields;
}

export function prepareFultonMunicipalRunoff(body: string, source: FultonMunicipalSource): FultonMunicipalRunoffInventory {
	assert.equal(Object.keys(source).sort().join(","), "bytes,retrievedAt,sha256,url", "The municipal source fields are invalid.");
	const url = new URL(source.url);
	assert(url.href === source.url && url.protocol === "https:" && ["fultoncountyga.gov", "www.fultoncountyga.gov"].includes(url.hostname) && !url.port && !url.username && !url.password && !url.search && !url.hash && /^\/-\/media\/[\w/-]+\.pdf$/u.test(url.pathname), "Use the exact official municipal ballot PDF URL.");
	assert(/^[a-f\d]{64}$/u.test(source.sha256) && Number.isSafeInteger(source.bytes) && source.bytes > 0 && source.bytes <= 12 * 1024 * 1024 && Number.isFinite(Date.parse(source.retrievedAt)) && new Date(source.retrievedAt).toISOString() === source.retrievedAt, "The municipal source evidence is invalid.");
	const fields = nativeFields(body);
	assert.equal(fields.filter(field => field.text === "COMPOSITE SAMPLE BALLOT").length, 1);
	assert.equal(fields.filter(field => field.text === "Fulton County, Georgia").length, 1);
	const elections = fields.filter(field => field.text.startsWith("Municipal General Runoff Election - "));
	assert.equal(elections.length, 1, "The municipal runoff election must be explicit and unambiguous.");
	const printedDate = /^Municipal General Runoff Election - (November|December) (0?[1-9]|[12]\d|3[01]), (20\d{2})$/u.exec(elections[0]!.text);
	assert(printedDate, "The municipal runoff date requires review.");
	const electionDate = `${printedDate[3]}-${printedDate[1] === "November" ? "11" : "12"}-${printedDate[2]!.padStart(2, "0")}`;
	assert(new Date(`${electionDate}T00:00:00Z`).toISOString().slice(0, 10) === electionDate && new Date(`${electionDate}T00:00:00Z`).getUTCDay() === 2, "The printed municipal runoff date is invalid.");
	const sourceId = `ga-fulton-municipal-runoff-${electionDate}`;
	const headings = fields.filter(field => field.text === "General Election Runoff");
	assert(headings.length > 0 && headings.length <= 15 && headings.every(field => field.top > elections[0]!.top + 30 && field.bold && field.family === "Arial" && field.size === 18));
	const beginning = Math.min(...headings.map(field => field.top));
	const columns = [[], [], []] as NativeField[][];
	for (const field of fields.filter(field => field.top >= beginning)) {
		if (field.text === "SAMPLE" && field.size === 285 && field.family === "Arial") continue;
		const center = field.left + field.width / 2;
		const column = Math.floor((center - 65) / 263);
		assert(column >= 0 && column < 3 && field.left >= 65 + column * 263 - 2 && field.left + field.width <= 65 + (column + 1) * 263 + 2, "The municipal field crosses voting columns.");
		columns[column]!.push(field);
	}
	const contests: FultonMunicipalContest[] = [];
	for (const column of columns) {
		let municipality = "";
		let pendingCity = false;
		let contest: FultonMunicipalContest | null = null;
		let voted = false;
		let previousTop = -1;
		let candidateField: NativeField | null = null;
		const finish = () => {
			if (!contest) return;
			assert(voted && (contest.office === "Mayor" ? !contest.district : /^District [1-9]\d?(?: At Large)?$/u.test(contest.district)) && contest.candidates.length === 2, "The municipal runoff contest is incomplete or unfamiliar.");
			contest.id = hash(JSON.stringify([sourceId, municipality, contest.office, contest.district])).slice(0, 24);
			for (const candidate of contest.candidates) candidate.id = hash(JSON.stringify([contest.id, candidate.name])).slice(0, 24);
			assert(new Set(contest.candidates.map(candidate => candidate.name)).size === 2, "The municipal contest repeats a candidate.");
			contests.push(contest);
			contest = null;
			candidateField = null;
		};
		for (const field of column.sort((first, second) => first.top - second.top)) {
			assert(field.top > previousTop, "The municipal ballot has overlapping text.");
			previousTop = field.top;
			if (field.text === "General Election Runoff" && field.bold && field.family === "Arial" && field.size === 18) {
				finish();
				assert(!pendingCity);
				pendingCity = true;
				municipality = "";
			}
			else if (pendingCity) {
				assert(/^City of [A-Z][A-Za-z .'-]{1,79}$/u.test(field.text) && field.bold && field.family === "Arial" && field.size === 18, "The municipal heading requires review.");
				municipality = field.text;
				pendingCity = false;
			}
			else if (/^For (?:Mayor|City Council(?: Member)?|Board of Education Member)$/u.test(field.text) && field.bold && field.family === "ArialNarrow" && field.size === 17) {
				finish();
				assert(municipality);
				contest = { id: "", municipality, office: field.text.slice(4), district: "", voteLimit: 1, candidates: [] };
				voted = false;
			}
			else if (/^District [1-9]\d?(?: At Large)?$/u.test(field.text) && field.bold && field.family === "ArialNarrow" && field.size === 17) {
				assert(contest && !contest.district && !voted && !contest.candidates.length);
				contest.district = field.text;
			}
			else if (field.text === "(Vote for One)" && !field.bold && field.family === "ArialMT" && field.size === 14) {
				assert(contest && !voted && !contest.candidates.length);
				voted = true;
			}
			else if (field.text === "(Incumbent)" && !field.bold && field.family === "ArialMT" && field.size === 12) {
				const candidate = contest?.candidates.at(-1);
				assert(candidate && candidateField && !candidate.incumbent && field.top - candidateField.top <= 24 && Math.abs(field.left - candidateField.left) <= 1);
				candidate.incumbent = true;
			}
			else {
				assert(contest && voted && contest.candidates.length < 2 && field.bold && field.family === "ArialNarrow" && field.size === 15 && /^[\p{L}\p{M}][\p{L}\p{M} .,'’-]{1,119}$/u.test(field.text), "The municipal candidate text requires review.");
				assert(!candidateField || field.top - candidateField.top >= 30, "The municipal candidate rows overlap.");
				contest.candidates.push({ id: "", name: field.text });
				candidateField = field;
			}
		}
		finish();
		assert(!pendingCity);
	}
	assert(contests.length > 0 && contests.length <= 30 && new Set(contests.map(contest => contest.id)).size === contests.length, "The municipal contest inventory is ambiguous.");
	return { schemaVersion: 1, type: "fulton-municipal-runoff-inventory", sourceId, stateCode: "GA", countyFips: "13121", electionDate, retrievedAt: source.retrievedAt, sourcePublishedAt: null, source: { ...source }, nativeTextSha256: hash(body), publicationApproved: false, voterApplicabilityVerified: false, automaticCollectionConfigured: false, contests };
}

export function fultonMunicipalRunoffCsv(inventory: FultonMunicipalRunoffInventory) {
	const rows: (string | number | boolean)[][] = [["sourceId", "electionDate", "municipality", "office", "district", "voteLimit", "name", "incumbent", "sourceUrl", "page", "retrievedAt"]];
	for (const contest of inventory.contests) {
		for (const candidate of contest.candidates) rows.push([inventory.sourceId, inventory.electionDate, contest.municipality, contest.office, contest.district, contest.voteLimit, candidate.name, candidate.incumbent ?? "", inventory.source.url, 1, inventory.retrievedAt]);
	}
	return `${rows.map(row => row.map(value => `"${String(value).replace(/"/gu, "\"\"")}"`).join(",")).join("\n")}\n`;
}
