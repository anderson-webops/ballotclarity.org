import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, open, realpath, unlink } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

const origin = "https://mauicountyvotes.gov";
const indexUrl = `${origin}/charter-amendments`;
const sitemapUrl = `${origin}/sitemap.xml`;
const blogMapUrl = `${origin}/sitemap.blog.xml`;
const maximumBytes = 2 * 1024 * 1024;
const day = 86_400_000;
const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const compact = (value: string) => value.replace(/\s+/gu, " ").trim();
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const articlePattern = /^\/blog\/f\/[a-z0-9-]*maui-county-charter-amendments[a-z0-9-]*$/u;
const resolutionPattern = /^(?:Reso|Resolution)\s+(\d{2}-\d{1,4}(?:,\s*(?:CD|FD)\d){0,3})\b/iu;
const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const counts = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];

export interface MauiCharterAccessReview { reviewedAt: string; robotsSha256: string }
export const mauiCharterAccessReview: MauiCharterAccessReview = {
	reviewedAt: "2026-11-07T05:41:45.411Z",
	robotsSha256: "9a86ee089a1fb815fc825106a39ca06e81cf1ac96ab668adb51ad9b291166a52"
};
interface Capture { url: string; body: string; sha256: string; capturedAt: string }
export interface MauiCharterQuestion { resolution: string; title: string; ballotQuestion: string; resolutionUrl: string; articleUrl: string; publicationDate: string }
export interface MauiCharterCapture {
	schemaVersion: 1;
	type: "maui-charter-measure-capture";
	accessReview: MauiCharterAccessReview;
	documents: Capture[];
}
interface Options {
	fetchDocument?: typeof fetchRemoteSourceDocument;
	now?: () => number;
	sleep?: (milliseconds: number) => Promise<unknown>;
	accessReview?: MauiCharterAccessReview;
}

function page(body: string) {
	if (!body.trim() || Buffer.byteLength(body) > maximumBytes || body.includes("\uFFFD") || /<title[^>]*>[^<]*(?:access denied|just a moment|captcha)/iu.test(body)) throw new Error("Maui source format or access changed.");
	const tree = parseStateHtml(body);
	for (const anchor of stateHtmlDescendants(tree, node => node.nodeName === "a")) {
		const address = stateHtmlAttribute(anchor, "href");
		if (resolutionPattern.test(compact(stateHtmlText(anchor)))) continue;
		if (!address || !/terms|privacy|copyright|legal|polic/iu.test(address + stateHtmlText(anchor))) continue;
		const url = new URL(address, origin);
		if (url.origin === origin || !["https://policies.google.com/privacy", "https://policies.google.com/terms"].includes(url.href)) throw new Error("Review the newly offered Maui publisher policy before collection.");
	}
	return tree;
}

function localUrl(value: string) {
	const url = new URL(value);
	if (url.origin !== origin || url.username || url.password || url.search || url.hash || url.href !== value) throw new Error("Maui discovery requires an exact offered county address.");
	return url;
}

