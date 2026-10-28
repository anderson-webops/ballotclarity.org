import type { FultonOfficeholderCapture } from "./fulton-officeholders.js";
import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { readAutomationRun, writeAutomationRun } from "./admin-operations.js";
import { readFultonOfficeholderEnvelope, withFultonOfficeholderLock, writeFultonOfficeholders } from "./fulton-officeholder-storage.js";
import { fultonOfficeholderPublication, prepareFultonOfficeholders } from "./fulton-officeholders.js";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { parseStateHtml, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";

interface FultonOfficeholderCollectionOptions {
	directory: string;
	now?: () => number;
	request?: typeof fetchRemoteSourceText;
	pause?: (milliseconds: number) => Promise<unknown>;
}

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function collectFultonOfficeholders({ directory, now = Date.now, request = fetchRemoteSourceText, pause = setTimeout }: FultonOfficeholderCollectionOptions) {
	return withFultonOfficeholderLock(directory, async (canonical) => {
		let lastImportAt: string | null = null;
		try {
			const current = readFultonOfficeholderEnvelope(canonical, now());
			lastImportAt = current.importedAt;
			if (Date.parse(current.snapshot.retrievedAt) + fultonOfficeholderPublication.minimumRefreshIntervalMs > now()) return { collected: false, publisherRequests: 0, retrievedAt: current.snapshot.retrievedAt };
		}
		catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
		const runDirectory = join(canonical, "automation");
		await mkdir(runDirectory, { recursive: true });
		if (await realpath(runDirectory) !== runDirectory) throw new Error("The Fulton collection journal must not be redirected.");
		const previousRun = await readAutomationRun(runDirectory, now());
		if (previousRun?.status === "failed" && Date.parse(previousRun.startedAt) + fultonOfficeholderPublication.minimumRefreshIntervalMs > now()) throw new Error("The failed Fulton collection is awaiting its next permitted retry.");
		const startedAt = new Date(now()).toISOString();
		const prior = { schemaVersion: 1 as const, type: "ballot-automation-run" as const, startedAt, lastImportAt, lastSuccessAt: previousRun?.lastSuccessAt ?? null, nextRunAt: null };
		await writeAutomationRun(runDirectory, { ...prior, status: "running", finishedAt: null, results: [] }, now());
		let prepared = false;
		try {
			const documents: FultonOfficeholderCapture["documents"] = [];
			const options = { allowedHosts: ["fultoncountyga.gov"], maxBytes: fultonOfficeholderPublication.maximumDocumentBytes, maxRedirects: 0, timeoutMs: 15000 };
			for (const [index, url] of [...fultonOfficeholderPublication.policies.map(policy => policy.url), fultonOfficeholderPublication.rosterUrl, fultonOfficeholderPublication.districtUrl].entries()) {
				if (index) await pause(11000);
				const body = await request(url, options);
				const policy = fultonOfficeholderPublication.policies[index];
				if (policy) {
					let region = body;
					if (policy.region === "main-text") {
						const main = stateHtmlDescendants(parseStateHtml(body), node => node.nodeName === "main");
						if (main.length !== 1) throw new Error("The Fulton officeholder policy layout requires review.");
						region = stateHtmlText(main[0]!).replace(/\s+/gu, " ").trim();
					}
					if (digest(region) !== policy.sha256) throw new Error("The Fulton officeholder publisher policy requires review.");
				}
				documents.push({ url, body, capturedAt: new Date(now()).toISOString(), sha256: digest(body) });
			}
			const capture: FultonOfficeholderCapture = { schemaVersion: 1, type: "fulton-officeholder-capture", documents };
			const snapshot = prepareFultonOfficeholders(capture, now());
			prepared = true;
			const captures = join(canonical, "captures");
			await mkdir(captures, { recursive: true });
			if (await realpath(captures) !== captures) throw new Error("The Fulton capture directory must not be redirected.");
			await writeFile(join(captures, `${snapshot.sourceSha256}.json`), `${JSON.stringify(capture)}\n`, { flag: "wx", mode: 0o600 });
			await writeFultonOfficeholders(canonical, snapshot, "collected", now());
			const finishedAt = new Date(now()).toISOString();
			await writeAutomationRun(runDirectory, { ...prior, status: "succeeded", finishedAt, lastSuccessAt: finishedAt, lastImportAt: finishedAt, results: [{ sourceId: "ga-fulton-board", status: "imported", records: snapshot.seats.filter(seat => seat.person).length, reason: null }] }, now());
			return { collected: true, publisherRequests: documents.length, retrievedAt: snapshot.retrievedAt };
		}
		catch (error) {
			await writeAutomationRun(runDirectory, { ...prior, status: "failed", finishedAt: new Date(now()).toISOString(), results: [{ sourceId: "ga-fulton-board", status: "failed", records: 0, reason: prepared ? "persistence-failed" : "source-unavailable" }] }, now());
			throw error;
		}
	});
}
