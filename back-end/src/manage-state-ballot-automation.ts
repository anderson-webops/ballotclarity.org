import { mkdir, open, realpath, unlink } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers/promises";
import { writeAutomationRun } from "./admin-operations.js";
import { refreshApprovedCandidateData } from "./state-ballot-automation.js";
import { assertExternalStateDataDirectory } from "./state-ballot-storage.js";

async function main() {
	const args = process.argv.slice(2);
	if (args.length > 1 || (args.length === 1 && args[0] !== "--watch"))
		throw new Error("Use no arguments for one pass or --watch for recurring approved imports.");
	const directory = process.env.STATE_BALLOT_DATA_DIR;
	if (!directory) throw new Error("STATE_BALLOT_DATA_DIR is required.");
	assertExternalStateDataDirectory(directory);
	await mkdir(directory, { recursive: true });
	assertExternalStateDataDirectory(await realpath(directory));
	const interval = Number(process.env.STATE_BALLOT_REFRESH_INTERVAL_MS ?? 4 * 3600000);
	if (!Number.isSafeInteger(interval) || interval < 60000 || interval > 86400000)
		throw new Error("The refresh interval must be between one minute and one day.");
	const lockPath = join(directory, "automation.lock");
	const lock = await open(lockPath, "wx", 0o600);
	const controller = new AbortController();
	const stop = () => controller.abort();
	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);
	let lastRun;
	try {
		await lock.writeFile(String(process.pid));
		do {
			lastRun = await refreshApprovedCandidateData();
			console.log(JSON.stringify(lastRun));
			if (args[0] !== "--watch") {
				if (lastRun.status === "failed") process.exitCode = 1;
				break;
			}
			if (controller.signal.aborted) break;
			lastRun.nextRunAt = new Date(Date.now() + interval).toISOString();
			await writeAutomationRun(directory, lastRun);
			try {
				await setTimeout(interval, undefined, { signal: controller.signal });
			}
			catch {
				break;
			}
		} while (!controller.signal.aborted);
	}
	finally {
		if (lastRun && args[0] === "--watch") {
			lastRun.status = "stopped";
			lastRun.nextRunAt = null;
			await writeAutomationRun(directory, lastRun);
		}
		process.removeListener("SIGINT", stop);
		process.removeListener("SIGTERM", stop);
		await lock.close();
		await unlink(lockPath);
	}
}

main().catch(() => {
	console.error("Approved-data automation failed. Check configuration, source access and the external run receipt.");
	process.exitCode = 1;
});
