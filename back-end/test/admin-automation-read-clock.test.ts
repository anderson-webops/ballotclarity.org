import type { AdminAutomationRun } from "../src/types/civic.js";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readAutomationRun, writeAutomationRun } from "../src/admin-operations.js";

const baseTime = Date.parse("2026-11-02T00:00:00.000Z");
const running = (time: number): AdminAutomationRun => ({ schemaVersion: 1, type: "ballot-automation-run", status: "running", startedAt: new Date(time).toISOString(), finishedAt: null, lastImportAt: null, lastSuccessAt: null, nextRunAt: null, results: [] });

test("default automation reads validate the completed observation, not the time before asynchronous I/O", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-automation-observation-"));
	try {
		const evidence = running(baseTime + 1);
		await writeAutomationRun(directory, evidence, baseTime + 1);
		let observedTime = baseTime;
		context.mock.method(Date, "now", () => observedTime);
		const observation = readAutomationRun(directory);
		observedTime = baseTime + 1;
		assert.deepEqual(await observation, evidence);
		await assert.rejects(readAutomationRun(directory, baseTime), /Automation evidence is invalid/u);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("default automation reads still reject genuinely future evidence without timestamp grace", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-automation-future-"));
	try {
		await writeAutomationRun(directory, running(baseTime + 1000), baseTime + 1000);
		context.mock.method(Date, "now", () => baseTime);
		await assert.rejects(readAutomationRun(directory), /Automation evidence is invalid/u);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
