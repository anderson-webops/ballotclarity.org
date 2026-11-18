import type { LafayetteResolutionEvidence } from "./lafayette-measure-guides.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readdir, realpath, rename, unlink } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import process from "node:process";
import { collectLafayetteGuideResearch, readLafayetteGuideCollectionPlan } from "./lafayette-guide-collection.js";
import { prepareLafayetteMeasureGuideFiles } from "./lafayette-measure-guides.js";
import { withStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

interface Pin { path: string; sha256: string }
interface Cohort { electionDate: string; review: Pin | null; documents: LafayetteResolutionEvidence[] }
interface Policy { schemaVersion: 1; type: "lafayette-guide-automation-policy"; profileSha256: string; intervalMs: number; cohorts: Cohort[]; baseSnapshot: Pin | null }
type Status = "started" | "prepared-for-review" | "editorial-review-required" | "awaiting-offered-guide" | "unchanged" | "failed";
interface FilePin extends Pin { bytes: number }
interface Attempt { runId: string; enrollmentSha256: string; inputSha256: string | null; createdAt: string; nextRunAt: string; status: Status; electionDate: string | null; capture: Pin | null; guides: number; files: FilePin[]; error: string | null }
interface State { schemaVersion: 1; type: "lafayette-guide-automation-state"; lastAttempt: Attempt | null; latestPrepared: Attempt | null; previousPrepared: Attempt | null }
interface Options { now?: () => number; collect?: typeof collectLafayetteGuideResearch; collection?: Parameters<typeof collectLafayetteGuideResearch>[1]; preparation?: Parameters<typeof prepareLafayetteMeasureGuideFiles>[1] }
const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);
const pin = (value: unknown): value is Pin => exact(value, ["path", "sha256"]) && typeof value.path === "string" && isAbsolute(value.path) && digest(value.sha256);
const date = (value: unknown): value is string => typeof value === "string" && /^20\d{2}-\d{2}-\d{2}$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const instant = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const runPattern = /^run-[a-f\d-]{36}$/u;
const capturePattern = /^intake-\d{13}-[a-f\d-]{36}\/capture\.json$/u;
const filePattern = /^run-[a-f\d-]{36}\/bundle\/(?:guides\/)?[a-zA-Z0-9][a-zA-Z0-9.-]{0,180}$/u;

