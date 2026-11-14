import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readdir, realpath, rename, unlink } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import process from "node:process";
import { withStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { assertUnionAutomationCapacity, inspectUnionBallotAutomation, readUnionBallotAutomationPlan } from "./union-ballot-automation.js";
import { unionCandidateHash as hash } from "./union-county-candidates.js";
import { prepareUnionMeasureGuideFiles } from "./union-measure-guides.js";

interface Pin { path: string; sha256: string }
interface Policy { schemaVersion: 1; type: "union-measure-automation-policy"; profileSha256: string; reviews: Pin[]; baseSnapshot: Pin | null }
interface Attempt { runId: string; preparedRunId: string; inputSha256: string; createdAt: string; retryAt: string | null; status: "prepared-for-review" | "editorial-review-required" | "no-questions-offered" | "failed"; preparedGuides: number; files: { path: string; bytes: number; sha256: string }[] }
interface State { schemaVersion: 1; type: "union-measure-automation-state"; lastAttempt: Attempt | null; latestReady: Attempt | null; previousReady: Attempt | null }
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const runId = (value: unknown): value is string => typeof value === "string" && /^run-[a-f0-9-]{36}$/u.test(value);
const clock = (value: unknown, now: number): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= now;
const pin = (value: unknown): value is Pin => exact(value, ["path", "sha256"]) && typeof value.path === "string" && isAbsolute(value.path) && digest(value.sha256);

async function privateFile(path: string) {
	const metadata = await lstat(path);
	if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.uid !== process.getuid?.() || (metadata.mode & 0o077) !== 0 || await realpath(path) !== path) throw new Error("Union question automation requires physical owner-private configuration.");
	return readBoundedStateDataBytes(path, 128 * 1024);
}
async function store(directory: string, name: string, value: unknown, replace = false) {
	const body = `${JSON.stringify(value)}\n`;
	if (Buffer.byteLength(body) > 128 * 1024) throw new Error("Union question automation metadata exceeds its bound.");
	const temporary = replace ? `.measure-${randomUUID()}.tmp` : name;
	const handle = await open(join(directory, temporary), "wx", 0o600);
	try {
		await handle.writeFile(body);
		await handle.sync();
	}
	finally { await handle.close(); }
	if (replace) {
		try {
			try {
				await privateFile(join(directory, name));
			}
			catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
			await rename(join(directory, temporary), join(directory, name));
		}
		finally {
			await unlink(join(directory, temporary)).catch((error: NodeJS.ErrnoException) => {
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
async function readState(directory: string, now: number): Promise<State> {
	let value: unknown;
	try {
		value = JSON.parse((await privateFile(join(directory, "state.json"))).toString("utf8"));
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: 1, type: "union-measure-automation-state", lastAttempt: null, latestReady: null, previousReady: null };
		throw error;
	}
	if (!exact(value, ["schemaVersion", "type", "lastAttempt", "latestReady", "previousReady"]) || value.schemaVersion !== 1 || value.type !== "union-measure-automation-state") throw new Error("Union question automation state requires review.");
	for (const item of [value.lastAttempt, value.latestReady, value.previousReady]) {
		if (item === null) continue;
		if (!exact(item, ["runId", "preparedRunId", "inputSha256", "createdAt", "retryAt", "status", "preparedGuides", "files"]) || !runId(item.runId) || !runId(item.preparedRunId) || !digest(item.inputSha256) || !clock(item.createdAt, now) || typeof item.status !== "string" || !["prepared-for-review", "editorial-review-required", "no-questions-offered", "failed"].includes(item.status) || !Number.isSafeInteger(item.preparedGuides) || Number(item.preparedGuides) < 0 || Number(item.preparedGuides) > 99 || (item.status === "prepared-for-review" ? Number(item.preparedGuides) < 1 : item.preparedGuides !== 0) || !Array.isArray(item.files) || item.files.length > 512 || (item.status === "failed" ? typeof item.retryAt !== "string" || !Number.isFinite(Date.parse(item.retryAt)) || new Date(item.retryAt).toISOString() !== item.retryAt || Date.parse(item.retryAt) < Date.parse(item.createdAt) || Date.parse(item.retryAt) > now + 2592000000 || item.files.length !== 0 : item.retryAt !== null || item.files.length === 0)) throw new Error("Union question preparation receipt requires review.");
		const paths = new Set<string>();
		for (const file of item.files) {
			if (!exact(file, ["path", "bytes", "sha256"]) || typeof file.path !== "string" || !file.path.startsWith(`${item.runId}/bundle/`) || !/^run-[a-f0-9-]{36}\/bundle\/(?:assembly\/)?[a-zA-Z0-9][a-zA-Z0-9.-]*$/u.test(file.path) || paths.has(file.path) || !digest(file.sha256) || !Number.isSafeInteger(file.bytes) || Number(file.bytes) < 1 || Number(file.bytes) > 12 * 1024 * 1024) throw new Error("Union question output inventory requires review.");
			paths.add(file.path);
			const path = join(directory, file.path);
			if (await realpath(path) !== path) throw new Error("Union question output cannot use redirected storage.");
			const metadata = await lstat(path);
			if (!metadata.isFile() || metadata.size !== file.bytes) throw new Error("Union question output bytes changed.");
			const body = await readBoundedStateDataBytes(path, Number(file.bytes));
			if (body.length !== file.bytes || hash(body) !== file.sha256) throw new Error("Union question output bytes changed.");
		}
	}
	const state = value as unknown as State;
	if ([state.latestReady, state.previousReady].some(item => item && (item.status !== "prepared-for-review" || item.preparedGuides < 1))) throw new Error("Union question ready pointers require complete guide proposals.");
	return state;
}
async function inventory(directory: string, run: string) {
	const files: Attempt["files"] = [];
	let bytes = 0;
	async function scan(parent: string, depth: number) {
		if (depth > 1) throw new Error("Union question output depth requires review.");
		for (const entry of await readdir(parent, { withFileTypes: true })) {
			const path = join(parent, entry.name);
			if (entry.isDirectory()) {
				await scan(path, depth + 1);
			}
			else {
				if (!entry.isFile() || files.length >= 512) throw new Error("Union question output requires bounded regular files.");
				const metadata = await lstat(path);
				if (!metadata.isFile() || metadata.size < 1 || metadata.size > 12 * 1024 * 1024) throw new Error("Union question output exceeds its file bound.");
				const body = await readBoundedStateDataBytes(path, metadata.size);
				bytes += body.length;
				files.push({ path: relative(directory, path), bytes: body.length, sha256: hash(body) });
				if (files.length > 512 || bytes > 128 * 1024 * 1024) throw new Error("Union question output exceeds its inventory bound.");
			}
		}
	}
	await scan(join(directory, run, "bundle"), 0);
	return files.sort((first, second) => first.path.localeCompare(second.path));
}
export async function prepareUnionAutomatedMeasureGuides(profilePath: string, policyPath: string, options: Parameters<typeof prepareUnionMeasureGuideFiles>[1] = {}) {
	const plan = await readUnionBallotAutomationPlan(profilePath);
	const profileBody = await privateFile(profilePath);
	const policyBody = await privateFile(policyPath);
	const value: unknown = JSON.parse(policyBody.toString("utf8"));
	if (!exact(value, ["schemaVersion", "type", "profileSha256", "reviews", "baseSnapshot"]) || value.schemaVersion !== 1 || value.type !== "union-measure-automation-policy" || value.profileSha256 !== hash(profileBody) || !Array.isArray(value.reviews) || value.reviews.length > 25 || value.reviews.some(item => !pin(item)) || (value.baseSnapshot !== null && !pin(value.baseSnapshot))) throw new Error("Union question automation policy must bind the exact reviewed profile and source reviews.");
	const policy = value as unknown as Policy;
	const reviews = new Map<string, Pin>();
	for (const selected of policy.reviews) {
		const body = await readBoundedStateDataBytes(selected.path, 128 * 1024);
		if (hash(body) !== selected.sha256) throw new Error("Union question editorial review bytes changed.");
		const review: unknown = JSON.parse(body.toString("utf8"));
		if (!review || typeof review !== "object" || !("electionDate" in review) || typeof review.electionDate !== "string" || !/^20\d{2}-11-0[2-8]$/u.test(review.electionDate) || reviews.has(review.electionDate)) throw new Error("Select one exact Union question review per election.");
		reviews.set(review.electionDate, selected);
	}
	if (policy.baseSnapshot && hash(await readBoundedStateDataBytes(policy.baseSnapshot.path)) !== policy.baseSnapshot.sha256) throw new Error("Union question base snapshot bytes changed.");
	const now = options.now ?? Date.now;
	if (!Number.isSafeInteger(now()) || now() < 0) throw new Error("Union question automation clock requires review.");
	return withStateBallotAutomationLock(plan.directory, "automation.lock", async () => {
		const inspected = await inspectUnionBallotAutomation(profilePath, now());
		const prepared = inspected.state?.latestPrepared;
		if (!prepared || !["prepared-review-required", "unchanged"].includes(inspected.state!.status)) throw new Error("Union question automation requires a complete successful worker preparation.");
		const directory = join(plan.directory, "question-guides");
		await mkdir(directory, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== "EEXIST") throw error;
		});
		const metadata = await lstat(directory);
		if (!metadata.isDirectory() || metadata.isSymbolicLink() || metadata.uid !== process.getuid?.() || (metadata.mode & 0o077) !== 0 || await realpath(directory) !== directory) throw new Error("Union question automation requires physical private storage.");
		const state = await readState(directory, now());
		const question = prepared.files.find(file => file.path.endsWith("/questions.json"))!;
		const inputSha256 = hash(JSON.stringify({ profile: hash(profileBody), policy: hash(policyBody), preparedRunId: prepared.runId, questions: question.sha256 }));
		if (state.lastAttempt?.inputSha256 === inputSha256 && (state.lastAttempt.status !== "failed" || now() < Date.parse(state.lastAttempt.retryAt!))) return { ...state, status: state.lastAttempt.status, skipped: true, publisherRequests: 0, imported: false, publicationApproved: false, automaticImportApproved: false };
		await assertUnionAutomationCapacity(plan.directory);
		const run = `run-${randomUUID()}`;
		const output = join(directory, run);
		await mkdir(output, { mode: 0o700 });
		const attempt: Attempt = { runId: run, preparedRunId: prepared.runId, inputSha256, createdAt: new Date(now()).toISOString(), retryAt: null, status: "failed", preparedGuides: 0, files: [] };
		try {
			const root = join(plan.directory, "runs", prepared.runId);
			const questionPlan: unknown = JSON.parse((await readBoundedStateDataBytes(join(root, "question-plan.json"), 32768)).toString("utf8"));
			if (!exact(questionPlan, ["schemaVersion", "type", "ballotCaptures", "outputRoot"]) || questionPlan.schemaVersion !== 1 || questionPlan.type !== "union-ballot-question-preparation" || questionPlan.outputRoot !== join(root, "questions") || !Array.isArray(questionPlan.ballotCaptures) || questionPlan.ballotCaptures.some(item => !pin(item))) throw new Error("Union worker question capture plan requires review.");
			const research = JSON.parse((await readBoundedStateDataBytes(join(root, question.path))).toString("utf8"));
			if (JSON.stringify(questionPlan.ballotCaptures.map(item => item.sha256)) !== JSON.stringify(research.ballotCaptureHashes)) throw new Error("Union question capture pins differ from the prepared evidence.");
			const guidePlan = { schemaVersion: 1, type: "union-measure-guide-preparation", ballotCaptures: questionPlan.ballotCaptures, review: reviews.get(prepared.electionDate) ?? null, baseSnapshot: policy.baseSnapshot, outputDirectory: join(output, "bundle"), outputName: "union-measures" };
			await store(output, "plan.json", guidePlan);
			const result = await prepareUnionMeasureGuideFiles(join(output, "plan.json"), options);
			if (result.status !== "prepared-for-review" && result.status !== "editorial-review-required" && result.status !== "no-questions-offered") throw new Error("Union question preparation returned an unknown outcome.");
			if (hash(await readBoundedStateDataBytes(join(output, "bundle", "questions.json"))) !== question.sha256 || hash(await privateFile(profilePath)) !== hash(profileBody) || hash(await privateFile(policyPath)) !== hash(policyBody) || (await inspectUnionBallotAutomation(profilePath, now())).state?.latestPrepared?.runId !== prepared.runId) throw new Error("Union question automation inputs changed during preparation.");
			attempt.status = result.status;
			attempt.preparedGuides = result.preparedGuides;
			attempt.files = await inventory(directory, run);
			if (attempt.status === "prepared-for-review") {
				state.previousReady = state.latestReady;
				state.latestReady = attempt;
			}
		}
		catch (error) {
			attempt.status = "failed";
			attempt.preparedGuides = 0;
			attempt.retryAt = new Date(now() + plan.intervalMs).toISOString();
			attempt.files = [];
			state.lastAttempt = attempt;
			await store(output, "receipt.json", attempt);
			await store(directory, "state.json", state, true);
			throw error;
		}
		state.lastAttempt = attempt;
		await store(output, "receipt.json", attempt);
		await store(directory, "state.json", state, true);
		return { ...state, status: attempt.status, skipped: false, publisherRequests: 0, imported: false, publicationApproved: false, automaticImportApproved: false };
	});
}
