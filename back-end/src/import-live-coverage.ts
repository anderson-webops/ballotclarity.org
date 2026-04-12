import { readFileSync } from "node:fs";
import process from "node:process";
import {
	parseCoverageSnapshot,
	writeCoverageSnapshot,
} from "./coverage-repository.js";

function readFlag(flag: string) {
	const index = process.argv.indexOf(flag);

	if (index === -1)
		return undefined;

	return process.argv[index + 1];
}

async function readSourcePayload() {
	const filePath = readFlag("--from-file") || process.env.LIVE_COVERAGE_SOURCE_FILE;
	const sourceUrl = readFlag("--from-url") || process.env.LIVE_COVERAGE_SOURCE_URL;

	if (filePath)
		return readFileSync(filePath, "utf8");

	if (sourceUrl) {
		const response = await fetch(sourceUrl);

		if (!response.ok)
			throw new Error(`Unable to fetch live coverage snapshot: ${response.status} ${response.statusText}`);

		return await response.text();
	}

	throw new Error("Specify --from-file <path> or --from-url <url> when importing live coverage.");
}

async function main() {
	try {
		const snapshot = parseCoverageSnapshot(JSON.parse(await readSourcePayload()));
		const outputPath = writeCoverageSnapshot(
			snapshot,
			readFlag("--output") || process.env.LIVE_COVERAGE_FILE || undefined
		);

		console.log(`Imported live coverage snapshot to ${outputPath}.`);
	}
	catch (error) {
		console.error(error instanceof Error ? error.message : "Unable to import live coverage snapshot.");
		process.exit(1);
	}
}

void main();
