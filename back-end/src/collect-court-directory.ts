import type { CourtDirectoryCapture } from "./court-directories.js";
import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { readAutomationRun, writeAutomationRun } from "./admin-operations.js";
import { courtDirectoryPublication, parseCourtDirectory, prepareCourtDirectory, verifyCourtDirectoryPolicy, verifyCourtDirectoryProfile } from "./court-directories.js";
import { readCourtDirectoryEnvelope, withCourtDirectoryLock, writeCourtDirectory } from "./court-directory-storage.js";
import { fetchRemoteSourceText } from "./remote-json-source.js";

export async function collectCourtDirectory({ directory, now = Date.now, request = fetchRemoteSourceText, pause = setTimeout }: { directory: string; now?: () => number; request?: typeof fetchRemoteSourceText; pause?: (milliseconds: number) => Promise<unknown> }) {
	return withCourtDirectoryLock(directory, async (canonical) => {
		let current = null;
		try {
			current = (await readCourtDirectoryEnvelope(canonical, now())).envelope;
		}
		catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
		if (current && Date.parse(current.snapshot.retrievedAt) + courtDirectoryPublication.minimumRefreshIntervalMs > now()) return { collected: false, publisherRequests: 0, retrievedAt: current.snapshot.retrievedAt };
		const runDirectory = join(canonical, "court-automation");
		await mkdir(runDirectory, { recursive: true });
		if (await realpath(runDirectory) !== runDirectory) throw new Error("The court collection journal must not be redirected.");
		const previous = await readAutomationRun(runDirectory, now());
		if (previous && ["failed", "running"].includes(previous.status) && Date.parse(previous.startedAt) + courtDirectoryPublication.minimumRefreshIntervalMs > now()) throw new Error("The court collection is awaiting its next permitted retry.");
		const prior = { schemaVersion: 1 as const, type: "ballot-automation-run" as const, startedAt: new Date(now()).toISOString(), lastImportAt: current?.importedAt ?? null, lastSuccessAt: previous?.lastSuccessAt ?? null, nextRunAt: null };
		await writeAutomationRun(runDirectory, { ...prior, status: "running", finishedAt: null, results: [] }, now());
		let prepared = false;
		try {
			const documents: CourtDirectoryCapture["documents"] = [];
			const get = async (url: string) => {
				if (documents.length) await pause(11000);
				const body = await request(url, { allowedHosts: ["fultonstate.org"], maxBytes: courtDirectoryPublication.maximumDocumentBytes, maxRedirects: 0, timeoutMs: 15000 });
				documents.push({ url, body, capturedAt: new Date(now()).toISOString(), sha256: createHash("sha256").update(body).digest("hex") });
				return body;
			};
			for (const [index, policy] of courtDirectoryPublication.policies.entries()) verifyCourtDirectoryPolicy(await get(policy.url), index);
			const judges = parseCourtDirectory(await get(courtDirectoryPublication.url));
			for (const judge of judges) verifyCourtDirectoryProfile(await get(judge.profileUrl), judge);
			const capture: CourtDirectoryCapture = { schemaVersion: 1, type: "court-directory-capture", documents };
			const snapshot = prepareCourtDirectory(capture, now());
			prepared = true;
			await writeFile(join(runDirectory, `capture-${new Date(now()).toISOString().replace(/[:.]/gu, "-")}.json`), `${JSON.stringify(capture)}\n`, { flag: "wx", mode: 0o600 });
			await writeCourtDirectory(canonical, snapshot, "collected", now());
			const finishedAt = new Date(now()).toISOString();
			await writeAutomationRun(runDirectory, { ...prior, status: "succeeded", finishedAt, lastImportAt: finishedAt, lastSuccessAt: finishedAt, nextRunAt: new Date(now() + courtDirectoryPublication.minimumRefreshIntervalMs).toISOString(), results: [{ sourceId: snapshot.sourceId, status: "imported", records: judges.length, reason: null }] }, now());
			return { collected: true, publisherRequests: documents.length, retrievedAt: snapshot.retrievedAt };
		}
		catch (error) {
			await writeAutomationRun(runDirectory, { ...prior, status: "failed", finishedAt: new Date(now()).toISOString(), results: [{ sourceId: courtDirectoryPublication.sourceId, status: "failed", records: 0, reason: prepared ? "persistence-failed" : "source-unavailable" }] }, now());
			throw error;
		}
	});
}
