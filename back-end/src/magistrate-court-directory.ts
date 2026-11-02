import type { StateHtmlNode } from "./state-ballot-html.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

const origin = "https://www.magistratefulton.org";
export const magistrateCourtPublication = {
	sourceId: "ga-fulton-magistrate-court",
	slug: "fulton-magistrate",
	title: "Fulton County Magistrate Court",
	countyFips: "13121",
	url: `${origin}/157/Judges`,
	homeUrl: `${origin}/`,
	chiefUrl: `${origin}/223/Chief-Magistrate-Judge`,
	minimumRefreshIntervalMs: 6 * 60 * 60 * 1000,
	minimumRequestIntervalMs: 20000,
	maximumDocumentBytes: 3 * 1024 * 1024,
	maximumCaptureBytes: 16 * 1024 * 1024,
	policies: [
		{ url: `${origin}/robots.txt`, region: "bytes", sha256: "9340481a0af59414fd114f3a9e8048f4ba2b91d3c6ee20dcfec607beed7b3892" },
		{ url: `${origin}/site/copyright`, region: "copyright-year-range-v1", sha256: "1a2c09161c13e5df1ddb223f4ae0430715b186012a13d43a96404fff1d9608a1" }
	]
} as const;

export interface MagistrateCourtJudge {
	name: string;
	role: "Judge" | "Chief Magistrate Judge";
	profileUrl: string;
}
interface MagistrateCourtDocument {
	url: string;
	status: 200 | 302;
	capturedAt: string;
	sha256: string;
	location?: string;
}
export interface MagistrateCourtCapture {
	schemaVersion: 1;
	type: "magistrate-court-capture";
	documents: (MagistrateCourtDocument & { body: string })[];
}
export interface MagistrateCourtSnapshot {
	schemaVersion: 1;
	type: "court-directory";
	sourceId: string;
	slug: string;
	title: string;
	countyFips: string;
	url: string;
	retrievedAt: string;
	sourceSha256: string;
	documents: MagistrateCourtDocument[];
	judges: MagistrateCourtJudge[];
}

