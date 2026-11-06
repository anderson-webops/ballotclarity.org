import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { EverettGlyphCatalog } from "./state-ballot-everett-visual.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteJsonText, fetchRemoteSourceDocument } from "./remote-json-source.js";
import { parseEverettNativeTree } from "./state-ballot-everett-visual.js";
import { everettAutomaticSource, everettIndexUrl, readEverettCandidateDocuments, validateEverettDocumentUrl, validateEverettSource } from "./state-ballot-everett.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, stateHtmlText } from "./state-ballot-html.js";
import { extractStateBallotPdfSvg, extractStateBallotPdfXml, resolveStateBallotPdfSvgExtractor, resolveStateBallotPdfXmlExtractor } from "./state-ballot-pdf.js";

export const everettHash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
export const everettAjaxUrl = "https://cityofeverett.com/wp-admin/admin-ajax.php";
const pageBytes = 2 * 1024 * 1024;
const exact = (value: unknown, fields: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...fields].sort().join(","));
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const text = (node: Parameters<typeof stateHtmlText>[0]) => clean(stateHtmlText(node));
export const everettPolicyReceipts = [
	{ url: "https://cityofeverett.com/robots.txt", format: "robots", sha256: "1b8ec1b7594d99e9f7ecf38d966714b3fdf34ebbbcf712a08cf484a9997214f3" },
	{ url: everettIndexUrl, format: "links", sha256: "7034496c8ba0753bb0e3181f668945323b0883a9145cf8a180cab962dacb9005" },
] as const;
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
interface Table extends Page { start: number; draw: number; requestBodySha256: string; successful2xx: true; jsonContentTypeValidated: true }
interface Document { url: string; sha256: string; retrievedAt: string; xml: string; svg: string }
interface Capture { schemaVersion: 1; type: "everett-candidate-capture"; policies: typeof everettPolicyReceipts; index: Page; tables: Table[]; documents: Document[] }
interface Library { tableId: string; nonce: string; columns: { data: string; name: string; searchable: string; orderable: string }[] }
export interface EverettElection { electionId: null; electionDate: string; pageUrl: string; everettDocumentUrls: string[]; everettIndexSha256: string }
type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;

export function validEverettDate(value: string) {
	return /^20\d{2}-11-0[2-8]$/u.test(value) && Number(value.slice(0, 4)) % 2 === 0 && new Date(`${value}T00:00:00Z`).getUTCDay() === 2;
}

export function readEverettLibrary(body: string): Library {
	assert(Buffer.byteLength(body) <= pageBytes);
	assert.equal(electionDocumentPolicyFingerprint(Buffer.from(body.replace(/©20\d{2} City Of Everett/gu, "©2026 City Of Everett")), "links", everettIndexUrl), everettPolicyReceipts[1].sha256, "The Everett policy surface requires review.");
	const tree = parseEverettNativeTree(body);
	const regions = descendants(tree, node => attribute(node, "id") === "ajax-content-wrap");
	assert.equal(regions.length, 1);
	const headings = descendants(regions[0], node => node.nodeName === "h1");
	assert(headings.length === 1 && text(headings[0]) === "Elections Department");
	const sequence = descendants(regions[0], node => node.nodeName === "h2" || node.nodeName === "table");
	const positions = sequence.flatMap((node, index) => node.nodeName === "h2" && text(node) === "Current Election Documents" ? [index] : []);
	assert.equal(positions.length, 1);
	const table = sequence[positions[0] + 1];
	assert(table?.nodeName === "table");
	const tableId = attribute(table, "id");
	assert.match(tableId, /^dlp_[a-f\d]{16}_\d{1,3}$/u);
	const config = JSON.parse(attribute(table, "data-config"));
	assert(config && config.serverSide === true && config.pageLength === 5 && JSON.stringify(config.lengthMenu) === "[5,10,25,50,100]" && !config.ajax);
	const headers = descendants(table, node => node.nodeName === "th");
	assert.deepEqual(headers.map(node => attribute(node, "data-data")), ["title", "date", "file_size", "link"]);
	const columns = headers.map(node => ({ data: attribute(node, "data-data"), name: attribute(node, "data-name"), searchable: attribute(node, "data-searchable"), orderable: attribute(node, "data-orderable") }));
	assert(columns.every(column => /^[a-z_]*$/u.test(column.name) && ["true", "false"].includes(column.searchable) && ["true", "false"].includes(column.orderable)));
	const scripts = descendants(tree, node => node.nodeName === "script" && attribute(node, "id") === "document-library-pro-js-before");
	assert.equal(scripts.length, 1);
	const declaration = (scripts[0].childNodes ?? []).map(node => node.value ?? "").join("");
	const match = /^\s*var posts_table_params = (\{[^\n]+\});\s*\/\/# sourceURL=document-library-pro-js-before\s*$/u.exec(declaration);
	assert(match && declaration.length <= 128 * 1024);
	const params = JSON.parse(match[1]);
	assert(params.ajax_url === everettAjaxUrl && params.ajax_action === "dlp_load_posts" && typeof params.ajax_nonce === "string" && /^[a-z\d]{10}$/u.test(params.ajax_nonce));
	return { tableId, nonce: params.ajax_nonce, columns };
}

