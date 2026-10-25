import type { DefaultTreeAdapterMap } from "parse5";
import type { ElectionReferenceSource } from "./election-reference-sources.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers/promises";
import { parse } from "parse5";
import { readProviderResponseText } from "./fetch-response.js";
import { openStatesBulkPublication, openStatesBulkSources, parseOpenStatesBulk } from "./openstates-bulk.js";
import { prepareOpenStatesReferenceFiles, readOpenStatesCandidateInputs } from "./prepare-openstates-references.js";
import { assertExternalStateDataDirectory, readBoundedStateData } from "./state-ballot-storage.js";

const interval = openStatesBulkPublication.minimumRefreshIntervalMs;
const policyBytes = 256 * 1024;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const validHash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const dateValue = (value: unknown, now: number) => typeof value === "string" && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now;
type HtmlNode = DefaultTreeAdapterMap["node"];

export interface OpenStatesCollectionPlan {
	schemaVersion: 1;
	type: "openstates-collection";
	sourceIds: string[];
	cacheDirectory: string;
	outputRoot: string;
	candidateFiles: string[];
	allowedCandidateSourceIds: string[];
	accessReview: { reviewedAt: string; termsTextSha256: string };
}

interface Capture {
	schemaVersion: 1;
	sourceId: string;
	sourceConfigurationSha256: string;
	capturedAt: string;
	checkedAt: string;
	sha256: string;
	etag?: string;
	lastModified?: string;
}

interface CollectionOptions {
	now?: () => number;
	fetchImpl?: (url: string, options: RequestInit) => Promise<Response>;
	sleep?: (milliseconds: number) => Promise<void>;
}

class SourceUnavailableError extends Error {
	constructor(readonly reason: "cooldown" | "transport" | "http", readonly status?: number) {
		super("An Open States source is temporarily unavailable.");
	}
}

interface CollectionObservation {
	sourceId: string;
	status: number | "cache" | "unavailable";
	capturedAt?: string;
	checkedAt?: string;
	sha256?: string;
	reason?: string;
	httpStatus?: number;
}

function policyNodes(node: HtmlNode): HtmlNode[] {
	const children = "childNodes" in node ? node.childNodes : [];
	if ("tagName" in node && node.tagName === "section" && children.some(child => "tagName" in child && child.tagName === "h1" && ["Terms of Service", "Privacy Policy"].includes(nodeText(child).trim()))) return [node];
	return children.flatMap(policyNodes);
}

function nodeText(node: HtmlNode): string {
	if (node.nodeName === "#text") return (node as DefaultTreeAdapterMap["textNode"]).value;
	if ("tagName" in node && ["script", "style", "nav", "footer", "header"].includes(node.tagName)) return "";
	const link = "tagName" in node && node.tagName === "a" ? ` ${node.attrs.find(attribute => attribute.name === "href")?.value ?? ""} ` : "";
	return link + ("childNodes" in node ? node.childNodes.map(nodeText).join(" ") : "");
}

export function openStatesPolicyFingerprint(body: string) {
	if (Buffer.byteLength(body) > policyBytes) throw new Error("The Open States policy exceeds its size limit.");
	const sections = policyNodes(parse(body));
	const text = sections.map(nodeText).join(" ").replace(/\s+/gu, " ").trim();
	if (sections.length !== 2 || !text.includes("Attribution") || !text.includes("We make no copyright claim") || !text.includes("Privacy Policy")) throw new Error("The reviewed Open States policy sections are unavailable.");
	return hash(text);
}

