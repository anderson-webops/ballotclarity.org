import type { FultonCalendarRun } from "./fulton-election-calendar-storage.js";
import type { FultonCalendarInventory } from "./fulton-election-calendar.js";
import type { AdminOperationDataset } from "./types/civic.js";
import { realpath } from "node:fs/promises";
import process from "node:process";
import { readFultonCalendarEnvelope, readFultonCalendarRun } from "./fulton-election-calendar-storage.js";
import { fultonCalendarPublication } from "./fulton-election-calendar.js";
import { assertExternalStateDataDirectory } from "./state-ballot-storage.js";

export interface FultonCalendarRepository {
	inspectSources: () => Promise<AdminOperationDataset[]>;
}

export function describeFultonCalendar(inventory: FultonCalendarInventory | null, run: FultonCalendarRun | null, now: number): AdminOperationDataset {
	const reviewIssues = inventory?.sections.flatMap(section => section.entries.filter(entry => entry.issues.length).map(entry => ({ id: entry.id, label: entry.label, printedDate: entry.printedDate, electionDate: section.electionDate, reason: "The printed weekday and date disagree." }))) ?? [];
	let status: AdminOperationDataset["status"] = !inventory ? run?.status === "running" ? "pending" : "missing" : reviewIssues.length ? "review" : Date.parse(inventory.retrievedAt) + fultonCalendarPublication.minimumRefreshIntervalMs <= now ? "stale" : "current";
	let failure: string | null = null;
	if (run?.status === "failed" && (run.finishedAt ?? "") >= (inventory?.retrievedAt ?? "")) {
		status = "error";
		failure = run.reason === "persistence-failed" ? "Calendar evidence could not be saved." : "Calendar collection failed.";
	}
	if (run?.status === "running" && Date.parse(run.startedAt) + fultonCalendarPublication.minimumRefreshIntervalMs <= now) {
		status = "error";
		failure = "Calendar collection has not reported a result.";
	}
	return { id: fultonCalendarPublication.sourceId, label: "Fulton election calendar", stateCode: "GA", electionDate: "", kind: "calendars", mode: "automatic", status, records: inventory?.sections.reduce((total, section) => total + section.entries.length, 0) ?? null, retrievedAt: inventory?.retrievedAt ?? null, lastAttemptAt: run?.startedAt ?? null, lastImportAt: null, failure, collectionState: run?.status ?? "unreported", lastSuccessAt: run?.lastSuccessAt ?? null, sourceUrl: fultonCalendarPublication.calendarUrl, reviewIssues };
}

export function createFultonCalendarRepository(directory = process.env.FULTON_ELECTION_CALENDAR_DIRECTORY?.trim(), now = Date.now): FultonCalendarRepository | null {
	if (!directory) return null;
	assertExternalStateDataDirectory(directory);
	return { async inspectSources() {
		const checkedAt = now();
		let inventory: FultonCalendarInventory | null = null;
		let run: FultonCalendarRun | null = null;
		let failure: string | null = null;
		let invalidRun = false;
		let canonical: string;
		try {
			canonical = await realpath(directory);
			assertExternalStateDataDirectory(canonical);
		}
		catch (error) {
			const dataset = describeFultonCalendar(null, null, checkedAt);
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") Object.assign(dataset, { status: "error", failure: "Calendar source evidence is invalid." });
			return [dataset];
		}
		try {
			inventory = (await readFultonCalendarEnvelope(canonical, checkedAt)).inventory;
		}
		catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") failure = "Calendar source evidence is invalid."; }
		try {
			run = await readFultonCalendarRun(canonical, checkedAt);
		}
		catch {
			failure = "Calendar collection evidence is invalid.";
			invalidRun = true;
		}
		const dataset = describeFultonCalendar(inventory, run, checkedAt);
		if (failure) Object.assign(dataset, { status: "error", failure });
		if (invalidRun) dataset.collectionState = "invalid";
		return [dataset];
	} };
}