const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const exact = (value: object, keys: string[]) => Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const canonicalName = (name: string) => clean(name).toLocaleLowerCase("en-US").replace(/[.,]/gu, "");
function reject(): never {
	throw new Error("The Magistrate Court publication requires review.");
}
function validName(value: unknown): value is string {
	return typeof value === "string" && value === clean(value) && value.length <= 160 && value.includes(" ") && !containsControlCharacters(value) && /^\p{L}[\p{L}\p{M} .,'()-]+$/u.test(value) && !/^(?:unknown|coming soon|to be announced|not available)$/iu.test(value);
}
function document(body: string) {
	if (typeof body !== "string" || Buffer.byteLength(body) > magistrateCourtPublication.maximumDocumentBytes || body.includes("\uFFFD")) return reject();
	const root = parseStateHtml(body);
	const pending = [{ node: root, depth: 0 }];
	let count = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		if (++count > 20000 || depth > 64) return reject();
		for (const child of node.childNodes ?? []) pending.push({ node: child, depth: depth + 1 });
	}
	return root;
}
function content(root: StateHtmlNode) {
	const matches = stateHtmlDescendants(root, node => stateHtmlAttribute(node, "id") === "moduleContent");
	if (matches.length !== 1) return reject();
	return matches[0]!;
}
function visible(node: StateHtmlNode) {
	return !node.attrs?.some(attribute => attribute.name === "hidden" || attribute.name === "inert" || (attribute.name === "aria-hidden" && attribute.value === "true") || (attribute.name === "style" && /display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)/iu.test(attribute.value)));
}
function policyInventory(root: StateHtmlNode) {
	const links = stateHtmlDescendants(root, node => node.nodeName === "a" && /privacy|terms|copyright|disclaimer|acceptable use|legal notice/iu.test(stateHtmlText(node))).map(node => new URL(stateHtmlAttribute(node, "href"), origin).href);
	if (links.length !== 1 || links[0] !== magistrateCourtPublication.policies[1].url) return reject();
}
export function verifyMagistrateCourtPolicy(body: string, index: number, now = Date.now()) {
	const policy = magistrateCourtPublication.policies[index];
	if (!Number.isFinite(now) || !policy || typeof body !== "string" || Buffer.byteLength(body) > magistrateCourtPublication.maximumDocumentBytes) return reject();
	if (index === 0) {
		if (digest(body) !== policy.sha256) return reject();
		return;
	}
	const root = document(body);
	policyInventory(root);
	const text = clean(stateHtmlText(content(root)));
	const years = [...text.matchAll(/© (1997|2006)-(20\d{2})/gu)];
	if (years.length !== 2 || years[0]![1] !== "1997" || years[1]![1] !== "2006" || years[0]![2] !== years[1]![2] || Number(years[0]![2]) > new Date(now).getUTCFullYear() + 1 || digest(text.replace(/(© (?:1997|2006)-)20\d{2}/gu, "$1{year}")) !== policy.sha256) return reject();
}
export function magistrateProfileUrl(value: string) {
	const url = new URL(value, origin);
	if (url.origin !== origin || url.username || url.password || url.hash || !/^\/(?:directory|Directory)\.aspx$/u.test(url.pathname) || !/^\?EID=[1-9]\d{0,4}$/u.test(url.search)) return reject();
	return url.href;
}
export function magistrateProfileRedirect(value: string) {
	const url = new URL(magistrateProfileUrl(value));
	return `/m/directory/employee?eid=${url.searchParams.get("EID")}`;
}
export function parseMagistrateCourtRoster(body: string): MagistrateCourtJudge[] {
	const root = document(body);
	policyInventory(root);
	const main = content(root);
	const headings = stateHtmlDescendants(main, node => node.nodeName === "h1");
	if (headings.length !== 1 || clean(stateHtmlText(headings[0]!)) !== "Judges") return reject();
	const judges: MagistrateCourtJudge[] = [];
	const pending = [{ node: main, parents: [] as StateHtmlNode[] }];
	while (pending.length) {
		const { node, parents } = pending.pop()!;
		if (node.nodeName === "h3") {
			const label = clean(stateHtmlText(node));
			if (!label.startsWith("Judge ") || !validName(label.slice(6)) || clean(stateHtmlAttribute(node, "data-headertext")) !== label || ![...parents, node].every(visible)) return reject();
			const card = [...parents].reverse().find(parent => stateHtmlAttribute(parent, "class").startsWith("widget image "));
			if (!card || stateHtmlDescendants(card, child => child.nodeName === "h3").length !== 1) return reject();
			const links = stateHtmlDescendants(card, child => child.nodeName === "a");
			if (links.length !== 1 || !visible(links[0]!)) return reject();
			judges.push({ name: label.slice(6), role: "Judge", profileUrl: magistrateProfileUrl(stateHtmlAttribute(links[0]!, "href")) });
		}
		for (const child of [...(node.childNodes ?? [])].reverse()) pending.push({ node: child, parents: [...parents, node] });
	}
	const profileLinks = stateHtmlDescendants(main, node => node.nodeName === "a").map(node => stateHtmlAttribute(node, "href"));
	if (!judges.length || judges.length > 100 || profileLinks.length !== judges.length || new Set(judges.map(judge => canonicalName(judge.name))).size !== judges.length || new Set(judges.map(judge => new URL(judge.profileUrl).search)).size !== judges.length) return reject();
	return judges;
}
export function parseMagistrateChief(homeBody: string, chiefBody: string): MagistrateCourtJudge {
	const home = document(homeBody);
	const chief = document(chiefBody);
	policyInventory(home);
	policyInventory(chief);
	const titles = stateHtmlDescendants(home, node => node.nodeName === "h1" && /\bwidgetTitle\b/u.test(stateHtmlAttribute(node, "class")));
	if (titles.length !== 1) return reject();
	const heading = clean(stateHtmlText(titles[0]!));
	const name = heading.startsWith("Judge ") ? heading.slice(6) : "";
	const chiefContent = content(chief);
	const chiefTitles = stateHtmlDescendants(chiefContent, node => node.nodeName === "h1");
	const namedRole = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")} (?:is|serves as) (?:(?:the|first|current|newly appointed|newly elected) ){0,2}Chief Magistrate Judge\\b`, "u");
	if (!validName(name) || !visible(titles[0]!) || chiefTitles.length !== 1 || clean(stateHtmlText(chiefTitles[0]!)) !== "Chief Magistrate Judge" || !namedRole.test(clean(stateHtmlText(chiefContent)))) return reject();
	return { name, role: "Chief Magistrate Judge", profileUrl: magistrateCourtPublication.chiefUrl };
}
export function verifyMagistrateCourtProfile(body: string, judge: MagistrateCourtJudge) {
	const root = document(body);
	policyInventory(root);
	const main = content(root);
	const names = stateHtmlDescendants(main, node => node.nodeName === "h2");
	const departments = stateHtmlDescendants(main, node => node.nodeName === "h3");
	if (names.length !== 1 || departments.length !== 1 || !visible(names[0]!) || clean(stateHtmlText(departments[0]!)) !== "Judges") return reject();
	const profileName = canonicalName(stateHtmlText(names[0]!));
	const rosterName = canonicalName(judge.name);
	const exactNamedOpening = rosterName.startsWith(`${profileName} `) && canonicalName(stateHtmlText(main)).startsWith(`${profileName} judges judge ${rosterName} `);
	if (profileName !== rosterName && !exactNamedOpening) return reject();
}
function validInstant(value: unknown, now: number): value is string {
	return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= now;
}
export function validateMagistrateCourtSnapshot(value: unknown, now = Date.now()): asserts value is MagistrateCourtSnapshot {
	if (!Number.isFinite(now) || !value || typeof value !== "object" || Array.isArray(value) || !exact(value, ["schemaVersion", "type", "sourceId", "slug", "title", "countyFips", "url", "retrievedAt", "sourceSha256", "documents", "judges"])) return reject();
	const snapshot = value as MagistrateCourtSnapshot;
	if (snapshot.schemaVersion !== 1 || snapshot.type !== "court-directory" || !["sourceId", "slug", "title", "countyFips", "url"].every(key => snapshot[key as keyof MagistrateCourtSnapshot] === magistrateCourtPublication[key as keyof typeof magistrateCourtPublication]) || !Array.isArray(snapshot.judges) || snapshot.judges.length < 2 || snapshot.judges.length > 101 || !Array.isArray(snapshot.documents)) return reject();
	for (const [index, judge] of snapshot.judges.entries()) {
		if (!judge || !exact(judge, ["name", "role", "profileUrl"]) || !validName(judge.name) || (index === 0 ? judge.role !== "Chief Magistrate Judge" || judge.profileUrl !== magistrateCourtPublication.chiefUrl : judge.role !== "Judge" || magistrateProfileUrl(judge.profileUrl) !== judge.profileUrl)) return reject();
	}
	if (new Set(snapshot.judges.map(judge => canonicalName(judge.name))).size !== snapshot.judges.length || new Set(snapshot.judges.map(judge => judge.profileUrl.toLowerCase())).size !== snapshot.judges.length) return reject();
	const fixed = [...magistrateCourtPublication.policies.map(policy => policy.url), magistrateCourtPublication.homeUrl, magistrateCourtPublication.url, magistrateCourtPublication.chiefUrl];
	let position = 0;
	for (const url of [...fixed, ...snapshot.judges.slice(1).map(judge => judge.profileUrl)]) {
		const entry = snapshot.documents[position++];
		if (!entry || entry.url !== url) return reject();
		if (entry.status === 302) {
			if (fixed.includes(url as typeof fixed[number]) || entry.location !== magistrateProfileRedirect(url)) return reject();
			const terminal = snapshot.documents[position++];
			if (!terminal || terminal.url !== origin + entry.location || terminal.status !== 200) return reject();
		}
		else if (entry.status !== 200) {
			return reject();
		}
	}
	if (position !== snapshot.documents.length) return reject();
	for (const entry of snapshot.documents) {
		if (!entry || !exact(entry, ["url", "status", "capturedAt", "sha256", ...(entry.status === 302 ? ["location"] : [])]) || !validInstant(entry.capturedAt, now) || !/^[a-f0-9]{64}$/u.test(entry.sha256)) return reject();
	}
	if (snapshot.retrievedAt !== new Date(Math.min(...snapshot.documents.map(entry => Date.parse(entry.capturedAt)))).toISOString() || snapshot.sourceSha256 !== digest(JSON.stringify(snapshot.documents))) return reject();
}
export function prepareMagistrateCourtDirectory(value: unknown, now = Date.now()): MagistrateCourtSnapshot {
	if (!value || typeof value !== "object" || Array.isArray(value) || !exact(value, ["schemaVersion", "type", "documents"])) return reject();
	const capture = value as MagistrateCourtCapture;
	if (capture.schemaVersion !== 1 || capture.type !== "magistrate-court-capture" || !Array.isArray(capture.documents) || capture.documents.length < 7 || capture.documents.length > 205 || Buffer.byteLength(JSON.stringify(capture)) > magistrateCourtPublication.maximumCaptureBytes) return reject();
	for (const entry of capture.documents) {
		if (!entry || !exact(entry, ["url", "status", "capturedAt", "sha256", "body", ...(entry.status === 302 ? ["location"] : [])]) || typeof entry.body !== "string" || Buffer.byteLength(entry.body) > magistrateCourtPublication.maximumDocumentBytes || digest(entry.body) !== entry.sha256) return reject();
	}
	for (const index of [0, 1]) verifyMagistrateCourtPolicy(capture.documents[index]!.body, index, now);
	const judges = [parseMagistrateChief(capture.documents[2]!.body, capture.documents[4]!.body), ...parseMagistrateCourtRoster(capture.documents[3]!.body)];
	let position = 5;
	for (const judge of judges.slice(1)) {
		let entry = capture.documents[position++];
		if (entry?.status === 302) entry = capture.documents[position++];
		if (!entry) return reject();
		verifyMagistrateCourtProfile(entry.body, judge);
	}
	const documents = capture.documents.map(({ body: _body, ...entry }) => entry);
	const { sourceId, slug, title, countyFips, url } = magistrateCourtPublication;
	const snapshot: MagistrateCourtSnapshot = { schemaVersion: 1, type: "court-directory", sourceId, slug, title, countyFips, url, documents, judges, retrievedAt: new Date(Math.min(...documents.map(entry => Date.parse(entry.capturedAt)))).toISOString(), sourceSha256: digest(JSON.stringify(documents)) };
	validateMagistrateCourtSnapshot(snapshot, now);
	return snapshot;
}
