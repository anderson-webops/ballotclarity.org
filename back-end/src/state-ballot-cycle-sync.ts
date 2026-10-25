import type { StateBallotCycleCatalog } from "./state-ballot-cycles.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, readStateBallotCycleCatalog, stateBallotCycleSources, writeStateBallotCycleCatalog } from "./state-ballot-cycles.js";
import { createStateBallotRepository } from "./state-ballot-repository.js";
import { assertExternalStateDataDirectory } from "./state-ballot-storage.js";

interface StateBallotCycleSyncOptions {
	familyId?: string;
	catalogPath: string;
	dataDirectory: string;
	enabledSourceIds?: string[];
	fetchDiscovery?: () => Promise<string>;
	fetchCandidates?: (source: StateBallotSource) => Promise<string>;
	now?: () => number;
}

export function fetchStateBallotCycleDiscovery(request: typeof fetchRemoteSourceText = fetchRemoteSourceText, familyId = "wa-general-2026") {
	const family = getStateBallotCycleFamily(familyId);
	return request(family.discoveryUrl, { allowedHosts: [new URL(family.discoveryUrl).hostname], maxBytes: 2 * 1024 * 1024, maxRedirects: ["csv", "delaware-html"].includes(family.format) ? 0 : 1, timeoutMs: 12000 });
}

export async function syncStateBallotCycles(options: StateBallotCycleSyncOptions) {
	assertExternalStateDataDirectory(options.dataDirectory);
	const now = options.now ?? Date.now;
	const family = getStateBallotCycleFamily(options.familyId ?? "wa-general-2026");
	const previous = readStateBallotCycleCatalog(options.catalogPath, now());
	if (previous && previous.familyId !== family.source.id) throw new Error("The configured catalog belongs to a different election family.");
	const body = await (options.fetchDiscovery ?? (() => fetchStateBallotCycleDiscovery(undefined, family.source.id)))();
	const discovered = discoverStateBallotElectionCycles(body, family.source.id, now());
	if (previous?.elections.some(election => Date.parse(`${election.electionDate}T00:00:00Z`) + 2 * 86400000 > now() && !discovered.elections.some(item => item.electionDate === election.electionDate && item.electionId === election.electionId)))
		throw new Error("An unexpired official election disappeared or changed identity; retain the accepted catalog for review.");
	const catalog: StateBallotCycleCatalog = previous?.discovery.sha256 === discovered.discovery.sha256 ? previous : discovered;
	const catalogChanged = await writeStateBallotCycleCatalog(options.catalogPath, catalog, now());
	const original = family.source;
	const sources = [...(catalog.elections.some(election => election.electionDate === original.electionDate) ? [original] : []), ...stateBallotCycleSources(catalog, now())]
		.filter(source => !options.enabledSourceIds || options.enabledSourceIds.includes(source.id));
	let persistenceFailed = false;
	const repository = createStateBallotRepository({ sources, dataDirectory: options.dataDirectory, now, fetchText: options.fetchCandidates, onPersistenceError: () => {
		persistenceFailed = true;
	} });
	const results: { sourceId: string; electionDate: string; status: "available" | "unavailable" | "persistence-failed" | "expired"; records: number; retrievedAt: string | null; imported: boolean }[] = [];
	for (const source of sources) {
		const expired = Date.parse(`${source.electionDate}T00:00:00Z`) + 2 * 86400000 <= now();
		persistenceFailed = false;
		const snapshot = expired ? null : await repository.getSnapshot(source.stateCode, source.id);
		results.push({ sourceId: source.id, electionDate: source.electionDate, status: expired ? "expired" : persistenceFailed ? "persistence-failed" : snapshot ? "available" : "unavailable", records: snapshot?.records.length ?? 0, retrievedAt: snapshot?.retrievedAt ?? null, imported: false });
	}
	const observations = await repository.inspectSources!();
	for (const result of results) result.imported = Boolean(observations.find(source => source.id === result.sourceId)?.lastImportAt);
	return { familyId: catalog.familyId, catalogChanged, discovery: catalog.discovery, checkedAt: new Date(now()).toISOString(), results };
}

export async function syncStateBallotCycleFamilies(options: StateBallotCycleSyncOptions[]) {
	const results = [];
	for (const configuration of options) {
		try {
			results.push({ status: "completed" as const, ...await syncStateBallotCycles(configuration) });
		}
		catch (error) {
			results.push({ status: "failed" as const, familyId: configuration.familyId ?? "wa-general-2026", error: error instanceof Error ? error.message : "Election-cycle synchronization failed." });
		}
	}
	return results;
}