async function readOptional(path: string) {
	try {
		const value = JSON.parse(await readBoundedStateData(path));
		if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("Open States cache metadata must be an object.");
		return value;
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

async function atomicJson(path: string, value: unknown) {
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		const handle = await open(temporary, "wx");
		try {
			await handle.writeFile(`${JSON.stringify(value)}\n`);
			await handle.sync();
		}
		finally { await handle.close(); }
		await rename(temporary, path);
	}
	finally {
		await unlink(temporary).catch((error) => {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		});
	}
}

async function contentFile(cache: string, body: string, extension: "csv" | "html") {
	const sha256 = hash(body);
	const path = join(cache, "bodies", `${sha256}.${extension}`);
	try {
		await writeFile(path, body, { flag: "wx" });
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "EEXIST" || hash(await readBoundedStateData(path)) !== sha256) throw error;
	}
	return { sha256, path };
}

async function collectionDirectories(plan: OpenStatesCollectionPlan, now: number) {
	if (!plan || Object.keys(plan).sort().join(",") !== "accessReview,allowedCandidateSourceIds,cacheDirectory,candidateFiles,outputRoot,schemaVersion,sourceIds,type" || plan.schemaVersion !== 1 || plan.type !== "openstates-collection" || !Array.isArray(plan.sourceIds) || !plan.sourceIds.length || plan.sourceIds.length > 51 || new Set(plan.sourceIds).size !== plan.sourceIds.length || !plan.sourceIds.every(id => openStatesBulkSources.some(source => source.id === id)) || typeof plan.cacheDirectory !== "string" || !isAbsolute(plan.cacheDirectory) || typeof plan.outputRoot !== "string" || !isAbsolute(plan.outputRoot) || !plan.accessReview || Object.keys(plan.accessReview).sort().join(",") !== "reviewedAt,termsTextSha256" || !dateValue(plan.accessReview.reviewedAt, now) || now - Date.parse(plan.accessReview.reviewedAt) > 30 * interval || !validHash(plan.accessReview.termsTextSha256)) throw new Error("Provide a valid Open States collection plan and a current explicit access review.");
	assertExternalStateDataDirectory(plan.cacheDirectory);
	assertExternalStateDataDirectory(plan.outputRoot);
	const sources = plan.sourceIds.map(id => openStatesBulkSources.find(source => source.id === id)!);
	if (sources.some(source => now >= Date.parse(source.electionDate) + 2 * interval)) throw new Error("This Open States election collection has expired.");
	const candidates = await readOpenStatesCandidateInputs(plan.candidateFiles, plan.allowedCandidateSourceIds);
	if (candidates.some(snapshot => !dateValue(snapshot.retrievedAt, now) || !sources.some(source => source.stateCode === snapshot.source.stateCode && source.electionDate === snapshot.source.electionDate))) throw new Error("Candidate inputs must match the selected election and states without future captures.");
	await mkdir(plan.cacheDirectory, { recursive: true });
	await mkdir(plan.outputRoot, { recursive: true });
	const cache = await realpath(plan.cacheDirectory);
	const outputRoot = await realpath(plan.outputRoot);
	assertExternalStateDataDirectory(cache);
	assertExternalStateDataDirectory(outputRoot);
	await mkdir(join(cache, "bodies"), { recursive: true });
	if (await realpath(join(cache, "bodies")) !== join(cache, "bodies")) throw new Error("Open States content storage must not use a linked directory.");
	return { cache, outputRoot, sources };
}

async function withCollectionLock<T>(cache: string, action: () => Promise<T>) {
	const path = join(cache, ".collection.lock");
	const ownerId = randomUUID();
	const handle = await open(path, "wx").catch((error) => {
		if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("The Open States cache is locked; verify the existing collector before retrying.");
		throw error;
	});
	const outcome = await (async () => {
		await handle.writeFile(JSON.stringify({ ownerId, pid: process.pid, startedAt: new Date().toISOString() }));
		return await action();
	})().then(value => ({ value }), (error: unknown) => ({ error }));
	await handle.close();
	if ((await readOptional(path))?.ownerId !== ownerId) {
		const ownershipError = new Error("Open States collection lock ownership changed; the replacement lock is preserved.");
		if ("error" in outcome) throw new AggregateError([outcome.error, ownershipError], "Open States collection failed and lock ownership changed.");
		throw ownershipError;
	}
	await unlink(path);
	if ("error" in outcome) throw outcome.error;
	return outcome.value;
}

