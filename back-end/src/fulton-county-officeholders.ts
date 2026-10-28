import type { StateHtmlNode } from "./state-ballot-html.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { fultonPolicyReceipts } from "./state-ballot-fulton.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

export const fultonCountyOfficeholderPublication = {
	sourceId: "ga-fulton-county-offices",
	countyFips: "13121",
	policies: fultonPolicyReceipts.slice(0, 2),
	minimumRefreshIntervalMs: 6 * 60 * 60 * 1000,
	maximumDocumentBytes: 3 * 1024 * 1024,
	offices: [
		{ id: "sheriff", role: "Sheriff", pageUrl: "https://fultoncountyga.gov/Inside-Fulton-County/Fulton-County-Departments/Sheriff", profilePrefix: "/Inside-Fulton-County/Fulton-County-Departments/Sheriff/About-Us/Sheriff-" },
		{ id: "district-attorney", role: "District Attorney", pageUrl: "https://fultoncountyga.gov/Inside-Fulton-County/Fulton-County-Departments/District-Attorney", profilePrefix: "/Inside-Fulton-County/Fulton-County-Departments/District-Attorney/DA-Executive-Team/" }
	]
} as const;

export interface FultonCountyOfficeholderCapture {
	schemaVersion: 1;
	type: "fulton-county-officeholder-capture";
	documents: { url: string; body: string; capturedAt: string; sha256: string }[];
}

export interface FultonCountyOffice {
	id: "sheriff" | "district-attorney";
	status: "occupied" | "vacant";
	person?: { name: string; slug: string; officialWebsiteUrl: string; portraitUrl: string };
}

export interface FultonCountyOfficeholderSnapshot {
	schemaVersion: 1;
	type: "fulton-county-officeholders";
	sourceId: "ga-fulton-county-offices";
	countyFips: "13121";
	retrievedAt: string;
	sourceSha256: string;
	documents: { url: string; capturedAt: string; sha256: string }[];
	offices: FultonCountyOffice[];
}

type OfficeDefinition = typeof fultonCountyOfficeholderPublication.offices[number];
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const named = (node: StateHtmlNode, className: string) => stateHtmlAttribute(node, "class").split(/\s+/u).includes(className);
const exact = (value: object, keys: string[]) => Object.keys(value).sort().join(",") === keys.sort().join(",");
function validName(value: unknown): value is string {
	if (typeof value !== "string" || value !== clean(value) || value.length > 160 || !value.includes(" ") || containsControlCharacters(value) || /^(?:unknown|coming soon|to be announced|not available)$/iu.test(value)) return false;
	return /^\p{L}/u.test(value) && Array.from(value).every(character => /^\p{L}$/u.test(character) || /^\p{M}$/u.test(character) || " .'\"()-".includes(character));
}

function main(body: string) {
	const nodes = stateHtmlDescendants(parseStateHtml(body), node => node.nodeName === "main");
	if (nodes.length !== 1) throw new Error("The Fulton county-office publication layout requires review.");
	return nodes[0]!;
}

function oneClass(node: StateHtmlNode, className: string) {
	const nodes = stateHtmlDescendants(node, child => named(child, className));
	if (nodes.length !== 1) throw new Error("The Fulton county-office fields require review.");
	return nodes[0]!;
}

function profileUrl(value: string, office: OfficeDefinition) {
	const url = new URL(value, office.pageUrl);
	if (url.origin !== "https://fultoncountyga.gov" || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(office.profilePrefix) || !/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/u.test(url.pathname.slice(office.profilePrefix.length))) throw new Error("The Fulton county-office profile link requires review.");
	return url.href;
}

function portraitUrl(value: string) {
	const url = new URL(value, "https://fultoncountyga.gov");
	if (url.origin !== "https://fultoncountyga.gov" || url.username || url.password || url.search || url.hash || !/^\/-\/media\/[\w/-]+\.(?:jpg|jpeg|png)$/iu.test(url.pathname) || url.pathname.split("/").includes("..")) throw new Error("The Fulton county-office portrait requires review.");
	return url.href;
}

function profileSlug(url: string) {
	return new URL(url).pathname.split("/").at(-1)!.replace(/^Sheriff-/u, "").toLowerCase();
}

