import type { StateHtmlNode } from "./state-ballot-html.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { fultonPolicyReceipts } from "./state-ballot-fulton.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

export const fultonOfficeholderPublication = {
	sourceId: "ga-fulton-board",
	countyFips: "13121",
	rosterUrl: "https://fultoncountyga.gov/commissioners",
	districtUrl: "https://fultoncountyga.gov/Commission-District-Finder",
	policies: fultonPolicyReceipts.slice(0, 2),
	minimumRefreshIntervalMs: 6 * 60 * 60 * 1000,
	maximumDocumentBytes: 3 * 1024 * 1024,
} as const;

export interface FultonOfficeholderCapture {
	schemaVersion: 1;
	type: "fulton-officeholder-capture";
	documents: { url: string; body: string; capturedAt: string; sha256: string }[];
}

export interface FultonBoardSeat {
	district: number | null;
	status: "occupied" | "vacant";
	person?: {
		name: string;
		slug: string;
		officialWebsiteUrl: string;
		portraitUrl: string;
		viceChair: boolean;
	};
}

export interface FultonOfficeholderSnapshot {
	schemaVersion: 1;
	type: "fulton-officeholders";
	sourceId: "ga-fulton-board";
	countyFips: "13121";
	retrievedAt: string;
	sourceSha256: string;
	documents: { url: string; capturedAt: string; sha256: string }[];
	seats: FultonBoardSeat[];
}

const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const named = (node: StateHtmlNode, className: string) => stateHtmlAttribute(node, "class").split(/\s+/u).includes(className);
const urls = [...fultonOfficeholderPublication.policies.map(item => item.url), fultonOfficeholderPublication.rosterUrl, fultonOfficeholderPublication.districtUrl];
const validText = (value: unknown): value is string => typeof value === "string" && value === clean(value) && value.length > 1 && value.length <= 200 && !/^[=+@-]/u.test(value) && !containsControlCharacters(value);
const exact = (value: object, keys: string[]) => Object.keys(value).sort().join(",") === keys.sort().join(",");
function asMain(body: string) {
	const nodes = stateHtmlDescendants(parseStateHtml(body), node => node.nodeName === "main");
	if (nodes.length !== 1) throw new Error("The Fulton officeholder publication layout requires review.");
	return nodes[0]!;
}

function oneClass(node: StateHtmlNode, className: string) {
	const nodes = stateHtmlDescendants(node, child => named(child, className));
	if (nodes.length !== 1) throw new Error("The Fulton officeholder card fields require review.");
	return nodes[0]!;
}

function publicUrl(value: string, portrait = false) {
	const url = new URL(value, "https://fultoncountyga.gov");
	const path = portrait ? /^\/-\/media\/[\w./%-]+\.(?:jpg|jpeg|png)$/iu : /^\/Commissioners\/[A-Za-z0-9-]+$/u;
	if (url.origin !== "https://fultoncountyga.gov" || url.username || url.password || url.search || url.hash || !path.test(url.pathname) || decodeURIComponent(url.pathname).split("/").includes(".."))
		throw new Error("The Fulton officeholder public link requires review.");
	return url.href;
}

function sourceDigest(documents: FultonOfficeholderSnapshot["documents"]) {
	return digest(JSON.stringify(documents));
}

