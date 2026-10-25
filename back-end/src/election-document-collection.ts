import type { ElectionDocumentSource } from "./election-document-sources.js";
import type { StateHtmlNode } from "./state-ballot-html.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readdir, realpath, rename, unlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { electionDocumentSources } from "./election-document-sources.js";
import { fetchRemoteSourceDocument, RemoteSourceDocumentPolicyError } from "./remote-json-source.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";
import { assertExternalStateDataDirectory, readBoundedStateData, readBoundedStateDataBytes } from "./state-ballot-storage.js";

const day = 86_400_000;
const maximumBytes = 12 * 1024 * 1024;
const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const validHash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const validDate = (value: unknown, now: number): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now;
const objectValue = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const exact = (value: object, keys: string[]) => Object.keys(value).sort().join(",") === keys.sort().join(",");

export interface ElectionDocumentPlan {
	schemaVersion: 1;
	type: "election-document-collection";
	sourceIds: string[];
	cacheDirectory: string;
	outputRoot: string;
	accessReviews: { sourceId: string; reviewedAt: string; configurationSha256: string; policyFingerprints: Record<string, string> }[];
}

export interface ElectionDocumentSeed {
	schemaVersion: 1;
	type: "election-document-seed";
	captures: { sourceId: string; url: string; path: string; sha256: string; capturedAt: string; etag?: string }[];
}

interface CollectionOptions {
	now?: () => number;
	sleep?: (milliseconds: number) => Promise<void>;
	fetchDocument?: typeof fetchRemoteSourceDocument;
}

interface Capture {
	schemaVersion: 1;
	sourceId: string;
	configurationSha256: string;
	url: string;
	sha256: string;
	capturedAt: string;
	checkedAt: string;
	etag?: string;
}

class CollectionFailure extends Error {
	constructor(readonly reason: string, readonly status?: number) { super(`Election document collection stopped: ${reason}.`); }
}

export const electionDocumentConfigurationSha256 = (source: ElectionDocumentSource) => hash(JSON.stringify(source));

export function electionDocumentPublisherHosts(source: ElectionDocumentSource) {
	validateRelativeRobotsDisallows(source.relativeRobotsDisallows);
	validateDocumentBounds(source);
	if (source.repeatWildcardGroup !== undefined && source.repeatWildcardGroup !== true) throw new CollectionFailure("robots-group-review-required");
	if (source.policies.some(policy => policy.otherRobotsAgents !== undefined && (policy.format !== "robots" || !Array.isArray(policy.otherRobotsAgents)))) throw new CollectionFailure("robots-group-review-required");
	if (source.documentFormat === undefined && source.documentDateMarkers !== undefined)
		throw new Error("HTML election markers cannot be applied to a default PDF source.");
	if (source.documentFormat !== undefined && (source.documentFormat !== "html" || !Array.isArray(source.documentDateMarkers) || !source.documentDateMarkers.length || source.documentDateMarkers.length > 10 || source.documentDateMarkers.some(marker => typeof marker !== "string" || !marker.trim() || marker.length > 250)))
		throw new Error("HTML document sources require explicit bounded election markers.");
	const addresses = [source.indexUrl, ...source.policies.map(policy => policy.url)];
	const urls = addresses.map(address => new URL(address));
	if (urls.some((url, index) => url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash || url.href !== addresses[index]) || urls[0]!.hostname !== source.host || new Set(source.policies.map(policy => policy.id)).size !== source.policies.length)
		throw new Error("Document publishers require exact public HTTPS addresses and unique policy identities.");
	const hosts = [...new Set(urls.map(url => url.hostname))];
	for (const host of hosts) {
		const robots = source.policies.filter(policy => policy.format === "robots" && new URL(policy.url).hostname === host);
		if (robots.length !== 1 || new URL(robots[0]!.url).pathname !== "/robots.txt")
			throw new Error("Every configured document publisher host requires exactly one robots policy.");
	}
	return hosts;
}

