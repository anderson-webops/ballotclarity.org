import type { MagistrateCourtCapture } from "./magistrate-court-directory.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { readAutomationRun, writeAutomationRun } from "./admin-operations.js";
import { magistrateCourtPublication, magistrateProfileRedirect, parseMagistrateChief, parseMagistrateCourtRoster, prepareMagistrateCourtDirectory, verifyMagistrateCourtPolicy, verifyMagistrateCourtProfile } from "./magistrate-court-directory.js";
import { readMagistrateCourtEnvelope, withMagistrateCourtLock, writeMagistrateCourt } from "./magistrate-court-storage.js";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";

export async function collectMagistrateCourt({ directory, now = Date.now, request = fetchRemoteSourceDocument, pause = setTimeout }: { directory: string; now?: () => number; request?: typeof fetchRemoteSourceDocument; pause?: (milliseconds: number) => Promise<unknown> }) {
	return withMagistrateCourtLock(directory, async (canonical) => {
		let current = null;
		try {
			current = (await readMagistrateCourtEnvelope(canonical, now())).envelope;
		}
		catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
		if (current && Date.parse(current.snapshot.retrievedAt) + magistrateCourtPublication.minimumRefreshIntervalMs > now()) return { collected: false, publisherRequests: 0, retrievedAt: current.snapshot.retrievedAt };
		const runDirectory = join(canonical, "magistrate-court-automation");
		await mkdir(runDirectory, { recursive: true });
		if (await realpath(runDirectory) !== runDirectory) throw new Error("The Magistrate Court collection journal must not be redirected.");
		const previous = await readAutomationRun(runDirectory, now());
		if (previous && ["failed", "running"].includes(previous.status) && Date.parse(previous.startedAt) + magistrateCourtPublication.minimumRefreshIntervalMs > now()) throw new Error("The Magistrate Court collection is awaiting its next permitted retry.");
		const prior = { schemaVersion: 1 as const, type: "ballot-automation-run" as const, startedAt: new Date(now()).toISOString(), lastImportAt: current?.importedAt ?? null, lastSuccessAt: previous?.lastSuccessAt ?? null, nextRunAt: null };
		await writeAutomationRun(runDirectory, { ...prior, status: "running", finishedAt: null, results: [] }, now());
		let prepared = false;
		try {
			const documents: MagistrateCourtCapture["documents"] = [];
			const get = async (url: string, profile = false) => {
				if (documents.length) await pause(magistrateCourtPublication.minimumRequestIntervalMs);
				const response = await request(url, { allowedHosts: ["www.magistratefulton.org"], maxBytes: magistrateCourtPublication.maximumDocumentBytes, timeoutMs: 15000 });
				if (response.status !== 200 && !(profile && response.status === 302 && response.location === magistrateProfileRedirect(url))) throw new Error("The Magistrate Court response requires review.");
				if (response.status === 200 && response.contentType !== (url.endsWith("robots.txt") ? "text/plain" : "text/html")) throw new Error("The Magistrate Court document type requires review.");
				const body = new TextDecoder("utf-8", { fatal: true }).decode(response.body);
				const entry = { url, status: response.status as 200 | 302, body, capturedAt: new Date(now()).toISOString(), sha256: createHash("sha256").update(response.body).digest("hex"), ...(response.status === 302 ? { location: response.location! } : {}) };
				documents.push(entry);
				if (Buffer.byteLength(JSON.stringify(documents)) > magistrateCourtPublication.maximumCaptureBytes) throw new Error("The Magistrate Court capture exceeds its bounds.");
				return entry;
			};
			for (const [index, policy] of magistrateCourtPublication.policies.entries()) verifyMagistrateCourtPolicy((await get(policy.url)).body, index, now());
			const home = await get(magistrateCourtPublication.homeUrl);
			const roster = await get(magistrateCourtPublication.url);
			const chief = await get(magistrateCourtPublication.chiefUrl);
			parseMagistrateChief(home.body, chief.body);
			const judges = parseMagistrateCourtRoster(roster.body);
			for (const judge of judges) {
				let entry = await get(judge.profileUrl, true);
				if (entry.status === 302) entry = await get(new URL(entry.location!, magistrateCourtPublication.url).href);
				verifyMagistrateCourtProfile(entry.body, judge);
			}
			const capture: MagistrateCourtCapture = { schemaVersion: 1, type: "magistrate-court-capture", documents };
			const snapshot = prepareMagistrateCourtDirectory(capture, now());
			prepared = true;
			await writeFile(join(runDirectory, `capture-${new Date(now()).toISOString().replace(/[:.]/gu, "-")}.json`), `${JSON.stringify(capture)}\n`, { flag: "wx", mode: 0o600 });
			await writeMagistrateCourt(canonical, snapshot, "collected", now());
			const finishedAt = new Date(now()).toISOString();
			await writeAutomationRun(runDirectory, { ...prior, status: "succeeded", finishedAt, lastImportAt: finishedAt, lastSuccessAt: finishedAt, nextRunAt: new Date(now() + magistrateCourtPublication.minimumRefreshIntervalMs).toISOString(), results: [{ sourceId: snapshot.sourceId, status: "imported", records: snapshot.judges.length, reason: null }] }, now());
			return { collected: true, publisherRequests: documents.length, retrievedAt: snapshot.retrievedAt };
		}
		catch (error) {
			await writeAutomationRun(runDirectory, { ...prior, status: "failed", finishedAt: new Date(now()).toISOString(), results: [{ sourceId: magistrateCourtPublication.sourceId, status: "failed", records: 0, reason: prepared ? "persistence-failed" : "source-unavailable" }] }, now());
			throw error;
		}
	});
}
