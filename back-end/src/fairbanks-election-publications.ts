import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, open, realpath, unlink } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteSourceDocument, fetchRemoteSourceText } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { containsControlCharacters } from "./text-validation.js";

const origin = "https://www.fnsb.gov";
export const fairbanksElectionIndexUrl = `${origin}/elections`;
const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => object(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const text = (node: Parameters<typeof stateHtmlText>[0]) => stateHtmlText(node).normalize("NFKC").replace(/\s+/gu, " ").trim();
const instant = (value: unknown, now: number): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= now;
export interface FairbanksPublicationAccessReview { reviewedAt: string; robotsSha256: string; indexLinksSha256: string; accessibilitySha256: string }
export const fairbanksPublicationAccessReview: FairbanksPublicationAccessReview = {
	reviewedAt: "2026-11-07T07:31:19.318Z",
	robotsSha256: "9340481a0af59414fd114f3a9e8048f4ba2b91d3c6ee20dcfec607beed7b3892",
	indexLinksSha256: "edbffefaabeea27a25a8f45a51e166f389ef793e0eb4338b7c8d9f021d82f2ae",
	accessibilitySha256: "87cdc57c1070e47d1d4b2cd5fdcf030ba329669317af0cfa7389dfc0afd9d7e5"
};
interface Page { url: string; body: string; sha256: string; capturedAt: string; checkedAt: string }
interface Publication extends Page { kind: "sample" | "notice"; text: string }
export interface FairbanksPublicationCapture { schemaVersion: 1; type: "fairbanks-election-publication-capture"; accessReview: FairbanksPublicationAccessReview; policies: Page[]; index: Page; documents: Publication[] }
type TextRequest = typeof fetchRemoteSourceText;
interface Options { now?: () => number; sleep?: (milliseconds: number) => Promise<void>; requestText?: TextRequest; requestDocument?: typeof fetchRemoteSourceDocument; extractor?: (body: Buffer) => Promise<string>; accessReview?: FairbanksPublicationAccessReview; previous?: FairbanksPublicationCapture }
const robotsLayout = { restrictiveGroups: [
	{ agents: ["Baiduspider"], unrelated: true },
	{ agents: ["Yandex"], unrelated: true },
	{ agents: ["*"] },
	{ agents: ["Siteimprove"], unrelated: true },
	{ agents: ["Siteimprovebot"], unrelated: true },
	{ agents: ["Siteimprovebot-crawler"], unrelated: true },
	{ agents: ["meta-webindexer", "meta-externalagent", "OAI-SearchBot", "GPTBot", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Amazonbot", "Bytespider", "CCBot", "cohere-ai", "Reflectionbot", "LinkupBot", "ExaSearchBot", "YouBot", "DuckAssistBot", "serpstatbot", "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot"] }
] } as const;
function review(value: unknown, now: number): asserts value is FairbanksPublicationAccessReview {
	if (!exact(value, ["reviewedAt", "robotsSha256", "indexLinksSha256", "accessibilitySha256"]) || !instant(value.reviewedAt, now) || now - Date.parse(value.reviewedAt) > 30 * 86400000 || ["robotsSha256", "indexLinksSha256", "accessibilitySha256"].some(key => value[key] !== fairbanksPublicationAccessReview[key as keyof FairbanksPublicationAccessReview])) throw new Error("The Fairbanks publisher access review requires renewal.");
}
function pageTree(body: string) {
	if (!body || Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The Fairbanks page exceeds its bounds.");
	const tree = parseStateHtml(body);
	const pending = [{ node: tree, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		if (++visited > 40000 || depth > 64) throw new Error("The Fairbanks page structure requires review.");
		for (const child of node.childNodes ?? []) pending.push({ node: child, depth: depth + 1 });
	}
	return tree;
}
function visible(node: Parameters<typeof stateHtmlText>[0]) {
	type Parented = typeof node & { parentNode?: Parented };
	for (let current: Parented | undefined = node; current; current = current.parentNode) {
		if (current.attrs?.some(item => item.name === "hidden") || attribute(current, "aria-hidden") === "true" || /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\D|$)/iu.test(attribute(current, "style"))) throw new Error("The Fairbanks publication visibility requires review.");
	}
}
function date(label: string) {
	const match = /\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),?\s+(October|November)\s+(\d{1,2}),\s+(20\d{2})\b/iu.exec(label);
	if (!match) throw new Error("The Fairbanks explicit election date requires review.");
	const value = `${match[4]}-${match[2]!.toLowerCase() === "october" ? "10" : "11"}-${match[3]!.padStart(2, "0")}`;
	const parsed = new Date(`${value}T00:00:00Z`);
	if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value < "2026-10-06" || ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][parsed.getUTCDay()]!.toLowerCase() !== match[1]!.toLowerCase()) throw new Error("The Fairbanks election date or weekday is inconsistent.");
	return value;
}
export function readFairbanksPublicationIndex(body: string) {
	const tree = pageTree(body);
	if (electionDocumentPolicyFingerprint(Buffer.from(body), "links", fairbanksElectionIndexUrl) !== fairbanksPublicationAccessReview.indexLinksSha256) throw new Error("The Fairbanks legal link inventory requires review.");
	const regions = descendants(tree, node => attribute(node, "id") === "page");
	if (regions.length !== 1 || descendants(regions[0]!, node => node.nodeName === "h1" && text(node) === "Election Information").length !== 1 || !text(tree).includes("Fairbanks North Star Borough")) throw new Error("The Fairbanks publication identity requires review.");
	const region = regions[0]!;
	visible(region);
	const rows = descendants(region, node => node.nodeName === "tr" && /Regular Municipal Election Day/u.test(text(node)));
	if (rows.length !== 1) throw new Error("The Fairbanks regular election date is missing or ambiguous.");
	visible(rows[0]!);
	const electionDate = date(text(rows[0]!));
	const calendar = new Date(`${electionDate}T00:00:00Z`);
	if (/first Tuesday in October/iu.test(text(region)) && (calendar.getUTCMonth() !== 9 || calendar.getUTCDay() !== 2 || calendar.getUTCDate() > 7)) throw new Error("The Fairbanks schedule and election date conflict.");
	if (/first Tuesday after the first Monday in November/iu.test(text(region)) && (calendar.getUTCMonth() !== 10 || calendar.getUTCDay() !== 2 || calendar.getUTCDate() < 2 || calendar.getUTCDate() > 8)) throw new Error("The Fairbanks schedule and election date conflict.");
	const documents = ([["sample", "FNSB Sample Ballot (PDF)"], ["notice", "Notice of Election (PDF)"]] as const).map(([kind, label]) => {
		const links = descendants(region, node => node.nodeName === "a" && text(node) === label);
		if (links.length !== 1) throw new Error("The complete Fairbanks publication set requires review.");
		visible(links[0]!);
		const url = new URL(attribute(links[0]!, "href"), fairbanksElectionIndexUrl);
		if (url.origin !== origin || url.search || url.hash || !/^\/DocumentCenter\/View\/\d{1,8}\/[A-Za-z0-9-]+-PDF$/u.test(url.pathname)) throw new Error("The Fairbanks offered document URL requires review.");
		return { kind, url: url.href };
	});
	return { electionDate, jurisdiction: "Fairbanks North Star Borough", documents };
}
function page(value: unknown, now: number, binary = false): asserts value is Page {
	if (!object(value) || typeof value.url !== "string" || typeof value.body !== "string" || !digest(value.sha256) || !instant(value.checkedAt, now) || !instant(value.capturedAt, Date.parse(value.checkedAt))) throw new Error("The Fairbanks capture provenance requires review.");
	const body = binary ? Buffer.from(value.body, "base64") : Buffer.from(value.body);
	if (body.length > (binary ? 8 : 2) * 1024 * 1024 || hash(body) !== value.sha256 || (binary && (body.toString("base64") !== value.body || body.subarray(0, 5).toString() !== "%PDF-"))) throw new Error("The Fairbanks captured bytes changed or exceed their bounds.");
}
export function readFairbanksPublicationCapture(value: unknown, now = Date.now()) {
	if (!exact(value, ["schemaVersion", "type", "accessReview", "policies", "index", "documents"]) || value.schemaVersion !== 1 || value.type !== "fairbanks-election-publication-capture" || !Array.isArray(value.policies) || value.policies.length !== 2 || !Array.isArray(value.documents) || value.documents.length !== 2) throw new Error("The Fairbanks publication capture contract requires review.");
	page(value.index, now);
	if (!exact(value.index, ["url", "body", "sha256", "capturedAt", "checkedAt"]) || value.index.url !== fairbanksElectionIndexUrl) throw new Error("The Fairbanks index provenance requires review.");
	for (const policy of value.policies) {
		page(policy, now);
		if (!exact(policy, ["url", "body", "sha256", "capturedAt", "checkedAt"])) throw new Error("The Fairbanks policy capture requires review.");
	}
	const policies = value.policies as Page[];
	if (policies[0]!.url !== `${origin}/robots.txt` || policies[0]!.sha256 !== fairbanksPublicationAccessReview.robotsSha256 || policies[1]!.url !== `${origin}/accessibility` || electionDocumentPolicyFingerprint(Buffer.from(policies[1]!.body), "region", policies[1]!.url, "contentarea") !== fairbanksPublicationAccessReview.accessibilitySha256) throw new Error("The Fairbanks publisher policies changed.");
	const rules = electionDocumentRobotsPolicy(Buffer.from(policies[0]!.body), [], [], undefined, undefined, robotsLayout);
	const inventory = readFairbanksPublicationIndex(value.index.body);
	const documents = value.documents as Publication[];
	for (const [position, document] of documents.entries()) {
		page(document, now, true);
		const offered = inventory.documents[position]!;
		if (!exact(document, ["url", "body", "sha256", "capturedAt", "checkedAt", "kind", "text"]) || document.kind !== offered.kind || document.url !== offered.url || !rules.allowed(document.url) || typeof document.text !== "string" || Buffer.byteLength(document.text) > 4 * 1024 * 1024 || !/Fairbanks North Star Borough/iu.test(document.text.split("\f")[0]!)) throw new Error("The Fairbanks publication evidence requires review.");
		const first = document.text.split("\f")[0]!.replace(/\s+/gu, " ").trim();
		const pages = document.text.split("\f").filter(item => item.trim()).length;
		if (!pages || pages > (document.kind === "sample" ? 4 : 20) || containsControlCharacters(document.text.replace(/[\r\n\t\f]/gu, ""))) throw new Error("The Fairbanks PDF text or page inventory requires review.");
		const dated = document.kind === "sample" ? /REGULAR ELECTION\s*(?:-\s*)?((October|November)\s+\d{1,2},\s+20\d{2})/iu.exec(first) : /Notice of Elections\s*((Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),?\s+(October|November)\s+\d{1,2},\s+20\d{2})/iu.exec(first);
		if (!dated) throw new Error("The Fairbanks PDF election identity requires review.");
		const printed = document.kind === "sample" ? date(`${new Date(`${inventory.electionDate}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}, ${dated[1]}`) : date(dated[1]!);
		if (printed !== inventory.electionDate) throw new Error("The Fairbanks index and PDF election dates disagree.");
	}
	const checked = Math.max(Date.parse(value.index.checkedAt), ...policies.map(item => Date.parse(item.checkedAt)), ...documents.map(item => Date.parse(item.checkedAt)));
	review(value.accessReview, checked);
	return { ...inventory, sourceDocuments: documents.map(({ kind, url, sha256, capturedAt, checkedAt }) => ({ kind, url, sha256, capturedAt, checkedAt })), candidateImportApproved: false, publicationApproved: false, resultsInferred: false };
}
export async function fetchFairbanksElectionPublications(options: Options = {}): Promise<FairbanksPublicationCapture> {
	const now = options.now ?? Date.now;
	const accessReview = options.accessReview ?? fairbanksPublicationAccessReview;
	review(accessReview, now());
	if (options.previous) readFairbanksPublicationCapture(options.previous, now());
	const request = options.requestText ?? fetchRemoteSourceText;
	const previousPages = options.previous ? [...options.previous.policies, options.previous.index, ...options.previous.documents] : [];
	const preserve = (url: string, body: string, binary = false) => {
		const sha256 = hash(binary ? Buffer.from(body, "base64") : body);
		const previous = previousPages.find(item => item.url === url && item.sha256 === sha256 && item.body === body);
		return { url, body, sha256, capturedAt: previous?.capturedAt ?? new Date(now()).toISOString(), checkedAt: new Date(now()).toISOString() };
	};
	const transport = { allowedHosts: ["www.fnsb.gov"], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 30000 };
	const robots = preserve(`${origin}/robots.txt`, await request(`${origin}/robots.txt`, transport));
	if (robots.sha256 !== accessReview.robotsSha256) throw new Error("The Fairbanks robots policy changed.");
	const rules = electionDocumentRobotsPolicy(Buffer.from(robots.body), [], [], undefined, undefined, robotsLayout);
	const pause = async (url: string) => {
		if (!rules.allowed(url)) throw new Error("The Fairbanks publisher path is restricted.");
		await (options.sleep ?? wait)(rules.delay);
	};
	await pause(`${origin}/accessibility`);
	const accessibility = preserve(`${origin}/accessibility`, await request(`${origin}/accessibility`, transport));
	if (electionDocumentPolicyFingerprint(Buffer.from(accessibility.body), "region", accessibility.url, "contentarea") !== accessReview.accessibilitySha256) throw new Error("The Fairbanks accessibility policy changed.");
	await pause(fairbanksElectionIndexUrl);
	const index = preserve(fairbanksElectionIndexUrl, await request(fairbanksElectionIndexUrl, transport));
	const inventory = readFairbanksPublicationIndex(index.body);
	if (options.previous) {
		const prior = readFairbanksPublicationCapture(options.previous, now());
		if (prior.electionDate !== inventory.electionDate && Date.parse(`${prior.electionDate}T00:00:00Z`) + 2 * 86400000 > now()) throw new Error("The unexpired Fairbanks election disappeared; retain prior evidence.");
	}
	let executable: string | undefined;
	const extractor = options.extractor ?? (async (body: Buffer) => {
		executable ??= await resolveStateBallotPdfExtractor();
		return extractStateBallotPdfText(body, executable);
	});
	const documents: Publication[] = [];
	for (const offered of inventory.documents) {
		await pause(offered.url);
		const response = await (options.requestDocument ?? fetchRemoteSourceDocument)(offered.url, { allowedHosts: transport.allowedHosts, maxBytes: 8 * 1024 * 1024, timeoutMs: 30000 });
		if (response.status !== 200 || response.contentType !== "application/pdf" || response.body.subarray(0, 5).toString() !== "%PDF-") throw new Error("A Fairbanks PDF is unavailable; retain prior evidence.");
		const extracted = await extractor(response.body);
		documents.push({ ...preserve(offered.url, response.body.toString("base64"), true), kind: offered.kind, text: extracted });
	}
	const capture: FairbanksPublicationCapture = { schemaVersion: 1, type: "fairbanks-election-publication-capture", accessReview, policies: [robots, accessibility], index, documents };
	readFairbanksPublicationCapture(capture, now());
	return capture;
}
export async function writeFairbanksElectionPublications(directory: string, capture: FairbanksPublicationCapture, now = Date.now()) {
	const inventory = readFairbanksPublicationCapture(capture, now);
	assertExternalStateDataDirectory(directory);
	await mkdir(directory, { recursive: true, mode: 0o700 });
	const canonical = await realpath(directory);
	assertExternalStateDataDirectory(canonical);
	if (canonical !== directory) throw new Error("Fairbanks storage requires its unlinked physical path.");
	const body = Buffer.from(`${JSON.stringify({ inventory, capture }, null, 2)}\n`);
	if (body.length > 12 * 1024 * 1024) throw new Error("The Fairbanks evidence bundle exceeds its storage bound.");
	const sha256 = hash(body);
	const path = join(canonical, `fairbanks-election-${inventory.electionDate}-${sha256}.json`);
	const temporary = join(canonical, `.${randomUUID()}.tmp`);
	const handle = await open(temporary, "wx", 0o600);
	try {
		await handle.writeFile(body);
		await handle.sync();
		await handle.close();
		try {
			await link(temporary, path);
		}
		catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readBoundedStateDataBytes(path)).equals(body)) throw error;
		}
		const parent = await open(canonical, "r");
		try {
			await parent.sync();
		}
		finally {
			await parent.close();
		}
	}
	finally {
		await handle.close().catch(() => {});
		await unlink(temporary);
	}
	return { path, sha256, electionDate: inventory.electionDate, imported: false, published: false };
}