function validateDocumentBounds(source: ElectionDocumentSource) {
	if (source.selectDocumentOptions !== undefined && source.selectDocumentOptions !== true) throw new CollectionFailure("document-option-review-required");
	if (!Number.isSafeInteger(source.maximumDocuments) || source.maximumDocuments < 1 || source.maximumDocuments > 100 || (source.minimumDocuments !== undefined && (!Number.isSafeInteger(source.minimumDocuments) || source.minimumDocuments < 1 || source.minimumDocuments > source.maximumDocuments))) throw new CollectionFailure("document-count-review-required");
	const paths = source.encodedDocumentPaths ?? [];
	if (!Array.isArray(paths) || paths.length > source.maximumDocuments || new Set(paths).size !== paths.length) throw new CollectionFailure("document-path-review-required");
	for (const path of paths) {
		if (typeof path !== "string" || !path.startsWith("/") || !path.includes("%") || /%(?!20|26)/u.test(path)) throw new CollectionFailure("document-path-review-required");
		const url = new URL(path, `https://${source.host}`);
		if (url.hostname !== source.host || url.pathname !== path || url.search || url.hash || url.username || url.password || url.port) throw new CollectionFailure("document-path-review-required");
	}
	const addresses = source.reviewedDocumentUrls ?? [];
	if (!Array.isArray(addresses) || (source.reviewedDocumentUrls !== undefined && !addresses.length) || addresses.length > source.maximumDocuments || new Set(addresses).size !== addresses.length) throw new CollectionFailure("document-query-review-required");
	for (const address of addresses) {
		let url: URL;
		try {
			url = new URL(address);
		}
		catch { throw new CollectionFailure("document-query-review-required"); }
		const queryKeys = [...url.searchParams.keys()].sort().join(",");
		const revisionQuery = queryKeys === "hash,rev" && /^[a-f\d]{32}$/iu.test(url.searchParams.get("rev") ?? "") && /^[a-f\d]{32}$/iu.test(url.searchParams.get("hash") ?? "");
		const englishAssetQuery = queryKeys === "language" && url.searchParams.get("language") === "en"
			&& /^\/getContentAsset\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\/[\w.-]+\.pdf$/iu.test(url.pathname);
		if (typeof address !== "string" || url.href !== address || url.protocol !== "https:" || url.hostname !== source.host || url.username || url.password || url.port || url.hash
			|| url.search.includes("%") || (!revisionQuery && !englishAssetQuery)
			|| !source.documentPatterns.some(pattern => new RegExp(pattern, "u").test(url.pathname))) {
			throw new CollectionFailure("document-query-review-required");
		}
	}
}

function html(body: Uint8Array) {
	if (body.byteLength > 2 * 1024 * 1024) throw new CollectionFailure("html-size-limit");
	const document = parseStateHtml(new TextDecoder("utf-8", { fatal: true }).decode(body));
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		if (++visited > 80_000 || depth > 64) throw new CollectionFailure("html-structure-limit");
		for (const child of node.childNodes ?? []) pending.push({ node: child, depth: depth + 1 });
	}
	return document;
}

function policyLinks(document: StateHtmlNode, address: string) {
	return [...new Set(stateHtmlDescendants(document, node => node.nodeName === "a").filter(node => /privacy|disclaimer|copyright|licen[cs]e|terms|polic(?:y|ies)/iu.test(`${stateHtmlText(node)} ${stateHtmlAttribute(node, "href")}`)).map(node => new URL(stateHtmlAttribute(node, "href"), address).href))].sort();
}

function mainText(node: StateHtmlNode): string {
	if (["script", "style", "noscript", "template", "form"].includes(node.nodeName)) return "";
	if (node.nodeName === "#text") return node.value ?? "";
	const address = node.nodeName === "a" ? ` ${stateHtmlAttribute(node, "href")} ` : "";
	return address + (node.childNodes ?? []).map(mainText).join(" ");
}

