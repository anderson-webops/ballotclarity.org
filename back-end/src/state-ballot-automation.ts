import type { StateBallotSource } from "./state-ballot-sources.js";
import type { AdminAutomationResult, AdminAutomationRun } from "./types/civic.js";
import process from "node:process";
import { readAutomationRun, writeAutomationRun } from "./admin-operations.js";
import { syncStateBallotCycleFamilies } from "./state-ballot-cycle-sync.js";
import { getStateBallotCycleFamily, stateBallotCycleCatalogLocations } from "./state-ballot-cycles.js";
import { createStateBallotRepository, resolveStateBallotConfiguration } from "./state-ballot-repository.js";

export async function refreshApprovedCandidateData(
	options: {
		environment?: NodeJS.ProcessEnv;
		now?: () => number;
		fetchText?: (source: StateBallotSource) => Promise<string>;
		fetchDiscovery?: (familyId: string) => Promise<string>;
	} = {}
) {
	const environment = options.environment ?? process.env;
	const now = options.now ?? Date.now;
	const configuration = resolveStateBallotConfiguration(environment, now());
	if (!configuration.dataDirectory)
		throw new Error("STATE_BALLOT_DATA_DIR is required for durable unattended imports.");
	const directory = configuration.dataDirectory;
	const previous = await readAutomationRun(directory, now());
	const startedAt = new Date(now()).toISOString();
	const run: AdminAutomationRun = {
		schemaVersion: 1,
		type: "ballot-automation-run",
		status: "running",
		startedAt,
		finishedAt: null,
		lastSuccessAt: previous?.lastSuccessAt ?? null,
		lastImportAt: previous?.lastImportAt ?? null,
		nextRunAt: null,
		results: []
	};
	await writeAutomationRun(directory, run, now());
	const results: AdminAutomationResult[] = [];
	const handled = new Set<string>();
	try {
		const families = environment.STATE_BALLOT_ENABLED_FAMILIES?.split(",").map(value => value.trim()) ?? [];
		const locations = stateBallotCycleCatalogLocations(environment).filter(location =>
			configuration.sources.some(
				source =>
					source.stateCode === getStateBallotCycleFamily(location.familyId).source.stateCode
					&& (source.id === location.familyId
						|| source.id.startsWith(`${getStateBallotCycleFamily(location.familyId).prefix}-`))
			)
		);
		const familyRuns = await syncStateBallotCycleFamilies(
			locations.map(location => ({
				...location,
				dataDirectory: directory,
				now,
				fetchCandidates: options.fetchText,
				...(options.fetchDiscovery ? { fetchDiscovery: () => options.fetchDiscovery!(location.familyId) } : {}),
				enabledSourceIds: families.includes(location.familyId)
					? undefined
					: configuration.sources.map(source => source.id)
			}))
		);
		for (const family of familyRuns) {
			handled.add(family.familyId);
			if (family.status === "failed") {
				results.push({ sourceId: family.familyId, status: "failed", records: 0, reason: "source-unavailable" });
			}
			else {
				for (const result of family.results) {
					handled.add(result.sourceId);
					if (result.status === "expired") continue;
					const failed = !["available", "awaiting-records"].includes(result.status);
					results.push({
						sourceId: result.sourceId,
						status: failed
							? "failed"
							: result.imported
								? "imported"
								: "cached",
						records: result.records,
						reason: failed
							? result.status === "persistence-failed"
								? "persistence-failed"
								: "source-unavailable"
							: null
					});
				}
			}
		}
		const sources = configuration.sources.filter(
			source =>
				!source.retrievalPolicy
				&& !handled.has(source.id)
				&& !locations.some(location =>
					source.id.startsWith(`${getStateBallotCycleFamily(location.familyId).prefix}-`)
				)
				&& Date.parse(`${source.electionDate}T00:00:00Z`) + 2 * 86400000 > now()
		);
		const persistenceErrors = new Set<string>();
		const repository = createStateBallotRepository({
			refreshReviewedLegacy: true,
			sources,
			dataDirectory: directory,
			now,
			fetchText: options.fetchText,
			ttlMs: configuration.ttlMs,
			onPersistenceError: (_state, sourceId) => persistenceErrors.add(sourceId)
		});
		for (const source of sources) {
			persistenceErrors.delete(source.id);
			const snapshot = await repository.getSnapshot(source.stateCode, source.id);
			const observation = (await repository.inspectSources!()).find(item => item.id === source.id);
			const failed = (!snapshot && !repository.isAwaitingRecords!(source.id)) || persistenceErrors.has(source.id) || Boolean(observation?.failure);
			results.push({
				sourceId: source.id,
				status: failed ? "failed" : observation?.lastImportAt ? "imported" : "cached",
				records: snapshot?.records.length ?? 0,
				reason: failed
					? persistenceErrors.has(source.id)
						? "persistence-failed"
						: "source-unavailable"
					: null
			});
		}
	}
	catch {
		results.push({ sourceId: "configuration", status: "failed", records: 0, reason: "configuration-invalid" });
	}
	run.finishedAt = new Date(now()).toISOString();
	run.results = results;
	run.status = results.some(result => result.status === "failed") ? "failed" : "succeeded";
	if (results.some(result => result.status === "imported")) {
		run.lastSuccessAt = run.finishedAt;
		run.lastImportAt = run.finishedAt;
	}
	await writeAutomationRun(directory, run, now());
	return run;
}
