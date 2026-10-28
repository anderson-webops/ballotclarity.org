import type { ElectionReferenceRepository } from "./election-references.js";
import type { FultonCountyOfficeholderRepository } from "./fulton-county-officeholder-storage.js";
import type { FultonOfficeholderRepository } from "./fulton-officeholder-storage.js";
import type { StateBallotRepository } from "./state-ballot-repository.js";
import type { AdminAutomationRun, AdminOperationsResponse } from "./types/civic.js";
import { randomUUID } from "node:crypto";
import { mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

export function automationRunPath(directory: string) {
	assertExternalStateDataDirectory(directory);
	return join(directory, "automation-run.json");
}

export function parseAutomationRun(value: unknown, now = Date.now()): AdminAutomationRun {
	const row = value as AdminAutomationRun;
	const timestamp = (value: unknown, future = false) =>
		value === null
		|| (typeof value === "string"
			&& Number.isFinite(Date.parse(value))
			&& new Date(value).toISOString() === value
			&& Date.parse(value) <= now + (future ? 86400000 : 0));
	if (
		!row
		|| typeof row !== "object"
		|| Array.isArray(row)
		|| Object.keys(row).sort().join(",") !== "finishedAt,lastImportAt,lastSuccessAt,nextRunAt,results,schemaVersion,startedAt,status,type"
		|| row.schemaVersion !== 1
		|| row.type !== "ballot-automation-run"
		|| !["running", "succeeded", "failed", "stopped"].includes(row.status)
		|| !row.startedAt
		|| !timestamp(row.startedAt)
		|| !timestamp(row.finishedAt)
		|| !timestamp(row.lastSuccessAt)
		|| !timestamp(row.lastImportAt)
		|| !timestamp(row.nextRunAt, true)
		|| !Array.isArray(row.results)
		|| row.results.length > 5000
	) {
		throw new Error("Automation evidence is invalid.");
	}
	if (
		(row.finishedAt && row.finishedAt < row.startedAt)
		|| ((row.status === "running") !== (row.finishedAt === null))
		|| (row.nextRunAt && (!row.finishedAt || row.nextRunAt <= row.finishedAt))
	) {
		throw new Error("Automation evidence has inconsistent times.");
	}
	for (const result of row.results) {
		if (
			!result
			|| Object.keys(result).sort().join(",") !== "reason,records,sourceId,status"
			|| !/^[a-z0-9-]{1,160}$/u.test(result.sourceId)
			|| !["imported", "cached", "failed"].includes(result.status)
			|| !Number.isSafeInteger(result.records)
			|| result.records < 0
			|| result.records > 25000
			|| ![null, "source-unavailable", "persistence-failed", "configuration-invalid"].includes(result.reason)
			|| (result.status === "failed") !== (result.reason !== null)
		) {
			throw new Error("Automation source results are invalid.");
		}
	}
	if (new Set(row.results.map(result => result.sourceId)).size !== row.results.length)
		throw new Error("Automation results contain duplicate sources.");
	return row;
}

export async function readAutomationRun(directory: string, now = Date.now()) {
	try {
		assertExternalStateDataDirectory(await realpath(directory));
		return parseAutomationRun(
			JSON.parse((await readBoundedStateDataBytes(automationRunPath(directory), 256 * 1024)).toString("utf8")),
			now
		);
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

export async function writeAutomationRun(directory: string, run: AdminAutomationRun, now = Date.now()) {
	parseAutomationRun(run, now);
	assertExternalStateDataDirectory(directory);
	await mkdir(directory, { recursive: true });
	assertExternalStateDataDirectory(await realpath(directory));
	const target = automationRunPath(directory);
	const temporary = join(dirname(target), `.automation-${randomUUID()}.tmp`);
	try {
		const handle = await open(temporary, "wx", 0o600);
		try {
			await handle.writeFile(JSON.stringify(run));
			await handle.sync();
		}
		finally {
			await handle.close();
		}
		await rename(temporary, target);
	}
	finally {
		await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		});
	}
}

export async function buildAdminOperations(options: {
	countyOfficeholders?: FultonCountyOfficeholderRepository | null;
	officeholders?: FultonOfficeholderRepository | null;
	candidates: StateBallotRepository | null;
	references: ElectionReferenceRepository | null;
	dataDirectory: string | null;
	now?: number;
}): Promise<AdminOperationsResponse> {
	const now = options.now ?? Date.now();
	const datasets = [
		...((await options.candidates?.inspectSources?.()) ?? []),
		...((await options.references?.inspectSources?.()) ?? []),
		...((await options.officeholders?.inspectSources?.()) ?? []),
		...((await options.countyOfficeholders?.inspectSources?.()) ?? [])
	];
	let run: AdminAutomationRun | null = null;
	let invalid = false;
	try {
		run = options.dataDirectory ? await readAutomationRun(options.dataDirectory, now) : null;
	}
	catch {
		invalid = true;
	}
	const status = invalid
		? "invalid"
		: !run
				? "unreported"
				: run.status === "failed" || run.status === "stopped"
					? run.status
					: run.nextRunAt
						? Date.parse(run.nextRunAt) < now
							? "overdue"
							: "scheduled"
						: run.status === "running" && now - Date.parse(run.startedAt) > 3600000
							? "overdue"
							: run.status;
	for (const dataset of datasets) {
		const result = run?.results.find(result => result.sourceId === dataset.id);
		if (run && result && result.status !== "cached" && run.startedAt >= (dataset.lastAttemptAt ?? "")) dataset.lastAttemptAt = run.startedAt;
		if (run?.finishedAt && result?.status === "imported" && run.finishedAt > (dataset.lastImportAt ?? "")) dataset.lastImportAt = run.finishedAt;
		if (result?.status === "failed" && (run?.finishedAt ?? "") >= (dataset.retrievedAt ?? "")) {
			dataset.failure = result.reason;
			dataset.status = "error";
		}
	}
	return {
		checkedAt: new Date(now).toISOString(),
		datasets,
		automation: {
			status,
			lastAttemptAt: run?.startedAt ?? null,
			lastSuccessAt: run?.lastSuccessAt ?? null,
			lastImportAt: run?.lastImportAt ?? null,
			nextRunAt: run?.nextRunAt ?? null,
			results: run?.results ?? []
		}
	};
}