export function validateFultonOfficeholderSnapshot(value: unknown, now = Date.now()): asserts value is FultonOfficeholderSnapshot {
	if (!value || typeof value !== "object" || Array.isArray(value) || !exact(value, ["schemaVersion", "type", "sourceId", "countyFips", "retrievedAt", "sourceSha256", "documents", "seats"])) throw new Error("The Fulton officeholder snapshot fields are invalid.");
	const snapshot = value as FultonOfficeholderSnapshot;
	if (snapshot.schemaVersion !== 1 || snapshot.type !== "fulton-officeholders" || snapshot.sourceId !== "ga-fulton-board" || snapshot.countyFips !== "13121" || !Array.isArray(snapshot.documents) || snapshot.documents.length !== urls.length || !Array.isArray(snapshot.seats) || snapshot.seats.length !== 7)
		throw new Error("The Fulton officeholder snapshot identity is invalid.");
	for (const [index, document] of snapshot.documents.entries()) {
		if (!document || !exact(document, ["url", "capturedAt", "sha256"]) || document.url !== urls[index] || typeof document.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(document.sha256) || typeof document.capturedAt !== "string" || !Number.isFinite(Date.parse(document.capturedAt)) || Date.parse(document.capturedAt) > now)
			throw new Error("The Fulton officeholder document provenance is invalid.");
	}
	if (snapshot.retrievedAt !== new Date(Math.min(...snapshot.documents.map(item => Date.parse(item.capturedAt)))).toISOString() || snapshot.sourceSha256 !== sourceDigest(snapshot.documents)) throw new Error("The Fulton officeholder capture clocks are invalid.");
	const slugs: string[] = [];
	for (const [index, seat] of snapshot.seats.entries()) {
		if (!seat || !exact(seat, seat.status === "occupied" ? ["district", "status", "person"] : ["district", "status"]) || seat.district !== (index === 0 ? null : index) || !["occupied", "vacant"].includes(seat.status)) throw new Error("The Fulton officeholder seats are invalid.");
		if (seat.status === "vacant") continue;
		const person = seat.person;
		if (!person || !exact(person, ["name", "slug", "officialWebsiteUrl", "portraitUrl", "viceChair"]) || !validText(person.name) || person.name.toLowerCase() === "vacant" || typeof person.viceChair !== "boolean" || (seat.district === null && person.viceChair) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(person.slug) || person.slug !== new URL(publicUrl(person.officialWebsiteUrl)).pathname.split("/").at(-1)!.toLowerCase() || publicUrl(person.officialWebsiteUrl) !== person.officialWebsiteUrl || publicUrl(person.portraitUrl, true) !== person.portraitUrl)
			throw new Error("The Fulton officeholder identity or public links are invalid.");
		slugs.push(person.slug);
	}
	if (new Set(slugs).size !== slugs.length || snapshot.seats.filter(seat => seat.person?.viceChair).length > 1) throw new Error("The Fulton officeholder identities are ambiguous.");
}

export function parseFultonBoardSeats(rosterBody: string, districtBody: string): FultonBoardSeat[] {
	const roster = asMain(rosterBody);
	if (!clean(stateHtmlText(roster)).includes("seven-member Board of Commissioners") || !clean(stateHtmlText(roster)).includes("representing all of Fulton County")) throw new Error("The Fulton board size or at-large scope requires review.");
	for (const [url, body] of [[fultonOfficeholderPublication.rosterUrl, rosterBody], [fultonOfficeholderPublication.districtUrl, districtBody]]) {
		const policies = stateHtmlDescendants(parseStateHtml(body!), node => node.nodeName === "a" && /privacy/iu.test(stateHtmlText(node))).map(node => new URL(stateHtmlAttribute(node, "href"), url).href);
		if (policies.length !== 1 || policies[0] !== fultonOfficeholderPublication.policies[1]!.url) throw new Error("The Fulton officeholder policy link inventory requires review.");
	}
	const finder = asMain(districtBody);
	if (stateHtmlDescendants(finder, node => node.nodeName === "h3").some(node => /^District \d/u.test(clean(stateHtmlText(node))) && !/^District [1-6] - .+$/u.test(clean(stateHtmlText(node))))) throw new Error("The Fulton district roster contains an unrecognized seat.");
	const districtHeadings = stateHtmlDescendants(finder, node => node.nodeName === "h3").map(node => /^District ([1-6]) - (.+)$/u.exec(clean(stateHtmlText(node)))).filter(match => match !== null);
	if (districtHeadings.length !== 6 || new Set(districtHeadings.map(match => match[1])).size !== 6) throw new Error("The Fulton district roster requires review.");
	const seats = new Map<number | null, FultonBoardSeat>();
	for (const card of stateHtmlDescendants(roster, node => named(node, "bio-card"))) {
		const rawName = clean(stateHtmlText(oneClass(card, "bio-card__name")));
		const position = clean(stateHtmlText(oneClass(card, "bio-card__position")));
		const district = /^District ([1-6])$/u.exec(position);
		if (!district && !/^(?:Chairman|Chairwoman|Chair)$/u.test(position)) throw new Error("The Fulton officeholder role requires review.");
		const districtNumber = district ? Number(district[1]) : null;
		if (seats.has(districtNumber)) throw new Error("The Fulton officeholder seat is repeated.");
		if (rawName === "Vacant") {
			seats.set(districtNumber, { district: districtNumber, status: "vacant" });
			continue;
		}
		const name = rawName.replace(/^Vice Chair /u, "");
		const links = [...new Set(stateHtmlDescendants(card, node => node.nodeName === "a").map(node => publicUrl(stateHtmlAttribute(node, "href"))))];
		const photo = /^background-image: url\(([^()]+)\);$/u.exec(stateHtmlAttribute(oneClass(card, "bio-card__frame"), "style"));
		if (!photo || links.length !== 1 || !validText(name)) throw new Error("The Fulton officeholder card requires review.");
		seats.set(districtNumber, { district: districtNumber, status: "occupied", person: { name, slug: new URL(links[0]!).pathname.split("/").at(-1)!.toLowerCase(), officialWebsiteUrl: links[0]!, portraitUrl: publicUrl(photo[1]!, true), viceChair: rawName !== name } });
	}
	if (!seats.has(null)) throw new Error("The Fulton chair record requires review.");
	for (const heading of districtHeadings) {
		const district = Number(heading[1]);
		const name = heading[2]!;
		const seat = seats.get(district);
		if (name === "Vacant" && !seat) seats.set(district, { district, status: "vacant" });
		else if (!seat || (name === "Vacant" ? seat.status !== "vacant" : seat.status !== "occupied" || seat.person!.name !== name)) throw new Error("The Fulton officeholder publications disagree.");
	}
	return [seats.get(null)!, ...[1, 2, 3, 4, 5, 6].map(district => seats.get(district)!)];
}