function sitemapLinks(body: string) {
	if (Buffer.byteLength(body) > maximumBytes || /<!DOCTYPE|<!ENTITY|<!\[CDATA\[/iu.test(body) || !/^\s*<\?xml[^>]*>\s*<(?:sitemapindex|urlset)\b/u.test(body)) throw new Error("Maui sitemap format changed.");
	const addresses = [...body.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(match => match[1]!);
	if (!addresses.length || addresses.length > 2000 || new Set(addresses).size !== addresses.length) throw new Error("Maui sitemap inventory changed.");
	for (const address of addresses) localUrl(address);
	return addresses;
}

function resolution(value: string) {
	const match = compact(value).match(resolutionPattern);
	if (!match) throw new Error("Maui resolution identity changed.");
	return match[1]!.toUpperCase().replace(/,\s*/gu, ", ");
}

export function readMauiCharterIndex(body: string) {
	const tree = page(body);
	const headings = stateHtmlDescendants(tree, node => node.nodeName === "h1").map(node => compact(stateHtmlText(node))).filter(text => /^20\d{2} Charter Amendments$/u.test(text));
	if (headings.length !== 1) throw new Error("Maui charter publication needs one explicit election year.");
	const year = Number(headings[0]!.slice(0, 4));
	const documents: { resolution: string; title: string; url: string }[] = [];
	let title = "";
	let headingCount = 0;
	for (const node of stateHtmlDescendants(tree, node => node.nodeName === "h4" || node.nodeName === "a")) {
		if (node.nodeName === "h4") {
			const heading = compact(stateHtmlText(node));
			if (!/^(?:\d+\)\s+)?Maui:\s+/u.test(heading)) continue;
			title = heading.replace(/^(?:\d+\)\s+)?Maui:\s*/u, "");
			headingCount++;
			if (!title || title.length > 250) throw new Error("Maui question title changed.");
			continue;
		}
		const label = compact(stateHtmlText(node));
		if (!resolutionPattern.test(label)) continue;
		const url = new URL(stateHtmlAttribute(node, "href"), origin);
		if (!title || url.protocol !== "https:" || url.hostname !== "img1.wsimg.com" || url.username || url.password || url.port || url.hash
			|| !/^\/blobby\/go\/d625d658-8582-4d35-b9fe-7702a7c85585\/downloads\/[a-f\d-]{36}\/[\w%,. -]+\.pdf$/iu.test(url.pathname)
			|| [...url.searchParams.keys()].join(",") !== "ver" || !/^\d{13}$/u.test(url.searchParams.get("ver") ?? "")) {
			throw new Error("Maui county resolution link changed.");
		}
		documents.push({ resolution: resolution(label), title, url: url.href });
		title = "";
	}
	if (!documents.length || documents.length > 20 || documents.length !== headingCount || new Set(documents.map(document => document.resolution)).size !== documents.length || new Set(documents.map(document => document.url)).size !== documents.length) throw new Error("Maui resolution inventory is incomplete or ambiguous.");
	return { year, documents };
}

function readArticle(body: string, url: string, year: number) {
	const tree = page(body);
	const scripts = stateHtmlDescendants(tree, node => node.nodeName === "script").map(node => (node.childNodes ?? []).map(child => child.value ?? "").join("").trim()).filter(text => text.startsWith("window._BLOG_DATA="));
	if (scripts.length !== 1) throw new Error("Maui article data is missing or ambiguous.");
	const data: unknown = JSON.parse(scripts[0]!.slice("window._BLOG_DATA=".length).replace(/;\s*$/u, ""));
	if (!object(data) || !object(data.head) || data.head.canonicalUrl !== url || !object(data.post) || typeof data.post.publishedDate !== "string" || typeof data.post.fullContent !== "string") throw new Error("Maui article identity changed.");
	const publishedAt = data.post.publishedDate;
	if (!Number.isFinite(Date.parse(publishedAt)) || new Date(publishedAt).toISOString() !== publishedAt) throw new Error("Maui article publication date changed.");
	if (Number(publishedAt.slice(0, 4)) !== year) return null;
	const content: unknown = JSON.parse(data.post.fullContent);
	if (!object(content) || !Array.isArray(content.blocks) || content.blocks.length > 200 || content.blocks.some(block => !object(block) || typeof block.text !== "string" || block.text.length > 10_000)) throw new Error("Maui article content changed.");
	const blocks = content.blocks.map(block => compact(block.text));
	const declarations = blocks.filter(text => /general election ballot will include/iu.test(text));
	const date = declarations.length === 1 ? declarations[0]!.match(/\b(20\d{2})\)[\s\S]{0,200}?\b([A-Z][a-z]+)\.?\s+(\d{1,2})\s+general election ballot will include\s+([a-z]+|\d{1,2})\s+proposed amendments to the Maui County Charter\./u) : null;
	if (!date || Number(date[1]) !== year) throw new Error("Maui election date and measure count need explicit county evidence.");
	const month = months.indexOf(date[2]!.slice(0, 3).toLowerCase()) + 1;
	const electionDate = `${year}-${String(month).padStart(2, "0")}-${date[3]!.padStart(2, "0")}`;
	if (!month || !Number.isFinite(Date.parse(electionDate)) || new Date(electionDate).toISOString().slice(0, 10) !== electionDate || publishedAt.slice(0, 10) > electionDate) throw new Error("Maui election calendar evidence conflicts.");
	const count = /^\d+$/u.test(date[4]!) ? Number(date[4]) : counts.indexOf(date[4]!.toLowerCase());
	const questions = blocks.filter(text => resolutionPattern.test(text)).map((text) => {
		const match = text.match(/^[\s\S]*?:\s*[“"](Shall the Charter[\s\S]+\?)[”"]$/u);
		if (!match || match[1]!.length > 4000) throw new Error("Maui official question text changed.");
		return { resolution: resolution(text), ballotQuestion: match[1]! };
	});
	if (!questions.length || questions.length !== count || questions.length > 20 || blocks.filter(text => /Shall the Charter/u.test(text)).length !== questions.length || new Set(questions.map(question => question.resolution)).size !== questions.length) throw new Error("Maui official question inventory is incomplete or ambiguous.");
	return { electionDate, publicationDate: publishedAt.slice(0, 10), questions };
}

