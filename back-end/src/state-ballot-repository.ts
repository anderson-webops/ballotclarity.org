import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import type { BallotContentPreview, BallotContentPreviewContest, LocationLookupResponse } from "./types/civic.js";
import { createHash } from "node:crypto";
import process from "node:process";
import { getStateAbbreviationForName } from "./official-election-tools.js";
import { fetchStateBallotSourceText } from "./state-ballot-fetch.js";
import { isActiveStateCandidateRecord, parseStateCandidateRecords, stateRecordMatchesDistricts } from "./state-ballot-records.js";
import { configuredStateBallotSources } from "./state-ballot-registry.js";
import { createStateBallotStorage } from "./state-ballot-storage.js";

export interface StateBallotSnapshot {
	source: StateBallotSource;
	retrievedAt: string;
	sha256: string;
	records: StateCandidateRecord[];
	documents?: { url: string; sha256: string; retrievedAt: string; includedRecordCount: number }[];
}

export interface StateBallotRepository {
	sources?: readonly StateBallotSource[];
	getSnapshot: (stateCode: string, sourceId?: string) => Promise<StateBallotSnapshot | null>;
}

interface StateBallotRepositoryOptions {
	dataDirectory?: string | null;
	fetchText?: (source: StateBallotSource) => Promise<string>;
	now?: () => number;
	onUnavailable?: (stateCode: string, reason: "transport" | "format") => void;
	onPersistenceError?: (stateCode: string) => void;
	sources?: readonly StateBallotSource[];
	ttlMs?: number;
}

export function resolveStateBallotConfiguration(environment: NodeJS.ProcessEnv = process.env) {
	const ttlMs = environment.STATE_BALLOT_CACHE_TTL_MS === undefined ? 4 * 60 * 60 * 1000 : Number(environment.STATE_BALLOT_CACHE_TTL_MS);
	if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > 24 * 60 * 60 * 1000)
		throw new Error("State source cache lifetime must be between one millisecond and one day.");
	const requested = environment.STATE_BALLOT_ENABLED_STATES?.split(",").map(value => value.trim().toUpperCase());
	if (requested?.some(state => !configuredStateBallotSources.some(source => source.stateCode === state)))
		throw new Error("Every enabled state must have a configured official source.");
	const requestedSources = environment.STATE_BALLOT_ENABLED_SOURCES?.split(",").map(value => value.trim());
	if (requestedSources?.some(id => !configuredStateBallotSources.some(source => source.id === id && (!requested || requested.includes(source.stateCode)))))
		throw new Error("Every enabled source must match a configured source in an enabled state.");
	return {
		ttlMs,
		dataDirectory: environment.STATE_BALLOT_DATA_DIR || null,
		sources: configuredStateBallotSources.filter(source => (!requested || requested.includes(source.stateCode)) && (!requestedSources || requestedSources.includes(source.id))),
	};
}

export function createStateBallotRepository(options: StateBallotRepositoryOptions = {}): StateBallotRepository {
	const configuration = resolveStateBallotConfiguration();
	const sources = options.sources ?? configuration.sources;
	const now = options.now ?? Date.now;
	const ttlMs = options.ttlMs ?? configuration.ttlMs;
	const dataDirectory = options.dataDirectory === undefined ? configuration.dataDirectory : options.dataDirectory;
	const storage = dataDirectory ? createStateBallotStorage(dataDirectory) : null;
	const cached = new Map<string, { expiresAt: number; snapshot: StateBallotSnapshot | null }>();
	const pending = new Map<string, Promise<StateBallotSnapshot | null>>();
	const fetchText = options.fetchText ?? fetchStateBallotSourceText;
	if (new Set(sources.map(source => source.id)).size !== sources.length)
		throw new Error("Official source identifiers must be unique.");
	if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > 24 * 60 * 60 * 1000)
		throw new Error("State source cache lifetime must be between one millisecond and one day.");

	async function loadSnapshot(source: StateBallotSource) {
		const electionEnd = Date.parse(`${source.electionDate}T00:00:00Z`) + 2 * 24 * 60 * 60 * 1000;
		if (!Number.isFinite(electionEnd) || now() >= electionEnd)
			return null;
		const entry = cached.get(source.id);
		if (source.retrievalPolicy !== "manual-snapshot" && entry && entry.expiresAt > now())
			return entry.snapshot;
		const active = pending.get(source.id);
		if (active)
			return active;
		const operation = Promise.resolve().then(async () => {
			let failureReason: "transport" | "format" = "transport";
			try {
				if (storage) {
					failureReason = "format";
					const stored = await storage.read(source);
					if (stored && Date.parse(stored.retrievedAt) > now())
						throw new Error("Stored state ballot data has a future capture time.");
					if (stored && (source.retrievalPolicy === "manual-snapshot" || Date.parse(stored.retrievedAt) + ttlMs > now())) {
						if (source.retrievalPolicy !== "manual-snapshot")
							cached.set(source.id, { expiresAt: Date.parse(stored.retrievedAt) + ttlMs, snapshot: stored });
						return stored;
					}
				}
				if (source.retrievalPolicy === "manual-snapshot") {
					failureReason = "format";
					throw new Error("This source requires a reviewed external snapshot import.");
				}
				failureReason = "transport";
				const body = await fetchText(source);
				failureReason = "format";
				const snapshot: StateBallotSnapshot = {
					source,
					retrievedAt: new Date(now()).toISOString(),
					sha256: createHash("sha256").update(body).digest("hex"),
					records: parseStateCandidateRecords(source, body),
				};
				if (storage)
					await storage.write(snapshot).catch(() => options.onPersistenceError?.(source.stateCode));
				cached.set(source.id, { expiresAt: now() + ttlMs, snapshot });
				return snapshot;
			}
			catch {
				if (source.retrievalPolicy !== "manual-snapshot")
					cached.set(source.id, { expiresAt: now() + 5 * 60 * 1000, snapshot: null });
				options.onUnavailable?.(source.stateCode, failureReason);
				return null;
			}
			finally {
				pending.delete(source.id);
			}
		});
		pending.set(source.id, operation);
		return operation;
	}

	return {
		sources,
		async getSnapshot(stateCode, sourceId) {
			const matching = sources.filter(source => source.stateCode === stateCode.toUpperCase() && (sourceId === undefined || source.id === sourceId));
			for (const source of matching) {
				const snapshot = await loadSnapshot(source);
				if (snapshot)
					return snapshot;
			}
			return null;
		},
	};
}

