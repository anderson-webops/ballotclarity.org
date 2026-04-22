import type { CoverageSnapshotMetadata } from "./coverage-repository.js";
import { readFileSync } from "node:fs";
import process from "node:process";
import {
	parseCoverageSnapshot,
	writeCoverageSnapshot,
	writeCoverageSnapshotMetadata,
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

function buildMetadata(): CoverageSnapshotMetadata {
	const status = readFlag("--status") || process.env.LIVE_COVERAGE_STATUS || "reviewed";
	const sourceLabel = readFlag("--source-label") || process.env.LIVE_COVERAGE_SOURCE_LABEL || "Imported live coverage snapshot";
	const sourceOrigin = readFlag("--source-origin") || process.env.LIVE_COVERAGE_SOURCE_ORIGIN;
	const note = readFlag("--note") || process.env.LIVE_COVERAGE_NOTE;
	const now = new Date().toISOString();

	if (status !== "production_approved" && status !== "reviewed" && status !== "seed" && status !== "unknown")
		throw new Error("Coverage snapshot status must be one of: production_approved, reviewed, seed, unknown.");

	return {
		approvedAt: status === "production_approved" ? now : undefined,
		importedAt: now,
		note,
		reviewedAt: status === "reviewed" || status === "production_approved" ? now : undefined,
		sourceLabel,
		sourceOrigin,
		sourceType: "imported",
		status
	};
}

async function main() {
	try {
		const snapshot = parseCoverageSnapshot(JSON.parse(await readSourcePayload()));
		const outputPath = writeCoverageSnapshot(
			snapshot,
			readFlag("--output") || process.env.LIVE_COVERAGE_FILE || undefined
		);
		const metadataPath = writeCoverageSnapshotMetadata(buildMetadata(), outputPath);

		console.log(`Imported live coverage snapshot to ${outputPath}.`);
		console.log(`Wrote coverage snapshot metadata to ${metadataPath}.`);
	}
	catch (error) {
		console.error(error instanceof Error ? error.message : "Unable to import live coverage snapshot.");
		process.exit(1);
	}
}

void main();