export function readMauiCharterCapture(value: unknown, now = Date.now()) {
	if (!object(value) || value.schemaVersion !== 1 || value.type !== "maui-charter-measure-capture" || !object(value.accessReview) || !Array.isArray(value.documents) || value.documents.length < 5 || value.documents.length > 12) throw new Error("Provide a bounded Maui county charter capture.");
	const captured = new Map<string, Capture>();
	for (const raw of value.documents) {
		if (!object(raw) || typeof raw.url !== "string" || typeof raw.body !== "string" || Buffer.byteLength(raw.body) > maximumBytes || raw.sha256 !== hash(raw.body) || typeof raw.capturedAt !== "string" || !Number.isFinite(Date.parse(raw.capturedAt)) || new Date(raw.capturedAt).toISOString() !== raw.capturedAt || Date.parse(raw.capturedAt) > now || captured.has(raw.url)) throw new Error("Maui capture hashes, dates or identities changed.");
		localUrl(raw.url);
		captured.set(raw.url, raw as unknown as Capture);
	}
	const review = value.accessReview;
	const robots = captured.get(`${origin}/robots.txt`);
	if (!robots || review.robotsSha256 !== robots.sha256 || typeof review.reviewedAt !== "string" || !Number.isFinite(Date.parse(review.reviewedAt)) || Date.parse(review.reviewedAt) > Date.parse(robots.capturedAt) || Date.parse(robots.capturedAt) - Date.parse(review.reviewedAt) > 30 * day) throw new Error("Maui publisher access review is missing or expired.");
	const policy = electionDocumentRobotsPolicy(Buffer.from(robots.body));
	if ([...captured.keys()].some(url => !policy.allowed(url))) throw new Error("Maui robots policy excludes a captured page.");
	const index = captured.get(indexUrl);
	const sitemap = captured.get(sitemapUrl);
	const blogMap = captured.get(blogMapUrl);
	if (!index || !sitemap || !blogMap || !robots.body.includes(`Sitemap: ${sitemapUrl}`) || !sitemapLinks(sitemap.body).includes(blogMapUrl)) throw new Error("Maui discovery provenance is incomplete.");
	const charter = readMauiCharterIndex(index.body);
	const addresses = sitemapLinks(blogMap.body).filter(url => articlePattern.test(new URL(url).pathname));
	if (!addresses.length || addresses.length > 8 || captured.size !== 4 + addresses.length || addresses.some(address => !captured.has(address))) throw new Error("Maui article discovery inventory changed.");
	const articles = addresses.flatMap((url) => {
		const article = readArticle(captured.get(url)!.body, url, charter.year);
		if (article && article.publicationDate > captured.get(url)!.capturedAt.slice(0, 10)) throw new Error("Maui publication date is in the future.");
		return article ? [{ ...article, url }] : [];
	});
	if (articles.length !== 1) throw new Error("Maui election publication is missing or ambiguous.");
	const article = articles[0]!;
	if (article.questions.length !== charter.documents.length || article.questions.some(question => !charter.documents.some(document => document.resolution === question.resolution))) throw new Error("Maui article and resolution inventory disagree.");
	const questions: MauiCharterQuestion[] = charter.documents.map(document => ({ resolution: document.resolution, title: document.title, ballotQuestion: article.questions.find(question => question.resolution === document.resolution)!.ballotQuestion, resolutionUrl: document.url, articleUrl: article.url, publicationDate: article.publicationDate }));
	return { schemaVersion: 1, type: "maui-charter-measure-inventory", stateCode: "HI", jurisdiction: { jurisdictionType: "county", name: "Maui County", slug: "hi-maui-county" }, electionDate: article.electionDate, questions, publicationApproved: false, automaticImportApproved: false, resultsInferred: false };
}

