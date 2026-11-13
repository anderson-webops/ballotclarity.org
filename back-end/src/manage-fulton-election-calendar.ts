import process from "node:process";
import { collectFultonElectionCalendar } from "./collect-fulton-election-calendar.js";
import { maximumFultonCalendarCaptureBytes, prepareFultonCalendarCapture, readFultonCalendarEnvelope } from "./fulton-election-calendar-storage.js";
import { fultonCalendarCsv } from "./fulton-election-calendar.js";
import { readBoundedStateDataBytes } from "./state-ballot-storage.js";

async function main() {
	const [command, directory, file, ...extra] = process.argv.slice(2);
	if (!directory || extra.length || (command === "prepare" ? !file : file !== undefined) || !["collect", "prepare", "export", "csv"].includes(command ?? "")) throw new Error("Use collect DIRECTORY, prepare DIRECTORY CAPTURE.json, export DIRECTORY, or csv DIRECTORY.");
	if (command === "collect") {
		console.log(JSON.stringify(await collectFultonElectionCalendar({ directory })));
	}
	else if (command === "prepare") {
		const result = await prepareFultonCalendarCapture(directory, JSON.parse((await readBoundedStateDataBytes(file!, maximumFultonCalendarCaptureBytes)).toString("utf8")));
		console.log(JSON.stringify({ prepared: true, changed: result.changed, retrievedAt: result.inventory.retrievedAt }));
	}
	else {
		const { inventory } = await readFultonCalendarEnvelope(directory);
		process.stdout.write(command === "csv" ? fultonCalendarCsv(inventory) : `${JSON.stringify(inventory, null, 2)}\n`);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "The Fulton calendar operation failed.");
	process.exitCode = 1;
});
