import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import type { StateBallotPendingReceipt } from "./state-ballot-storage.js";
import type {
	AdminOperationDataset,
	BallotContentPreview,
	BallotContentPreviewContest,
	LocationLookupResponse
} from "./types/civic.js";
import { createHash } from "node:crypto";
import process from "node:process";
import { electionDistrictMatches } from "./congressional-boundaries.js";
import { getStateAbbreviationForName } from "./official-election-tools.js";
import { parseCertifiedPdfCapture } from "./state-ballot-certified-pdf.js";
import { parseClarkCandidateCapture } from "./state-ballot-clark-collection.js";
import { parseConnecticutCandidateCapture } from "./state-ballot-connecticut-collection.js";
import { connecticutBallotDocuments } from "./state-ballot-connecticut-documents.js";
import {
	getStateBallotCycleFamily,
	readConfiguredStateBallotCycleCatalogs,
	StateBallotCycleCatalogError,
	stateBallotCycleSources
} from "./state-ballot-cycles.js";
import { fetchStateBallotSourceText } from "./state-ballot-fetch.js";
import { FultonCollectorCapabilityError, parseFultonCandidateCapture } from "./state-ballot-fulton.js";
import { parseIowaJohnsonCandidateCapture } from "./state-ballot-iowa-johnson.js";
import { parseIowaPolkCandidateCapture } from "./state-ballot-iowa-polk.js";
import { parseOregonCandidateCapture } from "./state-ballot-oregon-collection.js";
import {
	createStateCandidateRecord,
	isActiveStateCandidateRecord,
	parseStateCandidateRecords,
	stateRecordMatchesDistricts
} from "./state-ballot-records.js";
import { configuredStateBallotSources, legacyReviewedStateBallotSource } from "./state-ballot-registry.js";
import {
	orderStateBallotSources,
	StateBallotAwaitingRecordsError,
	supportsPendingStateBallotRecords
} from "./state-ballot-source-state.js";
import { createStateBallotStorage } from "./state-ballot-storage.js";
import { parseTexasCandidateCapture } from "./state-ballot-texas.js";
import { parseVermontCandidateCapture } from "./state-ballot-vermont.js";
import { parseWashoeCandidateCapture } from "./state-ballot-washoe.js";

export interface StateBallotSnapshot {
	source: StateBallotSource;
	retrievedAt: string;
	sha256: string;
	records: StateCandidateRecord[];
	documents?: { url: string; sha256: string; retrievedAt: string; includedRecordCount: number; town?: string }[];
	collectionIndexSha256?: string;
}

export interface StateBallotRepository {
	sources?: readonly StateBallotSource[];
	inspectSources?: () => Promise<AdminOperationDataset[]>;
	isAwaitingRecords?: (sourceId: string) => boolean;
	getSnapshot: (stateCode: string, sourceId?: string) => Promise<StateBallotSnapshot | null>;
}

interface StateBallotRepositoryOptions {
	collectionIndexSha256?: Readonly<Record<string, string>>;
	refreshReviewedLegacy?: boolean;
	dataDirectory?: string | null;
	fetchText?: (source: StateBallotSource) => Promise<string>;
	now?: () => number;
	onUnavailable?: (stateCode: string, reason: "transport" | "format") => void;
	onPersistenceError?: (stateCode: string, sourceId: string) => void;
	sources?: readonly StateBallotSource[];
	ttlMs?: number;
}