export function electionDocumentPolicyFingerprint(body: Uint8Array, format: ElectionDocumentSource["policies"][number]["format"], address: string, regionId?: string, regionClass?: string) {
	if (format === "robots") return hash(new TextDecoder("utf-8", { fatal: true }).decode(body).replace(/\r\n/gu, "\n").trim());
	if (format === "pdf") {
		if (body.byteLength < 6 || body.byteLength > maximumBytes || Buffer.from(body).subarray(0, 5).toString("ascii") !== "%PDF-") throw new CollectionFailure("policy-pdf-invalid");
		return hash(body);
	}
	const document = html(body);
	if (format === "links") return hash(JSON.stringify({ links: policyLinks(document, address), footers: stateHtmlDescendants(document, node => node.nodeName === "footer" || stateHtmlAttribute(node, "role") === "contentinfo" || /(?:^|\s)(?:site-)?footer(?:\s|$)/u.test(stateHtmlAttribute(node, "class"))).map(node => mainText(node).replace(/\s+/gu, " ").trim()) }));
	if (format === "region" && (Boolean(regionId) === Boolean(regionClass) || !(regionId ? /^[a-z][\w.-]{0,100}$/iu.test(regionId) : /^[a-z][\w-]{0,100}$/iu.test(regionClass || "")))) throw new CollectionFailure("policy-region-unavailable");
	const mains = stateHtmlDescendants(document, node => format !== "region"
		? node.nodeName === "main"
		: regionId
			? stateHtmlAttribute(node, "id") === regionId
			: stateHtmlAttribute(node, "class").split(/\s+/u).includes(regionClass!));
	if (mains.length !== 1) throw new CollectionFailure("policy-main-unavailable");
	const text = mainText(mains[0]!).replace(/\s+/gu, " ").trim();
	if (text.length < 50) throw new CollectionFailure("policy-main-unavailable");
	return hash(text);
}

function validateRelativeRobotsDisallows(values: string[] = []) {
	if (!Array.isArray(values) || values.length > 10 || new Set(values).size !== values.length || values.some(value => typeof value !== "string" || !/^\*\.[a-z]{1,10}$/u.test(value)))
		throw new CollectionFailure("robots-relative-rule-review-required");
}

export function electionDocumentRobotsPolicy(body: Uint8Array, otherAgents: string[] = [], relativeDisallows: string[] = [], repeatWildcardGroup?: true) {
	validateRelativeRobotsDisallows(relativeDisallows);
	if (repeatWildcardGroup !== undefined && repeatWildcardGroup !== true) throw new CollectionFailure("robots-group-review-required");
	const rules: { allow: boolean; pattern: RegExp; length: number }[] = [];
	let agents = 0;
	let wildcardGroups = 0;
	let delay = 11_000;
	let applicable = false;
	let hasDirectives = false;
	const reviewedAgents = otherAgents.map(agent => agent.toLowerCase());
	const observedAgents = new Set<string>();
	if (new Set(reviewedAgents).size !== reviewedAgents.length || reviewedAgents.some(agent => (!/^[a-z_-]+$/u.test(agent) && agent !== "*semrush*") || /ballot|gpt|chatgpt|openai|oai|claude|anthropic/u.test(agent))) throw new CollectionFailure("robots-group-review-required");
	for (const raw of new TextDecoder("utf-8", { fatal: true }).decode(body).split(/\r?\n/u)) {
		const line = raw.split("#", 1)[0]!.trim();
		if (!line) continue;
		const separator = line.indexOf(":");
		const key = line.slice(0, separator).trim().toLowerCase();
		const value = line.slice(separator + 1).trim();
		if (separator < 0) throw new CollectionFailure("robots-format-changed");
		if (key === "user-agent") {
			if (agents && !hasDirectives) throw new CollectionFailure("robots-group-review-required");
			const agent = value.toLowerCase();
			if ((observedAgents.has(agent) && !(repeatWildcardGroup && agent === "*" && wildcardGroups === 1)) || (agent !== "*" && !reviewedAgents.includes(agent))) throw new CollectionFailure("robots-group-review-required");
			agents++;
			if (agent === "*") wildcardGroups++;
			observedAgents.add(agent);
			applicable = agent === "*";
			hasDirectives = false;
		}
		else if (key === "sitemap") {
			continue;
		}
		else if (key === "crawl-delay" && /^\d+(?:\.\d+)?$/u.test(value)) {
			if (!agents) throw new CollectionFailure("robots-format-changed");
			hasDirectives = true;
			if (applicable) delay = Math.max(delay, Number(value) * 1000);
		}
		else if (["allow", "disallow"].includes(key) && agents) {
			hasDirectives = true;
			if (!value) continue;
			const pattern = value.startsWith("/") ? value : key === "disallow" && relativeDisallows.includes(value) ? `/${value}` : "";
			if (!pattern) throw new CollectionFailure("robots-format-changed");
			const escaped = pattern.replace(/[.+?^{}()|[\]\\]/gu, "\\$&").replace(/\*/gu, ".*").replace(/\$(?!$)/gu, "\\$");
			if (applicable) rules.push({ allow: key === "allow", pattern: new RegExp(`^${escaped}`, "u"), length: pattern.replace(/\*/gu, "").length });
		}
		else {
			throw new CollectionFailure("robots-format-changed");
		}
	}
	if (!observedAgents.has("*") || agents !== reviewedAgents.length + 1 + Number(Boolean(repeatWildcardGroup)) || wildcardGroups !== (repeatWildcardGroup ? 2 : 1) || delay > 300_000) throw new CollectionFailure("robots-group-review-required");
	return { delay, allowed(address: string) {
		const url = new URL(address);
		const matches = rules.filter(rule => rule.pattern.test(url.pathname + url.search)).sort((first, second) => second.length - first.length || Number(second.allow) - Number(first.allow));
		return matches[0]?.allow ?? true;
	} };
}