async function cacheCapture(cache: string, source: ElectionReferenceSource, now: number): Promise<(Capture & { body: string; path: string }) | null> {
	const metadata = await readOptional(join(cache, `${source.id}.json`)) as Capture | null;
	if (!metadata) return null;
	if (Object.keys(metadata).some(key => !["schemaVersion", "sourceId", "sourceConfigurationSha256", "capturedAt", "checkedAt", "sha256", "etag", "lastModified"].includes(key)) || metadata.schemaVersion !== 1 || metadata.sourceId !== source.id || metadata.sourceConfigurationSha256 !== hash(JSON.stringify(source)) || !validHash(metadata.sha256) || !dateValue(metadata.capturedAt, now) || !dateValue(metadata.checkedAt, now) || Date.parse(metadata.checkedAt) < Date.parse(metadata.capturedAt) || [metadata.etag, metadata.lastModified].some(value => value !== undefined && (typeof value !== "string" || value.length > 512 || /[^\x20-\x7E]/u.test(value)))) throw new Error("Open States cached capture provenance is invalid.");
	const path = join(cache, "bodies", `${metadata.sha256}.csv`);
	const body = await readBoundedStateData(path);
	if (hash(body) !== metadata.sha256) throw new Error("Open States cached data does not match its fingerprint.");
	parseOpenStatesBulk(body);
	return { ...metadata, body, path };
}

export async function seedOpenStatesCollection(plan: OpenStatesCollectionPlan, input: { policy: { body: string; capturedAt: string }; downloads: { sourceId: string; body: string; capturedAt: string; etag?: string; lastModified?: string }[] }, now = Date.now()) {
	const { cache, sources } = await collectionDirectories(plan, now);
	if (!dateValue(input.policy.capturedAt, now) || openStatesPolicyFingerprint(input.policy.body) !== plan.accessReview.termsTextSha256 || input.downloads.length !== sources.length || new Set(input.downloads.map(item => item.sourceId)).size !== sources.length) throw new Error("The reviewed seed does not match the collection access review.");
	for (const download of input.downloads) {
		if (!sources.some(source => source.id === download.sourceId) || !dateValue(download.capturedAt, now) || [download.etag, download.lastModified].some(value => value !== undefined && (typeof value !== "string" || value.length > 512 || /[^\x20-\x7E]/u.test(value)))) throw new Error("A reviewed seed capture has invalid provenance or response validators.");
		parseOpenStatesBulk(download.body);
	}
	return withCollectionLock(cache, async () => {
		if (await readOptional(join(cache, "policy.json")) || await readOptional(join(cache, "hold.json")) || (await Promise.all(sources.map(source => readOptional(join(cache, `${source.id}.json`))))).some(Boolean)) throw new Error("Reviewed seeds never overwrite an existing collection cache or hold.");
		const policy = await contentFile(cache, input.policy.body, "html");
		await atomicJson(join(cache, "policy.json"), { schemaVersion: 1, sha256: policy.sha256, capturedAt: input.policy.capturedAt, checkedAt: input.policy.capturedAt });
		for (const download of input.downloads) {
			const source = sources.find(source => source.id === download.sourceId)!;
			const content = await contentFile(cache, download.body, "csv");
			const { body, ...metadata } = download;
			await atomicJson(join(cache, `${source.id}.json`), { schemaVersion: 1, ...metadata, sourceConfigurationSha256: hash(JSON.stringify(source)), sha256: content.sha256, checkedAt: download.capturedAt });
		}
		return { seeded: sources.length, publisherRequests: 0 };
	});
}

