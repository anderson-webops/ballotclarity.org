import type { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { lstat, open, readdir, realpath, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

export const mauiPreparationIssueReasons = ["election-review-required", "resolution-evidence-required", "editorial-review-required", "missing-review", "question-changed", "resolution-document-changed", "review-incomplete", "question-no-longer-offered"] as const;
export interface MauiPreparationIssue { resolution: string | null; reason: typeof mauiPreparationIssueReasons[number] }
export interface MauiPreparationReference { directory: string; sha256: string; identitySha256: string; electionDate: string; preparedAt: string; questions: number }
export interface MauiPreparationInput { electionDate: string; captureSha256: string; inventorySha256: string; identitySha256: string }
export interface MauiPreparationRun {
	schemaVersion: 1;
	type: "maui-measure-preparation-run";
	status: "running" | "prepared" | "review" | "failed";
	startedAt: string;
	finishedAt: string | null;
	input: MauiPreparationInput | null;
	lastPrepared: MauiPreparationReference | null;
	issues: MauiPreparationIssue[];
	failure: "collection-failed" | "preparation-failed" | "persistence-failed" | null;
}
export const mauiPreparationHash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
export const mauiPreparationDigest = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);
export const mauiPreparationObject = (value: unknown, fields: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...fields].sort().join(","));
const instant = (value: unknown, now: number): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= now;
export const mauiPreparationDate = (value: unknown): value is string => typeof value === "string" && /^20\d{2}-\d{2}-\d{2}$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const receiptName = "maui-output-receipt.json";

function reference(value: unknown, now: number): value is MauiPreparationReference {
	return mauiPreparationObject(value, ["directory", "sha256", "identitySha256", "electionDate", "preparedAt", "questions"]) && mauiPreparationDigest(value.sha256) && mauiPreparationDigest(value.identitySha256) && typeof value.directory === "string" && new RegExp(`^maui-prepared-${value.identitySha256}-[a-f\\d-]{36}$`, "u").test(value.directory) && mauiPreparationDate(value.electionDate) && instant(value.preparedAt, now) && Number.isInteger(value.questions) && Number(value.questions) > 0 && Number(value.questions) <= 20;
}

function parseRun(value: unknown, now: number): MauiPreparationRun {
	if (!mauiPreparationObject(value, ["schemaVersion", "type", "status", "startedAt", "finishedAt", "input", "lastPrepared", "issues", "failure"]) || value.schemaVersion !== 1 || value.type !== "maui-measure-preparation-run" || !["running", "prepared", "review", "failed"].includes(String(value.status)) || !instant(value.startedAt, now) || (value.finishedAt !== null && (!instant(value.finishedAt, now) || value.finishedAt < value.startedAt)) || (value.status === "running") !== (value.finishedAt === null) || (value.lastPrepared !== null && (!reference(value.lastPrepared, now) || value.lastPrepared.preparedAt > (value.finishedAt ?? value.startedAt))) || !Array.isArray(value.issues) || value.issues.length > 64 || ![null, "collection-failed", "preparation-failed", "persistence-failed"].includes(value.failure as null) || (value.status === "failed") !== (value.failure !== null)) throw new Error("Maui preparation evidence requires review.");
	if (value.input !== null && (!mauiPreparationObject(value.input, ["electionDate", "captureSha256", "inventorySha256", "identitySha256"]) || !mauiPreparationDate(value.input.electionDate) || ![value.input.captureSha256, value.input.inventorySha256, value.input.identitySha256].every(mauiPreparationDigest))) throw new Error("Maui preparation input identity is invalid.");
	for (const issue of value.issues) {
		if (!mauiPreparationObject(issue, ["resolution", "reason"]) || (issue.resolution !== null && (typeof issue.resolution !== "string" || !/^\d{2}-\d{1,4}(?:, (?:CD|FD)\d){0,3}$/u.test(issue.resolution))) || !mauiPreparationIssueReasons.includes(issue.reason as MauiPreparationIssue["reason"])) throw new Error("Maui preparation exceptions require source identities.");
	}
	const run = value as unknown as MauiPreparationRun;
	if ((run.status === "review") !== Boolean(run.issues.length) || (run.status === "prepared" && (!run.input || !run.lastPrepared || run.input.identitySha256 !== run.lastPrepared.identitySha256 || run.input.electionDate !== run.lastPrepared.electionDate))) throw new Error("Maui preparation disposition and evidence disagree.");
	return run;
}