export function discoverElectionDocuments(source: ElectionDocumentSource, body: Uint8Array) {
	validateDocumentBounds(source);
	const document = html(body);
	const text = stateHtmlText(document).replace(/\s+/gu, " ");
	if (!source.dateMarkers.every(marker => text.includes(marker))) throw new CollectionFailure("index-election-changed");
	const urls = new Set<string>();
	const links = stateHtmlDescendants(document, node => node.nodeName === "a").map(anchor => stateHtmlAttribute(anchor, "href"));
	if (source.selectDocumentOptions) {
		for (const select of stateHtmlDescendants(document, node => node.nodeName === "select"))
			links.push(...stateHtmlDescendants(select, node => node.nodeName === "option").map(option => stateHtmlAttribute(option, "value")));
	}
	for (const link of links) {
		const url = new URL(link, source.indexUrl);
		if (url.hostname !== source.host || !source.documentPatterns.some(pattern => new RegExp(pattern, "u").test(url.pathname))) continue;
		url.hash = "";
		if (url.protocol !== "https:" || url.username || url.password || url.port || (source.reviewedDocumentUrls ? !source.reviewedDocumentUrls.includes(url.href) : Boolean(url.search))) throw new CollectionFailure("document-link-changed");
		if (url.pathname.includes("%") && !source.encodedDocumentPaths?.includes(url.pathname)) throw new CollectionFailure("document-link-changed");
		urls.add(url.href);
	}
	if (urls.size < (source.minimumDocuments ?? 1) || urls.size > source.maximumDocuments) throw new CollectionFailure("document-count-changed");
	return [...urls].sort();
}

async function optional(path: string) {
	try {
		const value: unknown = JSON.parse(await readBoundedStateData(path));
		if (!objectValue(value)) throw new CollectionFailure("cache-invalid");
		return value;
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

async function atomic(path: string, value: unknown) {
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		const handle = await open(temporary, "wx");
		try {
			await handle.writeFile(JSON.stringify(value));
			await handle.sync();
		}
		finally { await handle.close(); }
		await rename(temporary, path);
	}
	finally {
		await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		});
	}
}

async function bodyFile(cache: string, body: Uint8Array) {
	const sha256 = hash(body);
	const path = join(cache, "bodies", sha256);
	try {
		const handle = await open(path, "wx");
		try {
			await handle.writeFile(body);
			await handle.sync();
		}
		finally { await handle.close(); }
	}
	catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || hash(await readBoundedStateDataBytes(path)) !== sha256) throw error; }
	return sha256;
}

