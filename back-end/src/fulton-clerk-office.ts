import type { StateHtmlNode } from "./state-ballot-html.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

const origin = "https://www.fultonclerk.org";
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export const fultonClerkPublication = {
	url: `${origin}/`,
	aboutUrl: `${origin}/101/About-Us`,
	minimumRequestIntervalMs: 20000,
	maximumCaptureBytes: 16 * 1024 * 1024,
	policies: [
		{ url: `${origin}/robots.txt`, sha256: "9340481a0af59414fd114f3a9e8048f4ba2b91d3c6ee20dcfec607beed7b3892" },
		{ url: `${origin}/site/copyright`, sha256: "7eafd5a52e355d2a7df221514420c351b3f4349d82396858f8f03e29bf8059f4" },
		{ url: `${origin}/182/Legal-Disclaimer`, sha256: "5b8a9b813e6342d0e6272675c0271c2ba39367275ad0d069cffb041ec6c01e9f" }
	]
} as const;

export interface FultonClerkPerson {
	name: string;
	slug: string;
	officialWebsiteUrl: string;
}

function reject(): never {
	throw new Error("The Fulton Clerk publication requires review.");
}

function document(body: string) {
	if (typeof body !== "string" || Buffer.byteLength(body) > 3 * 1024 * 1024 || body.includes("\uFFFD")) return reject();
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

function policyInventory(root: StateHtmlNode, url: string) {
	const links = stateHtmlDescendants(root, node => node.nodeName === "a" && /privacy|terms|copyright|disclaimer|acceptable use|legal notice/iu.test(stateHtmlText(node))).filter(node => !(clean(stateHtmlText(node)) === "Glossary of Legal Terms" && new URL(stateHtmlAttribute(node, "href"), url).href === `${origin}/161/Glossary-of-Legal-Terms`)).map(node => new URL(stateHtmlAttribute(node, "href"), url).href).sort();
	const expected: string[] = [fultonClerkPublication.policies[1].url];
	if (fultonClerkPublication.policies.slice(1).some(policy => policy.url === url)) expected.push(fultonClerkPublication.policies[2].url);
	if (JSON.stringify(links) !== JSON.stringify(expected.sort())) return reject();
}

export function verifyFultonClerkPolicy(body: string, index: number, now = Date.now()) {
	const policy = fultonClerkPublication.policies[index];
	if (!policy || !Number.isFinite(now) || typeof body !== "string" || Buffer.byteLength(body) > 3 * 1024 * 1024) return reject();
	if (index === 0) {
		if (digest(body) !== policy.sha256) return reject();
		return;
	}
	const root = document(body);
	policyInventory(root, policy.url);
	const text = clean(stateHtmlText(content(root)));
	if (index === 2) {
		if (digest(text) !== policy.sha256) return reject();
		return;
	}
	const years = [...text.matchAll(/© (1997|2006)-(20\d{2})/gu)];
	if (years.length !== 2 || years[0]![1] !== "1997" || years[1]![1] !== "2006" || years[0]![2] !== years[1]![2] || Number(years[0]![2]) > new Date(now).getUTCFullYear() + 1 || digest(text.replace(/(© (?:1997|2006)-)20\d{2}/gu, "$1YEAR")) !== policy.sha256) return reject();
}

export function fultonClerkProfileUrl(value: string) {
	const url = new URL(value, origin);
	if (url.origin !== origin || url.username || url.password || url.search || url.hash || !/^\/[1-9]\d{0,4}\/Meet-Clerk-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/u.test(url.pathname)) return reject();
	return url.href;
}

function currentClerk(root: StateHtmlNode) {
	const statements = stateHtmlDescendants(root, node => node.nodeName === "p").map(node => /^Led by the Honorable (.+?), we welcome you to the Office of the Fulton County Clerk of Superior and Magistrate Courts,/u.exec(clean(stateHtmlText(node)))).filter(value => value !== null);
	if (statements.length !== 1) return reject();
	const name = clean(statements[0]![1]!);
	if (!name.includes(" ") || name.length > 160 || containsControlCharacters(name) || !/^\p{L}[\p{L}\p{M} .,'()-]+$/u.test(name) || /^(?:unknown|vacant|coming soon|to be announced|not available)$/iu.test(name)) return reject();
	return name;
}

export function parseFultonClerk(home: string, about: string): FultonClerkPerson {
	const homeRoot = document(home);
	const aboutRoot = document(about);
	policyInventory(homeRoot, fultonClerkPublication.url);
	policyInventory(aboutRoot, fultonClerkPublication.aboutUrl);
	const name = currentClerk(homeRoot);
	if (currentClerk(aboutRoot) !== name) return reject();
	const heading = stateHtmlDescendants(homeRoot, node => node.nodeName === "h1" && clean(stateHtmlText(node)) === "THE FULTON COUNTY CLERK OF SUPERIOR AND MAGISTRATE COURTS");
	const aboutLinks = [...new Set(stateHtmlDescendants(homeRoot, node => node.nodeName === "a" && clean(stateHtmlText(node)) === "About Us").map(node => new URL(stateHtmlAttribute(node, "href"), origin).href))];
	if (heading.length !== 1 || aboutLinks.length !== 1 || aboutLinks[0] !== fultonClerkPublication.aboutUrl) return reject();
	const links = stateHtmlDescendants(aboutRoot, node => node.nodeName === "a" && clean(stateHtmlText(node)).startsWith("Meet Clerk,"));
	if (links.length !== 1 || clean(stateHtmlText(links[0]!)) !== `Meet Clerk, ${name}`) return reject();
	const officialWebsiteUrl = fultonClerkProfileUrl(stateHtmlAttribute(links[0]!, "href"));
	const slug = name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
	if (!slug) return reject();
	return { name, slug, officialWebsiteUrl };
}

export function verifyFultonClerkProfile(body: string, person: FultonClerkPerson) {
	const root = document(body);
	policyInventory(root, fultonClerkProfileUrl(person.officialWebsiteUrl));
	const headings = stateHtmlDescendants(root, node => node.nodeName === "h1");
	if (headings.length !== 1 || clean(stateHtmlText(headings[0]!)) !== `Meet Clerk, ${person.name}` || !/Clerk of (?:the )?Superior (?:&|and) Magistrate Courts? of Fulton County/u.test(clean(stateHtmlText(content(root))))) return reject();
}
