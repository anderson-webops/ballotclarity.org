import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readAutomationRun } from "../src/admin-operations.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";

test("the recurring runner records its next run, excludes concurrent owners and clears scheduling on graceful shutdown", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-watch-test-"));
	const environment = {
		PATH: process.env.PATH,
		HOME: process.env.HOME,
		TMPDIR: process.env.TMPDIR,
		STATE_BALLOT_DATA_DIR: directory,
		STATE_BALLOT_ENABLED_STATES: "NC",
		STATE_BALLOT_ENABLED_SOURCES: "nc-sbe-2026",
		STATE_BALLOT_REFRESH_INTERVAL_MS: "60000"
	};
	const entry = fileURLToPath(new URL("../src/manage-state-ballot-automation.ts", import.meta.url));
	let worker: ReturnType<typeof spawn> | undefined;
	try {
		const source = configuredStateBallotSources.find(source => source.id === "nc-sbe-2026")!;
		await createStateBallotStorage(directory).write({
			source,
			retrievedAt: new Date().toISOString(),
			sha256: "a".repeat(64),
			records: [
				{
					id: "b".repeat(24),
					name: "Synthetic Candidate",
					office: "U.S. Senate",
					district: "",
					scope: "statewide",
					status: "listed"
				}
			]
		});
		worker = spawn(process.execPath, ["--import", "tsx", entry, "--watch"], {
			env: environment,
			stdio: ["ignore", "pipe", "pipe"]
		});
		let scheduled = false;
		for (let attempt = 0; attempt < 200; attempt++) {
			assert.equal(worker.exitCode, null);
			const run = await readAutomationRun(directory);
			if (run?.nextRunAt) {
				scheduled = true;
				break;
			}
			await new Promise(resolve => setTimeout(resolve, 20));
		}
		assert.equal(scheduled, true);
		const second = spawn(process.execPath, ["--import", "tsx", entry], { env: environment, stdio: "ignore" });
		assert.equal((await once(second, "exit"))[0], 1);
		await access(join(directory, "automation.lock"));
		const stopped = once(worker, "exit");
		worker.kill("SIGTERM");
		assert.equal((await stopped)[0], 0);
		const run = await readAutomationRun(directory);
		assert.equal(run!.status, "stopped");
		assert.equal(run!.nextRunAt, null);
		assert.equal(run!.lastImportAt, null);
		await assert.rejects(access(join(directory, "automation.lock")));
	}
	finally {
		if (worker && worker.exitCode === null && worker.signalCode === null) {
			const stopped = once(worker, "exit");
			worker.kill("SIGTERM");
			await stopped;
		}
		await rm(directory, { recursive: true, force: true });
	}
});
