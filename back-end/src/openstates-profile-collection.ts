import type { OpenStatesCollectionOptions, OpenStatesCollectionPlan } from "./openstates-collection.js";
import type { OpenStatesProfileCapture } from "./openstates-profile-enrichment.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { readProviderResponseText } from "./fetch-response.js";
import { openStatesBulkSources } from "./openstates-bulk.js";
import { collectOpenStates, readOpenStatesCollectionMetadata, validateOpenStatesCollectionPlan, withOpenStatesCollectionLock, writeOpenStatesCollectionMetadata } from "./openstates-collection.js";
import { openStatesProfileArchiveLimits } from "./openstates-profile-enrichment.js";
import { prepareOpenStatesProfileFiles, readOpenStatesProfileArchive } from "./prepare-openstates-profiles.js";
import { assertExternalStateDataDirectory, readBoundedStateData } from "./state-ballot-storage.js";

export const openStatesProfilePublication = {
	repository: "openstates/people",
	branch: "main",
	commitUrl: "https://api.github.com/repos/openstates/people/commits/main",
	apiTermsUrl: "https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#h-api-terms",
	apiVersion: "2022-11-28",
	minimumRefreshIntervalMs: 24 * 60 * 60 * 1000,
	maximumReviewAgeMs: 30 * 24 * 60 * 60 * 1000,
};

const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
export const openStatesProfileCollectionPolicySha256 = digest(JSON.stringify(openStatesProfilePublication));
const validHash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const validCommit = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
const validDate = (value: unknown, now: number): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now;
const validEtag = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 512 && !/[^\x20-\x7E]/u.test(value);

export interface OpenStatesProfileCollectionPlan {
	schemaVersion: 1;
	type: "openstates-profile-collection";
	collection: OpenStatesCollectionPlan;
	archiveCacheDirectory: string;
	accessReview: { reviewedAt: string; collectionPolicySha256: string; readmeSha256: string };
}

interface ArchiveCapture extends OpenStatesProfileCapture {
	schemaVersion: 1;
	collectionPolicySha256: string;
	checkedAt: string;
	readmeSha256: string;
	etag?: string;
}

async function collectedReferenceFiles(collection: Awaited<ReturnType<typeof collectOpenStates>>, allowedIds: string[]) {
	const manifest = JSON.parse(await readBoundedStateData(join(collection.outputDirectory, "openstates-reference-preparation.json")));
	if (manifest?.schemaVersion !== 1 || manifest.type !== "openstates-reference-preparation-result" || !Array.isArray(manifest.files) || manifest.files.length !== collection.prepared.collections || new Set(manifest.files.map((file: { path: unknown }) => file?.path)).size !== manifest.files.length)
		throw new Error("The state collection preparation manifest is invalid.");
	return Promise.all(manifest.files.map(async (file: { path: string; sourceId: string; sourceConfigurationSha256: string; sha256: string }) => {
		const source = openStatesBulkSources.find(item => item.id === file?.sourceId && allowedIds.includes(item.id));
		if (!source || file.path !== `election-references-openstates-${source.stateCode.toLowerCase()}-${source.electionDate.slice(0, 4)}.json` || file.sourceConfigurationSha256 !== digest(JSON.stringify(source)) || !validHash(file.sha256)) throw new Error("A collected reference file does not match its configured source.");
		const path = join(collection.outputDirectory, file.path);
		if (digest(await readBoundedStateData(path)) !== file.sha256) throw new Error("A collected reference file does not match its fingerprint.");
		return path;
	}));
}

