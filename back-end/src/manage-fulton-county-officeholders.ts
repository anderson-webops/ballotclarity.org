import { Buffer } from "node:buffer";
import process from "node:process";
import { collectFultonCountyOfficeholders } from "./collect-fulton-county-officeholders.js";
import { importFultonCountyOfficeholders, readFultonCountyOfficeholderEnvelope } from "./fulton-county-officeholder-storage.js";
import { fultonCountyOfficeholderCsv } from "./fulton-county-officeholders.js";
import { readBoundedStateData } from "./state-ballot-storage.js";

async function main() {
	const [command, directory, file, ...extra] = process.argv.slice(2);
	if (!directory || extra.length || (command === "import" ? !file : file !== undefined) || !["collect", "import", "export", "csv"].includes(command ?? "")) throw new Error("Use collect DIRECTORY, import DIRECTORY SNAPSHOT.json, export DIRECTORY, or csv DIRECTORY.");
	if (command === "collect") {
		console.log(JSON.stringify(await collectFultonCountyOfficeholders({ directory })));
	}
	else if (command === "import") {
		const body = await readBoundedStateData(file!);
		if (Buffer.byteLength(body) > 128 * 1024) throw new Error("The Fulton officeholder import exceeds its bounds.");
		const imported = await importFultonCountyOfficeholders(directory, JSON.parse(body));
		console.log(JSON.stringify({ imported: true, retrievedAt: imported.snapshot.retrievedAt }));
	}
	else {
		const snapshot = readFultonCountyOfficeholderEnvelope(directory).snapshot;
		process.stdout.write(command === "csv" ? fultonCountyOfficeholderCsv(snapshot) : `${JSON.stringify(snapshot, null, 2)}\n`);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "The Fulton county-office operation failed.");
	process.exitCode = 1;
});
