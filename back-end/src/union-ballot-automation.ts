import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { UnionBallotAccessReview, UnionBallotCollectionOptions } from "./union-county-ballots.js";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readdir, realpath, rename, unlink } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import process from "node:process";
import { setTimeout as pause } from "node:timers/promises";
import { collectUnionBallotEvidence } from "./collect-union-ballot-evidence.js";
import { loadUnionBallotCaptures } from "./prepare-union-ballot-corroboration.js";
import { prepareUnionBallotQuestions } from "./prepare-union-ballot-questions.js";
import { prepareUnionCandidateSnapshot } from "./prepare-union-candidate-snapshot.js";
import { acquireStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { unionCandidateHash as hash } from "./union-county-candidates.js";

interface Pin { path: string; sha256: string }
interface Plan { schemaVersion: 1; type: "union-ballot-automation"; directory: string; accessReview: UnionBallotAccessReview; intervalMs: number }
interface Prepared { runId: string; identitySha256: string; electionDate: string; capturedAt: string; candidates: number; questions: number; files: { path: string; bytes: number; sha256: string }[] }
interface State {
	schemaVersion: 1;
	type: "union-ballot-automation-state";
	status: "running" | "prepared-review-required" | "unchanged" | "failed";
	startedAt: string;
	finishedAt: string | null;
	nextCheckAt: string;
	lastCollectedAt: string | null;
	latestPrepared: Prepared | null;
	previousPrepared: Prepared | null;
	issues: string[];
	failure: "collection" | "preparation" | "storage" | null;
	publisherRequests: number;
}
type Extract = (body: Buffer, format: "layout" | "bbox-layout") => Promise<string>;
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const clock = (value: unknown, now: number): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= now;
const issues = ["initial-review-required", "new-election-review-required", "candidate-added", "candidate-removed", "candidate-changed", "question-changed", "source-document-changed", "interrupted-run-retained", "collection-failed", "preparation-failed", "storage-failed"];

export async function readUnionBallotAutomationPlan(path: string): Promise<Plan> {
	const value: unknown = JSON.parse((await readBoundedStateDataBytes(path, 32768)).toString("utf8"));
	if (!exact(value, ["schemaVersion", "type", "directory", "accessReview", "intervalMs"]) || value.schemaVersion !== 1 || value.type !== "union-ballot-automation" || typeof value.directory !== "string" || !Number.isSafeInteger(value.intervalMs) || Number(value.intervalMs) < 21600000 || Number(value.intervalMs) > 2592000000 || !exact(value.accessReview, ["unionRobots", "unionPrivacy", "countyRobots", "countyPrivacy"]) || Object.values(value.accessReview).some(value => !digest(value))) throw new Error("Provide a bounded external Union ballot automation profile.");
	assertExternalStateDataDirectory(value.directory);
	return value as unknown as Plan;
}
async function persist(directory: string, name: string, body: string, replace = false) {
	if (Buffer.byteLength(body) > 128 * 1024) throw new Error("Union automation metadata exceeds its bound.");
	const temporary = replace ? `.union-${randomUUID()}.tmp` : name;
	const handle = await open(join(directory, temporary), "wx", 0o600);
	try {
		await handle.writeFile(body);
		await handle.sync();
	}
	finally { await handle.close(); }
	if (replace) {
		try {
			try {
				if (!(await lstat(join(directory, name))).isFile()) throw new Error("Union automation state must be a regular file.");
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
async function preparedFiles(directory: string, value: unknown, now: number): Promise<Prepared | null> {
	if (value === null) return null;
	if (!exact(value, ["runId", "identitySha256", "electionDate", "capturedAt", "candidates", "questions", "files"]) || typeof value.runId !== "string" || !/^run-[a-f0-9-]{36}$/u.test(value.runId) || !digest(value.identitySha256) || typeof value.electionDate !== "string" || !/^20\d{2}-11-0[2-8]$/u.test(value.electionDate) || !clock(value.capturedAt, now) || !Number.isSafeInteger(value.candidates) || Number(value.candidates) < 1 || Number(value.candidates) > 25000 || !Number.isSafeInteger(value.questions) || Number(value.questions) < 0 || Number(value.questions) > 99 || !Array.isArray(value.files) || value.files.length !== 6) throw new Error("Union prepared output identity requires review.");
	const paths = new Set<string>();
	const bodies = new Map<string, Buffer>();
	for (const file of value.files) {
		if (!exact(file, ["path", "sha256", "bytes"]) || typeof file.path !== "string" || !/^(?:candidates|questions)\/prepared-[a-f0-9-]{36}\/[a-zA-Z0-9.-]+$/u.test(file.path) || paths.has(file.path) || !digest(file.sha256) || !Number.isSafeInteger(file.bytes) || Number(file.bytes) < 1 || Number(file.bytes) > 12 * 1024 * 1024) throw new Error("Union prepared output file requires review.");
		paths.add(file.path);
		const path = join(directory, "runs", value.runId, file.path);
		if (await realpath(path) !== path) throw new Error("Union prepared output cannot use redirected storage.");
		const metadata = await lstat(path);
		if (!metadata.isFile() || metadata.size !== file.bytes) throw new Error("Union prepared output bytes changed.");
		const body = await readBoundedStateDataBytes(path, Number(file.bytes));
		if (body.length !== file.bytes || hash(body) !== file.sha256) throw new Error("Union prepared output bytes changed.");
		const name = file.path.split("/").at(-1)!;
		if (bodies.has(name) || (name.startsWith("questions.") ? !file.path.startsWith("questions/") : !file.path.startsWith("candidates/"))) throw new Error("Union prepared output roles changed.");
		bodies.set(name, body);
	}
	const snapshotName = `nj-union-${value.electionDate}.json`;
	if ([...bodies.keys()].sort().join(",") !== [snapshotName, "source.json", "candidate-evidence.csv", "review.json", "questions.json", "questions.csv"].sort().join(",")) throw new Error("Union prepared output inventory changed.");
	const snapshot = JSON.parse(bodies.get(snapshotName)!.toString("utf8"));
	const questions = JSON.parse(bodies.get("questions.json")!.toString("utf8"));
	const review = JSON.parse(bodies.get("review.json")!.toString("utf8"));
	if (snapshot.electionDate !== value.electionDate || snapshot.retrievedAt !== value.capturedAt || snapshot.recordCount !== value.candidates || !Array.isArray(snapshot.records) || snapshot.records.length !== value.candidates || questions.electionDate !== value.electionDate || questions.questionCount !== value.questions || !Array.isArray(questions.questions) || questions.questions.length !== value.questions || review.candidateSnapshotSha256 !== hash(bodies.get(snapshotName)!) || review.evidenceCsvSha256 !== hash(bodies.get("candidate-evidence.csv")!) || questions.csvSha256 !== hash(bodies.get("questions.csv")!)) throw new Error("Union prepared output counts or provenance changed.");
	return value as unknown as Prepared;
}
async function readState(directory: string, now: number): Promise<State | null> {
	let body: Buffer;
	try {
		body = await readBoundedStateDataBytes(join(directory, "state.json"), 128 * 1024);
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
	const value: unknown = JSON.parse(body.toString("utf8"));
	if (value && typeof value === "object" && "nextCheckAt" in value && (typeof value.nextCheckAt !== "string" || !Number.isFinite(Date.parse(value.nextCheckAt)) || new Date(value.nextCheckAt).toISOString() !== value.nextCheckAt || Date.parse(value.nextCheckAt) > now + 2592000000)) throw new Error("Union next-check clock requires review.");
	if (!exact(value, ["schemaVersion", "type", "status", "startedAt", "finishedAt", "nextCheckAt", "lastCollectedAt", "latestPrepared", "previousPrepared", "issues", "failure", "publisherRequests"]) || value.schemaVersion !== 1 || value.type !== "union-ballot-automation-state" || !["running", "prepared-review-required", "unchanged", "failed"].includes(String(value.status)) || !clock(value.startedAt, now) || (value.finishedAt !== null && (!clock(value.finishedAt, now) || Date.parse(value.finishedAt) < Date.parse(value.startedAt))) || typeof value.nextCheckAt !== "string" || !Number.isFinite(Date.parse(value.nextCheckAt)) || (value.lastCollectedAt !== null && !clock(value.lastCollectedAt, now)) || !Array.isArray(value.issues) || value.issues.some(issue => !issues.includes(issue)) || value.issues.length > 12 || ![null, "collection", "preparation", "storage"].includes(value.failure as string | null) || !Number.isSafeInteger(value.publisherRequests) || Number(value.publisherRequests) < 0 || Number(value.publisherRequests) > 160 || (value.status === "running" ? value.finishedAt !== null : value.finishedAt === null)) throw new Error("Union automation state requires review.");
	await preparedFiles(directory, value.latestPrepared, now);
	await preparedFiles(directory, value.previousPrepared, now);
	return value as unknown as State;
}
export async function assertUnionAutomationCapacity(directory: string) {
	let bytes = 0;
	let count = 0;
	async function scan(parent: string, depth: number) {
		if (depth > 6) throw new Error("Union automation storage depth requires review.");
		for (const name of await readdir(parent)) {
			if (++count > 65536) throw new Error("Union automation storage needs retention review.");
			const path = join(parent, name);
			const entry = await lstat(path);
			if (entry.isSymbolicLink()) throw new Error("Union automation storage cannot contain redirected entries.");
			if (entry.isDirectory()) await scan(path, depth + 1);
			else if (entry.isFile()) bytes += entry.size;
			else throw new Error("Union automation storage requires regular files.");
			if (bytes + 160 * 1024 * 1024 > 512 * 1024 * 1024) throw new Error("Union automation storage needs retention review.");
		}
	}
	await scan(directory, 0);
}
async function physicalDirectory(directory: string) {
	if (await realpath(directory) !== directory) throw new Error("Union automation requires physical storage paths.");
	const metadata = await lstat(directory);
	if (!metadata.isDirectory() || metadata.isSymbolicLink() || (metadata.mode & 0o077) !== 0 || metadata.uid !== process.getuid?.()) throw new Error("Union automation requires private owner-controlled storage.");
}
async function candidateRecords(directory: string, prepared: Prepared) {
	const file = prepared.files.find(file => /\/nj-union-20\d{2}-11-0[2-8]\.json$/u.test(file.path));
	if (!file) throw new Error("Union prepared candidate snapshot is missing.");
	return (JSON.parse((await readBoundedStateDataBytes(join(directory, "runs", prepared.runId, file.path))).toString("utf8")) as { records: StateCandidateRecord[] }).records;
}
async function questionIdentity(directory: string, prepared: Prepared) {
	const file = prepared.files.find(file => file.path.endsWith("/questions.json"));
	if (!file) throw new Error("Union prepared question output is missing.");
	const report = JSON.parse((await readBoundedStateDataBytes(join(directory, "runs", prepared.runId, file.path))).toString("utf8")) as { questions: { id: string }[] };
	return report.questions.map(question => question.id).sort().join(",");
}
export async function inspectUnionBallotAutomation(planPath: string, now = Date.now()) {
	const plan = await readUnionBallotAutomationPlan(planPath);
	try {
		await physicalDirectory(plan.directory);
	}
	catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
	return { configured: true, state: await readState(plan.directory, now), imported: false, publicationApproved: false, recurringImportEnabled: false };
}
export async function runUnionBallotAutomation(planPath: string, options: { captures?: Pin[]; now?: () => number; pause?: (milliseconds: number) => Promise<void>; collection?: Omit<UnionBallotCollectionOptions, "onCapture">; extract?: Extract } = {}) {
	const plan = await readUnionBallotAutomationPlan(planPath);
	const now = options.now ?? Date.now;
	if (!Number.isSafeInteger(now()) || now() < 0) throw new Error("Union automation clock requires review.");
	if (options.captures && (!Array.isArray(options.captures) || !options.captures.length || options.captures.length > 5 || options.captures.some(pin => !exact(pin, ["path", "sha256"]) || typeof pin.path !== "string" || !isAbsolute(pin.path) || !digest(pin.sha256)))) throw new Error("Provide bounded absolute Union capture pins.");
	await mkdir(plan.directory, { recursive: true, mode: 0o700 });
	await physicalDirectory(plan.directory);
	const lock = await acquireStateBallotAutomationLock(plan.directory);
	try {
		const previous = await readState(lock.directory, now());
		if (!options.captures && previous && previous.status !== "running" && now() < Date.parse(previous.nextCheckAt)) return { ...previous, skipped: true, publisherRequests: 0, imported: false, publicationApproved: false, recurringImportEnabled: false };
		await assertUnionAutomationCapacity(lock.directory);
		const pendingIssues = (previous?.issues ?? []).filter(issue => !issue.endsWith("-failed") && issue !== "interrupted-run-retained");
		if (previous?.latestPrepared && !pendingIssues.length) pendingIssues.push("source-document-changed");
		if (previous?.status === "running") pendingIssues.push("interrupted-run-retained");
		const state: State = { schemaVersion: 1, type: "union-ballot-automation-state", status: "running", startedAt: new Date(now()).toISOString(), finishedAt: null, nextCheckAt: new Date(now() + plan.intervalMs).toISOString(), lastCollectedAt: previous?.lastCollectedAt ?? null, latestPrepared: previous?.latestPrepared ?? null, previousPrepared: previous?.previousPrepared ?? null, issues: pendingIssues, failure: null, publisherRequests: 0 };
		await persist(lock.directory, "state.json", `${JSON.stringify(state)}\n`, true);
		let stage: NonNullable<State["failure"]> = "collection";
		try {
			const runId = `run-${randomUUID()}`;
			const directory = join(lock.directory, "runs", runId);
			await mkdir(directory, { recursive: true, mode: 0o700 });
			let pins = options.captures;
			if (!pins) {
				if (previous?.status === "running") await (options.pause ?? pause)(20000);
				pins = [];
				let catalogSha256: string | null = null;
				let forms = 99;
				let bytes = 0;
				const request = options.collection?.request;
				const { fetchRemoteSourceDocument } = await import("./remote-json-source.js");
				for (let offset = 0; offset < forms; offset += 25) {
					const path = join(directory, `collection-${offset}.json`);
					await persist(directory, `collection-${offset}.json`, `${JSON.stringify({ schemaVersion: 1, type: "union-sample-ballot-window", outputRoot: join(directory, "captures"), windowOffset: offset, accessReview: plan.accessReview, catalogSha256 })}\n`);
					const collected = await collectUnionBallotEvidence(path, { collection: { ...options.collection, now, sleep: options.pause ?? options.collection?.sleep, request: async (url, transport) => {
						if (state.publisherRequests >= 128 || now() - Date.parse(state.startedAt) > 900000) throw new Error("Union automatic collection exceeded its run bound.");
						state.publisherRequests += 1;
						const response = await (request ?? fetchRemoteSourceDocument)(url, transport);
						bytes += response.body.length;
						if (bytes > 64 * 1024 * 1024) throw new Error("Union automatic collection exceeded its byte bound.");
						return response;
					} } });
					catalogSha256 = collected.catalogSha256;
					forms = collected.completeCatalogDocuments;
					pins.push({ path: join(collected.outputDirectory, "capture.json"), sha256: collected.captureSha256 });
				}
			}
			stage = "preparation";
			for (const pin of pins) {
				const capture = JSON.parse((await readBoundedStateDataBytes(pin.path)).toString("utf8"));
				if (!exact(capture.accessReview, ["unionRobots", "unionPrivacy", "countyRobots", "countyPrivacy"]) || JSON.stringify(Object.entries(capture.accessReview).sort()) !== JSON.stringify(Object.entries(plan.accessReview).sort())) throw new Error("Union captured publisher policy differs from the approved automation profile.");
			}
			const input = await loadUnionBallotCaptures(pins, now());
			if (input.originals.reduce((bytes, original) => bytes + original.body.length, 0) > 64 * 1024 * 1024) throw new Error("Union preparation exceeds its complete-edition byte bound.");
			const capturedAt = new Date(Math.min(...input.originals.map(original => Date.parse(original.metadata.capturedAt)))).toISOString();
			const electionDate = input.catalog.edition.electionDate;
			if (state.latestPrepared && (electionDate < state.latestPrepared.electionDate || capturedAt < state.latestPrepared.capturedAt)) throw new Error("An older Union source cannot replace the latest preparation.");
			const identitySha256 = hash(JSON.stringify({ catalog: input.catalog.sha256, documents: input.originals.map(original => ({ form: original.document.form, sha256: original.metadata.sha256 })).sort((first, second) => first.form - second.form) }));
			if (!options.captures) state.lastCollectedAt = new Date(now()).toISOString();
			if (state.latestPrepared?.identitySha256 === identitySha256) {
				state.status = "unchanged";
			}
			else {
				const candidatePlan = join(directory, "candidate-plan.json");
				const questionPlan = join(directory, "question-plan.json");
				await persist(directory, "candidate-plan.json", `${JSON.stringify({ schemaVersion: 1, type: "union-candidate-snapshot-preparation", ballotCaptures: pins, outputRoot: join(directory, "candidates") })}\n`);
				await persist(directory, "question-plan.json", `${JSON.stringify({ schemaVersion: 1, type: "union-ballot-question-preparation", ballotCaptures: pins, outputRoot: join(directory, "questions") })}\n`);
				const candidates = await prepareUnionCandidateSnapshot(candidatePlan, { now, extract: options.extract });
				const questions = await prepareUnionBallotQuestions(questionPlan, { now, extract: options.extract });
				const prepared: Prepared = { runId, identitySha256, electionDate, capturedAt, candidates: candidates.records, questions: questions.questions, files: [] };
				for (const path of [join(candidates.outputDirectory, `${candidates.sourceId}.json`), ...["source.json", "candidate-evidence.csv", "review.json"].map(name => join(candidates.outputDirectory, name)), ...["questions.json", "questions.csv"].map(name => join(questions.outputDirectory, name))]) {
					const body = await readBoundedStateDataBytes(path);
					prepared.files.push({ path: relative(directory, path), bytes: body.length, sha256: hash(body) });
				}
				await preparedFiles(lock.directory, prepared, now());
				state.issues = state.issues.filter(issue => issue === "interrupted-run-retained");
				if (!state.latestPrepared) {
					state.issues.push("initial-review-required");
				}
				else if (state.latestPrepared.electionDate !== electionDate) {
					state.issues.push("new-election-review-required");
				}
				else {
					const before = new Map((await candidateRecords(lock.directory, state.latestPrepared)).map(record => [record.id, record]));
					const after = new Map((await candidateRecords(lock.directory, prepared)).map(record => [record.id, record]));
					if ([...before.keys()].some(id => !after.has(id))) state.issues.push("candidate-removed");
					if ([...after.keys()].some(id => !before.has(id))) state.issues.push("candidate-added");
					if ([...after].some(([id, record]) => before.has(id) && JSON.stringify(before.get(id)) !== JSON.stringify(record))) state.issues.push("candidate-changed");
					if (await questionIdentity(lock.directory, prepared) !== await questionIdentity(lock.directory, state.latestPrepared)) state.issues.push("question-changed");
				}
				if (!state.issues.some(issue => issue !== "interrupted-run-retained")) state.issues.push("source-document-changed");
				state.previousPrepared = state.latestPrepared;
				state.latestPrepared = prepared;
				state.status = "prepared-review-required";
			}
			state.finishedAt = new Date(now()).toISOString();
			state.nextCheckAt = new Date(now() + plan.intervalMs).toISOString();
			stage = "storage";
			await persist(directory, "result.json", `${JSON.stringify(state)}\n`);
			await persist(lock.directory, "state.json", `${JSON.stringify(state)}\n`, true);
			return { ...state, skipped: false, imported: false, publicationApproved: false, recurringImportEnabled: false };
		}
		catch (error) {
			state.status = "failed";
			state.finishedAt = new Date(now()).toISOString();
			state.nextCheckAt = new Date(now() + plan.intervalMs).toISOString();
			state.failure = stage;
			state.issues.push(`${stage}-failed`);
			state.latestPrepared = previous?.latestPrepared ?? null;
			state.previousPrepared = previous?.previousPrepared ?? null;
			await persist(lock.directory, "state.json", `${JSON.stringify(state)}\n`, true);
			throw error;
		}
	}
	finally { await lock.release(); }
}