export function buildStateBallotPreview(snapshot: StateBallotSnapshot, lookup: Pick<LocationLookupResponse, "districtMatches">): BallotContentPreview | null {
	const contests = new Map<string, BallotContentPreviewContest>();
	for (const record of snapshot.records) {
		if (!isActiveStateCandidateRecord(record) || !stateRecordMatchesDistricts(record, lookup.districtMatches ?? []))
			continue;
		if (record.scope !== "statewide" && record.scope !== "local" && snapshot.source.withheldDistrictScopes?.includes(record.scope))
			continue;
		const key = JSON.stringify([record.office, record.scope, record.district]);
		let contest = contests.get(key);
		if (!contest) {
			contest = {
				id: `${snapshot.source.id}:${createHash("sha256").update(key).digest("hex").slice(0, 16)}`,
				title: record.office,
				districtName: record.district && !/\bdistrict\b/iu.test(record.office) ? `District ${record.district}` : undefined,
				candidates: [],
				sourceLabels: [snapshot.source.label],
			};
			contests.set(key, contest);
		}
		contest.candidates.push({ id: record.id, name: record.name, party: record.party, ballotStatus: record.status, sourceStatus: record.sourceStatus, ballotDesignation: record.ballotDesignation, candidateUrl: record.candidateUrl });
	}
	if (!contests.size)
		return null;
	const disclaimer = snapshot.source.stateCode === "VA"
		? "Federal candidates only; state and local contests are not included. This is not an address-specific ballot."
		: ["reviewed-pdf", "reviewed-image", "alaska-html", "connecticut-ballots", "oregon-ballots"].includes(snapshot.source.format)
				? "Dated snapshot; later changes and local contests may be missing."
				: snapshot.source.retrievalPolicy === "manual-snapshot"
					? "Dated snapshot; later changes and local contests may be missing. Filing does not establish ballot qualification."
					: `${snapshot.source.scopeNotice ? "" : "State records; local contests may be missing. "}Filing does not establish ballot qualification.`;
	return {
		id: snapshot.source.id,
		providerId: `official-state-${snapshot.source.stateCode.toLowerCase()}`,
		providerLabel: snapshot.source.label,
		sourceAuthority: "official-government",
		sourceUrl: snapshot.source.pageUrl,
		electionDate: snapshot.source.electionDate,
		generatedAt: snapshot.retrievedAt,
		disclaimer: `${disclaimer}${snapshot.source.scopeNotice ? ` ${snapshot.source.scopeNotice}` : ""}`,
		officialOnly: true,
		status: "official_source_unverified",
		contests: [...contests.values()],
		contestCount: contests.size,
		candidateCount: [...contests.values()].reduce((total, contest) => total + contest.candidates.length, 0),
		measureCount: 0,
	};
}

export async function attachStateBallotPreview(lookup: LocationLookupResponse, repository: StateBallotRepository | null) {
	if (!repository || lookup.result !== "resolved" || !lookup.location || lookup.selectionOptions?.length)
		return lookup;
	const state = lookup.location.state;
	const stateCode = /^[A-Z]{2}$/u.test(state) ? state : getStateAbbreviationForName(state);
	if (!stateCode)
		return lookup;
	const snapshot = await repository.getSnapshot(stateCode);
	const preview = snapshot
		? buildStateBallotPreview(snapshot, {
				districtMatches: lookup.inputKind === "address" && !lookup.detectedFromIp ? lookup.districtMatches : [],
			})
		: null;
	if (!preview)
		return lookup;
	lookup.ballotContentPreviews = [...(lookup.ballotContentPreviews ?? []).filter(item => item.providerId !== preview.providerId), preview];
	if (lookup.availability && !lookup.guideContent?.verifiedContestPackage) {
		lookup.availability.ballotCandidates = {
			label: "Ballot candidate data",
			detail: "Official state candidate records are available. Local contests may be missing.",
			status: "limited",
		};
	}
	return lookup;
}
