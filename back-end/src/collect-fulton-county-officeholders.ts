import type { FultonCountyOfficeholderCapture } from "./fulton-county-officeholders.js";
import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { readAutomationRun, writeAutomationRun } from "./admin-operations.js";
import { readFultonCountyOfficeholderEnvelope, withFultonCountyOfficeholderLock, writeFultonCountyOfficeholders } from "./fulton-county-officeholder-storage.js";
import { fultonCountyOfficeholderPublication, parseFultonCountyOffice, prepareFultonCountyOfficeholders } from "./fulton-county-officeholders.js";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { parseStateHtml, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function collectFultonCountyOfficeholders({ directory, now = Date.now, request = fetchRemoteSourceText, pause = setTimeout }: { directory: string; now?: () => number; request?: typeof fetchRemoteSourceText; pause?: (milliseconds: number) => Promise<unknown> }) {
	return withFultonCountyOfficeholderLock(directory, async (canonical) => {
		let lastImportAt: string | null = null;
		try {
			const current = readFultonCountyOfficeholderEnvelope(canonical, now());
			lastImportAt = current.importedAt;
			if (Date.parse(current.snapshot.retrievedAt) + fultonCountyOfficeholderPublication.minimumRefreshIntervalMs > now()) return { collected: false, publisherRequests: 0, retrievedAt: current.snapshot.retrievedAt };
		}
		catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
		const runDirectory = join(canonical, "county-office-automation");
		await mkdir(runDirectory, { recursive: true });
		if (await realpath(runDirectory) !== runDirectory) throw new Error("The county-office collection journal must not be redirected.");
		const previous = await readAutomationRun(runDirectory, now());
		if (previous?.status === "failed" && Date.parse(previous.startedAt) + fultonCountyOfficeholderPublication.minimumRefreshIntervalMs > now()) throw new Error("The failed county-office collection is awaiting its next permitted retry.");
		const prior = { schemaVersion: 1 as const, type: "ballot-automation-run" as const, startedAt: new Date(now()).toISOString(), lastImportAt, lastSuccessAt: previous?.lastSuccessAt ?? null, nextRunAt: null };
		await writeAutomationRun(runDirectory, { ...prior, status: "running", finishedAt: null, results: [] }, now());
		let prepared = false;
		try {
			const documents: FultonCountyOfficeholderCapture["documents"] = [];
			const get = async (url: string) => {
				if (documents.length) await pause(11000);
				const body = await request(url, { allowedHosts: ["fultoncountyga.gov"], maxBytes: fultonCountyOfficeholderPublication.maximumDocumentBytes, maxRedirects: 0, timeoutMs: 15000 });
				documents.push({ url, body, capturedAt: new Date(now()).toISOString(), sha256: digest(body) });
				return body;
			};
			for (const policy of fultonCountyOfficeholderPublication.policies) {
				const body = await get(policy.url);
				let region = body;
				if (policy.region === "main-text") {
					const main = stateHtmlDescendants(parseStateHtml(body), node => node.nodeName === "main");
					if (main.length !== 1) throw new Error("The county-office publisher policy layout requires review.");
					region = stateHtmlText(main[0]!).replace(/\s+/gu, " ").trim();
				}
				if (digest(region) !== policy.sha256) throw new Error("The county-office publisher policy requires review.");
			}
			for (const definition of fultonCountyOfficeholderPublication.offices) {
				const office = parseFultonCountyOffice(await get(definition.pageUrl), definition);
				if (office.person) await get(office.person.officialWebsiteUrl);
			}
			const capture: FultonCountyOfficeholderCapture = { schemaVersion: 1, type: "fulton-county-officeholder-capture", documents };
			const snapshot = prepareFultonCountyOfficeholders(capture, now());
			prepared = true;
			const captures = join(canonical, "county-office-captures");
			await mkdir(captures, { recursive: true });
			if (await realpath(captures) !== captures) throw new Error("The county-office capture directory must not be redirected.");
			await writeFile(join(captures, `${snapshot.sourceSha256}.json`), `${JSON.stringify(capture)}\n`, { flag: "wx", mode: 0o600 });
			await writeFultonCountyOfficeholders(canonical, snapshot, "collected", now());
			const finishedAt = new Date(now()).toISOString();
			await writeAutomationRun(runDirectory, { ...prior, status: "succeeded", finishedAt, lastImportAt: finishedAt, lastSuccessAt: finishedAt, results: [{ sourceId: "ga-fulton-county-offices", status: "imported", records: snapshot.offices.filter(office => office.person).length, reason: null }] }, now());
			return { collected: true, publisherRequests: documents.length, retrievedAt: snapshot.retrievedAt };
		}
		catch (error) {
			await writeAutomationRun(runDirectory, { ...prior, status: "failed", finishedAt: new Date(now()).toISOString(), results: [{ sourceId: "ga-fulton-county-offices", status: "failed", records: 0, reason: prepared ? "persistence-failed" : "source-unavailable" }] }, now());
			throw error;
		}
	});
}
