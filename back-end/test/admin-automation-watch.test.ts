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

test("the recurring runner resumes after abrupt process death without manual lock deletion", { timeout: 15000 }, async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-watch-recovery-"));
	const entry = fileURLToPath(new URL("../src/manage-state-ballot-automation.ts", import.meta.url));
	const workers: ReturnType<typeof spawn>[] = [];
	const launch = () => {
		const worker = spawn(process.execPath, ["--import", "tsx", entry, "--watch"], {
			env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "NC", STATE_BALLOT_ENABLED_SOURCES: "nc-sbe-2026", STATE_BALLOT_REFRESH_INTERVAL_MS: "60000" },
			stdio: ["ignore", "pipe", "pipe"]
		});
		workers.push(worker);
		let output = "";
		worker.stdout.on("data", (chunk) => {
			output += String(chunk);
		});
		return { worker, output: () => output };
	};
	const waitForPass = async (running: ReturnType<typeof launch>) => {
		for (let attempt = 0; attempt < 200; attempt++) {
			assert.equal(running.worker.exitCode, null);
			if (running.output().includes("\"status\":\"succeeded\"")) return;
			await new Promise(resolve => setTimeout(resolve, 20));
		}
		assert.fail("The recurring worker did not complete a pass.");
	};
	try {
		const first = launch();
		await waitForPass(first);
		const killed = once(first.worker, "exit");
		first.worker.kill("SIGKILL");
		assert.equal((await killed)[1], "SIGKILL");
		await access(join(directory, "automation.lock"));
		const restarted = launch();
		await waitForPass(restarted);
		const stopped = once(restarted.worker, "exit");
		restarted.worker.kill("SIGTERM");
		assert.equal((await stopped)[0], 0);
	}
	finally {
		for (const worker of workers) {
			if (worker.exitCode === null && worker.signalCode === null) {
				const stopped = once(worker, "exit");
				worker.kill("SIGKILL");
				await stopped;
			}
		}
		await rm(directory, { recursive: true, force: true });
	}
});

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
		await access(join(directory, "automation.lock"));
		const repeated = spawn(process.execPath, ["--import", "tsx", entry], { env: environment, stdio: "ignore" });
		assert.equal((await once(repeated, "exit"))[0], 0);
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
