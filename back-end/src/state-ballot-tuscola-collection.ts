import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import {
	stateHtmlAttribute as attribute,
	stateHtmlDescendants as descendants,
	parseStateHtml,
	stateHtmlText
} from "./state-ballot-html.js";
import {
	extractStateBallotPdfText,
	fetchStateBallotPdfDocument,
	resolveStateBallotPdfExtractor
} from "./state-ballot-pdf.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";
import { readTuscolaCandidateDocuments } from "./state-ballot-tuscola.js";

const origin = "https://www.tuscolacounty.org";
export const tuscolaDiscoveryUrl = `${origin}/elections/`;
const kinds = ["candidates", "samples"] as const;
type Kind = (typeof kinds)[number];
interface Page {
	url: string;
	body: string;
	sha256: string;
	retrievedAt: string;
}
interface Pdf {
	url: string;
	text: string;
	sha256: string;
	retrievedAt: string;
}
export interface TuscolaElection {
	electionId: null;
	electionDate: string;
	pageUrl: string;
	tuscolaDocuments: { kind: Kind; url: string; sha256: string }[];
}
interface Options {
	requestDocument?: typeof fetchRemoteSourceDocument;
	extractor?: (bytes: Buffer, kind: Kind) => Promise<string>;
	now?: () => number;
	sleep?: (milliseconds: number) => Promise<void>;
	discovery?: string;
}
export const tuscolaPolicyReceipts = [
	{
		url: `${origin}/robots.txt`,
		status: 200,
		format: "bytes",
		sha256: "ac7a15e4e6037d7cb4d9c9ff46ec1b496b848cf2305df7989520d7ba5d0ac998"
	},
	{
		url: `${origin}/`,
		status: 200,
		format: "links",
		sha256: "dafc4d854a3849a1c016c2f31bf47218caa76c4613a745847fc99b1a28a9e0dd"
	},
	{
		url: tuscolaDiscoveryUrl,
		status: 200,
		format: "links",
		sha256: "3ba113b6e96d8ddbe3d2682fd1259df27d490c84fbc7b2028371068f8e2700fb"
	},
	{
		url: `${origin}/policies/`,
		status: 200,
		format: "links",
		sha256: "50ae22a532b9d46d283e0e2b5a2f458aa9a9c64cefc06e14e57886c84db24450"
	},
	{
		url: `${origin}/doc/FOIA%20Policy.pdf`,
		status: 200,
		format: "pdf",
		sha256: "91f098e18ef29bc6887bfbcfa0ac63e9d7d7a3f4df6b80809109121a3b0bc640"
	},
	{
		url: `${origin}/policies/doc/Enhanced%20Access%20to%20Public%20Records.pdf`,
		status: 200,
		format: "pdf",
		sha256: "f200e6f730fd12f19c9a7701607dd403698a9df805dc8186e75ac84a0a341718"
	},
	{
		url: `${origin}/policies/doc/Computer%20Resources%20Acceptable%20Use%20Policy.pdf`,
		status: 200,
		format: "pdf",
		sha256: "4a6978cf4b6cb9d4142539e704f0650e47cb800a1906f6b1876036809941eb8a"
	},
	{
		url: `${origin}/doc/FOIA%20Policy%20-%20Final%207-1-15.pdf`,
		status: 200,
		format: "pdf",
		sha256: "91f098e18ef29bc6887bfbcfa0ac63e9d7d7a3f4df6b80809109121a3b0bc640"
	},
	{
		url: `${origin}/blic_html/doc/FOIA%20Policy%20-%20Final%207-1-15.pdf`,
		status: 404,
		format: "bytes",
		sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
	}
] as const;
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const text = (node: Parameters<typeof stateHtmlText>[0]) => clean(stateHtmlText(node));
function exact(value: unknown, fields: string[]): value is Record<string, unknown> {
	return Boolean(
		value
		&& typeof value === "object"
		&& !Array.isArray(value)
		&& Object.keys(value).sort().join("|") === [...fields].sort().join("|")
	);
}
function validDate(value: unknown): value is string {
	return typeof value === "string" && /^20\d{2}-11-0[2-8]$/u.test(value) && new Date(`${value}T00:00:00Z`).getUTCDay() === 2;
}
export function tuscolaPolicyFingerprint(body: Buffer, url: string) {
	const inventory = electionDocumentPolicyFingerprint(body, "links", url);
	const footer = descendants(parseStateHtml(body.toString("utf8")), node => attribute(node, "id") === "footer");
	if (footer.length !== 1 || text(footer[0]!).length < 100)
		throw new Error("The Tuscola website footer requires review.");
	return hash(JSON.stringify({ inventory, footer: text(footer[0]!) }));
}
export function validateTuscolaDocumentUrl(value: string, kind: Kind, year: string) {
	const url = new URL(value);
	const file = decodeURIComponent(url.pathname).split("/").at(-1)!;
	if (
		url.origin !== origin
		|| url.username
		|| url.password
		|| url.hash
		|| url.search
		|| !url.pathname.startsWith(`/elections/${year}/11/`)
		|| url.pathname.split("/").length !== 5
		|| !(
			kind === "candidates"
				? /^Official Candidate List(?:ing)? - November 20\d{2}\.pdf$/u
				: /^Sample Ballots? - November [1-9]\d? 20\d{2}\.pdf$/u
		).test(file)
		|| !file.endsWith(`${year}.pdf`)
	) {
		throw new Error("The Tuscola offered publication URL requires review.");
	}
}
export function validateTuscolaElection(value: unknown): asserts value is TuscolaElection {
	if (
		!exact(value, ["electionId", "electionDate", "pageUrl", "tuscolaDocuments"])
		|| value.electionId !== null
		|| !validDate(value.electionDate)
		|| value.pageUrl !== tuscolaDiscoveryUrl
		|| !Array.isArray(value.tuscolaDocuments)
		|| ![0, 2].includes(value.tuscolaDocuments.length)
	) {
		throw new Error("The Tuscola election configuration requires review.");
	}
	for (const [index, item] of value.tuscolaDocuments.entries()) {
		if (
			!exact(item, ["kind", "url", "sha256"])
			|| item.kind !== kinds[index]
			|| typeof item.url !== "string"
			|| typeof item.sha256 !== "string"
			|| !/^[a-f0-9]{64}$/u.test(item.sha256)
		) {
			throw new Error("The Tuscola publication configuration requires review.");
		}
		validateTuscolaDocumentUrl(item.url, kinds[index]!, value.electionDate.slice(0, 4));
	}
}
export function validateTuscolaSource(source: StateBallotSource) {
	validateTuscolaElection({
		electionId: null,
		electionDate: source.electionDate,
		pageUrl: source.pageUrl,
		tuscolaDocuments: []
	});
	if (
		source.stateCode !== "MI"
		|| source.format !== "tuscola-pdf"
		|| source.countyName !== "Tuscola County"
		|| source.url !== tuscolaDiscoveryUrl
		|| source.snapshotStorage !== "external"
		|| source.retrievalPolicy
		|| source.postBody
		|| source.documentUrls
		|| source.documentLinks
		|| source.id
		!== (source.electionDate === "2026-11-03"
			? "mi-tuscola-candidates-2026"
			: `mi-tuscola-general-${source.electionDate}`)
	) {
		throw new Error("The Tuscola source contract requires review.");
	}
}
export function tuscolaDocumentDigest(documents: TuscolaElection["tuscolaDocuments"]) {
	return hash(JSON.stringify(documents));
}
function timestamp(value: unknown, now: number) {
	if (
		typeof value !== "string"
		|| !Number.isFinite(Date.parse(value))
		|| new Date(value).toISOString() !== value
		|| Date.parse(value) > now
	) {
		throw new Error("The Tuscola capture clock requires review.");
	}
	return value;
}
function offered(body: string, now: number) {
	const document = parseStateHtml(body);
	if (
		descendants(document, node => node.nodeName === "h2" && text(node) === "Tuscola County Election Information")
			.length !== 1
	) {
		throw new Error("The Tuscola election page heading changed.");
	}
	const regions = descendants(document, node => attribute(node, "class").split(/\s+/u).includes("electionRes"));
	if (regions.length !== 1) throw new Error("The Tuscola election-date region changed.");
	const elections: { electionDate: string; documents: { kind: Kind; url: string }[] }[] = [];
	let current: (typeof elections)[number] | undefined;
	for (const node of regions[0]!.childNodes ?? []) {
		if (node.nodeName === "p") {
			current = undefined;
			const match = /^(20\d{2}), November ([1-9]\d?)(?:st|nd|rd|th)$/u.exec(text(node));
			if (!match || Number(match[1]) < Math.max(2026, new Date(now).getUTCFullYear())) continue;
			const electionDate = `${match[1]}-11-${match[2]!.padStart(2, "0")}`;
			if (!validDate(electionDate)) throw new Error("The Tuscola offered general-election date requires review.");
			elections.push((current = { electionDate, documents: [] }));
		}
		if (!current || node.nodeName !== "ul") continue;
		for (const link of descendants(node, child => child.nodeName === "a")) {
			const label = text(link);
			const year = current.electionDate.slice(0, 4);
			let kind: Kind | undefined;
			if (label === `Official Candidate List - November ${year}`) kind = "candidates";
			else if (label === `Sample Ballots - November ${Number(current.electionDate.slice(8))} ${year}`)
				kind = "samples";
			else if (/candidate|sample ballot/iu.test(label))
				throw new Error("A Tuscola publication label requires review.");
			if (!kind) continue;
			const url = new URL(attribute(link, "href"), tuscolaDiscoveryUrl).href;
			validateTuscolaDocumentUrl(url, kind, year);
			current.documents.push({ kind, url });
		}
	}
	if (
		!elections.length
		|| elections.length > 6
		|| new Set(elections.map(item => item.electionDate)).size !== elections.length
		|| elections.some(item => new Set(item.documents.map(document => document.kind)).size !== item.documents.length)
	) {
		throw new Error("The Tuscola offered election/publication set requires review.");
	}
	for (const election of elections)
		election.documents.sort((first, second) => kinds.indexOf(first.kind) - kinds.indexOf(second.kind));
	return elections.sort((first, second) => first.electionDate.localeCompare(second.electionDate));
}
export function readTuscolaDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 24 * 1024 * 1024) throw new Error("The Tuscola discovery exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (
		!exact(value, ["schemaVersion", "type", "policies", "index", "documents"])
		|| value.schemaVersion !== 1
		|| value.type !== "tuscola-discovery"
		|| JSON.stringify(value.policies) !== JSON.stringify(tuscolaPolicyReceipts)
		|| !exact(value.index, ["url", "body", "sha256", "retrievedAt"])
		|| value.index.url !== tuscolaDiscoveryUrl
		|| typeof value.index.body !== "string"
		|| hash(value.index.body) !== value.index.sha256
		|| tuscolaPolicyFingerprint(Buffer.from(value.index.body), tuscolaDiscoveryUrl)
		!== tuscolaPolicyReceipts[2].sha256
		|| !Array.isArray(value.documents)
	) {
		throw new Error("The Tuscola discovery or policy contract requires review.");
	}
	const index = value.index as unknown as Page;
	timestamp(index.retrievedAt, now);
	const selected = offered(index.body, now);
	if (selected.length !== value.documents.length) throw new Error("The Tuscola publication capture is incomplete.");
	const documents: Pdf[][] = [];
	const elections: TuscolaElection[] = [];
	for (const [position, election] of selected.entries()) {
		const captured = value.documents[position];
		if (!Array.isArray(captured) || captured.length !== election.documents.length)
			throw new Error("The Tuscola publication capture is incomplete.");
		for (const [index, document] of captured.entries()) {
			if (
				!exact(document, ["url", "text", "sha256", "retrievedAt"])
				|| document.url !== election.documents[index]!.url
				|| typeof document.text !== "string"
				|| Buffer.byteLength(document.text) > 4 * 1024 * 1024
				|| typeof document.sha256 !== "string"
				|| !/^[a-f0-9]{64}$/u.test(document.sha256)
				|| Date.parse(timestamp(document.retrievedAt, now)) < Date.parse(value.index.retrievedAt as string)
			) {
				throw new Error("The Tuscola document provenance requires review.");
			}
		}
		documents.push(captured);
		elections.push({
			electionId: null,
			electionDate: election.electionDate,
			pageUrl: tuscolaDiscoveryUrl,
			tuscolaDocuments:
				captured.length === 2
					? captured.map((document, index) => ({
							kind: kinds[index]!,
							url: document.url,
							sha256: document.sha256
						}))
					: []
		});
	}
	return { index, elections, documents };
}
export async function fetchTuscolaCycleDiscovery(options: Options = {}) {
	const request = options.requestDocument ?? fetchRemoteSourceDocument;
	const now = options.now ?? Date.now;
	const sleep = options.sleep ?? (milliseconds => new Promise(accept => setTimeout(accept, milliseconds)));
	let robots: ReturnType<typeof electionDocumentRobotsPolicy> | undefined, index: Page | undefined;
	for (const [position, policy] of tuscolaPolicyReceipts.entries()) {
		if (position) await sleep(11000);
		if (robots && !robots.allowed(policy.url)) throw new Error("The Tuscola robots policy disallows this request.");
		const response = await request(policy.url, {
			allowedHosts: ["www.tuscolacounty.org"],
			maxBytes: 2 * 1024 * 1024,
			timeoutMs: 25000
		});
		if (
			response.status !== policy.status
			|| (policy.format === "links"
				? response.contentType !== "text/html"
				|| tuscolaPolicyFingerprint(response.body, policy.url) !== policy.sha256
				: hash(response.body) !== policy.sha256)
			|| (policy.format === "pdf"
				&& (response.contentType !== "application/pdf"
					|| !response.body.subarray(0, 5).equals(Buffer.from("%PDF-"))))
		) {
			throw new Error("The Tuscola access or reuse policy changed; review before collection.");
		}
		if (!position) robots = electionDocumentRobotsPolicy(response.body);
		if (policy.url === tuscolaDiscoveryUrl) {
			index = {
				url: policy.url,
				body: response.body.toString("utf8"),
				sha256: hash(response.body),
				retrievedAt: new Date(now()).toISOString()
			};
		}
	}
	const selected = offered(index!.body, now());
	const documents: Pdf[][] = [];
	const executable = options.extractor ? null : await resolveStateBallotPdfExtractor();
	for (const election of selected) {
		const captured: Pdf[] = [];
		for (const document of election.documents) {
			if (!robots!.allowed(document.url))
				throw new Error("The Tuscola robots policy disallows this publication.");
			await sleep(11000);
			captured.push(
				await fetchStateBallotPdfDocument(document.url, {
					allowedHosts: ["www.tuscolacounty.org"],
					request,
					now,
					extractor: bytes =>
						options.extractor
							? options.extractor(bytes, document.kind)
							: extractStateBallotPdfText(
									bytes,
									executable!,
									12000,
									document.kind === "candidates" ? "raw-bbox" : "raw",
									document.kind === "candidates" ? 100 : 200
								)
				})
			);
		}
		documents.push(captured);
	}
	const body = JSON.stringify({
		schemaVersion: 1,
		type: "tuscola-discovery",
		policies: tuscolaPolicyReceipts,
		index,
		documents
	});
	readTuscolaDiscovery(body, now());
	return body;
}
export async function fetchTuscolaCandidateCapture(source: StateBallotSource, options: Options = {}) {
	validateTuscolaSource(source);
	const body = options.discovery ?? (await fetchTuscolaCycleDiscovery(options));
	if (
		!readTuscolaDiscovery(body, (options.now ?? Date.now)()).elections.some(
			item => item.electionDate === source.electionDate
		)
	) {
		throw new Error("The Tuscola election is not offered.");
	}
	return JSON.stringify({
		schemaVersion: 1,
		type: "tuscola-candidate-capture",
		discovery: JSON.parse(body),
		electionDate: source.electionDate
	});
}
export function parseTuscolaCandidateCapture(
	source: StateBallotSource,
	body: string,
	now = Date.now(),
	previous: readonly StateCandidateRecord[] = []
) {
	validateTuscolaSource(source);
	if (Buffer.byteLength(body) > 24 * 1024 * 1024)
		throw new Error("The Tuscola candidate capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (
		!exact(value, ["schemaVersion", "type", "discovery", "electionDate"])
		|| value.schemaVersion !== 1
		|| value.type !== "tuscola-candidate-capture"
		|| value.electionDate !== source.electionDate
	) {
		throw new Error("The Tuscola candidate capture requires review.");
	}
	const discovery = readTuscolaDiscovery(JSON.stringify(value.discovery), now);
	const index = discovery.elections.findIndex(item => item.electionDate === source.electionDate);
	if (index < 0) throw new Error("The Tuscola captured election is not offered.");
	const election = discovery.elections[index]!;
	if (!election.tuscolaDocuments.length) throw new StateBallotAwaitingRecordsError(source.id);
	const documents = discovery.documents[index]!;
	const parsed = readTuscolaCandidateDocuments(source, documents[0]!.text, documents[1]!.text);
	const identity = (record: StateCandidateRecord) =>
		JSON.stringify([
			record.name,
			record.office,
			record.district,
			record.jurisdiction ?? "",
			record.ballotDesignation ?? ""
		]);
	const current = new Set(parsed.records.map(identity));
	if (previous.some(record => !current.has(identity(record))))
		throw new Error("An accepted Tuscola candidate disappeared; retain the accepted data for review.");
	return {
		records: parsed.records,
		retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.retrievedAt)))).toISOString(),
		sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))),
		documents: documents.map(({ url, sha256, retrievedAt }, index) => ({
			url,
			sha256,
			retrievedAt,
			includedRecordCount: index ? 0 : parsed.records.length
		})),
		collectionIndexSha256: tuscolaDocumentDigest(election.tuscolaDocuments)
	};
}
