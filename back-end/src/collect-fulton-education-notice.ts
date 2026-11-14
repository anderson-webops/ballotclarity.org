import type { readFultonEducationNotice } from "./fulton-education-notice.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readdir, realpath, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers/promises";
import { electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { discoverFultonEducationNotices, fultonEducationNoticeIndexUrl } from "./fulton-education-notice.js";
import { verifyFultonCalendarPolicy } from "./fulton-election-calendar.js";
import { fultonPolicyReceipts } from "./fulton-source-policy.js";
import { readFultonEducationNoticeCapture } from "./prepare-fulton-education-notice.js";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { acquireStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

export const fultonEducationNoticeCollection = { sourceId: "ga-fulton-education-notice", indexUrl: fultonEducationNoticeIndexUrl, policies: fultonPolicyReceipts.slice(0, 2), minimumRefreshIntervalMs: 6 * 3600000, minimumRequestIntervalMs: 11000, maximumDocumentBytes: 12 * 1024 * 1024, maximumCaptureBytes: 24 * 1024 * 1024, maximumPreparedBytes: 2 * 1024 * 1024, maximumArchiveBytes: 128 * 1024 * 1024, maximumCaptures: 256 } as const;
const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const exact = (value: unknown, names: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...names].sort().join(","));
const clock = (value: unknown, now: number): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= now;
const captureName = /^capture-[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/u;
type Prepared = Awaited<ReturnType<typeof readFultonEducationNoticeCapture>>;
interface Options { now?: () => number; request?: typeof fetchRemoteSourceDocument; pause?: (milliseconds: number) => Promise<unknown>; extract?: (body: Buffer) => Promise<string> }
interface Journal { schemaVersion: 1; type: "fulton-education-notice-run"; configurationSha256: string; status: "running" | "succeeded" | "failed"; startedAt: string; finishedAt: string | null; lastSuccessAt: string | null; publisherRequests: number; reason: null | "collection-failed" | "persistence-or-review-failed" }

async function persist(directory: string, name: string, body: string | Uint8Array, replace = false) {
	const temporary = replace ? `.notice-${randomUUID()}.tmp` : name;
	try {
		const handle = await open(join(directory, temporary), "wx", 0o600);
		try {
			await handle.writeFile(body);
			await handle.sync();
		}
		finally { await handle.close(); }
		if (replace) {
			try {
				const metadata = await lstat(join(directory, name));
				if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("The notice metadata destination requires review.");
			}
			catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
			await rename(join(directory, temporary), join(directory, name));
		}
		const directoryHandle = await open(directory, "r");
		try {
			await directoryHandle.sync();
		}
		finally { await directoryHandle.close(); }
	}
	finally {
		if (replace) {
			await unlink(join(directory, temporary)).catch((error: NodeJS.ErrnoException) => {
				if (error.code !== "ENOENT") throw error;
			});
		}
	}
}

async function optional(directory: string, name: string) {
	try {
		return (await readBoundedStateDataBytes(join(directory, name), 8192)).toString("utf8");
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

async function capacity(directory: string) {
	const archive = join(directory, "notice-captures");
	await mkdir(archive, { recursive: true, mode: 0o700 });
	if (await realpath(archive) !== archive) throw new Error("The notice archive must retain its original directory.");
	const entries = await readdir(archive);
	if (entries.length >= fultonEducationNoticeCollection.maximumCaptures || (await readdir(directory)).length > 32) throw new Error("The notice archive needs retention review.");
	let bytes = 0;
	for (const name of entries) {
		const location = join(archive, name);
		if (!captureName.test(name) || !(await lstat(location)).isDirectory() || await realpath(location) !== location) throw new Error("The notice archive inventory requires review.");
		const files = await readdir(location);
		if (files.length > 8) throw new Error("The notice archive file inventory exceeds its bounds.");
		for (const file of files) {
			const metadata = await lstat(join(location, file));
			if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("The notice archive contains an unreviewed entry.");
			bytes += metadata.size;
		}
	}
	if (bytes + fultonEducationNoticeCollection.maximumCaptureBytes + fultonEducationNoticeCollection.maximumPreparedBytes + 65536 > fultonEducationNoticeCollection.maximumArchiveBytes) throw new Error("The notice archive needs capacity review.");
	return archive;
}

export function compareFultonEducationNotice(previous: ReturnType<typeof readFultonEducationNotice>, next: ReturnType<typeof readFultonEducationNotice>) {
	if (next.electionDate < previous.electionDate) throw new Error("An older education notice cannot replace retained evidence.");
	if (next.electionDate !== previous.electionDate) return;
	for (const name of ["taxRatePercent", "taxStartDate", "maximumCalendarQuarters", "maximumCollectionsCents", "fcsMaximumProjectCostCents", "apsMaximumProjectCostCents", "maximumBondPrincipalCents", "maximumAnnualInterestPercent", "schedule"] as const) {
		if (JSON.stringify(next[name]) !== JSON.stringify(previous[name])) throw new Error("Changed notice fiscal facts require review.");
	}
	if (previous.projects.some(project => !next.projects.some(candidate => JSON.stringify(candidate) === JSON.stringify(project)))) throw new Error("Changed or removed notice projects require review.");
}

export async function collectFultonEducationNotice(path: string, options: Options = {}) {
	const plan = JSON.parse((await readBoundedStateDataBytes(path, 32768)).toString("utf8"));
	if (!exact(plan, ["schemaVersion", "type", "directory", "electionDate"]) || plan.schemaVersion !== 1 || plan.type !== "fulton-education-notice-collection" || typeof plan.directory !== "string" || typeof plan.electionDate !== "string" || (plan.electionDate !== "latest-published" && !/^20\d{2}-\d{2}-\d{2}$/u.test(plan.electionDate))) throw new Error("Provide a configured Fulton education-notice collection plan.");
	assertExternalStateDataDirectory(plan.directory);
	const now = options.now ?? Date.now;
	const configurationSha256 = hash(JSON.stringify({ ...fultonEducationNoticeCollection, electionDate: plan.electionDate }));
	const lock = await acquireStateBallotAutomationLock(plan.directory);
	try {
		const directory = lock.directory;
		const raw = await optional(directory, "notice-current.json");
		const pointer = raw === null ? null : JSON.parse(raw);
		let current: Prepared | null = null;
		if (raw !== null) {
			if (!exact(pointer, ["schemaVersion", "configurationSha256", "capture", "captureSha256", "checkedAt"]) || pointer.schemaVersion !== 1 || pointer.configurationSha256 !== configurationSha256 || typeof pointer.capture !== "string" || !captureName.test(pointer.capture) || typeof pointer.captureSha256 !== "string" || !/^[a-f\d]{64}$/u.test(pointer.captureSha256) || !clock(pointer.checkedAt, now())) throw new Error("The notice current-pointer evidence requires review.");
			const location = join(directory, "notice-captures", pointer.capture);
			if (await realpath(location) !== location) throw new Error("The retained notice capture must not be redirected.");
			current = await readFultonEducationNoticeCapture(join(location, "capture.json"), pointer.captureSha256, plan.electionDate, options);
			if (current.documents.some(document => String(document.capturedAt) > String(pointer.checkedAt))) throw new Error("The notice check clock precedes its original capture.");
		}
		const journalBody = await optional(directory, "notice-run.json");
		const previous = journalBody === null ? null : JSON.parse(journalBody);
		if (journalBody !== null && (!exact(previous, ["schemaVersion", "type", "configurationSha256", "status", "startedAt", "finishedAt", "lastSuccessAt", "publisherRequests", "reason"]) || previous.schemaVersion !== 1 || previous.type !== "fulton-education-notice-run" || previous.configurationSha256 !== configurationSha256 || !["running", "succeeded", "failed"].includes(String(previous.status)) || !clock(previous.startedAt, now()) || (previous.finishedAt !== null && (!clock(previous.finishedAt, now()) || previous.finishedAt < previous.startedAt)) || (previous.lastSuccessAt !== null && !clock(previous.lastSuccessAt, now())) || (previous.status === "running") !== (previous.finishedAt === null) || !Number.isSafeInteger(previous.publisherRequests) || Number(previous.publisherRequests) < 0 || Number(previous.publisherRequests) > 4 || ![null, "collection-failed", "persistence-or-review-failed"].includes(previous.reason as null) || (previous.status === "failed") !== (previous.reason !== null))) throw new Error("The notice collection journal requires review.");
		if (previous?.status !== "succeeded" && previous && Date.parse(previous.startedAt) + fultonEducationNoticeCollection.minimumRefreshIntervalMs > now()) throw new Error("Notice collection is awaiting its next permitted attempt.");
		if (current && pointer && Date.parse(String(pointer.checkedAt)) + fultonEducationNoticeCollection.minimumRefreshIntervalMs > now()) return { status: "cached", publisherRequests: 0, electionDate: current.report.electionDate, capturedAt: current.report.source.capturedAt, captureSha256: pointer.captureSha256, imported: false, publicationApproved: false };
		if (previous && Date.parse(previous.startedAt) + fultonEducationNoticeCollection.minimumRefreshIntervalMs > now()) throw new Error("Notice collection is awaiting its next permitted attempt.");
		const archive = await capacity(directory);
		const run: Journal = { schemaVersion: 1, type: "fulton-education-notice-run", configurationSha256, status: "running", startedAt: new Date(now()).toISOString(), finishedAt: null, lastSuccessAt: previous?.lastSuccessAt ?? pointer?.checkedAt ?? null, publisherRequests: 0, reason: null };
		await persist(directory, "notice-run.json", `${JSON.stringify(run)}\n`, true);
		const name = `capture-${randomUUID()}`;
		const output = join(archive, name);
		let prepared = false;
		try {
			await mkdir(output, { mode: 0o700 });
			const documents: Record<string, unknown>[] = [];
			let totalBytes = 0;
			const get = async (url: string, pdf = false) => {
				if (run.publisherRequests) await (options.pause ?? setTimeout)(fultonEducationNoticeCollection.minimumRequestIntervalMs);
				run.publisherRequests++;
				await persist(directory, "notice-run.json", `${JSON.stringify(run)}\n`, true);
				const response = await (options.request ?? fetchRemoteSourceDocument)(url, { allowedHosts: ["fultoncountyga.gov"], maxBytes: pdf ? fultonEducationNoticeCollection.maximumDocumentBytes : 3 * 1024 * 1024, timeoutMs: 15000 });
				totalBytes += response.body.length;
				if (response.status !== 200 || (pdf ? response.contentType !== "application/pdf" || response.body.subarray(0, 5).toString() !== "%PDF-" : !["text/plain", "text/html"].includes(response.contentType)) || !response.body.length || response.body.length > (pdf ? fultonEducationNoticeCollection.maximumDocumentBytes : 3 * 1024 * 1024) || totalBytes > fultonEducationNoticeCollection.maximumCaptureBytes) throw new Error("The notice publisher response or document bounds require review.");
				const sha256 = hash(response.body);
				const retained = current?.documents.find(document => document.url === url && document.sha256 === sha256);
				const filename = `${sha256}.${pdf ? "pdf" : "html"}`;
				await persist(output, filename, response.body);
				documents.push({ url, sha256, bytes: response.body.length, capturedAt: retained?.capturedAt ?? new Date(now()).toISOString(), status: 200, contentType: response.contentType, path: filename });
				return response.body;
			};
			for (const [index, policy] of fultonEducationNoticeCollection.policies.entries()) verifyFultonCalendarPolicy((await get(policy.url)).toString("utf8"), index);
			const robots = electionDocumentRobotsPolicy(await readBoundedStateDataBytes(join(output, String(documents[0]!.path)), 3 * 1024 * 1024));
			if (!robots.allowed(fultonEducationNoticeIndexUrl)) throw new Error("Publisher permissions require review.");
			const offered = discoverFultonEducationNotices((await get(fultonEducationNoticeIndexUrl)).toString("utf8"));
			const selected = plan.electionDate === "latest-published" ? offered.at(-1) : offered.find(notice => notice.electionDate === plan.electionDate);
			if (!selected || !robots.allowed(selected.url)) throw new Error("The offered notice or publisher permissions require review.");
			await get(selected.url, true);
			const captureBody = `${JSON.stringify({ schemaVersion: 1, type: "fulton-education-notice-original-capture", sourceIndexUrl: fultonEducationNoticeIndexUrl, documents, publisherRequests: 4, reviewedPolicyDigestsMatched: true, publicationApproved: false, importApproved: false }, null, 2)}\n`;
			await persist(output, "capture.json", captureBody);
			const captureSha256 = hash(captureBody);
			const result = await readFultonEducationNoticeCapture(join(output, "capture.json"), captureSha256, plan.electionDate, options);
			if (Buffer.byteLength(result.body) + Buffer.byteLength(result.csv) > fultonEducationNoticeCollection.maximumPreparedBytes) throw new Error("The prepared notice research exceeds its storage bounds.");
			prepared = true;
			await persist(output, "notice-research.json", result.body);
			await persist(output, "notice-research.csv", result.csv);
			if (current) compareFultonEducationNotice(current.report, result.report);
			if (raw) await persist(directory, "notice-previous.json", raw, true);
			await persist(directory, "notice-current.json", `${JSON.stringify({ schemaVersion: 1, configurationSha256, capture: name, captureSha256, checkedAt: new Date(now()).toISOString() })}\n`, true);
			run.status = "succeeded";
			run.finishedAt = new Date(now()).toISOString();
			run.lastSuccessAt = run.finishedAt;
			await persist(directory, "notice-run.json", `${JSON.stringify(run)}\n`, true);
			return { status: "collected", outputDirectory: output, publisherRequests: run.publisherRequests, electionDate: result.report.electionDate, capturedAt: result.report.source.capturedAt, captureSha256, namedProjects: result.report.projects.length, principalYears: result.report.schedule.length, imported: false, publicationApproved: false };
		}
		catch (error) {
			run.status = "failed";
			run.finishedAt = new Date(now()).toISOString();
			run.reason = prepared ? "persistence-or-review-failed" : "collection-failed";
			await persist(directory, "notice-run.json", `${JSON.stringify(run)}\n`, true);
			throw error;
		}
	}
	finally { await lock.release(); }
}

if (process.argv[1]?.endsWith("collect-fulton-education-notice.ts") || process.argv[1]?.endsWith("collect-fulton-education-notice.js")) {
	const [path, ...extra] = process.argv.slice(2);
	Promise.resolve().then(() => {
		if (!path || extra.length) throw new Error("Use collect-fulton-education-notice PLAN.json.");
		return collectFultonEducationNotice(path);
	}).then(result => console.log(JSON.stringify(result))).catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : "Education notice collection failed.");
		process.exitCode = 1;
	});
}