export function resolveStateBallotConfiguration(environment: NodeJS.ProcessEnv = process.env, now = Date.now()) {
	const catalogs = readConfiguredStateBallotCycleCatalogs(environment, now);
	const cycleSources = catalogs.flatMap(catalog => stateBallotCycleSources(catalog, now));
	const configuredSources = [...configuredStateBallotSources, ...cycleSources];
	if (new Set(configuredSources.map(source => source.id)).size !== configuredSources.length) throw new Error("Official source identifiers must be unique.");
	const ttlMs = environment.STATE_BALLOT_CACHE_TTL_MS === undefined ? 4 * 60 * 60 * 1000 : Number(environment.STATE_BALLOT_CACHE_TTL_MS);
	if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > 24 * 60 * 60 * 1000)
		throw new Error("State source cache lifetime must be between one millisecond and one day.");
	const requested = environment.STATE_BALLOT_ENABLED_STATES?.split(",").map(value => value.trim().toUpperCase());
	if (requested?.some(state => !configuredSources.some(source => source.stateCode === state)))
		throw new Error("Every enabled state must have a configured official source.");
	const requestedSources = environment.STATE_BALLOT_ENABLED_SOURCES?.split(",").map(value => value.trim());
	const requestedFamilies = environment.STATE_BALLOT_ENABLED_FAMILIES?.split(",").map(value => value.trim());
	const enabledFamilies = requestedFamilies?.map(getStateBallotCycleFamily);
	if (enabledFamilies?.some(family => requested && !requested.includes(family.source.stateCode)))
		throw new Error("Every enabled election family must be supported and belong to an enabled state.");
	if (requestedSources?.some(id => !configuredSources.some(source => source.id === id && (!requested || requested.includes(source.stateCode)))))
		throw new Error("Every enabled source must match a configured source in an enabled state.");
	const familySourceIds = new Set(enabledFamilies?.flatMap(family => [family.source.id, ...catalogs.filter(catalog => catalog.familyId === family.source.id).flatMap(catalog => stateBallotCycleSources(catalog, now).map(source => source.id))]));
	return {
		ttlMs,
		dataDirectory: environment.STATE_BALLOT_DATA_DIR || null,
		sources: configuredSources.filter(source => (!requested || requested.includes(source.stateCode)) && (!requestedSources || requestedSources.includes(source.id) || familySourceIds.has(source.id))),
	};
}