async function profileCache(plan: OpenStatesProfileCollectionPlan, now: number) {
	if (!plan || Object.keys(plan).sort().join(",") !== "accessReview,archiveCacheDirectory,collection,schemaVersion,type" || plan.schemaVersion !== 1 || plan.type !== "openstates-profile-collection" || typeof plan.archiveCacheDirectory !== "string" || !isAbsolute(plan.archiveCacheDirectory) || !plan.accessReview || Object.keys(plan.accessReview).sort().join(",") !== "collectionPolicySha256,readmeSha256,reviewedAt" || !validDate(plan.accessReview.reviewedAt, now) || now - Date.parse(plan.accessReview.reviewedAt) > openStatesProfilePublication.maximumReviewAgeMs || plan.accessReview.collectionPolicySha256 !== openStatesProfileCollectionPolicySha256 || !validHash(plan.accessReview.readmeSha256))
		throw new Error("Provide a current explicit profile-collection access review and external archive cache.");
	assertExternalStateDataDirectory(plan.archiveCacheDirectory);
	await validateOpenStatesCollectionPlan(plan.collection, now);
	await mkdir(plan.archiveCacheDirectory, { recursive: true });
	const cache = await realpath(plan.archiveCacheDirectory);
	assertExternalStateDataDirectory(cache);
	if (cache === await realpath(plan.collection.cacheDirectory)) throw new Error("Profile archives and state CSVs require separate caches.");
	await mkdir(join(cache, "bodies"), { recursive: true });
	if (await realpath(join(cache, "bodies")) !== join(cache, "bodies")) throw new Error("Profile archive storage must not use a linked directory.");
	return cache;
}

async function readCapture(cache: string, plan: OpenStatesProfileCollectionPlan, now: number) {
	const value = await readOpenStatesCollectionMetadata(join(cache, "current.json")) as ArchiveCapture | null;
	if (!value) return null;
	if (Object.keys(value).some(key => !["schemaVersion", "collectionPolicySha256", "commit", "sha256", "capturedAt", "checkedAt", "readmeSha256", "etag"].includes(key)) || value.schemaVersion !== 1 || value.collectionPolicySha256 !== openStatesProfileCollectionPolicySha256 || !validCommit(value.commit) || !validHash(value.sha256) || !validDate(value.capturedAt, now) || !validDate(value.checkedAt, now) || Date.parse(value.checkedAt) < Date.parse(value.capturedAt) || value.readmeSha256 !== plan.accessReview.readmeSha256 || (value.etag !== undefined && !validEtag(value.etag)))
		throw new Error("The profile archive cache has invalid or incompatible provenance.");
	const path = join(cache, "bodies", `${value.sha256}.tar.gz`);
	if (digest(await readOpenStatesProfileArchive(path)) !== value.sha256) throw new Error("The cached profile archive does not match its fingerprint.");
	return { metadata: value, path };
}

async function readArchiveResponse(response: Response) {
	const maximum = openStatesProfileArchiveLimits.compressedBytes;
	const length = response.headers.get("content-length");
	if (length !== null && (!/^\d+$/u.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > maximum)) {
		await response.body?.cancel().catch(() => {});
		throw new Error("The profile archive response exceeds its size limit.");
	}
	if (!response.body) throw new Error("The profile archive response is empty.");
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let received = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			received += value.byteLength;
			if (received > maximum) {
				await reader.cancel().catch(() => {});
				throw new Error("The profile archive response exceeds its size limit.");
			}
			chunks.push(value);
		}
	}
	finally { reader.releaseLock(); }
	return Buffer.concat(chunks, received);
}

export async function seedOpenStatesProfileCollection(plan: OpenStatesProfileCollectionPlan, archive: OpenStatesProfileCapture & { path: string }, referenceFiles: string[], now = Date.now()) {
	const cache = await profileCache(plan, now);
	return withOpenStatesCollectionLock(cache, async () => {
		if (await readOpenStatesCollectionMetadata(join(cache, "current.json")) || await readOpenStatesCollectionMetadata(join(cache, "hold.json"))) throw new Error("Profile seeds never replace an existing archive cache or hold.");
		const bytes = await readOpenStatesProfileArchive(archive.path);
		if (!validCommit(archive.commit) || !validDate(archive.capturedAt, now) || digest(bytes) !== archive.sha256) throw new Error("The reviewed profile archive seed has invalid provenance.");
		const directory = join(plan.collection.outputRoot, `profile-seed-${now}`);
		await mkdir(directory);
		const preparationPlan = { schemaVersion: 1, type: "openstates-profile-enrichment", archive, referenceFiles, outputDirectory: join(directory, "prepared") };
		const path = join(directory, "plan.json");
		await writeFile(path, `${JSON.stringify(preparationPlan)}\n`, { flag: "wx" });
		const prepared = await prepareOpenStatesProfileFiles(path, now);
		if (prepared.archive.readmeSha256 !== plan.accessReview.readmeSha256) throw new Error("The profile seed's dedication differs from the reviewed publication.");
		await writeFile(join(cache, "bodies", `${archive.sha256}.tar.gz`), bytes, { flag: "wx" });
		const { path: archivePath, ...capture } = archive;
		await writeOpenStatesCollectionMetadata(join(cache, "current.json"), { schemaVersion: 1, collectionPolicySha256: openStatesProfileCollectionPolicySha256, ...capture, readmeSha256: prepared.archive.readmeSha256, checkedAt: archive.capturedAt });
		return { seeded: true, publisherRequests: 0, outputDirectory: prepared.outputDirectory };
	});
}

