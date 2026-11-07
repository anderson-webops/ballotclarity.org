import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateHtmlNode } from "./state-ballot-html.js";
import type { IowaSampleContext, IowaSampleDocument } from "./state-ballot-iowa-county-native.js";
import type { IowaSampleGeometry, IowaSampleNativeProof } from "./state-ballot-iowa-county-proof.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { readIowaCountySample, readIowaCountySamples } from "./state-ballot-iowa-county-native.js";
import { inspectIowaSampleGeometry, verifyIowaSampleNative } from "./state-ballot-iowa-county-proof.js";
import { extractStateBallotPdfText, extractStateBallotPdfXml, inspectStateBallotPdfObjects, resolveStateBallotPdfExtractor, resolveStateBallotPdfObjectInspector, resolveStateBallotPdfXmlExtractor } from "./state-ballot-pdf.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";
import { containsControlCharacters } from "./text-validation.js";

type County = "Monona" | "Woodbury";
type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;
export interface IowaCountySampleLink { url: string; styles: string[] }
export interface IowaCountyElection { electionId: null; electionDate: string; pageUrl: string; iowaCountyDocuments: IowaCountySampleLink[] }
export interface IowaCountyPage { url: string; body: string; sha256: string; retrievedAt: string }
type Page = IowaCountyPage;
interface Discovery { schemaVersion: 1; type: "iowa-county-discovery"; county: County; policies: unknown; index: Page; indexes: Page[]; pages: Page[] }
interface CapturedSample extends IowaSampleDocument { visible: string; geometry: IowaSampleGeometry[]; objectsSha256: string; proof: IowaSampleNativeProof }
interface Options {
	request?: typeof fetchRemoteSourceDocument;
	sleep?: (milliseconds: number) => Promise<void>;
	now?: () => number;
	discovery?: string;
	extract?: (bytes: Buffer) => Promise<{ layout: string; bbox: string; visible: string; objects: string }>;
}
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const text = (node: StateHtmlNode) => clean(stateHtmlText(node));
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
export const iowaCountyOrigins = { Monona: "https://mononacountyiowa.gov", Woodbury: "https://elections.woodburycountyiowa.gov" } as const;
export const iowaCountyDiscoveryUrls = { Monona: `${iowaCountyOrigins.Monona}/auditor/elections/`, Woodbury: `${iowaCountyOrigins.Woodbury}/elections/` } as const;
export const iowaCountyPolicyReceipts = {
	Monona: { robotsStatus: 200, robotsSha256: "8fa3036c68bfcbd32365f6225d24333264093b7cd38d306e106b4dbdc934fd5b", homeSha256: "784c3feb350750ec162a5478884b02af811fa2c184be9b37ecc26c75dea905c9", noticeUrl: `${iowaCountyOrigins.Monona}/page/title_vi/`, noticeSha256: "d189c91f0b92d0816e3b75a7a03f6d3c5911488fe66e72f6e90b5adae4787098" },
	Woodbury: { robotsStatus: 404, robotsSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", homeSha256: "d1e016da0cc30a8942bddd2b9545dea8cd7feec3bf83f6fbdc0d79cd88b9535b", noticeUrl: `${iowaCountyOrigins.Woodbury}/site/accessibility/`, noticeSha256: "609f95b1ab8dfdf2c9c53f246db8734f278d2b31e30ebe915501e614c5fdf459" }
} as const;

function tree(body: string) {
	assert(Buffer.byteLength(body) <= 2 * 1024 * 1024, "The Iowa publication exceeds its bounds.");
	const root = parseStateHtml(body);
	const pending = [{ node: root, depth: 0 }];
	let count = 0;
	while (pending.length) {
		const current = pending.pop()!;
		assert(++count <= 80000 && current.depth <= 64, "The Iowa publication structure exceeds its bounds.");
		for (const child of current.node.childNodes ?? []) pending.push({ node: child, depth: current.depth + 1 });
	}
	return root;
}

function checkedUrl(value: string, county: County) {
	const url = new URL(value);
	assert(url.origin === iowaCountyOrigins[county] && !url.username && !url.password && !url.hash && !url.search && url.href === value, "The Iowa publication URL requires review.");
	return url;
}

export function iowaCountyPolicyFingerprint(body: string, county: County, region: "home" | "notice") {
	const root = tree(body);
	const origin = iowaCountyOrigins[county];
	const links = (node: StateHtmlNode) => descendants(node, candidate => candidate.nodeName === "a").map(candidate => [text(candidate), new URL(attribute(candidate, "href") || origin, origin).href]);
	if (region === "notice") {
		const mains = descendants(root, node => attribute(node, "id") === (county === "Monona" ? "standardPage" : "pageContent"));
		assert(mains.length === 1 && text(mains[0]!).length >= 50, "The Iowa notice region requires review.");
		return hash(JSON.stringify({ text: text(mains[0]!), links: links(mains[0]!) }));
	}
	const footers = descendants(root, node => county === "Monona" ? ["footer", "credit"].includes(attribute(node, "id")) : node.nodeName === "footer");
	assert(footers.length === (county === "Monona" ? 2 : 1), "The Iowa legal footer inventory requires review.");
	const selected = links(root).filter(([label, url]) => /privacy|terms|disclaimer|copyright|licen[cs]|legal|title.vi|accessibility/iu.test(`${label} ${url}`) && !(county === "Monona" && [`${origin}/employment/`, `${origin}/treasurer/drivers_license/`].includes(url!)));
	assert(selected.some(([, url]) => url === iowaCountyPolicyReceipts[county].noticeUrl), "The Iowa linked notice is unavailable.");
	return hash(JSON.stringify({ footer: footers.map(node => text(node).replace(/©\s*20\d{2}/gu, "©YYYY")), links: [...new Set(selected.map(value => JSON.stringify(value)))].sort() }));
}

function electionDate(value: string, county: County) {
	const url = checkedUrl(value, county);
	const prefix = county === "Monona" ? "/elections/" : "/elections/info/";
	const match = new RegExp(`^${prefix}(?:(20\\d{2})_)?general_election_(20\\d{2})_11_(0[2-8])/$`, "u").exec(url.pathname);
	assert(match && (!match[1] || match[1] === match[2]) && Number(match[2]) >= 2026 && Number(match[2]) % 2 === 0, "The Iowa dated general-election link requires review.");
	const date = `${match[2]}-11-${match[3]}`;
	assert(new Date(`${date}T00:00:00Z`).getUTCDay() === 2, "The Iowa printed general-election day requires review.");
	return date;
}

export function iowaCountySource(county: County, date = "2026-11-03", pageUrl?: string): StateBallotSource {
	assert(["Monona", "Woodbury"].includes(county), "The Iowa county is unsupported.");
	const page = pageUrl ?? (county === "Monona" ? `${iowaCountyOrigins.Monona}/elections/2026_general_election_2026_11_03/` : `${iowaCountyOrigins.Woodbury}/elections/info/2026_general_election_2026_11_03/`);
	assert(electionDate(page, county) === date, "The Iowa source date and publication disagree.");
	return { stateCode: "IA", id: date === "2026-11-03" ? `ia-${county.toLowerCase()}-samples-2026` : `ia-${county.toLowerCase()}-samples-general-${date}`, countyName: `${county} County`, label: `${county} County sample ballots`, electionDate: date, url: page, pageUrl: page, format: "iowa-county-pdf", snapshotStorage: "external", defaultPriority: -10, ballotPreview: false };
}

export function validateIowaCountySource(source: StateBallotSource) {
	const county = source.countyName === "Monona County" ? "Monona" : source.countyName === "Woodbury County" ? "Woodbury" : null;
	assert(county, "The Iowa county source contract requires review.");
	assert.deepEqual(source, iowaCountySource(county, source.electionDate, source.pageUrl), "The Iowa county source contract requires review.");
	return county;
}

export function iowaCountyDocumentDigest(documents: IowaCountySampleLink[]) {
	return hash(JSON.stringify(documents));
}
export function validateIowaCountyDocumentUrl(value: string, county: County) {
	assert(/^\/files\/sample_ballots\/[a-z\d_]+\.pdf$/u.test(checkedUrl(value, county).pathname), "The Iowa offered sample link requires review.");
}
export function validateIowaCountyElection(value: unknown, county: County): asserts value is IowaCountyElection {
	assert(exact(value, ["electionId", "electionDate", "pageUrl", "iowaCountyDocuments"]) && value.electionId === null && typeof value.pageUrl === "string" && value.electionDate === electionDate(value.pageUrl, county) && Array.isArray(value.iowaCountyDocuments) && value.iowaCountyDocuments.length <= 100, "The Iowa election descriptor requires review.");
	const seen = new Set<string>();
	for (const document of value.iowaCountyDocuments) {
		assert(exact(document, ["url", "styles"]) && typeof document.url === "string" && Array.isArray(document.styles) && document.styles.length > 0 && document.styles.length <= 100 && document.styles.every(style => typeof style === "string" && clean(style) === style && !containsControlCharacters(style) && style.length > 0 && style.length <= 300) && new Set(document.styles).size === document.styles.length && !seen.has(document.url), "The Iowa sample style inventory requires review.");
		validateIowaCountyDocumentUrl(document.url, county);
		seen.add(document.url);
	}
}

function checkedPage(value: unknown, county: County, now: number): asserts value is Page {
	assert(exact(value, ["url", "body", "sha256", "retrievedAt"]) && typeof value.url === "string" && typeof value.body === "string" && hash(value.body) === value.sha256 && typeof value.retrievedAt === "string" && Number.isFinite(Date.parse(value.retrievedAt)) && new Date(value.retrievedAt).toISOString() === value.retrievedAt && Date.parse(value.retrievedAt) <= now, "The Iowa page provenance requires review.");
	checkedUrl(value.url, county);
	tree(value.body);
}

function generalLinks(page: Page, county: County) {
	const links = new Map<string, string>();
	for (const node of descendants(tree(page.body), candidate => candidate.nodeName === "a")) {
		const label = /^(20\d{2}) General Election$/u.exec(text(node));
		if (!label || Number(label[1]) < 2026) continue;
		const url = new URL(attribute(node, "href"), page.url).href;
		const date = electionDate(url, county);
		assert(date.startsWith(label[1]!), "The Iowa offered election label and date disagree.");
		if (links.has(date)) assert(links.get(date) === url, "The Iowa offered election identity is ambiguous.");
		links.set(date, url);
	}
	return links;
}

function indexTargets(index: Page, county: County) {
	const expected = county === "Monona" ? [`${iowaCountyOrigins.Monona}/auditor/upcoming_elections/`, `${iowaCountyOrigins.Monona}/auditor/election_results/`] : [`${iowaCountyOrigins.Woodbury}/elections/past/`];
	const offered = new Set(descendants(tree(index.body), node => node.nodeName === "a").map(node => new URL(attribute(node, "href") || index.url, index.url).href));
	assert(expected.every(url => offered.has(url)), "The Iowa upcoming/history navigation requires review.");
	const headings = descendants(tree(index.body), node => node.nodeName === "h1").map(text);
	assert(headings.length === 1 && headings[0] === (county === "Monona" ? "Elections & Voting" : "Elections Upcoming Elections"), "The Iowa election index identity requires review.");
	return expected;
}

function parseElection(page: Page, county: County): IowaCountyElection {
	const date = electionDate(page.url, county);
	const root = tree(page.body);
	const headings = descendants(root, node => node.nodeName === "h1").map(text);
	assert(headings.length === 1 && headings[0] === `${county === "Woodbury" ? "Elections " : ""}${date.slice(0, 4)} General Election`, "The Iowa publication heading requires review.");
	const dateText = `November ${Number(date.slice(-2))}, ${date.slice(0, 4)}`;
	assert(descendants(root, node => node.nodeName === "h3" && text(node) === dateText).length === 1, "The Iowa printed election date requires review.");
	const samples = new Map<string, string[]>();
	for (const node of descendants(root, candidate => candidate.nodeName === "a" && /\/files\/sample_ballots\//u.test(attribute(candidate, "href")))) {
		const url = new URL(attribute(node, "href"), page.url).href;
		validateIowaCountyDocumentUrl(url, county);
		const label = text(node);
		assert(label && label.length <= 300, "The Iowa offered sample has no usable style label.");
		const labels = samples.get(url) ?? [];
		if (!labels.includes(label)) labels.push(label);
		samples.set(url, labels);
	}
	const election = { electionId: null, electionDate: date, pageUrl: page.url, iowaCountyDocuments: [...samples].map(([url, styles]) => ({ url, styles })) };
	validateIowaCountyElection(election, county);
	return election;
}

export function readIowaCountyDiscovery(body: string, county: County, now = Date.now()) {
	assert(Buffer.byteLength(body) <= 12 * 1024 * 1024, "The Iowa discovery exceeds its bounds.");
	const value = JSON.parse(body);
	assert(exact(value, ["schemaVersion", "type", "county", "policies", "index", "indexes", "pages"]) && value.schemaVersion === 1 && value.type === "iowa-county-discovery" && value.county === county && JSON.stringify(value.policies) === JSON.stringify(iowaCountyPolicyReceipts[county]) && Array.isArray(value.indexes) && Array.isArray(value.pages) && value.pages.length <= 8, "The Iowa discovery contract requires review.");
	checkedPage(value.index, county, now);
	assert(value.index.url === iowaCountyDiscoveryUrls[county], "The Iowa discovery entry point changed.");
	const targets = indexTargets(value.index, county);
	assert(value.indexes.length === targets.length, "The Iowa history/upcoming page set is incomplete.");
	const offered = generalLinks(value.index, county);
	for (const [index, page] of value.indexes.entries()) {
		checkedPage(page, county, now);
		assert(page.url === targets[index], "The Iowa linked index identity requires review.");
		const heading = descendants(tree(page.body), node => node.nodeName === "h1").map(text);
		assert(heading.length === 1 && heading[0] === (county === "Woodbury" ? "Elections Past Elections" : index ? "Election Results" : "Upcoming Elections"), "The Iowa linked index heading requires review.");
		for (const [date, url] of generalLinks(page, county)) {
			if (offered.has(date)) assert(offered.get(date) === url, "The Iowa election links conflict.");
			offered.set(date, url);
		}
	}
	const selected = [...offered].sort(([first], [second]) => first.localeCompare(second));
	assert(value.pages.length === selected.length, "The Iowa offered election publication set is incomplete.");
	const pages = value.pages.map((page: unknown, index: number) => {
		checkedPage(page, county, now);
		assert(page.url === selected[index]![1], "The Iowa captured publication is not the offered edition.");
		return page;
	});
	return { ...(value as unknown as Discovery), elections: pages.map((page: Page) => parseElection(page, county)) };
}

export async function fetchIowaCountyCycleDiscovery(county: County, options: Options = {}) {
	const request = options.request ?? fetchRemoteSourceDocument;
	const now = options.now ?? Date.now;
	const origin = iowaCountyOrigins[county];
	let lastRequest: number | null = null;
	const get = async (url: string, maximum = 2 * 1024 * 1024) => {
		checkedUrl(url, county);
		if (lastRequest !== null) await (options.sleep ?? wait)(Math.max(0, 20000 - (now() - lastRequest)));
		lastRequest = now();
		return request(url, { allowedHosts: [new URL(origin).hostname], maxBytes: maximum, timeoutMs: 25000 });
	};
	const policy = iowaCountyPolicyReceipts[county];
	const robots = await get(`${origin}/robots.txt`, 128 * 1024);
	assert(robots.status === policy.robotsStatus && !robots.location && hash(robots.body) === policy.robotsSha256, "The Iowa robots policy requires review.");
	const home = await get(`${origin}/`);
	assert(home.status === 200 && !home.location && iowaCountyPolicyFingerprint(home.body.toString("utf8"), county, "home") === policy.homeSha256, "The Iowa legal footer and link inventory require review.");
	const notice = await get(policy.noticeUrl);
	assert(notice.status === 200 && !notice.location && iowaCountyPolicyFingerprint(notice.body.toString("utf8"), county, "notice") === policy.noticeSha256, "The Iowa linked notice requires review.");
	const page = async (url: string): Promise<Page> => {
		const response = await get(url);
		assert(response.status === 200 && !response.location && /text\/html/iu.test(response.contentType ?? ""), "The Iowa publication is unavailable.");
		const result = { url, body: response.body.toString("utf8"), sha256: hash(response.body), retrievedAt: new Date(now()).toISOString() };
		checkedPage(result, county, now());
		return result;
	};
	const index = await page(iowaCountyDiscoveryUrls[county]);
	const indexes: Page[] = [];
	const offered = generalLinks(index, county);
	for (const target of indexTargets(index, county)) {
		const linked = await page(target);
		indexes.push(linked);
		for (const [date, url] of generalLinks(linked, county)) {
			if (offered.has(date)) assert(offered.get(date) === url, "The Iowa offered election links conflict.");
			offered.set(date, url);
		}
	}
	assert(offered.size <= 8, "The Iowa offered election set exceeds its bounds.");
	const pages: Page[] = [];
	for (const [, url] of [...offered].sort(([first], [second]) => first.localeCompare(second))) pages.push(await page(url));
	const body = JSON.stringify({ schemaVersion: 1, type: "iowa-county-discovery", county, policies: policy, index, indexes, pages });
	readIowaCountyDiscovery(body, county, now());
	return body;
}

export async function fetchIowaCountyCandidateCapture(source: StateBallotSource, options: Options = {}) {
	const county = validateIowaCountySource(source);
	const now = options.now ?? Date.now;
	const discovery = options.discovery ?? await fetchIowaCountyCycleDiscovery(county, options);
	const selected = readIowaCountyDiscovery(discovery, county, now()).elections.find((election: IowaCountyElection) => election.electionDate === source.electionDate);
	assert(selected && selected.pageUrl === source.pageUrl, "The Iowa selected election is not offered.");
	if (!selected.iowaCountyDocuments.length) return JSON.stringify({ schemaVersion: 1, type: "iowa-county-candidate-capture", discovery: JSON.parse(discovery), documents: [] });
	const tools = options.extract ? null : { text: await resolveStateBallotPdfExtractor(), xml: await resolveStateBallotPdfXmlExtractor(), objects: await resolveStateBallotPdfObjectInspector() };
	const extract = options.extract ?? (async (bytes: Buffer) => ({ layout: await extractStateBallotPdfText(bytes, tools!.text, 12000, "layout", 2), bbox: await extractStateBallotPdfText(bytes, tools!.text, 12000, "bbox-layout", 2), visible: await extractStateBallotPdfXml(bytes, tools!.xml, "iowa-county"), objects: await inspectStateBallotPdfObjects(bytes, tools!.objects, "iowa-county") }));
	const documents: CapturedSample[] = [];
	let totalBytes = 0;
	const started = now();
	for (const link of selected.iowaCountyDocuments) {
		assert(now() - started <= 45 * 60 * 1000, "The Iowa acquisition exceeded its bounded duration.");
		await (options.sleep ?? wait)(20000);
		const response = await (options.request ?? fetchRemoteSourceDocument)(link.url, { allowedHosts: [new URL(iowaCountyOrigins[county]).hostname], maxBytes: 8 * 1024 * 1024, timeoutMs: 25000 });
		assert(response.status === 200 && !response.location && response.body.subarray(0, 5).toString("ascii") === "%PDF-", "The Iowa sample is unavailable.");
		const retrievedAt = new Date(now()).toISOString();
		const native = await extract(response.body);
		const context: IowaSampleContext = { county, electionDate: source.electionDate, style: link.styles[0]! };
		const parsed = readIowaCountySample(native.bbox, native.layout, context);
		const geometry = inspectIowaSampleGeometry(native.objects, county);
		const objectsSha256 = hash(native.objects);
		const proof = verifyIowaSampleNative(parsed, native.visible, geometry, objectsSha256, context);
		const document = { url: link.url, sha256: hash(response.body), retrievedAt, style: context.style, bbox: native.bbox, layout: native.layout, visible: native.visible, geometry, objectsSha256, proof };
		totalBytes += Buffer.byteLength(JSON.stringify(document));
		assert(totalBytes <= 24 * 1024 * 1024, "The Iowa combined native acquisition exceeds its bounds.");
		documents.push(document);
	}
	return JSON.stringify({ schemaVersion: 1, type: "iowa-county-candidate-capture", discovery: JSON.parse(discovery), documents });
}

export function parseIowaCountyCandidateCapture(source: StateBallotSource, body: string, factory: Factory, now = Date.now(), previous?: { records: StateCandidateRecord[]; documents?: { url: string; styles?: string[] }[] }) {
	const county = validateIowaCountySource(source);
	assert(Buffer.byteLength(body) <= 32 * 1024 * 1024, "The Iowa native capture exceeds its bounds.");
	const capture = JSON.parse(body);
	assert(exact(capture, ["schemaVersion", "type", "discovery", "documents"]) && capture.schemaVersion === 1 && capture.type === "iowa-county-candidate-capture" && Array.isArray(capture.documents), "The Iowa native capture contract requires review.");
	const selected = readIowaCountyDiscovery(JSON.stringify(capture.discovery), county, now).elections.find((election: IowaCountyElection) => election.electionDate === source.electionDate);
	assert(selected && selected.pageUrl === source.pageUrl && capture.documents.length === selected.iowaCountyDocuments.length, "The Iowa sample set is incomplete.");
	if (!capture.documents.length) throw new StateBallotAwaitingRecordsError(source.id);
	const documents = capture.documents.map((document: unknown, index: number) => {
		assert(exact(document, ["url", "sha256", "retrievedAt", "style", "bbox", "layout", "visible", "geometry", "objectsSha256", "proof"]) && document.url === selected.iowaCountyDocuments[index]!.url && document.style === selected.iowaCountyDocuments[index]!.styles[0] && typeof document.bbox === "string" && typeof document.layout === "string" && typeof document.visible === "string" && typeof document.objectsSha256 === "string", "The Iowa sample identity or native fields require review.");
		const typed = document as unknown as CapturedSample;
		const context: IowaSampleContext = { county, electionDate: source.electionDate, style: typed.style };
		const parsed = readIowaCountySample(typed.bbox, typed.layout, context);
		assert.deepEqual(verifyIowaSampleNative(parsed, typed.visible, typed.geometry, typed.objectsSha256, context), typed.proof, "The Iowa native proof changed.");
		return typed;
	});
	const parsed = readIowaCountySamples(documents, { county, electionDate: source.electionDate }, now);
	const records = parsed.records.map((choice) => {
		const record = factory(source, { name: choice.name, office: choice.recordKind === "judicial-retention-question" ? `Judicial retention · ${choice.office}` : choice.office, party: choice.party ?? (choice.nonpartisanOffice ? "Nonpartisan" : ""), district: choice.districtCode ?? "", jurisdiction: choice.jurisdiction, scope: choice.scope, status: "listed" });
		assert(record, "The Iowa candidate cannot be normalized.");
		delete record.sourceStatus;
		if (choice.voteLimit) record.voteLimit = choice.voteLimit;
		if (choice.recordKind === "judicial-retention-question") record.sourceStatus = "Judicial retention election";
		if (choice.termType) record.ballotDesignation = "To fill vacancy";
		return record;
	});
	assert(new Set(records.map(record => record.id)).size === records.length, "The Iowa normalized candidate identities are duplicated.");
	assert(!previous?.records.some(record => !records.some(candidate => candidate.id === record.id)), "An accepted Iowa ballot choice disappeared; retain the snapshot for review.");
	assert(!previous?.documents?.some(document => !selected.iowaCountyDocuments.some(item => item.url === document.url && (!document.styles || document.styles.every(style => item.styles.includes(style))))), "An accepted Iowa sample or style disappeared; retain the snapshot for review.");
	return { records, retrievedAt: parsed.retrievedAt, sha256: parsed.sha256, documents: parsed.documents.map(({ url, sha256, retrievedAt, includedRecordCount }) => ({ url, sha256, retrievedAt, includedRecordCount, styles: selected.iowaCountyDocuments.find(document => document.url === url)!.styles })), collectionIndexSha256: iowaCountyDocumentDigest(selected.iowaCountyDocuments) };
}