export function createStateBallotRepository(options: StateBallotRepositoryOptions = {}): StateBallotRepository {
	const now = options.now ?? Date.now;
	const configuration = resolveStateBallotConfiguration(process.env, now());
	let acceptedSources = options.sources ?? configuration.sources;
	const configurationFailures = new Set<string>();
	const currentSources = () => {
		if (options.sources) return options.sources;
		try {
			acceptedSources = resolveStateBallotConfiguration(process.env, now()).sources;
			configurationFailures.clear();
		}
		catch (error) {
			if (error instanceof StateBallotCycleCatalogError) {
				const stateCode = getStateBallotCycleFamily(error.familyId).source.stateCode;
				configurationFailures.add(stateCode);
				options.onUnavailable?.(stateCode, "format");
			}
			else {
				for (const stateCode of new Set(acceptedSources.map(source => source.stateCode))) {
					configurationFailures.add(stateCode);
					options.onUnavailable?.(stateCode, "format");
				}
			}
		}
		return acceptedSources;
	};
	const sources = currentSources();
	const ttlMs = options.ttlMs ?? configuration.ttlMs;
	const dataDirectory = options.dataDirectory === undefined ? configuration.dataDirectory : options.dataDirectory;
	const storage = dataDirectory ? createStateBallotStorage(dataDirectory) : null;
	const cached = new Map<string, { expiresAt: number; snapshot: StateBallotSnapshot | null }>();
	const pending = new Map<string, Promise<StateBallotSnapshot | null>>();
	const observations = new Map<string, { lastAttemptAt: string; lastImportAt: string | null; failure: string | null }>();
	const awaitingRecords = new Map<string, { expiresAt: number; receipt: StateBallotPendingReceipt }>();
	const pendingExpiry = (source: StateBallotSource, receipt: StateBallotPendingReceipt) => Math.min(Date.parse(receipt.retrievedAt) + ttlMs, Date.parse(`${source.electionDate}T00:00:00Z`));
	function rememberPending(source: StateBallotSource, receipt: StateBallotPendingReceipt) {
		const expiresAt = pendingExpiry(source, receipt);
		if (expiresAt <= now()) return false;
		awaitingRecords.set(source.id, { expiresAt, receipt });
		cached.set(source.id, { expiresAt, snapshot: null });
		observations.set(source.id, { lastAttemptAt: receipt.retrievedAt, lastImportAt: null, failure: null });
		return true;
	}
	const fetchText = options.fetchText ?? fetchStateBallotSourceText;
	const indexMatches = (source: StateBallotSource, snapshot: StateBallotSnapshot | null) => !options.collectionIndexSha256?.[source.id] || snapshot?.collectionIndexSha256 === options.collectionIndexSha256[source.id];
	if (new Set(sources.map(source => source.id)).size !== sources.length)
		throw new Error("Official source identifiers must be unique.");
	if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > 24 * 60 * 60 * 1000)
		throw new Error("State source cache lifetime must be between one millisecond and one day.");

	async function loadSnapshot(source: StateBallotSource) {
		const electionEnd = Date.parse(`${source.electionDate}T00:00:00Z`) + 2 * 24 * 60 * 60 * 1000;
		if (!Number.isFinite(electionEnd) || now() >= electionEnd)
			return null;
		const entry = cached.get(source.id);
		if (source.retrievalPolicy !== "manual-snapshot" && entry && entry.expiresAt > now() && indexMatches(source, entry.snapshot))
			return entry.snapshot;
		const active = pending.get(source.id);
		if (active)
			return active;
		const operation = Promise.resolve().then(async () => {
			let failureReason: "transport" | "format" = "transport";
			let stored: StateBallotSnapshot | null = null;
			let reviewedFallback: StateBallotSnapshot | null = null;
			let body: string | undefined;
			let capturedAt: string | undefined;
			try {
				if (storage) {
					failureReason = "format";
					stored = await storage.read(source);
					if (stored && Date.parse(stored.retrievedAt) > now())
						throw new Error("Stored state ballot data has a future capture time.");
					if (stored && legacyReviewedStateBallotSource(source) && stored.source.retrievalPolicy === "manual-snapshot") reviewedFallback = stored;
					if (stored && legacyReviewedStateBallotSource(source) && stored.source.retrievalPolicy === "manual-snapshot" && !options.refreshReviewedLegacy) return stored;
					if (stored && indexMatches(source, stored) && !(options.refreshReviewedLegacy && reviewedFallback) && (source.retrievalPolicy === "manual-snapshot" || Date.parse(stored.retrievedAt) + ttlMs > now())) {
						if (source.retrievalPolicy !== "manual-snapshot")
							cached.set(source.id, { expiresAt: Date.parse(stored.retrievedAt) + ttlMs, snapshot: stored });
						return stored;
					}
					if (!stored) {
						const receipt = await storage.readPending(source, now());
						if (receipt && !(["iowa-polk-pdf", "iowa-johnson-html", "washoe-html", "clark-pdf"].includes(source.format) && options.collectionIndexSha256?.[source.id]) && rememberPending(source, receipt)) return null;
					}
				}
				if (source.retrievalPolicy === "manual-snapshot") {
					failureReason = "format";
					throw new Error("This source requires a reviewed external snapshot import.");
				}
				failureReason = "transport";
				observations.set(source.id, { lastAttemptAt: new Date(now()).toISOString(), lastImportAt: observations.get(source.id)?.lastImportAt ?? null, failure: null });
				body = await fetchText(source);
				capturedAt = new Date(now()).toISOString();
				failureReason = "format";
				const documentCapture = source.format === "iowa-polk-pdf" ? parseIowaPolkCandidateCapture(source, body, createStateCandidateRecord, now()) : source.format === "iowa-johnson-html" ? parseIowaJohnsonCandidateCapture(source, body, createStateCandidateRecord, now()) : source.format === "washoe-html" ? parseWashoeCandidateCapture(source, body, createStateCandidateRecord, now()) : source.format === "clark-pdf" ? parseClarkCandidateCapture(source, body, createStateCandidateRecord, now(), stored?.records) : source.format === "connecticut-pdf" ? parseConnecticutCandidateCapture(source, body, createStateCandidateRecord, now(), stored?.records) : source.format === "oregon-pdf" ? parseOregonCandidateCapture(source, body, createStateCandidateRecord, now()) : source.format === "texas-certified-pdf" ? parseTexasCandidateCapture(source, body) : source.format === "vermont-xlsx" ? parseVermontCandidateCapture(source, body) : source.format === "fulton-pdf" ? parseFultonCandidateCapture(source, body) : source.format === "certified-pdf" ? parseCertifiedPdfCapture(source, body) : null;
				const snapshot: StateBallotSnapshot = {
					source,
					retrievedAt: capturedAt,
					sha256: createHash("sha256").update(body).digest("hex"),
					records: documentCapture?.records ?? parseStateCandidateRecords(source, body),
					...(documentCapture ?? {}),
				};
				if (!indexMatches(source, snapshot)) throw new Error("The collected candidate documents do not match the discovered index.");
				if (source.format === "connecticut-pdf" && stored?.documents?.some((document) => {
					const town = document.town ?? connecticutBallotDocuments.find(item => item.url === document.url)?.town;
					return !town || !snapshot.documents?.some(item => item.town === town);
				})) {
					throw new Error("An accepted Connecticut town disappeared; retain its snapshot for review.");
				}
				if (storage) {
					try {
						await storage.write(snapshot);
						observations.get(source.id)!.lastImportAt = new Date(now()).toISOString();
					}
					catch {
						observations.get(source.id)!.failure = "Snapshot persistence failed.";
						options.onPersistenceError?.(source.stateCode, source.id);
						if (["iowa-polk-pdf", "washoe-html", "clark-pdf", "connecticut-pdf"].includes(source.format)) return stored;
					}
				}
				cached.set(source.id, { expiresAt: now() + ttlMs, snapshot });
				awaitingRecords.delete(source.id);
				return snapshot;
			}
			catch (error) {
				if (error instanceof StateBallotAwaitingRecordsError && error.sourceId === source.id && supportsPendingStateBallotRecords(source) && body !== undefined && capturedAt && !stored && now() < Date.parse(`${source.electionDate}T00:00:00Z`)) {
					const receipt = { retrievedAt: capturedAt, sourceSha256: createHash("sha256").update(body).digest("hex") };
					try {
						if (storage) await storage.writePending(source, receipt, now());
						if (rememberPending(source, receipt)) return null;
					}
					catch {
						observations.get(source.id)!.failure = "Pending source evidence could not be persisted.";
						options.onPersistenceError?.(source.stateCode, source.id);
						return null;
					}
				}
				awaitingRecords.delete(source.id);
				const observation = observations.get(source.id);
				if (observation) observation.failure = error instanceof FultonCollectorCapabilityError ? "PDF text extractor is not configured or unavailable." : failureReason === "format" ? "Source format requires review." : "Source collection failed.";
				if (reviewedFallback) {
					cached.set(source.id, { expiresAt: now() + 5 * 60 * 1000, snapshot: reviewedFallback });
					options.onUnavailable?.(source.stateCode, failureReason);
					return reviewedFallback;
				}
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
		get sources() { return currentSources(); },
		isAwaitingRecords(sourceId) { return (awaitingRecords.get(sourceId)?.expiresAt ?? 0) > now(); },
		async inspectSources() {
			return Promise.all(currentSources().map(async (source): Promise<AdminOperationDataset> => {
				const observation = observations.get(source.id);
				const item: AdminOperationDataset = { id: source.id, label: source.label, stateCode: source.stateCode, electionDate: source.electionDate, kind: "candidates", mode: source.retrievalPolicy ? "reviewed" : "automatic", status: "missing", records: null, retrievedAt: null, lastAttemptAt: observation?.lastAttemptAt ?? null, lastImportAt: observation?.lastImportAt ?? null, failure: observation?.failure ?? null };
				try {
					const snapshot = storage ? await storage.read(source) : null;
					if (snapshot) {
						if (Date.parse(snapshot.retrievedAt) > now()) throw new Error("Future capture");
						item.records = snapshot.records.length;
						item.retrievedAt = snapshot.retrievedAt;
						item.status = Date.parse(`${source.electionDate}T00:00:00Z`) + 2 * 86400000 <= now() ? "archived" : !source.retrievalPolicy && Date.parse(snapshot.retrievedAt) + ttlMs <= now() ? "stale" : "current";
					}
					else {
						const receipt = storage ? await storage.readPending(source, now()) : awaitingRecords.get(source.id)?.receipt;
						if (receipt) {
							item.lastAttemptAt ??= receipt.retrievedAt;
							if (pendingExpiry(source, receipt) > now()) item.status = "pending";
						}
					}
				}
				catch { item.failure = "Stored data could not be validated."; }
				if (configurationFailures.has(source.stateCode)) item.failure = "Election catalog requires review.";
				if (item.failure) item.status = "error";
				return item;
			}));
		},
		async getSnapshot(stateCode, sourceId) {
			const matching = currentSources().filter(source => source.stateCode === stateCode.toUpperCase() && (sourceId === undefined || source.id === sourceId));
			const ordered = sourceId === undefined ? orderStateBallotSources(matching, now()) : matching;
			const currentDate = ordered.find(source => Date.parse(`${source.electionDate}T00:00:00Z`) + 2 * 86400000 > now())?.electionDate;
			for (const source of ordered.filter(source => sourceId !== undefined || source.electionDate === currentDate)) {
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
	const configured = configuredStateBallotSources.find(source => source.id === snapshot.source.id && source.stateCode === snapshot.source.stateCode && source.electionDate === snapshot.source.electionDate);
	for (const record of snapshot.records) {
		if (!isActiveStateCandidateRecord(record) || !stateRecordMatchesDistricts(record, lookup.districtMatches ?? []))
			continue;
		if (record.scope !== "statewide" && record.scope !== "local" && (snapshot.source.withheldDistrictScopes?.includes(record.scope) || configured?.withheldDistrictScopes?.includes(record.scope)))
			continue;
		if (record.scope === "statewide" && (snapshot.source.withheldStatewideOffices?.includes(record.office) || configured?.withheldStatewideOffices?.includes(record.office)))
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
		: ["washoe-html", "clark-pdf", "connecticut-pdf", "reviewed-pdf", "reviewed-image", "fulton-pdf", "certified-pdf", "oregon-pdf", "texas-certified-pdf", "vermont-xlsx", "alaska-html", "connecticut-ballots", "oregon-ballots"].includes(snapshot.source.format)
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
	const countyNames = new Set((lookup.districtMatches ?? []).filter(match => match.districtType.toLowerCase() === "county").map(match => match.label.normalize("NFKC").trim().toLowerCase()));
	const preferred = orderStateBallotSources((repository.sources ?? []).filter(source => countyNames.size === 1 && !lookup.detectedFromIp && source.stateCode === stateCode && Date.parse(`${source.electionDate}T00:00:00Z`) + 2 * 86400000 > Date.now() && source.countyName && countyNames.has(source.countyName.normalize("NFKC").trim().toLowerCase())));
	let snapshot: StateBallotSnapshot | null = null;
	for (const source of preferred) {
		snapshot = await repository.getSnapshot(stateCode, source.id);
		if (snapshot) break;
	}
	snapshot ??= await repository.getSnapshot(stateCode);
	const preview = snapshot
		? buildStateBallotPreview(snapshot, {
				districtMatches: lookup.inputKind === "address" && !lookup.detectedFromIp
					? electionDistrictMatches(stateCode, snapshot.source.electionDate, lookup.districtMatches ?? [], lookup.electionDistrictMatches)
					: [],
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
