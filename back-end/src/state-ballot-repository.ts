import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import type { BallotContentPreview, BallotContentPreviewContest, LocationLookupResponse } from "./types/civic.js";
import { createHash } from "node:crypto";
import { getStateAbbreviationForName } from "./official-election-tools.js";
import { fetchStateBallotSourceText } from "./state-ballot-fetch.js";
import { parseStateCandidateRecords, stateRecordMatchesDistricts } from "./state-ballot-records.js";
import { stateBallotSources } from "./state-ballot-sources.js";

export interface StateBallotSnapshot {
	source: StateBallotSource;
	retrievedAt: string;
	sha256: string;
	records: StateCandidateRecord[];
}

export interface StateBallotRepository {
	getSnapshot: (stateCode: string) => Promise<StateBallotSnapshot | null>;
}

interface StateBallotRepositoryOptions {
	fetchText?: (source: StateBallotSource) => Promise<string>;
	now?: () => number;
	onUnavailable?: (stateCode: string, reason: "transport" | "format") => void;
	sources?: readonly StateBallotSource[];
	ttlMs?: number;
}

export function createStateBallotRepository(options: StateBallotRepositoryOptions = {}): StateBallotRepository {
	const sources = options.sources ?? stateBallotSources;
	const now = options.now ?? Date.now;
	const ttlMs = options.ttlMs ?? 4 * 60 * 60 * 1000;
	const cached = new Map<string, { expiresAt: number; snapshot: StateBallotSnapshot | null }>();
	const pending = new Map<string, Promise<StateBallotSnapshot | null>>();
	const fetchText = options.fetchText ?? fetchStateBallotSourceText;
	if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > 24 * 60 * 60 * 1000)
		throw new Error("State source cache lifetime must be between one millisecond and one day.");

	return {
		async getSnapshot(stateCode) {
			const source = sources.find(item => item.stateCode === stateCode.toUpperCase());
			if (!source)
				return null;
			const electionEnd = Date.parse(`${source.electionDate}T00:00:00Z`) + 2 * 24 * 60 * 60 * 1000;
			if (!Number.isFinite(electionEnd) || now() >= electionEnd)
				return null;
			const entry = cached.get(source.id);
			if (entry && entry.expiresAt > now())
				return entry.snapshot;
			const active = pending.get(source.id);
			if (active)
				return active;
			const operation = Promise.resolve().then(async () => {
				let failureReason: "transport" | "format" = "transport";
				try {
					const body = await fetchText(source);
					failureReason = "format";
					const snapshot: StateBallotSnapshot = {
						source,
						retrievedAt: new Date(now()).toISOString(),
						sha256: createHash("sha256").update(body).digest("hex"),
						records: parseStateCandidateRecords(source, body),
					};
					cached.set(source.id, { expiresAt: now() + ttlMs, snapshot });
					return snapshot;
				}
				catch {
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
		},
	};
}

export function buildStateBallotPreview(snapshot: StateBallotSnapshot, lookup: Pick<LocationLookupResponse, "districtMatches">): BallotContentPreview | null {
	const contests = new Map<string, BallotContentPreviewContest>();
	for (const record of snapshot.records) {
		if (["withdrawn", "disqualified", "defeated", "elected", "unopposed", "inactive", "unrecognized"].includes(record.status) || !stateRecordMatchesDistricts(record, lookup.districtMatches ?? []))
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
		contest.candidates.push({ id: record.id, name: record.name, party: record.party, ballotStatus: record.status, sourceStatus: record.sourceStatus, candidateUrl: record.candidateUrl });
	}
	if (!contests.size)
		return null;
	return {
		id: snapshot.source.id,
		providerId: `official-state-${snapshot.source.stateCode.toLowerCase()}`,
		providerLabel: snapshot.source.label,
		sourceAuthority: "official-government",
		sourceUrl: snapshot.source.pageUrl,
		electionDate: snapshot.source.electionDate,
		generatedAt: snapshot.retrievedAt,
		disclaimer: snapshot.source.stateCode === "VA"
			? "Federal candidates only; state and local contests are not included. This is not an address-specific ballot."
			: "State records; local contests may be missing. Filing does not establish ballot qualification.",
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