async function directories(plan: ElectionDocumentPlan, now: number) {
	if (!objectValue(plan) || !exact(plan, ["schemaVersion", "type", "sourceIds", "cacheDirectory", "outputRoot", "accessReviews"]) || plan.schemaVersion !== 1 || plan.type !== "election-document-collection" || !Array.isArray(plan.sourceIds) || !plan.sourceIds.length || plan.sourceIds.length > 25 || new Set(plan.sourceIds).size !== plan.sourceIds.length || !Array.isArray(plan.accessReviews) || plan.accessReviews.length !== plan.sourceIds.length || typeof plan.cacheDirectory !== "string" || !isAbsolute(plan.cacheDirectory) || typeof plan.outputRoot !== "string" || !isAbsolute(plan.outputRoot)) throw new Error("Provide a configured election document plan and explicit current access reviews.");
	const sources = plan.sourceIds.map(id => electionDocumentSources.find(source => source.id === id));
	if (sources.some(source => !source || now >= Date.parse(source.electionDate) + 2 * day) || new Set(plan.accessReviews.map(review => review?.sourceId)).size !== sources.length) throw new Error("The selected election document sources are unavailable or expired.");
	for (const source of sources as ElectionDocumentSource[]) {
		electionDocumentPublisherHosts(source);
		const review = plan.accessReviews.find(review => review?.sourceId === source.id);
		if (!review || !exact(review, ["sourceId", "reviewedAt", "configurationSha256", "policyFingerprints"]) || !validDate(review.reviewedAt, now) || now - Date.parse(review.reviewedAt) > 30 * day || review.configurationSha256 !== electionDocumentConfigurationSha256(source) || !objectValue(review.policyFingerprints) || !exact(review.policyFingerprints, [...source.policies.map(policy => policy.id), "indexLinks", ...(source.documentFormat === "html" ? ["documentLinks"] : [])]) || !Object.values(review.policyFingerprints).every(validHash)) throw new Error("An election document source requires a matching current access review.");
	}
	for (const path of [plan.cacheDirectory, plan.outputRoot]) {
		assertExternalStateDataDirectory(path);
		await mkdir(path, { recursive: true });
		assertExternalStateDataDirectory(await realpath(path));
	}
	const cache = await realpath(plan.cacheDirectory);
	const outputRoot = await realpath(plan.outputRoot);
	if (cache === outputRoot || cache.startsWith(`${outputRoot}/`) || outputRoot.startsWith(`${cache}/`)) throw new Error("Document cache and prepared output must use separate external directories.");
	for (const name of ["bodies", "captures", "hosts"]) {
		const path = join(cache, name);
		await mkdir(path, { recursive: true });
		if (await realpath(path) !== path) throw new Error("Document cache directories must not be linked.");
	}
	return { cache, outputRoot, sources: sources as ElectionDocumentSource[] };
}

async function locked<T>(cache: string, action: () => Promise<T>) {
	const path = join(cache, ".collection.lock");
	const owner = randomUUID();
	const handle = await open(path, "wx");
	try {
		await handle.writeFile(JSON.stringify({ owner }));
		await handle.close();
		return await action();
	}
	finally {
		await handle.close().catch(() => {});
		if ((await optional(path))?.owner === owner) await unlink(path);
	}
}

function capturePath(cache: string, source: ElectionDocumentSource, url: string) {
	return join(cache, "captures", `${hash(`${source.id}/${url}`)}.json`);
}

function validateContent(source: ElectionDocumentSource, review: ElectionDocumentPlan["accessReviews"][number], url: string, body: Uint8Array) {
	const policy = source.policies.find(policy => policy.url === url);
	if (policy && electionDocumentPolicyFingerprint(body, policy.format, url, policy.regionId, policy.regionClass) !== review.policyFingerprints[policy.id]) throw new CollectionFailure("publisher-policy-changed");
	if (url === source.indexUrl) {
		if (electionDocumentPolicyFingerprint(body, "links", url) !== review.policyFingerprints.indexLinks) throw new CollectionFailure("publisher-policy-links-changed");
		discoverElectionDocuments(source, body);
	}
	else if (!policy) {
		if (source.documentFormat === "html") {
			const document = html(body);
			if (electionDocumentPolicyFingerprint(body, "links", url) !== review.policyFingerprints.documentLinks) throw new CollectionFailure("publisher-policy-links-changed");
			const text = stateHtmlText(document).replace(/\s+/gu, " ");
			if (!source.documentDateMarkers!.every(marker => text.includes(marker))) throw new CollectionFailure("document-election-changed");
		}
		else if (!body.byteLength || body.byteLength > maximumBytes || Buffer.from(body).subarray(0, 5).toString("ascii") !== "%PDF-") {
			throw new CollectionFailure("document-format-changed");
		}
	}
}