function policyLinks(body: string, url: string) {
	const links = stateHtmlDescendants(parseStateHtml(body), node => node.nodeName === "a" && /privacy|terms of use|copyright|acceptable use|legal notice/iu.test(stateHtmlText(node))).map(node => new URL(stateHtmlAttribute(node, "href"), url).href);
	if (links.length !== 1 || links[0] !== fultonCountyOfficeholderPublication.policies[1]!.url) throw new Error("The Fulton county-office policy link inventory requires review.");
}

export function parseFultonCountyOffice(body: string, office: OfficeDefinition): FultonCountyOffice {
	policyLinks(body, office.pageUrl);
	const content = main(body);
	if (!clean(stateHtmlText(content)).includes("Fulton County")) throw new Error("The county-office jurisdiction requires review.");
	const cards = stateHtmlDescendants(content, node => named(node, "bio-card")).filter(card => stateHtmlDescendants(card, node => named(node, "bio-card__position")).some(node => clean(stateHtmlText(node)) === office.role));
	if (cards.length !== 1) throw new Error("The current county-office leadership requires review.");
	const card = cards[0]!;
	const sourceName = clean(stateHtmlText(oneClass(card, "bio-card__name")));
	if (sourceName === "Vacant") return { id: office.id, status: "vacant" };
	const name = office.id === "sheriff" ? sourceName.replace(/^Sheriff /u, "") : sourceName;
	const links = [...new Set(stateHtmlDescendants(card, node => node.nodeName === "a").map(node => profileUrl(stateHtmlAttribute(node, "href"), office)))];
	const photo = /^background-image: url\(([^()]+)\);$/u.exec(stateHtmlAttribute(oneClass(card, "bio-card__frame"), "style"));
	if (!validName(name) || links.length !== 1 || !photo) throw new Error("The Fulton county-office identity requires review.");
	return { id: office.id, status: "occupied", person: { name, slug: profileSlug(links[0]!), officialWebsiteUrl: links[0]!, portraitUrl: portraitUrl(photo[1]!) } };
}

export function validateFultonCountyOfficeholderSnapshot(value: unknown, now = Date.now()): asserts value is FultonCountyOfficeholderSnapshot {
	if (!value || typeof value !== "object" || Array.isArray(value) || !exact(value, ["schemaVersion", "type", "sourceId", "countyFips", "retrievedAt", "sourceSha256", "documents", "offices"])) throw new Error("The Fulton county-office snapshot fields are invalid.");
	const snapshot = value as FultonCountyOfficeholderSnapshot;
	if (snapshot.schemaVersion !== 1 || snapshot.type !== "fulton-county-officeholders" || snapshot.sourceId !== "ga-fulton-county-offices" || snapshot.countyFips !== "13121" || !Array.isArray(snapshot.offices) || snapshot.offices.length !== 2 || !Array.isArray(snapshot.documents)) throw new Error("The Fulton county-office snapshot identity is invalid.");
	const urls: string[] = fultonCountyOfficeholderPublication.policies.map(policy => policy.url);
	const slugs: string[] = [];
	for (const [index, office] of snapshot.offices.entries()) {
		const definition = fultonCountyOfficeholderPublication.offices[index]!;
		if (!office || !["occupied", "vacant"].includes(office.status) || office.id !== definition.id || !exact(office, office.status === "occupied" ? ["id", "status", "person"] : ["id", "status"])) throw new Error("The Fulton county-office roles are invalid.");
		urls.push(definition.pageUrl);
		if (office.status === "vacant") continue;
		const person = office.person;
		if (!person || !exact(person, ["name", "slug", "officialWebsiteUrl", "portraitUrl"]) || !validName(person.name) || profileUrl(person.officialWebsiteUrl, definition) !== person.officialWebsiteUrl || profileSlug(person.officialWebsiteUrl) !== person.slug || portraitUrl(person.portraitUrl) !== person.portraitUrl) throw new Error("The Fulton county-office person is invalid.");
		urls.push(person.officialWebsiteUrl);
		slugs.push(person.slug);
	}
	if (new Set(slugs).size !== slugs.length || snapshot.documents.length !== urls.length) throw new Error("The Fulton county-office inventory is invalid.");
	for (const [index, document] of snapshot.documents.entries()) {
		if (!document || !exact(document, ["url", "capturedAt", "sha256"]) || document.url !== urls[index] || typeof document.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(document.sha256) || typeof document.capturedAt !== "string" || !Number.isFinite(Date.parse(document.capturedAt)) || Date.parse(document.capturedAt) > now) throw new Error("The Fulton county-office provenance is invalid.");
	}
	if (snapshot.retrievedAt !== new Date(Math.min(...snapshot.documents.map(document => Date.parse(document.capturedAt)))).toISOString() || snapshot.sourceSha256 !== digest(JSON.stringify(snapshot.documents))) throw new Error("The Fulton county-office clocks or digest are invalid.");
}

