import type { StateHtmlNode } from "./state-ballot-html.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

export const courtDirectoryPublication = {
	sourceId: "ga-fulton-state-court",
	slug: "fulton-state",
	title: "Fulton County State Court",
	countyFips: "13121",
	url: "https://fultonstate.org/judiciary/",
	minimumRefreshIntervalMs: 6 * 60 * 60 * 1000,
	maximumDocumentBytes: 3 * 1024 * 1024,
	policies: [
		{ url: "https://fultonstate.org/robots.txt", region: "bytes", sha256: "a08ebb1e77bd26ca5457123088fbe21aa26073dd0207b72ce88fcfa37a2e357a" },
		{ url: "https://fultonstate.org/privacy-policy/", region: "main", sha256: "4d7ff88ed2eac82878908696ef0f1b67c7c20ac8a26ad930957de7c2d37b024d" },
		{ url: "https://fultonstate.org/terms-of-use/", region: "main", sha256: "8a382f8f5feb6c05a04575f996c8d744c79194b36cd904f55ac3b47154ac078f" },
		{ url: "https://fultonstate.org/legal-disclaimer/", region: "main", sha256: "0002e5d5e129ef4f29c971c38f12767416ed927bb6d0d346b8613d2bb2ba0cc1" }
	]
} as const;

export interface CourtDirectoryJudge {
	name: string;
	role: "Judge" | "Chief Judge";
	division: string;
	profileUrl: string;
}

interface CourtDirectoryDocument { url: string; capturedAt: string; sha256: string }
export interface CourtDirectoryCapture {
	schemaVersion: 1;
	type: "court-directory-capture";
	documents: (CourtDirectoryDocument & { body: string })[];
}

export interface CourtDirectorySnapshot {
	schemaVersion: 1;
	type: "court-directory";
	sourceId: string;
	slug: string;
	title: string;
	countyFips: string;
	url: string;
	retrievedAt: string;
	sourceSha256: string;
	documents: CourtDirectoryDocument[];
	judges: CourtDirectoryJudge[];
}

const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const exact = (value: object, keys: string[]) => Object.keys(value).sort().join(",") === keys.sort().join(",");
const canonicalName = (name: string) => name.toLocaleLowerCase("en-US");