export async function seedElectionDocuments(plan: ElectionDocumentPlan, seed: ElectionDocumentSeed, now = Date.now()) {
	const { cache, sources } = await directories(plan, now);
	if (!objectValue(seed) || !exact(seed, ["schemaVersion", "type", "captures"]) || seed.schemaVersion !== 1 || seed.type !== "election-document-seed" || !Array.isArray(seed.captures) || !seed.captures.length || seed.captures.length > 500) throw new Error("Provide explicit retained election document captures.");
	return locked(cache, async () => {
		if ((await readdir(join(cache, "captures"))).length || (await readdir(join(cache, "hosts"))).length || (await readdir(join(cache, "bodies"))).length) throw new Error("Document seeds never replace an existing cache or publisher hold.");
		const prepared: { source: ElectionDocumentSource; input: ElectionDocumentSeed["captures"][number]; body: Buffer }[] = [];
		const seen = new Set<string>();
		let combinedBytes = 0;
		for (const input of seed.captures) {
			const source = sources.find(source => source.id === input?.sourceId);
			if (!source || !exact(input, ["sourceId", "url", "path", "sha256", "capturedAt", ...(input.etag === undefined ? [] : ["etag"])]) || typeof input.path !== "string" || !isAbsolute(input.path) || !validHash(input.sha256) || !validDate(input.capturedAt, now) || typeof input.url !== "string" || seen.has(`${source.id}/${input.url}`) || (input.etag !== undefined && !/^(?:W\/)?"[\x21\x23-\x7E]{0,500}"$/u.test(input.etag))) throw new Error("A retained document capture is invalid or duplicated.");
			const body = await readBoundedStateDataBytes(input.path);
			combinedBytes += body.length;
			if (combinedBytes > 128 * 1024 * 1024) throw new Error("Retained document seeds exceed their combined size limit.");
			if (hash(body) !== input.sha256) throw new Error("A retained document capture hash differs.");
			prepared.push({ source, input, body });
			seen.add(`${source.id}/${input.url}`);
		}
		for (const source of sources) {
			const review = plan.accessReviews.find(review => review.sourceId === source.id)!;
			const index = prepared.find(item => item.source.id === source.id && item.input.url === source.indexUrl);
			if (!index || source.policies.some(policy => !prepared.some(item => item.source.id === source.id && item.input.url === policy.url))) throw new Error("Each document seed requires its reviewed index and policies.");
			const allowed = new Set([source.indexUrl, ...source.policies.map(policy => policy.url), ...discoverElectionDocuments(source, index.body)]);
			const permissions = new Map(source.policies.filter(policy => policy.format === "robots").map((policy) => {
				const robots = prepared.find(item => item.source.id === source.id && item.input.url === policy.url)!;
				return [new URL(policy.url).hostname, electionDocumentRobotsPolicy(robots.body, policy.otherRobotsAgents ?? source.otherRobotsAgents, source.relativeRobotsDisallows, source.repeatWildcardGroup)];
			}));
			for (const item of prepared.filter(item => item.source.id === source.id)) {
				if (!allowed.has(item.input.url) || !permissions.get(new URL(item.input.url).hostname)?.allowed(item.input.url)) throw new Error("A retained document is outside its permitted observed source links.");
				validateContent(source, review, item.input.url, item.body);
			}
		}
		for (const { source, input, body } of prepared) {
			const sha256 = await bodyFile(cache, body);
			await atomic(capturePath(cache, source, input.url), { schemaVersion: 1, sourceId: source.id, configurationSha256: electionDocumentConfigurationSha256(source), url: input.url, sha256, capturedAt: input.capturedAt, checkedAt: input.capturedAt, ...(input.etag ? { etag: input.etag } : {}) });
		}
		for (const hostname of new Set(sources.flatMap(electionDocumentPublisherHosts))) {
			const host = join(cache, "hosts", hostname);
			await mkdir(host, { recursive: true });
			if (await realpath(host) !== host) throw new Error("Publisher cache directories must not be linked.");
			const latest = Math.max(...prepared.filter(item => new URL(item.input.url).hostname === hostname).map(item => Date.parse(item.input.capturedAt)));
			await atomic(join(host, "last-request.json"), { at: new Date(latest).toISOString() });
		}
		return { seeded: prepared.length, publisherRequests: 0, imported: false };
	});
}