export async function collectOpenStates(plan: OpenStatesCollectionPlan, options: CollectionOptions = {}) {
	const now = options.now ?? Date.now;
	const { cache, outputRoot, sources } = await collectionDirectories(plan, now());
	const fetchImpl = options.fetchImpl ?? fetch;
	const sleep = options.sleep ?? (milliseconds => setTimeout(milliseconds));
	return withCollectionLock(cache, async () => {
		if (await readOptional(join(cache, "hold.json"))) throw new Error("Open States publisher access is on hold; a new review is required before any request.");
		let publisherRequests = 0;
		async function hold(reason: string, sourceId: string, status?: number): Promise<never> {
			await atomicJson(join(cache, "hold.json"), { reason, sourceId, status, at: new Date(now()).toISOString() });
			throw new Error(`Open States collection stopped for review: ${reason}.`);
		}
		async function request(url: string, sourceId: string, headers: Record<string, string>) {
			const attemptPath = join(cache, `${sourceId}.attempt.json`);
			const previous = await readOptional(attemptPath);
			if (previous && !dateValue(previous.at, now())) throw new Error("Open States request-attempt provenance is invalid.");
			if (previous && now() - Date.parse(previous.at) < interval) throw new SourceUnavailableError("cooldown");
			await sleep(1000);
			await atomicJson(attemptPath, { at: new Date(now()).toISOString() });
			publisherRequests++;
			let response: Response;
			try {
				response = await fetchImpl(url, { headers: { "User-Agent": "BallotClarity-source-review/1.0 (+https://ballotclarity.org)", ...headers }, redirect: "manual", credentials: "omit", signal: AbortSignal.timeout(15_000) });
			}
			catch { throw new SourceUnavailableError("transport"); }
			if (response.redirected || [301, 302, 303, 307, 308, 401, 403, 429].includes(response.status)) {
				await response.body?.cancel().catch(() => {});
				return hold("publisher-denial-or-redirect", sourceId, response.status);
			}
			if (response.status !== 200 && response.status !== 304) {
				await response.body?.cancel().catch(() => {});
				throw new SourceUnavailableError("http", response.status);
			}
			return response;
		}
		let policy = await readOptional(join(cache, "policy.json"));
		if (policy) {
			if (policy.schemaVersion !== 1 || !validHash(policy.sha256) || !dateValue(policy.capturedAt, now()) || !dateValue(policy.checkedAt, now()) || Date.parse(policy.checkedAt) < Date.parse(policy.capturedAt)) throw new Error("Open States policy cache provenance is invalid.");
			const body = await readBoundedStateData(join(cache, "bodies", `${policy.sha256}.html`));
			if (hash(body) !== policy.sha256 || openStatesPolicyFingerprint(body) !== plan.accessReview.termsTextSha256) return hold("policy-changed", "policy");
		}
		if (!policy || now() - Date.parse(policy.checkedAt) >= interval) {
			const response = await request(openStatesBulkPublication.termsUrl, "policy", { Accept: "text/html" });
			if (response.status !== 200 || !response.headers.get("content-type")?.toLowerCase().startsWith("text/html")) {
				await response.body?.cancel().catch(() => {});
				return hold("policy-unavailable", "policy", response.status);
			}
			let body: string;
			let fingerprint: string;
			try {
				body = await readProviderResponseText(response, policyBytes);
				fingerprint = openStatesPolicyFingerprint(body);
			}
			catch { return hold("policy-unavailable", "policy"); }
			if (fingerprint !== plan.accessReview.termsTextSha256) return hold("policy-changed", "policy");
			const content = await contentFile(cache, body, "html");
			policy = { schemaVersion: 1, sha256: content.sha256, capturedAt: new Date(now()).toISOString(), checkedAt: new Date(now()).toISOString() };
			await atomicJson(join(cache, "policy.json"), policy);
		}
		const downloads = [];
		const observations: CollectionObservation[] = [];
		for (const source of sources) {
			try {
				let cached = await cacheCapture(cache, source, now());
				let status: number | "cache" = "cache";
				if (!cached || now() - Date.parse(cached.checkedAt) >= interval) {
					const headers: Record<string, string> = { Accept: "text/csv" };
					if (cached?.etag) headers["If-None-Match"] = cached.etag;
					else if (cached?.lastModified && Number.isFinite(Date.parse(cached.lastModified))) headers["If-Modified-Since"] = cached.lastModified;
					const response = await request(source.documents[0]!.url, source.id, headers);
					status = response.status;
					if (status === 304) {
						if (!cached || (!headers["If-None-Match"] && !headers["If-Modified-Since"])) return hold("unexpected-not-modified", source.id, status);
						const { body, path, ...metadata } = cached;
						await atomicJson(join(cache, `${source.id}.json`), { ...metadata, checkedAt: new Date(now()).toISOString() });
					}
					else {
						if (!/^(?:text\/csv|application\/csv|text\/plain)(?:;|$)/iu.test(response.headers.get("content-type") ?? "")) {
							await response.body?.cancel().catch(() => {});
							return hold("source-format-changed", source.id, status);
						}
						let body: string;
						try {
							body = await readProviderResponseText(response, openStatesBulkPublication.maximumBytes);
							parseOpenStatesBulk(body);
						}
						catch { return hold("source-format-or-size-changed", source.id, status); }
						const content = await contentFile(cache, body, "csv");
						const validators = { etag: response.headers.get("etag") ?? undefined, lastModified: response.headers.get("last-modified") ?? undefined };
						if (Object.values(validators).some(value => value !== undefined && (value.length > 512 || /[^\x20-\x7E]/u.test(value)))) return hold("invalid-response-validator", source.id, status);
						await atomicJson(join(cache, `${source.id}.json`), { schemaVersion: 1, sourceId: source.id, sourceConfigurationSha256: hash(JSON.stringify(source)), capturedAt: new Date(now()).toISOString(), checkedAt: new Date(now()).toISOString(), sha256: content.sha256, ...validators });
					}
					cached = await cacheCapture(cache, source, now());
				}
				if (!cached) throw new Error("Open States capture was not persisted.");
				downloads.push({ stateCode: source.stateCode, path: cached.path, url: source.documents[0]!.url, capturedAt: cached.capturedAt, sha256: cached.sha256 });
				observations.push({ sourceId: source.id, status, capturedAt: cached.capturedAt, checkedAt: cached.checkedAt, sha256: cached.sha256 });
			}
			catch (error) {
				if (!(error instanceof SourceUnavailableError)) throw error;
				observations.push({ sourceId: source.id, status: "unavailable", reason: error.reason, httpStatus: error.status });
			}
		}
		if (!downloads.length) throw new Error("No Open States source is available for preparation; accepted data is unchanged.");
		const run = join(outputRoot, `openstates-${now()}-${randomUUID()}`);
		await mkdir(run);
		const preparationPlan = { schemaVersion: 1, type: "openstates-reference-preparation", downloads, candidateFiles: plan.candidateFiles, allowedCandidateSourceIds: plan.allowedCandidateSourceIds, outputDirectory: join(run, "prepared") };
		const planPath = join(run, "preparation-plan.json");
		await writeFile(planPath, `${JSON.stringify(preparationPlan, null, 2)}\n`, { flag: "wx" });
		const prepared = await prepareOpenStatesReferenceFiles(planPath, now());
		const receipt = { schemaVersion: 1, type: "openstates-collection-result", preparationPlan: planPath, outputDirectory: preparationPlan.outputDirectory, publisherRequests, complete: downloads.length === sources.length, observations, prepared, imported: false };
		await writeFile(join(run, "collection-result.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
		return receipt;
	});
}

export async function collectOpenStatesFile(path: string) {
	return collectOpenStates(JSON.parse(await readBoundedStateData(path)));
}

export { readOptional as readOpenStatesCollectionMetadata, collectionDirectories as validateOpenStatesCollectionPlan, withCollectionLock as withOpenStatesCollectionLock, atomicJson as writeOpenStatesCollectionMetadata };
export type { CollectionOptions as OpenStatesCollectionOptions };