export function prepareFultonCountyOfficeholders(capture: FultonCountyOfficeholderCapture, now = Date.now()): FultonCountyOfficeholderSnapshot {
	if (!capture || !exact(capture, ["schemaVersion", "type", "documents"]) || capture.schemaVersion !== 1 || capture.type !== "fulton-county-officeholder-capture" || !Array.isArray(capture.documents) || capture.documents.length < 4 || capture.documents.length > 6) throw new Error("The Fulton county-office capture is invalid.");
	for (const [index, document] of capture.documents.entries()) {
		if (!document || !exact(document, ["url", "body", "capturedAt", "sha256"]) || typeof document.body !== "string" || Buffer.byteLength(document.body) > fultonCountyOfficeholderPublication.maximumDocumentBytes || digest(document.body) !== document.sha256) throw new Error("The Fulton county-office capture provenance is invalid.");
		const policy = fultonCountyOfficeholderPublication.policies[index];
		if (policy && (document.url !== policy.url || digest(policy.region === "bytes" ? document.body : clean(stateHtmlText(main(document.body)))) !== policy.sha256)) throw new Error("The Fulton county-office publisher policy requires review.");
	}
	const offices: FultonCountyOffice[] = [];
	let cursor = 2;
	for (const definition of fultonCountyOfficeholderPublication.offices) {
		const department = capture.documents[cursor++];
		if (!department || department.url !== definition.pageUrl) throw new Error("The Fulton county-office publication order is invalid.");
		const office = parseFultonCountyOffice(department.body, definition);
		if (office.person) {
			const profile = capture.documents[cursor++];
			if (!profile || profile.url !== office.person.officialWebsiteUrl) throw new Error("The Fulton county-office profile evidence is incomplete.");
			policyLinks(profile.body, profile.url);
			const content = main(profile.body);
			const sourceName = clean(stateHtmlText(oneClass(content, "name")));
			if ((definition.id === "sheriff" ? sourceName.replace(/^Sheriff /u, "") : sourceName) !== office.person.name || !clean(stateHtmlText(content)).includes("Fulton County") || !clean(stateHtmlText(content)).includes(definition.role)) throw new Error("The county-office publications disagree.");
		}
		offices.push(office);
	}
	if (cursor !== capture.documents.length) throw new Error("The county-office capture contains unrecognized documents.");
	const documents = capture.documents.map(({ url, capturedAt, sha256 }) => ({ url, capturedAt, sha256 }));
	const snapshot: FultonCountyOfficeholderSnapshot = { schemaVersion: 1, type: "fulton-county-officeholders", sourceId: "ga-fulton-county-offices", countyFips: "13121", retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.capturedAt)))).toISOString(), sourceSha256: digest(JSON.stringify(documents)), documents, offices };
	validateFultonCountyOfficeholderSnapshot(snapshot, now);
	return snapshot;
}

export function fultonCountyOfficeholderCsv(snapshot: FultonCountyOfficeholderSnapshot) {
	validateFultonCountyOfficeholderSnapshot(snapshot);
	const quote = (value: string) => `"${value.replace(/"/gu, "\"\"")}"`;
	return `${[["office", "status", "name", "officeWebsite", "portraitUrl", "sourceAsOf"], ...snapshot.offices.map(office => [fultonCountyOfficeholderPublication.offices.find(item => item.id === office.id)!.role, office.status, office.person?.name ?? "", office.person?.officialWebsiteUrl ?? "", office.person?.portraitUrl ?? "", snapshot.retrievedAt])].map(row => row.map(quote).join(",")).join("\n")}\n`;
}
