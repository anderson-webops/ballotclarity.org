import type { CoverageSnapshotMetadata } from "./coverage-repository.js";
import type { CoverageSnapshotStatus } from "./types/civic.js";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
	coverageSnapshotMetadataPath,
	writeCoverageSnapshot,
	writeCoverageSnapshotMetadata,
} from "./coverage-repository.js";
import {
	summarizeCoverageSnapshotValidation,
	validateCoverageSnapshotForPublication,
} from "./coverage-snapshot-validation.js";
import {
	buildFultonOfficialLogisticsOnlySnapshot,
	buildFultonReviewedCoverageSnapshotMetadata,
	fultonOfficialLogisticsSnapshotDefaultTimestamp,
} from "./fulton-reviewed-coverage.js";

function readFlag(flag: string, argv = process.argv.slice(2)) {
	const index = argv.indexOf(flag);

	if (index === -1)
		return undefined;

	return argv[index + 1];
}

function defaultOutputPath() {
	return resolve(
		process.cwd(),
		"data",
		"reviewed",
		"fulton-county-2026-general.official-logistics-only.json",
	);
}

function parseStatus(value: string | undefined): CoverageSnapshotStatus {
	const status = value ?? "reviewed";

	if (status !== "reviewed" && status !== "production_approved")
		throw new Error("Fulton reviewed coverage export status must be reviewed or production_approved.");

	return status;
}

function buildMetadata({
	note,
	sourceLabel,
	sourceOrigin,
	status,
	timestamp,
}: {
	note?: string;
	sourceLabel?: string;
	sourceOrigin?: string;
	status: CoverageSnapshotStatus;
	timestamp: string;
}): CoverageSnapshotMetadata {
	return buildFultonReviewedCoverageSnapshotMetadata({
		approvedAt: status === "production_approved" ? timestamp : undefined,
		importedAt: timestamp,
		note,
		reviewedAt: timestamp,
		sourceLabel,
		sourceOrigin,
		status,
	});
}

export function runExportFultonReviewedCoverageCommand(argv = process.argv.slice(2)) {
	const outputPath = readFlag("--output", argv) || process.env.LIVE_COVERAGE_FILE || defaultOutputPath();
	const timestamp = readFlag("--timestamp", argv) || fultonOfficialLogisticsSnapshotDefaultTimestamp;
	const status = parseStatus(readFlag("--status", argv) || process.env.LIVE_COVERAGE_STATUS);
	const metadata = buildMetadata({
		note: readFlag("--note", argv) || process.env.LIVE_COVERAGE_NOTE,
		sourceLabel: readFlag("--source-label", argv) || process.env.LIVE_COVERAGE_SOURCE_LABEL,
		sourceOrigin: readFlag("--source-origin", argv) || process.env.LIVE_COVERAGE_SOURCE_ORIGIN,
		status,
		timestamp,
	});
	const snapshot = buildFultonOfficialLogisticsOnlySnapshot(timestamp);
	const validation = validateCoverageSnapshotForPublication(snapshot, metadata);

	for (const line of summarizeCoverageSnapshotValidation(validation))
		console.log(line);

	if (!validation.ok)
		throw new Error("Fulton reviewed coverage export failed validation.");

	const snapshotPath = writeCoverageSnapshot(snapshot, outputPath);
	const metadataPath = writeCoverageSnapshotMetadata(metadata, snapshotPath);

	console.log(`Wrote reviewed Fulton coverage snapshot to ${snapshotPath}.`);
	console.log(`Wrote reviewed Fulton coverage metadata to ${metadataPath}.`);
	console.log(`Ops handoff: /usr/local/sbin/ballotclarity-coverage promote --from ${snapshotPath} --target /srv/ballotclarity.org/back-end/data/live-coverage.active.json`);

	return {
		metadataPath,
		snapshotPath,
		validation,
	};
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
	try {
		runExportFultonReviewedCoverageCommand();
	}
	catch (error) {
		console.error(error instanceof Error ? error.message : "Unable to export reviewed Fulton coverage snapshot.");
		console.error(`Expected metadata sidecar path: ${coverageSnapshotMetadataPath(readFlag("--output") || defaultOutputPath())}`);
		process.exit(1);
	}
}