export async function collectOpenStatesProfiles(plan: OpenStatesProfileCollectionPlan, options: OpenStatesCollectionOptions = {}) {
	const now = options.now ?? Date.now;
	const cache = await profileCache(plan, now());
	const fetchImpl = options.fetchImpl ?? fetch;
	const sleep = options.sleep ?? (milliseconds => setTimeout(milliseconds));
	return withOpenStatesCollectionLock(cache, async () => {
		if (await readOpenStatesCollectionMetadata(join(cache, "hold.json"))) throw new Error("Profile archive access is on hold; a new review is required before any request.");
		let cached = await readCapture(cache, plan, now());
		let publisherRequests = 0;
		async function hold(reason: string, status?: number): Promise<never> {
			await writeOpenStatesCollectionMetadata(join(cache, "hold.json"), { reason, status, at: new Date(now()).toISOString() });
			throw new Error(`Profile collection stopped for review: ${reason}.`);
		}
		async function request(url: string, key: string, accept: string, etag?: string) {
			const path = join(cache, `attempt-${key}.json`);
			const previous = await readOpenStatesCollectionMetadata(path);
			if (previous && !validDate(previous.at, now())) throw new Error("Profile request-attempt provenance is invalid.");
			if (previous && now() - Date.parse(previous.at) < openStatesProfilePublication.minimumRefreshIntervalMs) throw new Error("Profile request cooldown is active; accepted data is unchanged.");
			await sleep(1000);
			await writeOpenStatesCollectionMetadata(path, { at: new Date(now()).toISOString() });
			publisherRequests++;
			const response = await fetchImpl(url, { headers: { "User-Agent": "BallotClarity-source-review/1.0 (+https://ballotclarity.org)", "X-GitHub-Api-Version": openStatesProfilePublication.apiVersion, "Accept": accept, ...(etag ? { "If-None-Match": etag } : {}) }, redirect: "manual", credentials: "omit", signal: AbortSignal.timeout(15_000) });
			if (response.redirected || [301, 303, 307, 308, 401, 403, 429].includes(response.status) || (response.status === 302 && !/^archive-[a-f0-9]{40}$/u.test(key))) {
				await response.body?.cancel().catch(() => {});
				return hold("publisher-denial-or-unexpected-redirect", response.status);
			}
			return response;
		}
		const collection = await collectOpenStates(plan.collection, options);
		const directory = dirname(collection.outputDirectory);
		const referenceFiles = await collectedReferenceFiles(collection, plan.collection.sourceIds);
		let status: "cache" | "same-commit" | "not-modified" | "downloaded" = "cache";
		let nextCapture = cached?.metadata;
		if (!cached || now() - Date.parse(cached.metadata.checkedAt) >= openStatesProfilePublication.minimumRefreshIntervalMs) {
			const response = await request(openStatesProfilePublication.commitUrl, "commit", "application/vnd.github+json", cached?.metadata.etag);
			if (response.status === 304) {
				await response.body?.cancel().catch(() => {});
				if (!cached?.metadata.etag) return hold("unexpected-not-modified", response.status);
				nextCapture = { ...cached.metadata, checkedAt: new Date(now()).toISOString() };
				status = "not-modified";
			}
			else {
				if (response.status !== 200) {
					await response.body?.cancel().catch(() => {});
					throw new Error(`Profile commit metadata is temporarily unavailable (${response.status}); accepted data is unchanged.`);
				}
				let commit: string;
				try {
					if (!/^application\/json(?:;|$)/iu.test(response.headers.get("content-type") ?? "")) throw new Error("Unexpected commit response.");
					const metadata = JSON.parse(await readProviderResponseText(response, 256 * 1024));
					if (!validCommit(metadata?.sha) || metadata.html_url !== `https://github.com/openstates/people/commit/${metadata.sha}` || metadata.url !== `https://api.github.com/repos/openstates/people/commits/${metadata.sha}`) throw new Error("Unexpected repository identity.");
					commit = metadata.sha;
				}
				catch {
					await response.body?.cancel().catch(() => {});
					return hold("invalid-repository-commit-metadata");
				}
				const etag = response.headers.get("etag") ?? undefined;
				if (etag !== undefined && !validEtag(etag)) return hold("invalid-commit-validator");
				if (commit === cached?.metadata.commit) {
					nextCapture = { ...cached.metadata, checkedAt: new Date(now()).toISOString(), etag };
					status = "same-commit";
				}
				else {
					const location = `https://codeload.github.com/openstates/people/legacy.tar.gz/${commit}`;
					const archiveResponse = await request(`https://api.github.com/repos/openstates/people/tarball/${commit}`, `archive-${commit}`, "application/vnd.github+json");
					await archiveResponse.body?.cancel().catch(() => {});
					if (archiveResponse.status === 404 || archiveResponse.status >= 500) throw new Error("Profile archive is temporarily unavailable; accepted data is unchanged.");
					if (archiveResponse.status !== 302 || archiveResponse.headers.get("location") !== location) return hold("unexpected-archive-redirect", archiveResponse.status);
					const content = await request(location, `content-${commit}`, "application/gzip");
					if (content.status !== 200 || !/^application\/(?:gzip|x-gzip|octet-stream)(?:;|$)/iu.test(content.headers.get("content-type") ?? "")) {
						await content.body?.cancel().catch(() => {});
						if (content.status === 404 || content.status >= 500) throw new Error("Profile archive is temporarily unavailable; accepted data is unchanged.");
						return hold("invalid-archive-response", content.status);
					}
					let bytes: Buffer;
					try {
						bytes = await readArchiveResponse(content);
					}
					catch { return hold("invalid-or-oversized-archive"); }
					const sha256 = digest(bytes);
					const path = join(cache, "bodies", `${sha256}.tar.gz`);
					try {
						await writeFile(path, bytes, { flag: "wx" });
					}
					catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || digest(await readOpenStatesProfileArchive(path)) !== sha256) throw error; }
					nextCapture = { schemaVersion: 1, collectionPolicySha256: openStatesProfileCollectionPolicySha256, commit, sha256, capturedAt: new Date(now()).toISOString(), checkedAt: new Date(now()).toISOString(), readmeSha256: plan.accessReview.readmeSha256, etag };
					cached = { metadata: nextCapture, path };
					status = "downloaded";
				}
			}
		}
		if (!cached || !nextCapture) throw new Error("No valid profile archive is available; accepted data is unchanged.");
		const preparationPlan = { schemaVersion: 1, type: "openstates-profile-enrichment", archive: { path: cached.path, commit: nextCapture.commit, sha256: nextCapture.sha256, capturedAt: nextCapture.capturedAt }, referenceFiles, outputDirectory: join(directory, "profiles") };
		const planPath = join(directory, "profile-enrichment-plan.json");
		await writeFile(planPath, `${JSON.stringify(preparationPlan, null, 2)}\n`, { flag: "wx" });
		let prepared: Awaited<ReturnType<typeof prepareOpenStatesProfileFiles>>;
		try {
			prepared = await prepareOpenStatesProfileFiles(planPath, now());
			if (prepared.archive.readmeSha256 !== plan.accessReview.readmeSha256) return hold("repository-dedication-changed");
		}
		catch (error) {
			if (typeof (error as NodeJS.ErrnoException).code === "string" && (error as NodeJS.ErrnoException).code!.startsWith("E")) throw error;
			if (await readOpenStatesCollectionMetadata(join(cache, "hold.json"))) throw error;
			return hold("invalid-profile-archive-or-inputs");
		}
		await writeOpenStatesCollectionMetadata(join(cache, "current.json"), nextCapture);
		const receipt = { schemaVersion: 1, type: "openstates-profile-collection-result", complete: collection.complete && prepared.complete, outputDirectory: prepared.outputDirectory, collection, archive: { ...nextCapture, status }, publisherRequests: collection.publisherRequests + publisherRequests, prepared, imported: false };
		await writeFile(join(directory, "profile-collection-result.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
		return receipt;
	});
}

export async function collectOpenStatesProfilesFile(path: string) {
	return collectOpenStatesProfiles(JSON.parse(await readBoundedStateData(path)));
}