export function everettTableRequest(library: Library, start: number, draw: number) {
	assert(Number.isSafeInteger(start) && start >= 0 && start < 200 && start % 100 === 0 && draw === start / 100 + 1);
	const form = new URLSearchParams({ "action": "dlp_load_posts", "table_id": library.tableId, "_ajax_nonce": library.nonce, "draw": String(draw), "start": String(start), "length": "100", "search[value]": "", "search[regex]": "false", "order[0][column]": "0", "order[0][dir]": "desc" });
	for (const [index, column] of library.columns.entries()) {
		for (const [key, value] of Object.entries(column)) form.set(`columns[${index}][${key}]`, value);
		form.set(`columns[${index}][search][value]`, "");
		form.set(`columns[${index}][search][regex]`, "false");
	}
	return form.toString();
}

export function readEverettTable(body: string, start: number, draw: number) {
	assert(Buffer.byteLength(body) <= pageBytes);
	const value = JSON.parse(body);
	assert(exact(value, ["draw", "recordsFiltered", "recordsTotal", "data"]) && value.draw === draw && Number.isSafeInteger(value.recordsTotal) && Number(value.recordsTotal) >= 0 && Number(value.recordsTotal) <= 200 && value.recordsFiltered === value.recordsTotal && Array.isArray(value.data) && value.data.length === Math.min(100, Math.max(0, Number(value.recordsTotal) - start)));
	const rows = value.data.map((row) => {
		assert(exact(row, ["__attributes", "title", "date", "file_size", "link"]) && exact(row.__attributes, ["id", "class"]) && typeof row.__attributes.id === "string" && /^post-row-[1-9]\d{0,9}$/u.test(row.__attributes.id));
		assert([row.title, row.date, row.file_size, row.link].every(value => typeof value === "string" && value.length <= 16384));
		const title = text(parseEverettNativeTree(String(row.title)));
		const links = descendants(parseEverettNativeTree(String(row.link)), node => node.nodeName === "a");
		assert(links.length === 1 && text(links[0]) === "Download");
		return { id: row.__attributes.id, title, date: String(row.date), url: attribute(links[0], "href") };
	});
	return { total: Number(value.recordsTotal), rows };
}

function selectedRows(rows: ReturnType<typeof readEverettTable>["rows"]) {
	assert(new Set(rows.map(row => row.id)).size === rows.length);
	const samples = rows.filter(row => /sample.*ballot/iu.test(row.title) && !/primary|municipal/iu.test(row.title));
	assert(samples.length <= 20 && new Set(samples.map(row => row.url)).size === samples.length);
	for (const row of samples) {
		assert(/^Sample State Ballot(?:, | Ward )/u.test(row.title), "The Everett publication title requires review.");
		const year = /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, (20\d{2}) \d{1,2}:\d{2} [ap]m$/u.exec(row.date)?.[1];
		assert(year);
		validateEverettDocumentUrl(row.url, year);
	}
	assert(new Set(samples.map(row => /\b20\d{2}\b/u.exec(row.date)![0])).size <= 1, "Competing Everett publication years require review.");
	return samples;
}

function timestamp(value: unknown, now: number): asserts value is string {
	assert(typeof value === "string" && new Date(value).toISOString() === value && Date.parse(value) <= now);
}

function printedDate(xml: string) {
	const tree = parseEverettNativeTree(xml);
	const firstPage = descendants(tree, node => node.nodeName === "page")[0];
	assert(firstPage);
	const dates = descendants(firstPage, node => node.nodeName === "text").map(text).map(line => /^Tuesday, November ([2-8]), (20\d{2}) \/ /u.exec(line)).filter(match => match !== null);
	assert(dates.length === 1, "The Everett election date requires review.");
	const date = `${dates[0][2]}-11-0${dates[0][1]}`;
	assert(validEverettDate(date));
	return date;
}

