import type { FultonCalendarRun } from "./fulton-election-calendar-storage.js";
import type { FultonCalendarCapture } from "./fulton-election-calendar.js";
import { createHash } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { readFultonCalendarEnvelope, readFultonCalendarRun, writeFultonCalendarCapture, writeFultonCalendarFile } from "./fulton-election-calendar-storage.js";
import { fultonCalendarPublication, readFultonCalendarCapture, readFultonCalendarIndex, verifyFultonCalendarPolicy } from "./fulton-election-calendar.js";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { withStateBallotAutomationLock } from "./state-ballot-automation-lock.js";

export async function collectFultonElectionCalendar({ directory, now = Date.now, request = fetchRemoteSourceText, pause = setTimeout }: { directory: string; now?: () => number; request?: typeof fetchRemoteSourceText; pause?: (milliseconds: number) => Promise<unknown> }) {
	return withStateBallotAutomationLock(directory, "automation.lock", async (canonical) => {
		let current: Awaited<ReturnType<typeof readFultonCalendarEnvelope>> | null = null;
		try {
			current = await readFultonCalendarEnvelope(canonical, now());
		}
		catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
		if (current && Date.parse(current.inventory.retrievedAt) + fultonCalendarPublication.minimumRefreshIntervalMs > now()) return { collected: false, publisherRequests: 0, retrievedAt: current.inventory.retrievedAt };
		const previous = await readFultonCalendarRun(canonical, now());
		if (previous && Date.parse(previous.startedAt) + fultonCalendarPublication.minimumRefreshIntervalMs > now()) throw new Error("The Fulton calendar collection is awaiting its next permitted attempt.");
		const run: FultonCalendarRun = { schemaVersion: 1, type: "fulton-calendar-collection-run", status: "running", startedAt: new Date(now()).toISOString(), finishedAt: null, lastSuccessAt: previous?.lastSuccessAt ?? current?.envelope.storedAt ?? null, publisherRequests: 0, reason: null };
		await writeFultonCalendarFile(canonical, "calendar-run.json", `${JSON.stringify(run)}\n`);
		let prepared = false;
		try {
			const capture: FultonCalendarCapture = { schemaVersion: 1, type: "fulton-election-calendar-capture", documents: [] };
			const get = async (url: string) => {
				if (run.publisherRequests) await pause(fultonCalendarPublication.minimumRequestIntervalMs);
				run.publisherRequests++;
				const body = await request(url, { allowedHosts: ["fultoncountyga.gov"], maxBytes: fultonCalendarPublication.maximumDocumentBytes, maxRedirects: 0, timeoutMs: 15000 });
				capture.documents.push({ url, body, capturedAt: new Date(now()).toISOString(), sha256: createHash("sha256").update(body).digest("hex") });
				return body;
			};
			for (const [index, policy] of fultonCalendarPublication.policies.entries()) verifyFultonCalendarPolicy(await get(policy.url), index);
			readFultonCalendarIndex(await get(fultonCalendarPublication.indexUrl));
			await get(fultonCalendarPublication.calendarUrl);
			readFultonCalendarCapture(capture, now());
			prepared = true;
			const result = await writeFultonCalendarCapture(canonical, capture, "collected", now());
			run.status = "succeeded";
			run.finishedAt = new Date(now()).toISOString();
			run.lastSuccessAt = result.storedAt;
			await writeFultonCalendarFile(canonical, "calendar-run.json", `${JSON.stringify(run)}\n`);
			return { collected: true, publisherRequests: run.publisherRequests, retrievedAt: result.inventory.retrievedAt };
		}
		catch (error) {
			run.status = "failed";
			run.finishedAt = new Date(now()).toISOString();
			run.reason = prepared ? "persistence-failed" : "collection-failed";
			await writeFultonCalendarFile(canonical, "calendar-run.json", `${JSON.stringify(run)}\n`);
			throw error;
		}
	});
}
