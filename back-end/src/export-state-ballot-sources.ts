import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { serializeStateBallotSnapshots } from "./state-ballot-export.js";
import { createStateBallotRepository, resolveStateBallotConfiguration } from "./state-ballot-repository.js";

async function main() {
	const { positionals, values } = parseArgs({ options: { "output": { type: "string" }, "source": { type: "string", multiple: true }, "all-sources": { type: "boolean" } }, allowPositionals: true });
	const requested = positionals.map(state => state.toUpperCase());
	const configuration = resolveStateBallotConfiguration();
	if (requested.some(state => !configuration.sources.some(source => source.stateCode === state)))
		throw new Error("Every requested state must have a configured official source.");
	if (values.source?.some(id => !configuration.sources.some(source => source.id === id && (!requested.length || requested.includes(source.stateCode)))))
		throw new Error("Every requested source must match an enabled state and source.");
	const selected = configuration.sources.filter(source => (!requested.length || requested.includes(source.stateCode)) && (!values.source || values.source.includes(source.id)));
	if (requested.some(state => !selected.some(source => source.stateCode === state)))
		throw new Error("Every requested state must have a selected source.");
	const exactSources = Boolean(values.source || values["all-sources"]);
	const sources = exactSources ? selected : selected.filter((source, index) => selected.findIndex(item => item.stateCode === source.stateCode) === index);
	const repository = createStateBallotRepository();
	const snapshots = [];
	for (const source of sources) {
		const snapshot = await repository.getSnapshot(source.stateCode, exactSources ? source.id : undefined);
		if (!snapshot) throw new Error(`No export written: the ${source.stateCode} official source ${exactSources ? source.id : "selection"} is unavailable.`);
		snapshots.push(snapshot);
	}
	const content = serializeStateBallotSnapshots(snapshots);
	if (values.output) {
		const path = resolve(values.output);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content, { flag: "wx", mode: 0o644 });
		console.error(`Exported ${snapshots.reduce((count, snapshot) => count + snapshot.records.length, 0)} records from ${snapshots.length} sources to ${path}.`);
	}
	else {
		process.stdout.write(content);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Candidate export failed.");
	process.exitCode = 1;
});
