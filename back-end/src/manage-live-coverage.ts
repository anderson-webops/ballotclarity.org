import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { coverageSnapshotMetadataPath } from "./coverage-repository.js";

function readFlag(flag: string, argv = process.argv.slice(2)) {
	const index = argv.indexOf(flag);

	if (index === -1)
		return undefined;

	return argv[index + 1];
}

function requireFlag(flag: string, argv = process.argv.slice(2)) {
	const value = readFlag(flag, argv);

	if (!value)
		throw new Error(`${flag} is required.`);

	return value;
}

export function defaultTargetPath() {
	return process.env.LIVE_COVERAGE_FILE || resolve(process.cwd(), "back-end", "data", "live-coverage.local.json");
}

export function backupDirectoryFor(snapshotPath: string) {
	return join(dirname(snapshotPath), "backups");
}

function timestamp() {
	return new Date().toISOString().replaceAll(":", "").replaceAll(".", "").replace("T", "-");
}

export function backupSnapshot(snapshotPath: string) {
	if (!existsSync(snapshotPath))
		return null;

	const backupDir = backupDirectoryFor(snapshotPath);
	mkdirSync(backupDir, { recursive: true });
	const stamp = timestamp();
	const backupSnapshotPath = join(backupDir, `${basename(snapshotPath)}.${stamp}`);
	const backupMetadataPath = coverageSnapshotMetadataPath(backupSnapshotPath);

	copyFileSync(snapshotPath, backupSnapshotPath);

	if (existsSync(coverageSnapshotMetadataPath(snapshotPath)))
		copyFileSync(coverageSnapshotMetadataPath(snapshotPath), backupMetadataPath);

	return {
		metadataPath: existsSync(backupMetadataPath) ? backupMetadataPath : null,
		snapshotPath: backupSnapshotPath,
		stamp
	};
}

export function promoteSnapshot(candidatePath: string, targetPath: string) {
	if (!existsSync(candidatePath))
		throw new Error(`Candidate snapshot not found at ${candidatePath}.`);

	if (!existsSync(coverageSnapshotMetadataPath(candidatePath)))
		throw new Error(`Candidate snapshot metadata not found at ${coverageSnapshotMetadataPath(candidatePath)}.`);

	mkdirSync(dirname(targetPath), { recursive: true });
	copyFileSync(candidatePath, targetPath);
	copyFileSync(coverageSnapshotMetadataPath(candidatePath), coverageSnapshotMetadataPath(targetPath));
}

export function rollbackSnapshot(targetPath: string, backupPath: string) {
	if (!existsSync(backupPath))
		throw new Error(`Backup snapshot not found at ${backupPath}.`);

	copyFileSync(backupPath, targetPath);

	if (existsSync(coverageSnapshotMetadataPath(backupPath)))
		copyFileSync(coverageSnapshotMetadataPath(backupPath), coverageSnapshotMetadataPath(targetPath));
}

export function listBackups(targetPath: string) {
	const backupDir = backupDirectoryFor(targetPath);

	if (!existsSync(backupDir))
		return [];

	return readdirSync(backupDir)
		.filter(entry => entry.startsWith(`${basename(targetPath)}.`))
		.filter(entry => !entry.endsWith(".meta.json"))
		.sort()
		.reverse()
		.map(entry => join(backupDir, entry));
}

export function runManageCoverageCommand(argv = process.argv.slice(2)) {
	const [command] = argv;
	const targetPath = readFlag("--target", argv) || defaultTargetPath();

	if (!command || command === "help" || command === "--help") {
		console.log("Usage:");
		console.log("  tsx src/manage-live-coverage.ts promote --from <candidate-snapshot> [--target <active-snapshot>]");
		console.log("  tsx src/manage-live-coverage.ts rollback --from <backup-snapshot> [--target <active-snapshot>]");
		console.log("  tsx src/manage-live-coverage.ts list-backups [--target <active-snapshot>]");
		return;
	}

	if (command === "promote") {
		const candidatePath = requireFlag("--from", argv);
		const backup = backupSnapshot(targetPath);
		promoteSnapshot(candidatePath, targetPath);
		console.log(`Promoted coverage snapshot from ${candidatePath} to ${targetPath}.`);

		if (backup)
			console.log(`Backed up previous active snapshot to ${backup.snapshotPath}.`);

		return;
	}

	if (command === "rollback") {
		const backupPath = requireFlag("--from", argv);
		const backup = backupSnapshot(targetPath);
		rollbackSnapshot(targetPath, backupPath);
		console.log(`Rolled back active coverage snapshot from ${backupPath} to ${targetPath}.`);

		if (backup)
			console.log(`Backed up pre-rollback snapshot to ${backup.snapshotPath}.`);

		return;
	}

	if (command === "list-backups") {
		for (const entry of listBackups(targetPath))
			console.log(entry);
		return;
	}

	throw new Error(`Unknown command: ${command}`);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
	try {
		runManageCoverageCommand();
	}
	catch (error) {
		console.error(error instanceof Error ? error.message : "Unable to manage live coverage snapshot.");
		process.exit(1);
	}
}