export async function collectElectionDocuments(plan: ElectionDocumentPlan, options: CollectionOptions = {}) {
	const now = options.now ?? Date.now;
	const { cache, outputRoot, sources } = await directories(plan, now());
	return locked(cache, async () => {
		const observations: { sourceId: string; complete: boolean; reason?: string; status?: number; documents?: Capture[] }[] = [];
		let publisherRequests = 0;
		for (const source of sources) {
			const review = plan.accessReviews.find(review => review.sourceId === source.id)!;
			const publishers = new Map(electionDocumentPublisherHosts(source).map(hostname => [hostname, { directory: join(cache, "hosts", hostname), delay: 11_000 }]));
			for (const publisher of publishers.values()) {
				await mkdir(publisher.directory, { recursive: true });
				if (await realpath(publisher.directory) !== publisher.directory) throw new Error("Publisher cache directories must not be linked.");
			}
			async function capture(url: string) {
				const address = new URL(url);
				const publisher = publishers.get(address.hostname);
				if (!publisher || (address.hostname !== source.host && !source.policies.some(policy => policy.url === url))) throw new CollectionFailure("document-link-changed");
				const host = publisher.directory;
				const isPdf = /\.pdf$/iu.test(address.pathname);
				const path = capturePath(cache, source, url);
				const raw = await optional(path);
				let previous: Capture | null = null;
				let body: Buffer | undefined;
				if (raw) {
					if (!exact(raw, ["schemaVersion", "sourceId", "configurationSha256", "url", "sha256", "capturedAt", "checkedAt", ...(raw.etag === undefined ? [] : ["etag"])]) || raw.schemaVersion !== 1 || raw.sourceId !== source.id || raw.configurationSha256 !== electionDocumentConfigurationSha256(source) || raw.url !== url || !validHash(raw.sha256) || !validDate(raw.capturedAt, now()) || !validDate(raw.checkedAt, now()) || Date.parse(raw.checkedAt) < Date.parse(raw.capturedAt) || (raw.etag !== undefined && (typeof raw.etag !== "string" || !/^(?:W\/)?"[\x21\x23-\x7E]{0,500}"$/u.test(raw.etag)))) throw new CollectionFailure("cache-invalid");
					previous = raw as unknown as Capture;
					body = await readBoundedStateDataBytes(join(cache, "bodies", previous.sha256));
					if (hash(body) !== previous.sha256) throw new CollectionFailure("cache-integrity-changed");
					validateContent(source, review, url, body);
					if (now() - Date.parse(previous.checkedAt) < day) return { metadata: previous, body };
				}
				const failure = await optional(`${path}.failure`);
				if (failure && (!exact(failure, ["retryAt"]) || typeof failure.retryAt !== "number" || !Number.isFinite(failure.retryAt) || failure.retryAt < 0 || failure.retryAt > now() + day)) throw new CollectionFailure("cache-invalid");
				if (failure && typeof failure.retryAt === "number" && failure.retryAt > now()) throw new CollectionFailure("cooldown");
				const last = await optional(join(host, "last-request.json"));
				if (last && (!exact(last, ["at"]) || !validDate(last.at, now()))) throw new CollectionFailure("cache-invalid");
				let wait = last ? Math.max(0, publisher.delay - (now() - Date.parse(last.at as string))) : 0;
				while (wait > 0) {
					await (options.sleep ?? setTimeout)(wait);
					wait = Math.max(0, publisher.delay - (now() - Date.parse(last!.at as string)));
				}
				if (now() >= Date.parse(source.electionDate) + 2 * day || now() - Date.parse(review.reviewedAt) > 30 * day) throw new CollectionFailure("review-or-election-expired");
				await atomic(join(host, "last-request.json"), { at: new Date(now()).toISOString() });
				let response: Awaited<ReturnType<typeof fetchRemoteSourceDocument>>;
				try {
					publisherRequests++;
					response = await (options.fetchDocument ?? fetchRemoteSourceDocument)(url, { allowedHosts: [address.hostname], maxBytes: isPdf ? maximumBytes : 2 * 1024 * 1024, timeoutMs: 30_000, ...(previous?.etag ? { etag: previous.etag } : {}) });
				}
				catch (error) {
					if (error instanceof RemoteSourceDocumentPolicyError || /CERT|TLS|UNABLE_TO_VERIFY_LEAF_SIGNATURE/u.test(String((error as NodeJS.ErrnoException).code ?? ""))) throw new CollectionFailure("document-transport-policy-violation");
					await atomic(`${path}.failure`, { retryAt: now() + 60 * 60 * 1000 });
					throw new CollectionFailure("transport-unavailable");
				}
				finally {
					await atomic(join(host, "last-request.json"), { at: new Date(now()).toISOString() });
				}
				if ([401, 403, 429].includes(response.status) || (response.status >= 300 && response.status < 400 && response.status !== 304)) throw new CollectionFailure("publisher-denial-or-redirect", response.status);
				if (response.status === 304) {
					if (!previous?.etag || !body) throw new CollectionFailure("unsolicited-not-modified");
					const metadata = { ...previous, checkedAt: new Date(now()).toISOString() };
					await atomic(path, metadata);
					return { metadata, body };
				}
				if (response.status !== 200) {
					await atomic(`${path}.failure`, { retryAt: now() + day });
					throw new CollectionFailure("document-or-policy-unavailable", response.status);
				}
				if (isPdf && response.contentType !== "application/pdf") throw new CollectionFailure("document-format-changed");
				if (!source.policies.some(policy => policy.url === url) && url !== source.indexUrl && source.documentFormat === "html" && response.contentType !== "text/html") throw new CollectionFailure("document-format-changed");
				validateContent(source, review, url, response.body);
				const sha256 = await bodyFile(cache, response.body);
				const metadata: Capture = { schemaVersion: 1, sourceId: source.id, configurationSha256: electionDocumentConfigurationSha256(source), url, sha256, capturedAt: previous?.sha256 === sha256 ? previous.capturedAt : new Date(now()).toISOString(), checkedAt: new Date(now()).toISOString(), ...(response.etag && /^(?:W\/)?"[\x21\x23-\x7E]{0,500}"$/u.test(response.etag) ? { etag: response.etag } : {}) };
				await atomic(path, metadata);
				await unlink(`${path}.failure`).catch((error: NodeJS.ErrnoException) => {
					if (error.code !== "ENOENT") throw error;
				});
				return { metadata, body: response.body };
			}
			try {
				for (const publisher of publishers.values()) {
					if (await optional(join(publisher.directory, "hold.json"))) throw new CollectionFailure("publisher-on-hold");
				}
				const permissions = new Map<string, ReturnType<typeof electionDocumentRobotsPolicy>>();
				for (const policy of source.policies.filter(policy => policy.format === "robots")) {
					const robots = await capture(policy.url);
					const permission = electionDocumentRobotsPolicy(robots.body, policy.otherRobotsAgents ?? source.otherRobotsAgents, source.relativeRobotsDisallows, source.repeatWildcardGroup);
					const hostname = new URL(policy.url).hostname;
					publishers.get(hostname)!.delay = permission.delay;
					permissions.set(hostname, permission);
				}
				const allowed = (url: string) => permissions.get(new URL(url).hostname)?.allowed(url) ?? false;
				for (const policy of source.policies.filter(policy => policy.format !== "robots")) {
					if (!allowed(policy.url)) throw new CollectionFailure("robots-denial");
					await capture(policy.url);
				}
				if (!allowed(source.indexUrl)) throw new CollectionFailure("robots-denial");
				const index = await capture(source.indexUrl);
				const documents: Capture[] = [];
				for (const url of discoverElectionDocuments(source, index.body)) {
					if (!allowed(url)) throw new CollectionFailure("robots-denial");
					documents.push((await capture(url)).metadata);
				}
				observations.push({ sourceId: source.id, complete: true, documents });
			}
			catch (error) {
				const failure = error instanceof CollectionFailure ? error : new CollectionFailure("cache-or-format-invalid");
				if (!["publisher-on-hold", "transport-unavailable", "document-or-policy-unavailable", "cooldown"].includes(failure.reason)) {
					for (const publisher of publishers.values()) await atomic(join(publisher.directory, "hold.json"), { reason: failure.reason, status: failure.status, at: new Date(now()).toISOString() });
				}
				observations.push({ sourceId: source.id, complete: false, reason: failure.reason, ...(failure.status ? { status: failure.status } : {}) });
			}
		}
		const result = { schemaVersion: 1, type: "election-document-collection-result", complete: observations.every(observation => observation.complete), observations, publisherRequests, collectedAt: new Date(now()).toISOString(), configuredLinkRulesOnly: true, coverageCompletenessClaimed: false, capturedContentReviewed: false, imported: false, published: false };
		const file = join(outputRoot, `election-documents-${randomUUID()}.json`);
		await atomic(file, result);
		return { ...result, file };
	});
}
