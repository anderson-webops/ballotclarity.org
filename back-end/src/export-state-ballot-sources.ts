import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { serializeStateBallotSnapshots } from "./state-ballot-export.js";
import { createStateBallotRepository } from "./state-ballot-repository.js";
import { stateBallotSources } from "./state-ballot-sources.js";

async function main() {
	const { positionals, values } = parseArgs({ options: { output: { type: "string" } }, allowPositionals: true });
	const requested = positionals.map(state => state.toUpperCase());
	if (requested.some(state => !stateBallotSources.some(source => source.stateCode === state)))
		throw new Error("Every requested state must have a configured official source.");
	const sources = requested.length ? stateBallotSources.filter(source => requested.includes(source.stateCode)) : stateBallotSources;
	const repository = createStateBallotRepository();
	const snapshots = [];
	for (const source of sources) {
		const snapshot = await repository.getSnapshot(source.stateCode);
		if (!snapshot) throw new Error(`No export written: the ${source.stateCode} official source is unavailable.`);
		snapshots.push(snapshot);
	}
	const content = serializeStateBallotSnapshots(snapshots);
	if (values.output) {
		const path = resolve(values.output);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content, { flag: "wx", mode: 0o644 });
		console.error(`Exported ${snapshots.reduce((count, snapshot) => count + snapshot.records.length, 0)} records from ${snapshots.length} states to ${path}.`);
	}
	else {
		process.stdout.write(content);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Candidate export failed.");
	process.exitCode = 1;
});
