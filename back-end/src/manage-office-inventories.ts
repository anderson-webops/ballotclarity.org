import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import { realpath } from "node:fs/promises";
import { isAbsolute } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { collectHennepinOfficeCapture, persistOfficeInventory, readOfficeInventoryState } from "./election-office-collection.js";
import { serializeOfficeInventoryCsv } from "./election-office-inventory.js";
import { configuredStateBallotSources, legacyReviewedStateBallotSource } from "./state-ballot-registry.js";
import { parseBundledStateSnapshot } from "./state-ballot-snapshot.js";
import { assertExternalStateDataDirectory, readBoundedStateData, readBoundedStateDataBytes } from "./state-ballot-storage.js";

async function main() {
	const { values, positionals } = parseArgs({ allowPositionals: true, strict: true, options: { "directory": { type: "string" }, "capture": { type: "string" }, "candidate-snapshot": { type: "string", multiple: true }, "format": { type: "string" } } });
	const [command] = positionals;
	if (positionals.length !== 1 || !["collect", "prepare", "audit", "export"].includes(command ?? "") || !values.directory) throw new Error("Use collect|prepare|audit|export --directory ABSOLUTE_EXTERNAL_PATH [--capture FILE] [--candidate-snapshot FILE ...] [--format json|csv].");
	assertExternalStateDataDirectory(values.directory);
	try {
		assertExternalStateDataDirectory(await realpath(values.directory));
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	if ((command === "prepare") !== Boolean(values.capture) || (values.format && (command !== "export" || !["json", "csv"].includes(values.format))) || (command === "export" && values["candidate-snapshot"]?.length)) throw new Error("The requested office inventory options do not match the operation.");
	const paths = values["candidate-snapshot"] ?? [];
	if (paths.length > 100 || new Set(paths).size !== paths.length || [...paths, ...values.capture ? [values.capture] : []].some(path => !isAbsolute(path))) throw new Error("Use distinct, bounded, absolute candidate and capture paths.");
	const snapshots: StateBallotSnapshot[] = [];
	for (const path of paths) {
		const body = await readBoundedStateData(path);
		const metadata = JSON.parse(body);
		const configured = configuredStateBallotSources.find(source => source.id === metadata.sourceId && source.stateCode === "MN");
		if (!configured) throw new Error("Office comparisons require a configured Minnesota candidate source.");
		const source = metadata.retrievalPolicy === "manual-snapshot" && configured.retrievalPolicy !== "manual-snapshot" ? legacyReviewedStateBallotSource(configured) : configured;
		if (!source) throw new Error("The candidate snapshot has no reviewed source contract.");
		const snapshot = parseBundledStateSnapshot(source, body, metadata.retrievalPolicy);
		if (Date.parse(snapshot.retrievedAt) > Date.now()) throw new Error("Candidate capture times cannot be in the future.");
		snapshots.push(snapshot);
	}
	if (new Set(snapshots.map(snapshot => snapshot.source.id)).size !== snapshots.length) throw new Error("Candidate sources must be distinct.");
	const current = await readOfficeInventoryState(values.directory);
	if (command === "export") {
		if (!current) throw new Error("No accepted office inventory is available.");
		process.stdout.write(values.format === "csv" ? serializeOfficeInventoryCsv(current.inventory) : `${JSON.stringify(current, null, 2)}\n`);
		return;
	}
	const capture = command === "collect" ? await collectHennepinOfficeCapture() : command === "prepare" ? new TextDecoder("utf-8", { fatal: true }).decode(await readBoundedStateDataBytes(values.capture!, 4 * 1024 * 1024)) : current?.capture;
	if (!capture) throw new Error("No accepted office inventory is available for comparison.");
	const result = await persistOfficeInventory(values.directory, capture, snapshots);
	process.stdout.write(`${JSON.stringify({ sourceId: result.state.inventory.sourceId, electionDate: result.state.inventory.electionDate, inventoryRows: result.state.inventory.rows.length, inventoryChanged: result.inventoryChanged, auditChanged: result.auditChanged, lastSourceCheckAt: result.state.lastSourceCheckAt, lastInventoryImportAt: result.state.lastInventoryImportAt, lastAuditPreparedAt: result.state.lastAuditPreparedAt, audit: result.state.audit })}\n`);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Office inventory management failed.");
	process.exitCode = 1;
});