export function validateEverettElection(value: unknown): asserts value is EverettElection {
	assert(exact(value, ["electionId", "electionDate", "pageUrl", "everettDocumentUrls", "everettIndexSha256"]) && value.electionId === null && typeof value.electionDate === "string" && validEverettDate(value.electionDate) && value.pageUrl === everettIndexUrl && Array.isArray(value.everettDocumentUrls) && value.everettDocumentUrls.length > 0 && value.everettDocumentUrls.length <= 20 && new Set(value.everettDocumentUrls).size === value.everettDocumentUrls.length);
	for (const url of value.everettDocumentUrls) {
		assert(typeof url === "string");
		validateEverettDocumentUrl(url, value.electionDate.slice(0, 4));
	}
	assert.equal(value.everettIndexSha256, everettHash(JSON.stringify({ electionDate: value.electionDate, urls: value.everettDocumentUrls })));
}

export function readEverettDiscovery(body: string, now = Date.now(), glyphs?: EverettGlyphCatalog) {
	assert(Buffer.byteLength(body) <= 12 * 1024 * 1024);
	const value = JSON.parse(body);
	assert(exact(value, ["schemaVersion", "type", "policies", "index", "tables", "documents"]) && value.schemaVersion === 1 && value.type === "everett-candidate-capture" && JSON.stringify(value.policies) === JSON.stringify(everettPolicyReceipts));
	function page(value: unknown, url: string, extra: string[] = []): asserts value is Page {
		assert(exact(value, ["url", "body", "sha256", "retrievedAt", ...extra]) && value.url === url && typeof value.body === "string" && Buffer.byteLength(value.body) <= pageBytes && value.sha256 === everettHash(value.body));
		timestamp(value.retrievedAt, now);
	}
	page(value.index, everettIndexUrl);
	const capture = value as unknown as Capture;
	const library = readEverettLibrary(capture.index.body);
	assert(Array.isArray(value.tables) && value.tables.length > 0 && value.tables.length <= 2 && Array.isArray(value.documents) && value.documents.length <= 20);
	const rows: ReturnType<typeof readEverettTable>["rows"] = [];
	let total: number | undefined;
	for (const [index, table] of capture.tables.entries()) {
		page(table, everettAjaxUrl, ["start", "draw", "requestBodySha256", "successful2xx", "jsonContentTypeValidated"]);
		assert(table.start === index * 100 && table.draw === index + 1 && table.requestBodySha256 === everettHash(everettTableRequest(library, table.start, table.draw)) && table.successful2xx === true && table.jsonContentTypeValidated === true && Date.parse(table.retrievedAt) >= Date.parse(capture.index.retrievedAt));
		const result = readEverettTable(table.body, table.start, table.draw);
		assert(total === undefined || total === result.total);
		total = result.total;
		rows.push(...result.rows);
	}
	assert(total === rows.length && capture.tables.length === Math.max(1, Math.ceil(total / 100)));
	const selected = selectedRows(rows);
	assert.equal(capture.documents.length, selected.length);
	for (const [index, document] of capture.documents.entries()) {
		assert(exact(document, ["url", "sha256", "retrievedAt", "xml", "svg"]) && document.url === selected[index].url && /^[a-f\d]{64}$/u.test(document.sha256) && typeof document.xml === "string" && typeof document.svg === "string");
		timestamp(document.retrievedAt, now);
		assert(Date.parse(document.retrievedAt) >= Date.parse(capture.tables.at(-1)!.retrievedAt));
	}
	if (!capture.documents.length) return { ...capture, elections: [] as EverettElection[] };
	const electionDate = printedDate(capture.documents[0].xml);
	assert(selected.every(row => row.date.includes(electionDate.slice(0, 4))));
	readEverettCandidateDocuments(everettAutomaticSource(electionDate), capture.documents, (_source, values) => ({ id: everettHash(JSON.stringify(values)).slice(0, 24), name: values.name, office: values.office, district: values.district ?? "", scope: values.scope ?? "local", status: "listed", ...(values.party ? { party: values.party } : {}) }), glyphs);
	const election: EverettElection = { electionId: null, electionDate, pageUrl: everettIndexUrl, everettDocumentUrls: capture.documents.map(document => document.url), everettIndexSha256: everettHash(JSON.stringify({ electionDate, urls: capture.documents.map(document => document.url) })) };
	validateEverettElection(election);
	return { ...capture, elections: [election] };
}

export function parseEverettCandidateCapture(source: StateBallotSource, body: string, factory: Factory, now = Date.now(), previous?: { records: readonly StateCandidateRecord[]; documents?: readonly { url: string }[] }, glyphs?: EverettGlyphCatalog) {
	validateEverettSource(source);
	const capture = readEverettDiscovery(body, now, glyphs);
	assert(capture.elections.length === 1 && capture.elections[0].electionDate === source.electionDate);
	const result = readEverettCandidateDocuments(source, capture.documents, factory, glyphs);
	assert(!previous?.records.some(record => !result.records.some(candidate => candidate.id === record.id)), "An accepted Everett candidate disappeared.");
	assert(!previous?.documents?.some(document => !capture.documents.some(candidate => candidate.url === document.url)), "An accepted Everett ballot style disappeared.");
	const documents = capture.documents.map((document, index) => ({ url: document.url, sha256: document.sha256, retrievedAt: document.retrievedAt, includedRecordCount: result.claims.filter(claim => claim.documentIndex === index && result.claims.find(first => first.record.id === claim.record.id) === claim).length }));
	return { records: result.records, documents, retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.retrievedAt)))).toISOString(), sha256: everettHash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), collectionIndexSha256: capture.elections[0].everettIndexSha256 };
}