export function prepareFultonOfficeholders(capture: FultonOfficeholderCapture, now = Date.now()): FultonOfficeholderSnapshot {
	if (!capture || !exact(capture, ["schemaVersion", "type", "documents"]) || capture.schemaVersion !== 1 || capture.type !== "fulton-officeholder-capture" || !Array.isArray(capture.documents) || capture.documents.length !== urls.length) throw new Error("The Fulton officeholder capture is invalid.");
	for (const [index, document] of capture.documents.entries()) {
		if (!document || !exact(document, ["url", "body", "capturedAt", "sha256"]) || document.url !== urls[index] || typeof document.body !== "string" || Buffer.byteLength(document.body) > fultonOfficeholderPublication.maximumDocumentBytes || digest(document.body) !== document.sha256)
			throw new Error("The Fulton officeholder capture provenance is invalid.");
		const policy = fultonOfficeholderPublication.policies[index];
		if (policy && digest(policy.region === "bytes" ? document.body : clean(stateHtmlText(asMain(document.body)))) !== policy.sha256) throw new Error("The Fulton officeholder publisher policy requires review.");
	}
	const seats = parseFultonBoardSeats(capture.documents[2]!.body, capture.documents[3]!.body);
	const documents = capture.documents.map(({ url, capturedAt, sha256 }) => ({ url, capturedAt, sha256 }));
	const snapshot: FultonOfficeholderSnapshot = { schemaVersion: 1, type: "fulton-officeholders", sourceId: "ga-fulton-board", countyFips: "13121", retrievedAt: new Date(Math.min(...documents.map(item => Date.parse(item.capturedAt)))).toISOString(), sourceSha256: sourceDigest(documents), documents, seats };
	validateFultonOfficeholderSnapshot(snapshot, now);
	return snapshot;
}

export function fultonOfficeholderCsv(snapshot: FultonOfficeholderSnapshot) {
	validateFultonOfficeholderSnapshot(snapshot);
	const quote = (value: string) => `"${value.replace(/"/gu, "\"\"")}"`;
	return `${[["seat", "status", "name", "officeWebsite", "portraitUrl", "sourceAsOf"], ...snapshot.seats.map(seat => [seat.district === null ? "Chair" : `District ${seat.district}`, seat.status, seat.person?.name ?? "", seat.person?.officialWebsiteUrl ?? "", seat.person?.portraitUrl ?? "", snapshot.retrievedAt])].map(row => row.map(quote).join(",")).join("\n")}\n`;
}