export async function mauiPreparationFiles(directory: string) {
	const files: { name: string; bytes: number; sha256: string }[] = [];
	let bytes = 0;
	async function collect(parent: string, prefix: string) {
		const entries = await readdir(parent);
		if (entries.length > 32) throw new Error("Maui preparation output exceeds its file bound.");
		for (const name of entries.sort()) {
			if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,120}$/u.test(name)) throw new Error("Maui preparation contains an unknown file.");
			const path = join(parent, name);
			const metadata = await lstat(path);
			if (metadata.isDirectory() && !prefix && name === "assembly") {
				if (await realpath(path) !== path) throw new Error("Maui preparation storage is redirected.");
				await collect(path, "assembly/");
			}
			else {
				if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("Maui preparation output requires regular files.");
				if (!prefix && name === receiptName) continue;
				bytes += metadata.size;
				if (bytes > 32 * 1024 * 1024 || files.length >= 32) throw new Error("Maui preparation output exceeds its storage bound.");
				const body = await readBoundedStateDataBytes(path);
				files.push({ name: prefix + name, bytes: body.length, sha256: mauiPreparationHash(body) });
			}
		}
	}
	await collect(directory, "");
	return files.sort((first, second) => first.name.localeCompare(second.name, "en"));
}

export async function readMauiPreparationOutput(directory: string, stored: MauiPreparationReference, now = Date.now()) {
	if (!reference(stored, now)) throw new Error("Maui preparation reference requires review.");
	assertExternalStateDataDirectory(directory);
	const path = join(directory, stored.directory);
	if (await realpath(path) !== path) throw new Error("Maui preparation output must use its physical path.");
	const body = await readBoundedStateDataBytes(join(path, receiptName), 128 * 1024);
	const receipt: unknown = JSON.parse(body.toString("utf8"));
	if (mauiPreparationHash(body) !== stored.sha256 || !mauiPreparationObject(receipt, ["schemaVersion", "type", "identitySha256", "electionDate", "preparedAt", "questions", "files", "publicationApproved", "automaticImportApproved"]) || receipt.schemaVersion !== 1 || receipt.type !== "maui-measure-preparation-output" || receipt.identitySha256 !== stored.identitySha256 || receipt.electionDate !== stored.electionDate || receipt.preparedAt !== stored.preparedAt || receipt.questions !== stored.questions || receipt.publicationApproved !== false || receipt.automaticImportApproved !== false || JSON.stringify(receipt.files) !== JSON.stringify(await mauiPreparationFiles(path))) throw new Error("Maui prepared output no longer matches its receipt.");
	return receipt;
}

export async function readMauiPreparationRun(directory: string, now = Date.now()): Promise<MauiPreparationRun | null> {
	assertExternalStateDataDirectory(directory);
	try {
		if (await realpath(directory) !== directory) throw new Error("Maui preparation requires its physical storage path.");
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
	let body: Buffer;
	try {
		body = await readBoundedStateDataBytes(join(directory, "maui-preparation-run.json"), 16 * 1024);
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
	const run = parseRun(JSON.parse(body.toString("utf8")), now);
	if (run.lastPrepared) await readMauiPreparationOutput(directory, run.lastPrepared, now);
	return run;
}

export async function writeMauiPreparationRun(directory: string, run: MauiPreparationRun, now = Date.now()) {
	parseRun(run, now);
	assertExternalStateDataDirectory(directory);
	if (await realpath(directory) !== directory) throw new Error("Maui preparation requires its physical storage path.");
	const temporary = join(directory, `.maui-preparation-${randomUUID()}.tmp`);
	const destination = join(directory, "maui-preparation-run.json");
	try {
		const handle = await open(temporary, "wx", 0o600);
		try {
			await handle.writeFile(`${JSON.stringify(run)}\n`);
			await handle.sync();
		}
		finally { await handle.close(); }
		try {
			const metadata = await lstat(destination);
			if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("Maui preparation journal must be a regular file.");
		}
		catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
		await rename(temporary, destination);
		const parent = await open(directory, "r");
		try {
			await parent.sync();
		}
		finally { await parent.close(); }
	}
	finally {
		await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		});
	}
}