export async function fetchMauiCharterCapture(options: Options = {}): Promise<MauiCharterCapture> {
	const now = options.now ?? Date.now;
	const accessReview = options.accessReview ?? mauiCharterAccessReview;
	const documents: Capture[] = [];
	let policy: ReturnType<typeof electionDocumentRobotsPolicy> | undefined;
	async function capture(url: string, format: "text/plain" | "text/html" | "xml") {
		localUrl(url);
		if (policy && !policy.allowed(url)) throw new Error("Maui robots policy excludes the offered source.");
		if (documents.length) await (options.sleep ?? setTimeout)(policy?.delay ?? 11_000);
		const response = await (options.fetchDocument ?? fetchRemoteSourceDocument)(url, { allowedHosts: ["mauicountyvotes.gov"], maxBytes: maximumBytes, timeoutMs: 20_000 });
		if (response.status !== 200 || (format === "xml" ? !["application/xml", "text/xml"].includes(response.contentType) : response.contentType !== format) || response.body.length > maximumBytes) throw new Error("Maui publisher denied the request or changed format; collection stopped.");
		const body = new TextDecoder("utf-8", { fatal: true }).decode(response.body);
		documents.push({ url, body, sha256: hash(body), capturedAt: new Date(now()).toISOString() });
		return body;
	}
	const robots = await capture(`${origin}/robots.txt`, "text/plain");
	if (hash(robots) !== accessReview.robotsSha256 || !Number.isFinite(Date.parse(accessReview.reviewedAt)) || Date.parse(accessReview.reviewedAt) > now() || now() - Date.parse(accessReview.reviewedAt) > 30 * day) throw new Error("Maui publisher access review is missing, changed or expired.");
	policy = electionDocumentRobotsPolicy(Buffer.from(robots));
	if (!robots.includes(`Sitemap: ${sitemapUrl}`)) throw new Error("Maui sitemap is no longer offered by the publisher.");
	readMauiCharterIndex(await capture(indexUrl, "text/html"));
	if (!sitemapLinks(await capture(sitemapUrl, "xml")).includes(blogMapUrl)) throw new Error("Maui blog sitemap is no longer offered by the publisher.");
	const addresses = sitemapLinks(await capture(blogMapUrl, "xml")).filter(url => articlePattern.test(new URL(url).pathname));
	if (!addresses.length || addresses.length > 8) throw new Error("Maui charter article discovery requires review.");
	for (const address of addresses) await capture(address, "text/html");
	const result: MauiCharterCapture = { schemaVersion: 1, type: "maui-charter-measure-capture", accessReview, documents };
	readMauiCharterCapture(result, now());
	return result;
}

export async function writeMauiCharterCapture(directory: string, capture: MauiCharterCapture, now = Date.now()) {
	const inventory = readMauiCharterCapture(capture, now);
	assertExternalStateDataDirectory(directory);
	await mkdir(directory, { recursive: true, mode: 0o700 });
	const canonical = await realpath(directory);
	assertExternalStateDataDirectory(canonical);
	if (canonical !== directory) throw new Error("Maui collection storage must use its unlinked physical path.");
	const body = Buffer.from(`${JSON.stringify({ inventory, capture }, null, 2)}\n`);
	if (body.length > 12 * 1024 * 1024) throw new Error("Maui collection exceeds its storage bound.");
	const sha256 = hash(body);
	const path = join(canonical, `maui-charter-${inventory.electionDate}-${sha256}.json`);
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
		finally { await parent.close(); }
	}
	finally {
		await handle.close().catch(() => {});
		await unlink(temporary);
	}
	return { path, sha256, questions: inventory.questions.length, electionDate: inventory.electionDate, imported: false, published: false };
}