async function privateFile(path: string) {
	const metadata = await lstat(path);
	if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.uid !== process.getuid?.() || (metadata.mode & 0o077) !== 0 || await realpath(path) !== path) throw new Error("Lafayette automation requires physical owner-private configuration and state.");
	return readBoundedStateDataBytes(path, 128 * 1024);
}
async function store(directory: string, filename: string, value: unknown, replace = false) {
	const body = `${JSON.stringify(value)}\n`;
	if (Buffer.byteLength(body) > 128 * 1024) throw new Error("Lafayette automation metadata exceeds its bound.");
	const name = replace
		? `.preparation-${randomUUID()}.tmp`
		: filename;
	const handle = await open(join(directory, name), "wx", 0o600);
	try {
		await handle.writeFile(body);
		await handle.sync();
	}
	finally { await handle.close(); }
	if (replace) {
		try {
			try {
				await privateFile(join(directory, filename));
			}
			catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
			await rename(join(directory, name), join(directory, filename));
		}
		finally {
			await unlink(join(directory, name)).catch((error: NodeJS.ErrnoException) => {
				if (error.code !== "ENOENT") throw error;
			});
		}
	}
	const parent = await open(directory, "r");
	try {
		await parent.sync();
	}
	finally { await parent.close(); }
}
async function boundedFile(path: string, maximumBytes = 12 * 1024 * 1024) {
	const metadata = await lstat(path);
	if (!metadata.isFile() || metadata.size > maximumBytes) throw new Error("A Lafayette input exceeds its regular-file bound.");
	return readBoundedStateDataBytes(path, Math.max(1, metadata.size));
}
async function checkedPin(value: Pin, maximumBytes = 12 * 1024 * 1024) {
	const body = await boundedFile(value.path, maximumBytes);
	if (hash(body) !== value.sha256) throw new Error("A pinned Lafayette input changed.");
	return body;
}
async function capacity(root: string, reserve = false) {
	let bytes = 0;
	let count = 0;
	async function inspect(directory: string, depth: number) {
		if (depth > 6) throw new Error("Lafayette retained storage exceeds its reviewed depth.");
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) {
				await inspect(path, depth + 1);
			}
			else {
				if (!entry.isFile()) throw new Error("Lafayette retained storage requires physical regular files.");
				bytes += (await lstat(path)).size;
				count += 1;
				if (bytes > (reserve ? 128 : 256) * 1024 * 1024 || count > (reserve ? 7168 : 8192)) throw new Error("Lafayette retained storage needs owner-reviewed archival before another capture.");
			}
		}
	}
	await inspect(root, 0);
}
async function captureFile(root: string, selected: Pin, now: number) {
	if (!capturePattern.test(selected.path) || !digest(selected.sha256)) throw new Error("Lafayette capture identity requires review.");
	const path = join(root, selected.path);
	if (await realpath(path) !== path) throw new Error("Lafayette capture storage cannot be redirected.");
	const manifest = JSON.parse((await checkedPin({ path, sha256: selected.sha256 }, 128 * 1024)).toString("utf8"));
	if (manifest.schemaVersion !== 1 || manifest.type !== "lafayette-guide-capture" || !["prepared-for-review", "awaiting-offered-guide"].includes(manifest.status) || !Array.isArray(manifest.captures) || manifest.captures.length !== (manifest.selected === null
		? 4
		: 12)) {
		throw new Error("Lafayette captured publication inventory requires review.");
	}
	const paths = new Set<string>();
	let totalBytes = 0;
	for (const input of manifest.captures) {
		if (!input || typeof input.path !== "string" || !/^\d{2}-[a-f\d]{64}\.bin$/u.test(input.path) || !digest(input.sha256) || !Number.isSafeInteger(input.bytes) || input.bytes < 0 || input.bytes > 12 * 1024 * 1024 || !instant(input.capturedAt) || Date.parse(input.capturedAt) > now) throw new Error("Lafayette captured input metadata requires review.");
		totalBytes += input.bytes;
		if (paths.has(input.path) || totalBytes > 32 * 1024 * 1024) throw new Error("Lafayette captured inventory exceeds its complete-source bound.");
		paths.add(input.path);
		const bodyPath = join(root, selected.path.slice(0, -"capture.json".length), input.path);
		if (await realpath(bodyPath) !== bodyPath) throw new Error("Lafayette captured input cannot be redirected.");
		const body = await checkedPin({ path: bodyPath, sha256: input.sha256 });
		if (body.length !== input.bytes) throw new Error("Lafayette captured input length changed.");
	}
	return manifest;
}
async function readState(directory: string, root: string, now: number): Promise<State> {
	let value: unknown;
	try {
		value = JSON.parse((await privateFile(join(directory, "state.json"))).toString("utf8"));
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		return {
			schemaVersion: 1,
			type: "lafayette-guide-automation-state",
			lastAttempt: null,
			latestPrepared: null,
			previousPrepared: null
		};
	}
	if (!exact(value, [
		"schemaVersion",
		"type",
		"lastAttempt",
		"latestPrepared",
		"previousPrepared"
	]) || value.schemaVersion !== 1 || value.type !== "lafayette-guide-automation-state") {
		throw new Error("Lafayette preparation state requires review.");
	}
	for (const selected of [value.lastAttempt, value.latestPrepared, value.previousPrepared]) {
		if (selected === null) continue;
		if (!exact(selected, [
			"runId",
			"enrollmentSha256",
			"inputSha256",
			"createdAt",
			"nextRunAt",
			"status",
			"electionDate",
			"capture",
			"guides",
			"files",
			"error"
		]) || typeof selected.runId !== "string" || !runPattern.test(selected.runId) || !digest(selected.enrollmentSha256) || (selected.inputSha256 !== null && !digest(selected.inputSha256)) || !instant(selected.createdAt) || Date.parse(selected.createdAt) > now || !instant(selected.nextRunAt) || Date.parse(selected.nextRunAt) < Date.parse(selected.createdAt) || Date.parse(selected.nextRunAt) > Date.parse(selected.createdAt) + 604800000 || typeof selected.status !== "string" || ![
			"started",
			"prepared-for-review",
			"editorial-review-required",
			"awaiting-offered-guide",
			"unchanged",
			"failed"
		].includes(selected.status) || (selected.electionDate !== null && !date(selected.electionDate)) || !Number.isInteger(selected.guides) || Number(selected.guides) < 0 || Number(selected.guides) > 2 || !Array.isArray(selected.files) || selected.files.length > 512 || (selected.error !== null && (typeof selected.error !== "string" || selected.error.length > 500))) {
			throw new Error("Lafayette preparation receipt requires review.");
		}
		if (selected.capture !== null) {
			if (!exact(selected.capture, ["path", "sha256"]) || typeof selected.capture.path !== "string" || !digest(selected.capture.sha256)) throw new Error("Lafayette capture receipt requires review.");
			const capture = await captureFile(root, selected.capture as unknown as Pin, now);
			if ((capture.selected?.electionDate ?? null) !== selected.electionDate) throw new Error("Lafayette preparation and capture election dates differ.");
		}
		if (selected.status === "prepared-for-review"
			? !selected.guides || !selected.files.length || selected.capture === null || !date(selected.electionDate)
			: selected.guides !== 0) {
			throw new Error("Lafayette prepared guide receipt is incomplete.");
		}
		if ([
			"started",
			"awaiting-offered-guide",
			"unchanged",
			"failed"
		].includes(selected.status) && selected.files.length !== 0) {
			throw new Error("Lafayette attempt status has an unexpected proposal inventory.");
		}
		if (selected.status === "failed"
			? !selected.error
			: selected.error !== null) {
			throw new Error("Lafayette attempt error status requires review.");
		}
		const paths = new Set<string>();
		for (const file of selected.files) {
			if (!exact(file, ["path", "bytes", "sha256"]) || typeof file.path !== "string" || !filePattern.test(file.path) || !file.path.startsWith(`${selected.runId}/bundle/`) || paths.has(file.path) || !Number.isSafeInteger(file.bytes) || Number(file.bytes) < 1 || Number(file.bytes) > 32 * 1024 * 1024 || !digest(file.sha256)) throw new Error("Lafayette preparation file inventory requires review.");
			paths.add(file.path);
			const path = join(directory, file.path);
			if (await realpath(path) !== path || (await checkedPin({ path, sha256: file.sha256 }, 32 * 1024 * 1024)).length !== file.bytes) throw new Error("Lafayette prepared files changed.");
		}
	}
	const state = value as unknown as State;
	if ([state.latestPrepared, state.previousPrepared].some(item => item !== null && item.status !== "prepared-for-review")) throw new Error("Lafayette prepared pointers require complete proposals.");
	return state;
}
async function inventory(directory: string, runId: string) {
	const files: FilePin[] = [];
	async function inspect(parent: string) {
		for (const entry of await readdir(parent, { withFileTypes: true })) {
			const path = join(parent, entry.name);
			if (entry.isDirectory()) {
				if (entry.name !== "guides" || parent !== join(directory, runId, "bundle")) throw new Error("Lafayette proposal output exceeds its directory bound.");
				await inspect(path);
			}
			else {
				const name = relative(directory, path);
				if (!entry.isFile() || !filePattern.test(name) || files.length >= 512) throw new Error("Lafayette proposal output requires bounded regular files.");
				const body = await boundedFile(path, 32 * 1024 * 1024);
				files.push({
					path: name,
					bytes: body.length,
					sha256: hash(body)
				});
			}
		}
	}
	await inspect(join(directory, runId, "bundle"));
	return files.sort((first, second) => first.path.localeCompare(second.path));
}
async function location(profilePath: string) {
	const body = await privateFile(profilePath);
	const plan = await readLafayetteGuideCollectionPlan(profilePath);
	assertExternalStateDataDirectory(plan.outputRoot);
	await mkdir(plan.outputRoot, { recursive: true });
	const root = await realpath(plan.outputRoot);
	assertExternalStateDataDirectory(root);
	const directory = join(root, "measure-automation");
	await mkdir(directory, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
		if (error.code !== "EEXIST") throw error;
	});
	const metadata = await lstat(directory);
	if (!metadata.isDirectory() || metadata.isSymbolicLink() || metadata.uid !== process.getuid?.() || (metadata.mode & 0o077) !== 0 || await realpath(directory) !== directory) throw new Error("Lafayette automation requires physical private storage.");
	return { root, directory, body };
}
export async function inspectLafayetteGuideAutomation(profilePath: string, now = Date.now()) {
	const selected = await location(profilePath);
	const state = await readState(selected.directory, selected.root, now);
	return {
		directory: selected.directory,
		...state,
		status: state.lastAttempt?.status === "started"
			? "incomplete-attempt"
			: state.lastAttempt?.status ?? "uninitialized",
		publisherRequests: 0,
		imported: false,
		publicationApproved: false
	};
}
export async function runLafayetteGuideAutomation(profilePath: string, policyPath: string, options: Options = {}) {
	const selected = await location(profilePath);
	const policyBody = await privateFile(policyPath);
	const value: unknown = JSON.parse(policyBody.toString("utf8"));
	if (!exact(value, [
		"schemaVersion",
		"type",
		"profileSha256",
		"intervalMs",
		"cohorts",
		"baseSnapshot"
	]) || value.schemaVersion !== 1 || value.type !== "lafayette-guide-automation-policy" || value.profileSha256 !== hash(selected.body) || !Number.isSafeInteger(value.intervalMs) || Number(value.intervalMs) < 3600000 || Number(value.intervalMs) > 604800000 || !Array.isArray(value.cohorts) || value.cohorts.length > 25 || (value.baseSnapshot !== null && !pin(value.baseSnapshot))) {
		throw new Error("Lafayette automation policy must bind the exact collection profile and reviewed cohorts.");
	}
	const policy = value as unknown as Policy;
	const dates = new Set<string>();
	for (const cohort of policy.cohorts) {
		if (!exact(cohort, ["electionDate", "review", "documents"]) || !date(cohort.electionDate) || dates.has(cohort.electionDate) || (cohort.review !== null && !pin(cohort.review)) || !Array.isArray(cohort.documents) || !cohort.documents.length || cohort.documents.length > 2) throw new Error("Lafayette automation requires one reviewed cohort per election.");
		dates.add(cohort.electionDate);
		if (cohort.review) {
			const review = JSON.parse((await checkedPin(cohort.review, 128 * 1024)).toString("utf8"));
			if (review.schemaVersion !== 1 || review.type !== "lafayette-measure-editorial-review" || review.electionDate !== cohort.electionDate || review.publicationApproved !== false || review.automaticImportApproved !== false) throw new Error("Lafayette editorial review must retain its exact election and approval state.");
		}
		for (const document of cohort.documents) {
			if (!exact(document, [
				"path",
				"sha256",
				"area",
				"resolution",
				"url",
				"capturedAt"
			]) || typeof document.path !== "string" || !isAbsolute(document.path) || !digest(document.sha256) || !["Lafayette Parish", "City of Lafayette"].includes(document.area) || typeof document.resolution !== "string" || typeof document.url !== "string" || !instant(document.capturedAt)) {
				throw new Error("Lafayette call-document pins require review.");
			}
			await checkedPin(document);
		}
	}
	if (policy.baseSnapshot) await checkedPin(policy.baseSnapshot, 32 * 1024 * 1024);
	const now = options.now ?? Date.now;
	if (!Number.isSafeInteger(now()) || now() < 0) throw new Error("Lafayette automation clock requires review.");
	return withStateBallotAutomationLock(selected.directory, "automation.lock", async () => {
		const state = await readState(selected.directory, selected.root, now());
		const enrollmentSha256 = hash(JSON.stringify([
			hash(selected.body),
			hash(policyBody)
		]));
		if (state.lastAttempt?.status === "started") {
			state.lastAttempt.status = "failed";
			state.lastAttempt.error = "The earlier preparation did not finish; its original captures and proposals are retained.";
			await store(selected.directory, "state.json", state, true);
		}
		if (state.lastAttempt?.enrollmentSha256 === enrollmentSha256 && now() < Date.parse(state.lastAttempt.nextRunAt)) {
			return {
				...state,
				status: state.lastAttempt.status,
				skipped: true,
				publisherRequests: 0,
				imported: false,
				publicationApproved: false
			};
		}
		await capacity(selected.root, true);
		const runId = `run-${randomUUID()}`;
		const output = join(selected.directory, runId);
		await mkdir(output, { mode: 0o700 });
		const attempt: Attempt = {
			runId,
			enrollmentSha256,
			inputSha256: null,
			createdAt: new Date(now()).toISOString(),
			nextRunAt: new Date(now() + policy.intervalMs).toISOString(),
			status: "started",
			electionDate: null,
			capture: null,
			guides: 0,
			files: [],
			error: null
		};
		state.lastAttempt = attempt;
		await store(output, "started.json", attempt);
		await store(selected.directory, "state.json", state, true);
		try {
			if (hash(await privateFile(profilePath)) !== hash(selected.body) || hash(await privateFile(policyPath)) !== hash(policyBody)) throw new Error("Lafayette enrollment changed before collection.");
			const collected = await (options.collect ?? collectLafayetteGuideResearch)(profilePath, options.collection);
			const capturePath = relative(selected.root, join(collected.outputDirectory, "capture.json"));
			attempt.capture = { path: capturePath, sha256: collected.captureSha256 };
			const capture = await captureFile(selected.root, attempt.capture, now());
			attempt.electionDate = collected.electionDate;
			if (capture.status !== collected.status || (capture.selected?.electionDate ?? null) !== attempt.electionDate) throw new Error("Lafayette collection result differs from its durable receipt.");
			if (attempt.electionDate === null) {
				attempt.status = "awaiting-offered-guide";
			}
			else {
				const cohort = policy.cohorts.find(item => item.electionDate === attempt.electionDate);
				attempt.inputSha256 = hash(JSON.stringify({
					enrollmentSha256,
					electionDate: attempt.electionDate,
					sources: capture.captures.filter((item: { url: string }) => [capture.selected.url, "https://www.lafayettela.info/"].includes(item.url)).map((item: { url: string; sha256: string }) => ({ url: item.url, sha256: item.sha256 }))
				}));
				if (state.latestPrepared?.inputSha256 === attempt.inputSha256) {
					attempt.status = "unchanged";
				}
				else if (!cohort) {
					await mkdir(join(output, "bundle"), { mode: 0o700 });
					await store(join(output, "bundle"), "review-required.json", {
						electionDate: attempt.electionDate,
						capture: attempt.capture,
						reason: "reviewed-call-documents-and-editorial-evidence-required",
						imported: false,
						publicationApproved: false
					});
					attempt.status = "editorial-review-required";
					attempt.files = await inventory(selected.directory, runId);
				}
				else {
					const sourcePin = (url: string) => {
						const source = capture.captures.find((item: { url: string }) => item.url === url);
						if (!source) throw new Error("Lafayette capture lacks a required publication.");
						return {
							path: join(collected.outputDirectory, source.path),
							sha256: source.sha256,
							url: source.url,
							capturedAt: source.capturedAt
						};
					};
					await store(output, "research-plan.json", {
						schemaVersion: 1,
						type: "lafayette-ballot-research-preparation",
						electionDate: attempt.electionDate,
						guide: sourcePin(capture.selected.url),
						governmentPage: sourcePin("https://www.lafayettela.info/"),
						outputDirectory: join(output, "research")
					});
					const researchPlan = {
						path: join(output, "research-plan.json"),
						sha256: hash(await readBoundedStateDataBytes(join(output, "research-plan.json")))
					};
					await store(output, "plan.json", {
						schemaVersion: 1,
						type: "lafayette-measure-guide-preparation",
						researchPlan,
						review: cohort.review,
						documents: cohort.documents,
						baseSnapshot: policy.baseSnapshot,
						outputDirectory: join(output, "bundle"),
						outputName: "lafayette-measures"
					});
					const prepared = await prepareLafayetteMeasureGuideFiles(join(output, "plan.json"), {
						...options.preparation,
						now: now()
					});
					if (prepared.guides > 0 && !prepared.reviewRequired && (prepared.prepared?.guides !== prepared.guides || prepared.prepared.measures !== prepared.measures)) throw new Error("Lafayette assembled guides differ from the complete native proposal.");
					attempt.status = prepared.guides > 0 && !prepared.reviewRequired
						? "prepared-for-review"
						: "editorial-review-required";
					attempt.guides = attempt.status === "prepared-for-review"
						? prepared.guides
						: 0;
					attempt.files = await inventory(selected.directory, runId);
				}
			}
			await capacity(selected.root);
			if (hash(await privateFile(profilePath)) !== hash(selected.body) || hash(await privateFile(policyPath)) !== hash(policyBody)) throw new Error("Lafayette enrollment changed during preparation.");
			if (attempt.status === "prepared-for-review") {
				state.previousPrepared = state.latestPrepared;
				state.latestPrepared = attempt;
			}
		}
		catch (error) {
			attempt.status = "failed";
			attempt.guides = 0;
			attempt.files = [];
			attempt.error = error instanceof Error
				? error.message.slice(0, 500)
				: "Lafayette preparation failed.";
			await store(output, "receipt.json", attempt);
			await store(selected.directory, "state.json", state, true);
			throw error;
		}
		await store(output, "receipt.json", attempt);
		await store(selected.directory, "state.json", state, true);
		return {
			...state,
			status: attempt.status,
			skipped: false,
			imported: false,
			publicationApproved: false
		};
	});
}
