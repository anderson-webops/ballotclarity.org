import type { FultonCalendarRun } from "../src/fulton-election-calendar-storage.js";
import type { FultonCalendarInventory } from "../src/fulton-election-calendar.js";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildAdminOperations, writeAutomationRun } from "../src/admin-operations.js";
import { createFultonCalendarRepository, describeFultonCalendar } from "../src/fulton-election-calendar-operations.js";
import { fultonCalendarPublication } from "../src/fulton-election-calendar.js";

const now = Date.parse("2026-11-13T19:00:00.000Z");
const time = new Date(now).toISOString();
function inventory(conflict = false): FultonCalendarInventory {
	return { schemaVersion: 1, type: "official-election-calendar-inventory", sourceId: fultonCalendarPublication.sourceId, stateCode: "GA", countyFips: "13121", retrievedAt: time, sourceSha256: "a".repeat(64), sourcePublishedAt: null, publicationApproved: false, electionOccurrenceConfirmed: false, documents: [], sections: [{ title: "General Runoff Election", electionDate: "2026-12-01", status: conflict ? "review-required" : "parsed", entries: [{ id: "b".repeat(24), label: "Logic and Accuracy Testing of Voting Equipment", printedDate: conflict ? "Monday, November 11" : "Wednesday, November 11", date: conflict ? null : "2026-11-11", endDate: null, issues: conflict ? ["weekday-date-conflict: fixture"] : [] }] }] };
}
function run(status: FultonCalendarRun["status"] = "succeeded"): FultonCalendarRun {
	return { schemaVersion: 1, type: "fulton-calendar-collection-run", status, startedAt: time, finishedAt: status === "running" ? null : time, lastSuccessAt: status === "succeeded" ? time : null, publisherRequests: 4, reason: status === "failed" ? "collection-failed" : null };
}

test("calendar inspection preserves review facts and never labels source custody as deadline import", () => {
	const source = inventory(true);
	const before = JSON.stringify(source);
	const dataset = describeFultonCalendar(source, null, now);
	assert.equal(dataset.kind, "calendars");
	assert.equal(dataset.status, "review");
	assert.equal(dataset.records, 1);
	assert.equal(dataset.failure, null);
	assert.equal(dataset.lastImportAt, null);
	assert.equal(dataset.lastSuccessAt, null);
	assert.equal(dataset.collectionState, "unreported");
	assert.equal(dataset.sourceUrl, fultonCalendarPublication.calendarUrl);
	assert.deepEqual(dataset.reviewIssues, [{ id: "b".repeat(24), label: "Logic and Accuracy Testing of Voting Equipment", printedDate: "Monday, November 11", electionDate: "2026-12-01", reason: "The printed weekday and date disagree." }]);
	assert.equal(JSON.stringify(source), before);
});

test("calendar freshness, attempts and successful collection clocks stay separate from scheduling and imports", () => {
	const fresh = describeFultonCalendar(inventory(), run(), now + 1000);
	assert.equal(fresh.status, "current");
	assert.equal(fresh.lastAttemptAt, time);
	assert.equal(fresh.lastSuccessAt, time);
	assert.equal(fresh.lastImportAt, null);
	assert.equal("nextRunAt" in fresh, false);
	assert.equal(describeFultonCalendar(inventory(), run(), now + 21600000).status, "stale");
	assert.equal(describeFultonCalendar(null, run("running"), now + 1000).status, "pending");
	const delayed = describeFultonCalendar(inventory(), run("running"), now + 21600000);
	assert.equal(delayed.status, "error");
	assert.equal(delayed.failure, "Calendar collection has not reported a result.");
});

test("failed collection keeps prior review facts and makes acquisition failure visible", () => {
	const failed = describeFultonCalendar(inventory(true), run("failed"), now);
	assert.equal(failed.status, "error");
	assert.equal(failed.failure, "Calendar collection failed.");
	assert.equal(failed.records, 1);
	assert.equal(failed.reviewIssues!.length, 1);
	const persistence = describeFultonCalendar(inventory(), { ...run("failed"), reason: "persistence-failed" }, now);
	assert.equal(persistence.failure, "Calendar evidence could not be saved.");
});

test("calendar monitoring is opt-in and missing directories are inspected without being created", async () => {
	assert.equal(createFultonCalendarRepository(""), null);
	assert.throws(() => createFultonCalendarRepository("relative"), /absolute/u);
	const directory = await mkdtemp(join(tmpdir(), "ballot-calendar-missing-monitor-"));
	try {
		const repository = createFultonCalendarRepository(join(directory, "missing"), () => now)!;
		const dataset = (await repository.inspectSources())[0]!;
		assert.equal(dataset.status, "missing");
		assert.equal(dataset.records, null);
		assert.equal(dataset.lastImportAt, null);
		assert.deepEqual(await readdir(directory), []);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("invalid source files and invalid or redirected collection journals produce bounded errors", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-calendar-invalid-monitor-"));
	try {
		const repository = createFultonCalendarRepository(directory, () => now)!;
		await writeFile(join(directory, "fulton-calendar.json"), "{}");
		const invalid = (await repository.inspectSources())[0]!;
		assert.equal(invalid.status, "error");
		assert.equal(invalid.failure, "Calendar source evidence is invalid.");
		assert.doesNotMatch(JSON.stringify(invalid), new RegExp(directory, "u"));
		await rm(join(directory, "fulton-calendar.json"));
		await writeFile(join(directory, "calendar-run.json"), "{}");
		assert.equal((await repository.inspectSources())[0]!.collectionState, "invalid");
		await rm(join(directory, "calendar-run.json"));
		await writeFile(join(directory, "retained.json"), JSON.stringify(run()));
		await symlink(join(directory, "retained.json"), join(directory, "calendar-run.json"));
		assert.equal((await repository.inspectSources())[0]!.failure, "Calendar collection evidence is invalid.");
		assert.equal(await readFile(join(directory, "retained.json"), "utf8"), JSON.stringify(run()));
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("candidate automation receipts cannot assign calendar deadline-import or scheduling evidence", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-calendar-isolation-"));
	try {
		await writeAutomationRun(directory, { schemaVersion: 1, type: "ballot-automation-run", status: "succeeded", startedAt: time, finishedAt: time, lastSuccessAt: time, lastImportAt: time, nextRunAt: null, results: [{ sourceId: fultonCalendarPublication.sourceId, status: "imported", records: 1, reason: null }] }, now);
		const dataset = describeFultonCalendar(inventory(true), null, now);
		const result = await buildAdminOperations({ candidates: null, references: null, calendars: { inspectSources: async () => [dataset] }, dataDirectory: directory, now });
		assert.deepEqual(result.datasets, [dataset]);
		assert.equal(result.datasets[0]!.lastImportAt, null);
		assert.equal(result.datasets[0]!.lastAttemptAt, null);
		assert.equal(result.datasets[0]!.collectionState, "unreported");
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
