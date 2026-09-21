import { createHash, randomUUID } from "node:crypto";
import {
	closeSync,
	copyFileSync,
	existsSync,
	fsyncSync,
	linkSync,
	mkdirSync,
	openSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

interface CoveragePromotionJournal {
	newMetadataSha256: string;
	newSnapshotSha256: string;
	previousMetadataPresent: boolean;
	previousMetadataSha256?: string;
	previousSnapshotPresent: boolean;
	previousSnapshotSha256?: string;
	targetPath: string;
	transactionDirectory: string;
	version: 1;
}

export type CoveragePromotionInterruptionPoint = "metadata" | "snapshot";

export interface CoverageSnapshotReplacementOptions {
	simulateCrashAfter?: CoveragePromotionInterruptionPoint;
}

export class CoveragePromotionInterruptedError extends Error {
	constructor(point: CoveragePromotionInterruptionPoint) {
		super(`Simulated process interruption after replacing coverage ${point}.`);
		this.name = "CoveragePromotionInterruptedError";
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sha256File(path: string) {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function fsyncPath(path: string) {
	const descriptor = openSync(path, "r");

	try {
		fsyncSync(descriptor);
	}
	finally {
		closeSync(descriptor);
	}
}

function fsyncDirectory(path: string) {
	const descriptor = openSync(path, "r");

	try {
		fsyncSync(descriptor);
	}
	finally {
		closeSync(descriptor);
	}
}

function metadataDigest(metadata: Record<string, unknown>) {
	const digest = metadata.contentSha256;

	if (digest === undefined)
		return undefined;

	if (typeof digest !== "string" || !SHA256_PATTERN.test(digest))
		throw new Error("Coverage snapshot metadata contentSha256 must be a lowercase SHA-256 digest.");

	return digest;
}

function transactionPaths(targetPath: string, transactionDirectory: string) {
	const directory = join(dirname(targetPath), transactionDirectory);

	return {
		directory,
		newMetadata: join(directory, "new.meta.json"),
		newSnapshot: join(directory, "new.snapshot.json"),
		previousMetadata: join(directory, "previous.meta.json"),
		previousSnapshot: join(directory, "previous.snapshot.json"),
	};
}

function parseJournal(raw: unknown, targetPath: string): CoveragePromotionJournal {
	if (!isRecord(raw) || raw.version !== 1)
		throw new Error("Coverage promotion journal must be a version 1 JSON object.");

	const resolvedTargetPath = resolve(targetPath);
	const transactionDirectory = raw.transactionDirectory;
	const expectedPrefix = `.${basename(resolvedTargetPath)}.promotion.`;

	if (raw.targetPath !== resolvedTargetPath)
		throw new Error("Coverage promotion journal target does not match the requested snapshot.");

	if (
		typeof transactionDirectory !== "string"
		|| transactionDirectory !== basename(transactionDirectory)
		|| !transactionDirectory.startsWith(expectedPrefix)
		|| !transactionDirectory.endsWith(".txn")
	) {
		throw new Error("Coverage promotion journal contains an invalid transaction directory.");
	}

	for (const field of ["newMetadataSha256", "newSnapshotSha256"] as const) {
		if (typeof raw[field] !== "string" || !SHA256_PATTERN.test(raw[field]))
			throw new Error(`Coverage promotion journal contains an invalid ${field}.`);
	}

	if (typeof raw.previousSnapshotPresent !== "boolean" || typeof raw.previousMetadataPresent !== "boolean")
		throw new Error("Coverage promotion journal is missing prior-pair presence state.");

	if (
		(raw.previousSnapshotPresent && (typeof raw.previousSnapshotSha256 !== "string" || !SHA256_PATTERN.test(raw.previousSnapshotSha256)))
		|| (!raw.previousSnapshotPresent && raw.previousSnapshotSha256 !== undefined)
	) {
		throw new Error("Coverage promotion journal contains invalid prior snapshot state.");
	}

	if (
		(raw.previousMetadataPresent && (typeof raw.previousMetadataSha256 !== "string" || !SHA256_PATTERN.test(raw.previousMetadataSha256)))
		|| (!raw.previousMetadataPresent && raw.previousMetadataSha256 !== undefined)
	) {
		throw new Error("Coverage promotion journal contains invalid prior metadata state.");
	}

	return raw as unknown as CoveragePromotionJournal;
}

function copyAtomically(sourcePath: string, targetPath: string) {
	const temporaryPath = join(
		dirname(targetPath),
		`.${basename(targetPath)}.recovery.${process.pid}.${randomUUID()}.tmp`
	);

	try {
		copyFileSync(sourcePath, temporaryPath);
		fsyncPath(temporaryPath);
		renameSync(temporaryPath, targetPath);
		fsyncDirectory(dirname(targetPath));
	}
	finally {
		rmSync(temporaryPath, { force: true });
	}
}

function cleanupPromotion(targetPath: string, transactionDirectory: string) {
	const journalPath = coveragePromotionJournalPath(targetPath);
	rmSync(journalPath, { force: true });
	fsyncDirectory(dirname(targetPath));
	rmSync(join(dirname(targetPath), transactionDirectory), { force: true, recursive: true });
}

function isCompleteNewPair(targetPath: string, journal: CoveragePromotionJournal) {
	const metadataPath = coverageSnapshotMetadataPath(targetPath);

	if (!existsSync(targetPath) || !existsSync(metadataPath))
		return false;

	if (sha256File(targetPath) !== journal.newSnapshotSha256 || sha256File(metadataPath) !== journal.newMetadataSha256)
		return false;

	const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as unknown;
	return isRecord(metadata) && metadataDigest(metadata) === journal.newSnapshotSha256;
}

function restorePreviousPair(targetPath: string, journal: CoveragePromotionJournal) {
	const targetMetadataPath = coverageSnapshotMetadataPath(targetPath);
	const paths = transactionPaths(targetPath, journal.transactionDirectory);

	if (journal.previousSnapshotPresent) {
		if (!existsSync(paths.previousSnapshot) || sha256File(paths.previousSnapshot) !== journal.previousSnapshotSha256)
			throw new Error("Coverage promotion recovery cannot verify the prior snapshot copy.");

		copyAtomically(paths.previousSnapshot, targetPath);
	}
	else {
		rmSync(targetPath, { force: true });
		fsyncDirectory(dirname(targetPath));
	}

	if (journal.previousMetadataPresent) {
		if (!existsSync(paths.previousMetadata) || sha256File(paths.previousMetadata) !== journal.previousMetadataSha256)
			throw new Error("Coverage promotion recovery cannot verify the prior metadata copy.");

		copyAtomically(paths.previousMetadata, targetMetadataPath);
	}
	else {
		rmSync(targetMetadataPath, { force: true });
		fsyncDirectory(dirname(targetPath));
	}

	if (
		(journal.previousSnapshotPresent && sha256File(targetPath) !== journal.previousSnapshotSha256)
		|| (journal.previousMetadataPresent && sha256File(targetMetadataPath) !== journal.previousMetadataSha256)
		|| (!journal.previousSnapshotPresent && existsSync(targetPath))
		|| (!journal.previousMetadataPresent && existsSync(targetMetadataPath))
	) {
		throw new Error("Coverage promotion recovery could not restore the complete prior snapshot pair.");
	}
}

function publishJournal(targetPath: string, journal: CoveragePromotionJournal) {
	const parent = dirname(targetPath);
	const journalPath = coveragePromotionJournalPath(targetPath);
	const temporaryPath = join(
		parent,
		`.${basename(journalPath)}.${process.pid}.${randomUUID()}.tmp`
	);

	try {
		writeFileSync(temporaryPath, `${JSON.stringify(journal, null, 2)}\n`, { flag: "wx", mode: 0o600 });
		fsyncPath(temporaryPath);
		linkSync(temporaryPath, journalPath);
		fsyncDirectory(parent);
	}
	finally {
		rmSync(temporaryPath, { force: true });
	}
}

export function coverageSnapshotMetadataPath(snapshotPath: string) {
	return `${snapshotPath}.meta.json`;
}

export function coveragePromotionJournalPath(snapshotPath: string) {
	return `${snapshotPath}.promotion.json`;
}

export function coverageSnapshotDigest(snapshotPath: string) {
	return sha256File(snapshotPath);
}

export function bindCoverageSnapshotMetadata(
	metadata: Record<string, unknown>,
	snapshotPath: string
) {
	return {
		...metadata,
		contentSha256: coverageSnapshotDigest(snapshotPath),
	};
}

export function verifyCoverageSnapshotMetadataDigest(
	metadata: Record<string, unknown>,
	snapshotPath: string,
	options: { required?: boolean } = {}
) {
	const expectedDigest = metadataDigest(metadata);

	// Legacy sidecars remain readable so an older release can still be rolled
	// back. Promotion is stricter because approval must bind the exact bytes.
	if (expectedDigest === undefined) {
		if (options.required)
			throw new Error("Coverage snapshot approval metadata must include contentSha256.");

		return;
	}

	const actualDigest = coverageSnapshotDigest(snapshotPath);

	if (actualDigest !== expectedDigest)
		throw new Error("Coverage snapshot does not match its approval metadata digest.");
}

export function recoverPendingCoveragePromotion(targetPath: string) {
	const resolvedTargetPath = resolve(targetPath);
	const journalPath = coveragePromotionJournalPath(resolvedTargetPath);

	if (!existsSync(journalPath))
		return "none" as const;

	const journal = parseJournal(JSON.parse(readFileSync(journalPath, "utf8")), resolvedTargetPath);

	if (isCompleteNewPair(resolvedTargetPath, journal)) {
		cleanupPromotion(resolvedTargetPath, journal.transactionDirectory);
		return "new" as const;
	}

	restorePreviousPair(resolvedTargetPath, journal);
	cleanupPromotion(resolvedTargetPath, journal.transactionDirectory);
	return "previous" as const;
}

export function replaceCoverageSnapshotPair(
	sourcePath: string,
	targetPath: string,
	options: CoverageSnapshotReplacementOptions = {}
) {
	const resolvedTargetPath = resolve(targetPath);
	const resolvedSourcePath = resolve(sourcePath);
	const sourceMetadataPath = coverageSnapshotMetadataPath(resolvedSourcePath);
	const targetMetadataPath = coverageSnapshotMetadataPath(resolvedTargetPath);

	recoverPendingCoveragePromotion(resolvedTargetPath);
	mkdirSync(dirname(resolvedTargetPath), { recursive: true });

	const transactionDirectory = `.${basename(resolvedTargetPath)}.promotion.${process.pid}.${randomUUID()}.txn`;
	const paths = transactionPaths(resolvedTargetPath, transactionDirectory);
	let journalPublished = false;

	mkdirSync(paths.directory, { mode: 0o700 });

	try {
		copyFileSync(resolvedSourcePath, paths.newSnapshot);
		const sourceMetadata = JSON.parse(readFileSync(sourceMetadataPath, "utf8")) as unknown;

		if (!isRecord(sourceMetadata))
			throw new Error("Coverage snapshot metadata must be a JSON object.");

		const boundMetadata = bindCoverageSnapshotMetadata(sourceMetadata, paths.newSnapshot);
		writeFileSync(paths.newMetadata, `${JSON.stringify(boundMetadata, null, 2)}\n`, { mode: 0o600 });

		const previousSnapshotPresent = existsSync(resolvedTargetPath);
		const previousMetadataPresent = existsSync(targetMetadataPath);

		if (previousSnapshotPresent)
			copyFileSync(resolvedTargetPath, paths.previousSnapshot);

		if (previousMetadataPresent)
			copyFileSync(targetMetadataPath, paths.previousMetadata);

		for (const path of [
			paths.newSnapshot,
			paths.newMetadata,
			previousSnapshotPresent ? paths.previousSnapshot : undefined,
			previousMetadataPresent ? paths.previousMetadata : undefined,
		]) {
			if (path)
				fsyncPath(path);
		}

		fsyncDirectory(paths.directory);

		const journal: CoveragePromotionJournal = {
			newMetadataSha256: sha256File(paths.newMetadata),
			newSnapshotSha256: sha256File(paths.newSnapshot),
			previousMetadataPresent,
			previousMetadataSha256: previousMetadataPresent ? sha256File(paths.previousMetadata) : undefined,
			previousSnapshotPresent,
			previousSnapshotSha256: previousSnapshotPresent ? sha256File(paths.previousSnapshot) : undefined,
			targetPath: resolvedTargetPath,
			transactionDirectory,
			version: 1,
		};

		publishJournal(resolvedTargetPath, journal);
		journalPublished = true;

		renameSync(paths.newSnapshot, resolvedTargetPath);
		fsyncDirectory(dirname(resolvedTargetPath));

		if (options.simulateCrashAfter === "snapshot")
			throw new CoveragePromotionInterruptedError("snapshot");

		renameSync(paths.newMetadata, targetMetadataPath);
		fsyncDirectory(dirname(resolvedTargetPath));

		if (options.simulateCrashAfter === "metadata")
			throw new CoveragePromotionInterruptedError("metadata");

		if (!isCompleteNewPair(resolvedTargetPath, journal))
			throw new Error("Coverage promotion did not produce a complete digest-bound snapshot pair.");

		cleanupPromotion(resolvedTargetPath, transactionDirectory);
	}
	catch (error) {
		if (error instanceof CoveragePromotionInterruptedError)
			throw error;

		if (journalPublished) {
			try {
				recoverPendingCoveragePromotion(resolvedTargetPath);
			}
			catch (recoveryError) {
				throw new AggregateError(
					[error, recoveryError],
					"Coverage promotion failed and automatic recovery could not establish a complete snapshot pair."
				);
			}
		}
		else {
			rmSync(paths.directory, { force: true, recursive: true });
		}

		throw error;
	}
}