function validName(value: unknown): value is string {
	return typeof value === "string" && value === clean(value) && value.length <= 160 && value.includes(" ") && !containsControlCharacters(value) && /^\p{L}[\p{L}\p{M} .'()-]+$/u.test(value) && !/^(?:unknown|coming soon|to be announced|not available)$/iu.test(value);
}

function content(root: StateHtmlNode) {
	const matches = stateHtmlDescendants(root, node => node.nodeName === "main" && stateHtmlAttribute(node, "id") === "inner-wrap");
	if (matches.length !== 1) throw new Error("The court publication layout requires review.");
	return matches[0]!;
}

function officialProfileUrl(value: string) {
	const url = new URL(value, courtDirectoryPublication.url);
	if (url.origin !== "https://fultonstate.org" || url.username || url.password || url.search || url.hash || !/^\/judge-[a-z0-9]+(?:-[a-z0-9]+)*\/$/u.test(url.pathname)) throw new Error("The court profile URL requires review.");
	return url.href;
}

function policyInventory(root: StateHtmlNode, base: string) {
	const links = stateHtmlDescendants(root, node => node.nodeName === "a" && /privacy|terms|copyright|disclaimer|acceptable use|legal notice/iu.test(stateHtmlText(node))).map(node => new URL(stateHtmlAttribute(node, "href"), base).href).sort();
	const expected = courtDirectoryPublication.policies.slice(1).map(policy => policy.url).sort();
	if (links.join("\n") !== expected.join("\n")) throw new Error("The court policy inventory requires review.");
}

export function verifyCourtDirectoryPolicy(body: string, index: number) {
	const policy = courtDirectoryPublication.policies[index];
	if (!policy || Buffer.byteLength(body) > courtDirectoryPublication.maximumDocumentBytes || digest(policy.region === "bytes" ? body : clean(stateHtmlText(content(parseStateHtml(body))))) !== policy.sha256) throw new Error("The court publisher policy requires review.");
}

export function parseCourtDirectory(body: string): CourtDirectoryJudge[] {
	const root = parseStateHtml(body);
	policyInventory(root, courtDirectoryPublication.url);
	const main = content(root);
	const headings = stateHtmlDescendants(main, node => node.nodeName === "h1");
	if (headings.length !== 1 || clean(stateHtmlText(headings[0]!)).toLowerCase() !== "the judges" || !clean(stateHtmlText(main)).includes("State Court of Fulton County")) throw new Error("The court roster identity requires review.");
	const menus = stateHtmlDescendants(root, node => node.nodeName === "ul" && stateHtmlAttribute(node, "id") === "primary-menu");
	if (menus.length !== 1) throw new Error("The court navigation requires review.");
	const menu = stateHtmlDescendants(menus[0]!, node => node.nodeName === "a").map(node => ({ text: clean(stateHtmlText(node)), href: stateHtmlAttribute(node, "href") })).filter(link => /^(?:Chief )?Judge /u.test(link.text));
	const people: CourtDirectoryJudge[] = [];
	function walk(node: StateHtmlNode, ancestors: StateHtmlNode[]) {
		if (node.nodeName === "h3") {
			const label = clean(stateHtmlText(node));
			const card = [...ancestors].reverse().find(parent => stateHtmlDescendants(parent, child => child.nodeName === "h3").length === 1 && stateHtmlDescendants(parent, child => child.nodeName === "a").length === 1);
			if (!card) throw new Error("The court roster card requires review.");
			const link = stateHtmlDescendants(card, child => child.nodeName === "a")[0]!;
			if (!/^view profile\s*→$/iu.test(clean(stateHtmlText(link)))) throw new Error("The court roster profile label requires review.");
			const profileUrl = officialProfileUrl(stateHtmlAttribute(link, "href"));
			const references = menu.filter(item => officialProfileUrl(item.href) === profileUrl);
			if (references.length !== 1) throw new Error("The court identity references disagree.");
			const identity = /^(Chief Judge|Judge) (.+)$/u.exec(references[0]!.text)!;
			if (!validName(identity[2]) || canonicalName(identity[2]) !== canonicalName(label)) throw new Error("The court judge names disagree.");
			const details = clean(stateHtmlText(card)).slice(label.length).trim();
			const division = /^(CHIEF JUDGE \| )?Division ([A-Z]) \| \d[A-Z] view profile →$/iu.exec(details);
			if (!division || Boolean(division[1]) !== (identity[1] === "Chief Judge")) throw new Error("The court judge role or division requires review.");
			people.push({ name: identity[2], role: identity[1] as CourtDirectoryJudge["role"], division: division[2]!.toUpperCase(), profileUrl });
		}
		for (const child of node.childNodes ?? []) walk(child, [...ancestors, node]);
	}
	walk(main, []);
	const links = stateHtmlDescendants(main, node => node.nodeName === "a");
	if (people.length < 2 || people.length > 100 || people.length !== menu.length || people.length !== links.length || people.filter(person => person.role === "Chief Judge").length !== 1 || new Set(people.map(person => canonicalName(person.name))).size !== people.length || new Set(people.map(person => person.profileUrl)).size !== people.length || new Set(people.map(person => person.division)).size !== people.length) throw new Error("The court roster inventory requires review.");
	return people;
}

export function verifyCourtDirectoryProfile(body: string, judge: CourtDirectoryJudge) {
	const root = parseStateHtml(body);
	policyInventory(root, judge.profileUrl);
	const main = content(root);
	const headings = stateHtmlDescendants(main, node => node.nodeName === "h1");
	if (headings.length !== 1 || canonicalName(clean(stateHtmlText(headings[0]!)).replace(/^(?:Chief )?Judge /u, "")) !== canonicalName(judge.name) || !new RegExp(`\\bDivision ${judge.division}\\b`, "u").test(clean(stateHtmlText(main)))) throw new Error("The court profile identity disagrees with its roster.");
}

export function validateCourtDirectorySnapshot(value: unknown, now = Date.now()): asserts value is CourtDirectorySnapshot {
	if (!Number.isFinite(now) || !value || typeof value !== "object" || Array.isArray(value) || !exact(value, ["schemaVersion", "type", "sourceId", "slug", "title", "countyFips", "url", "retrievedAt", "sourceSha256", "documents", "judges"])) throw new Error("The court snapshot fields are invalid.");
	const snapshot = value as CourtDirectorySnapshot;
	if (snapshot.schemaVersion !== 1 || snapshot.type !== "court-directory" || ["sourceId", "slug", "title", "countyFips", "url"].some(key => snapshot[key as keyof CourtDirectorySnapshot] !== courtDirectoryPublication[key as keyof typeof courtDirectoryPublication]) || !Array.isArray(snapshot.documents) || !Array.isArray(snapshot.judges) || snapshot.judges.length < 2 || snapshot.judges.length > 100) throw new Error("The court snapshot identity is invalid.");
	for (const judge of snapshot.judges) {
		if (!judge || !exact(judge, ["name", "role", "division", "profileUrl"]) || !validName(judge.name) || !["Judge", "Chief Judge"].includes(judge.role) || typeof judge.division !== "string" || !/^[A-Z]$/u.test(judge.division) || typeof judge.profileUrl !== "string" || officialProfileUrl(judge.profileUrl) !== judge.profileUrl) throw new Error("The court judge is invalid.");
	}
	if (snapshot.judges.filter(judge => judge.role === "Chief Judge").length !== 1 || ["name", "division", "profileUrl"].some(key => new Set(snapshot.judges.map(judge => canonicalName(judge[key as keyof CourtDirectoryJudge]))).size !== snapshot.judges.length)) throw new Error("The court snapshot inventory is invalid.");
	const urls = [...courtDirectoryPublication.policies.map(policy => policy.url), courtDirectoryPublication.url, ...snapshot.judges.map(judge => judge.profileUrl)];
	if (snapshot.documents.length !== urls.length) throw new Error("The court snapshot evidence is incomplete.");
	for (const [index, document] of snapshot.documents.entries()) {
		if (!document || !exact(document, ["url", "capturedAt", "sha256"]) || document.url !== urls[index] || typeof document.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(document.sha256) || typeof document.capturedAt !== "string" || !Number.isFinite(Date.parse(document.capturedAt)) || new Date(document.capturedAt).toISOString() !== document.capturedAt || Date.parse(document.capturedAt) > now) throw new Error("The court snapshot provenance is invalid.");
	}
	if (snapshot.retrievedAt !== new Date(Math.min(...snapshot.documents.map(document => Date.parse(document.capturedAt)))).toISOString() || snapshot.sourceSha256 !== digest(JSON.stringify(snapshot.documents))) throw new Error("The court snapshot clocks or digest are invalid.");
}

export function prepareCourtDirectory(capture: CourtDirectoryCapture, now = Date.now()): CourtDirectorySnapshot {
	if (!capture || !exact(capture, ["schemaVersion", "type", "documents"]) || capture.schemaVersion !== 1 || capture.type !== "court-directory-capture" || !Array.isArray(capture.documents) || capture.documents.length < 7 || capture.documents.length > 105) throw new Error("The court capture is invalid.");
	for (const [index, document] of capture.documents.entries()) {
		if (!document || !exact(document, ["url", "body", "capturedAt", "sha256"]) || typeof document.body !== "string" || Buffer.byteLength(document.body) > courtDirectoryPublication.maximumDocumentBytes || digest(document.body) !== document.sha256) throw new Error("The court capture provenance is invalid.");
		if (index < courtDirectoryPublication.policies.length) verifyCourtDirectoryPolicy(document.body, index);
	}
	const judges = parseCourtDirectory(capture.documents[4]!.body);
	if (capture.documents.length !== judges.length + 5) throw new Error("The court profile inventory is incomplete.");
	for (const [index, judge] of judges.entries()) verifyCourtDirectoryProfile(capture.documents[index + 5]!.body, judge);
	const documents = capture.documents.map(({ url, capturedAt, sha256 }) => ({ url, capturedAt, sha256 }));
	const { sourceId, slug, title, countyFips, url } = courtDirectoryPublication;
	const snapshot: CourtDirectorySnapshot = { schemaVersion: 1, type: "court-directory", sourceId, slug, title, countyFips, url, retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.capturedAt)))).toISOString(), sourceSha256: digest(JSON.stringify(documents)), documents, judges };
	validateCourtDirectorySnapshot(snapshot, now);
	return snapshot;
}