interface FetchOptions {
	requestDocument?: typeof fetchRemoteSourceDocument;
	requestText?: typeof fetchRemoteJsonText;
	wait?: (milliseconds: number) => Promise<void>;
	now?: () => number;
	extract?: (bytes: Buffer) => Promise<{ xml: string; svg: string }>;
	discovery?: string;
	glyphs?: EverettGlyphCatalog;
}

export async function fetchEverettCycleDiscovery(options: FetchOptions = {}) {
	const request = options.requestDocument ?? fetchRemoteSourceDocument;
	const requestText = options.requestText ?? fetchRemoteJsonText;
	const now = options.now ?? Date.now;
	const wait = options.wait ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
	let robots: ReturnType<typeof electionDocumentRobotsPolicy> | undefined;
	const pace = async (url: string) => {
		if (robots) {
			assert(robots.allowed(url), "Everett robots rules require review.");
			await wait(Math.max(20000, robots.delay));
		}
	};
	const get = async (url: string, pdf = false) => {
		await pace(url);
		const response = await request(url, { allowedHosts: ["cityofeverett.com"], maxBytes: pdf ? 8 * 1024 * 1024 : pageBytes, timeoutMs: 25000 });
		assert(response.status === 200 && (pdf ? /^application\/pdf(?:;|$)/iu.test(response.contentType ?? "") && response.body.subarray(0, 5).equals(Buffer.from("%PDF-")) : true));
		return { response, page: { url, body: response.body.toString("utf8"), sha256: everettHash(response.body), retrievedAt: new Date(now()).toISOString() } };
	};
	const policy = await get(everettPolicyReceipts[0].url);
	assert.equal(electionDocumentPolicyFingerprint(policy.response.body, "robots", everettPolicyReceipts[0].url), everettPolicyReceipts[0].sha256);
	robots = electionDocumentRobotsPolicy(policy.response.body);
	const index = await get(everettIndexUrl);
	assert(/^text\/html(?:;|$)/iu.test(index.response.contentType ?? ""));
	const library = readEverettLibrary(index.page.body);
	const tables: Table[] = [];
	const rows: ReturnType<typeof readEverettTable>["rows"] = [];
	let total = 1;
	while (rows.length < total) {
		const start = tables.length * 100;
		const draw = tables.length + 1;
		assert(start < 200);
		const postBody = everettTableRequest(library, start, draw);
		await pace(everettAjaxUrl);
		const body = await requestText(everettAjaxUrl, { allowedHosts: ["cityofeverett.com"], maxBytes: pageBytes, timeoutMs: 25000, maxRedirects: 0, postBody });
		const result = readEverettTable(body, start, draw);
		assert(tables.length === 0 || total === result.total);
		total = result.total;
		tables.push({ url: everettAjaxUrl, body, sha256: everettHash(body), retrievedAt: new Date(now()).toISOString(), start, draw, requestBodySha256: everettHash(postBody), successful2xx: true, jsonContentTypeValidated: true });
		rows.push(...result.rows);
	}
	const documents: Document[] = [];
	const extract = options.extract ?? (async (bytes: Buffer) => ({ xml: await extractStateBallotPdfXml(bytes, await resolveStateBallotPdfXmlExtractor()), svg: await extractStateBallotPdfSvg(bytes, await resolveStateBallotPdfSvgExtractor(), 1) }));
	for (const row of selectedRows(rows)) {
		const { response, page } = await get(row.url, true);
		documents.push({ url: row.url, sha256: page.sha256, retrievedAt: page.retrievedAt, ...await extract(response.body) });
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "everett-candidate-capture", policies: everettPolicyReceipts, index: index.page, tables, documents });
	readEverettDiscovery(body, now(), options.glyphs);
	return body;
}

export async function fetchEverettCandidateCapture(source: StateBallotSource, options: FetchOptions = {}) {
	validateEverettSource(source);
	const body = options.discovery ?? await fetchEverettCycleDiscovery(options);
	const capture = readEverettDiscovery(body, options.now?.() ?? Date.now(), options.glyphs);
	assert(capture.elections.length === 1 && capture.elections[0].electionDate === source.electionDate);
	return body;
}
