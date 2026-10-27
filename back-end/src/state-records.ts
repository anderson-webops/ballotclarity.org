import type { Express } from "express";
import type { PublicRequestThrottle } from "./public-request-throttle.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotRepository, StateBallotSnapshot } from "./state-ballot-repository.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import type { PublicStateCandidateRecord, StateQuestionsResponse, StateRecordsResponse } from "./types/civic.js";
import { normalizePublicHref } from "./public-href.js";
import { createPublicRequestThrottle } from "./public-request-throttle.js";
import { validateChicagoDocumentUrl } from "./state-ballot-chicago-collection.js";
import { validateGoffstownDocumentUrl } from "./state-ballot-goffstown-discovery.js";
import { isActiveStateCandidateRecord } from "./state-ballot-records.js";
import { configuredStateBallotSources } from "./state-ballot-registry.js";
import { orderStateBallotSources } from "./state-ballot-source-state.js";
import { containsControlCharacters } from "./text-validation.js";
import { usStates } from "./us-states.js";

const scopes = ["all", "statewide", "congressional", "state-senate", "state-house", "local"];

export function stateRecordDocumentLinks(source: StateBallotSource | undefined, snapshot?: StateBallotSnapshot) {
	if (source?.format === "goffstown-pdf" && snapshot?.documents) {
		return snapshot.documents.map((document) => {
			validateGoffstownDocumentUrl(document.url, source.electionDate);
			return { label: "Sample ballot", url: document.url };
		});
	}
	if (source?.format === "chicago-pdf" && snapshot?.documents) {
		return snapshot.documents.map((document) => {
			validateChicagoDocumentUrl(document.url);
			return { label: "Candidate list", url: document.url };
		});
	}
	if (!source?.documentLinks) return undefined;
	if (!source.documentLinks.length || source.documentLinks.length !== source.documentUrls?.length) throw new Error("The candidate source document links are invalid.");
	return source.documentLinks.map((link, index) => {
		const url = normalizePublicHref(link.url);
		if (!link.label.trim() || link.label.length > 150 || containsControlCharacters(link.label) || url !== link.url || !url?.startsWith("https://") || url !== source.documentUrls?.[index]) throw new Error("The candidate source document links are invalid.");
		return { label: link.label, url };
	});
}

function singleQuery(value: unknown, fallback: string) {
	if (value === undefined) return fallback;
	if (typeof value !== "string") throw new Error("Each filter must have a single value.");
	return value;
}

export function parseStateRecordFilters(query: Record<string, unknown>) {
	const rawSearch = singleQuery(query.q, "");
	const search = rawSearch.normalize("NFKC").trim();
	const scope = singleQuery(query.scope, "all");
	const status = singleQuery(query.status, "active");
	const rawLimit = singleQuery(query.limit, "50");
	const rawOffset = singleQuery(query.offset, "0");
	if (rawSearch.length > 120 || search.length > 120 || containsControlCharacters(rawSearch)) throw new Error("Search must be a single line with 120 characters or fewer.");
	if (!scopes.includes(scope) || !["active", "all"].includes(status)) throw new Error("The selected record filter is invalid.");
	if (!/^\d+$/u.test(rawLimit) || !/^\d+$/u.test(rawOffset)) throw new Error("Pagination must use whole numbers.");
	const limit = Number(rawLimit);
	const offset = Number(rawOffset);
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0 || offset > 25_000) throw new Error("The requested page is outside the supported range.");
	return { search: search.toLowerCase(), scope, status, limit, offset };
}

function publicRecord(record: StateCandidateRecord): PublicStateCandidateRecord {
	const candidateUrl = record.candidateUrl ? normalizePublicHref(record.candidateUrl) : undefined;
	return {
		id: record.id,
		name: record.name,
		office: record.office,
		district: record.district,
		scope: record.scope,
		status: record.status,
		party: record.party,
		incumbent: record.incumbent,
		jurisdiction: record.jurisdiction,
		sourceStatus: record.sourceStatus,
		ballotDesignation: record.ballotDesignation,
		candidateUrl: candidateUrl && /^https?:\/\//u.test(candidateUrl) ? candidateUrl : undefined,
		sourceDistrictLabel: record.sourceDistrictLabel,
		sourceAreaLabel: record.sourceAreaLabel,
		termYears: record.termYears,
		termEnd: record.termEnd,
		seats: record.seats,
		voteLimit: record.voteLimit,
	};
}

export function buildStateRecordPage(snapshot: StateBallotSnapshot, filters: ReturnType<typeof parseStateRecordFilters>) {
	const matching = snapshot.records.filter(record => (filters.status === "all" || isActiveStateCandidateRecord(record))
		&& (filters.scope === "all" || record.scope === filters.scope)
		&& (!filters.search || [record.name, record.office, record.party, record.incumbent ? "incumbent" : "", record.district, record.jurisdiction, record.sourceAreaLabel, record.sourceDistrictLabel, record.sourceStatus].join(" ").toLowerCase().includes(filters.search)));
	const offset = filters.offset >= matching.length ? Math.max(0, Math.floor((matching.length - 1) / filters.limit) * filters.limit) : filters.offset;
	return {
		total: snapshot.records.length,
		matched: matching.length,
		inactive: snapshot.records.filter(record => !isActiveStateCandidateRecord(record)).length,
		offset,
		limit: filters.limit,
		records: matching.slice(offset, offset + filters.limit).map(publicRecord),
	};
}

export function registerStateRecordRoutes(app: Express, repository: StateBallotRepository | null, throttle: PublicRequestThrottle = createPublicRequestThrottle({ windowMs: 60_000, maxRequests: 120, maxBuckets: 10_000 }), now: () => number = Date.now) {
	const currentSources = () => orderStateBallotSources(repository?.sources ?? configuredStateBallotSources, now());
	app.use("/api/state-records", (request, response, next) => {
		response.setHeader("Cache-Control", "no-store");
		const attempt = throttle.attempt(request.ip || request.socket.remoteAddress || "unknown");
		if (!attempt.allowed) {
			response.setHeader("Retry-After", String(attempt.retryAfterSeconds));
			response.status(429).json({ message: "Too many record requests. Please try again shortly." });
			return;
		}
		next();
	});
	app.get("/api/state-records", (_request, response) => {
		const sources = currentSources();
		response.json({ states: usStates.map(([stateCode, stateName]) => {
			const options = sources.filter(source => source.stateCode === stateCode);
			return { stateCode, stateName, configured: Boolean(options.length), electionDate: options[0]?.electionDate, sources: options.map(({ id, label, electionDate }) => ({ id, label, electionDate })) };
		}) });
	});
	app.get("/api/state-records/:stateCode", async (request, response) => {
		const sources = currentSources();
		const stateCode = String(request.params.stateCode).toUpperCase();
		const state = usStates.find(([code]) => code === stateCode);
		if (!state) {
			response.status(400).json({ message: "The selected state is invalid." });
			return;
		}
		let filters: ReturnType<typeof parseStateRecordFilters>;
		try {
			filters = parseStateRecordFilters(request.query);
		}
		catch (error) {
			response.status(400).json({ message: error instanceof Error ? error.message : "The record filters are invalid." });
			return;
		}
		let sourceId: string | undefined;
		try {
			if (Object.keys(request.query).some(key => key.startsWith("source[")))
				throw new Error("The selected candidate source must be a single value.");
			if (request.query.source !== undefined) {
				sourceId = singleQuery(request.query.source, "");
				if (!sources.some(source => source.id === sourceId && source.stateCode === stateCode))
					throw new Error("The selected candidate source is invalid for this state.");
			}
		}
		catch (error) {
			response.status(400).json({ message: error instanceof Error ? error.message : "The selected candidate source is invalid." });
			return;
		}
		const source = sources.find(source => source.stateCode === stateCode && (sourceId === undefined || source.id === sourceId));
		const payload: StateRecordsResponse = {
			available: false,
			source: { stateCode, stateName: state[1], configured: Boolean(source), id: source?.id, label: source?.label, url: source?.pageUrl, electionDate: source?.electionDate, scopeNotice: source?.scopeNotice },
			total: 0,
			matched: 0,
			inactive: 0,
			offset: filters.offset,
			limit: filters.limit,
			records: [],
		};
		try {
			payload.source.documentLinks = stateRecordDocumentLinks(source);
			const snapshot = source && repository ? await repository.getSnapshot(stateCode, sourceId) : null;
			if (snapshot) {
				const selected = sources.find(item => item.id === snapshot.source.id && item.stateCode === stateCode && item.electionDate === snapshot.source.electionDate && (sourceId === undefined || item.id === sourceId));
				if (!selected || snapshot.source.stateCode !== stateCode || (sourceId === undefined && source && snapshot.source.electionDate !== source.electionDate))
					throw new Error("The repository returned a mismatched candidate source.");
				payload.source = { stateCode, stateName: state[1], configured: true, id: selected.id, label: selected.label, url: selected.pageUrl, electionDate: selected.electionDate, scopeNotice: selected.scopeNotice, documentLinks: stateRecordDocumentLinks(selected, snapshot), sourceAsOfDate: snapshot.sourceAsOfDate };
				Object.assign(payload, buildStateRecordPage(snapshot, filters));
				payload.available = true;
				payload.source.retrievedAt = snapshot.retrievedAt;
				payload.questionCount = snapshot.ballotQuestions?.length;
			}
			else if (source && repository?.isAwaitingRecords?.(source.id)) {
				payload.awaitingRecords = true;
			}
			response.json(payload);
		}
		catch {
			response.status(503).json({ message: "Candidate records are temporarily unavailable." });
		}
	});
	app.get("/api/state-records/:stateCode/questions", async (request, response) => {
		const stateCode = String(request.params.stateCode).toUpperCase();
		const state = usStates.find(([code]) => code === stateCode);
		const sourceId = request.query.source;
		const id = request.query.id;
		const source = currentSources().find(source => source.id === sourceId && source.stateCode === stateCode);
		if (!state || !source || typeof sourceId !== "string" || Object.keys(request.query).some(key => !["source", "id"].includes(key)) || (id !== undefined && (typeof id !== "string" || !/^[a-f0-9]{24}$/u.test(id)))) {
			response.status(400).json({ message: "The question source or identifier is invalid." });
			return;
		}
		try {
			const snapshot = repository ? await repository.getSnapshot(stateCode, sourceId) : null;
			if (snapshot && (snapshot.source.id !== source.id || snapshot.source.stateCode !== stateCode || snapshot.source.electionDate !== source.electionDate)) throw new Error("The question source is mismatched.");
			const payload: StateQuestionsResponse = {
				available: Boolean(snapshot?.ballotQuestions?.length),
				source: { stateCode, stateName: state[1], configured: true, id: source.id, label: source.label, url: source.pageUrl, electionDate: source.electionDate, retrievedAt: snapshot?.retrievedAt, sourceAsOfDate: snapshot?.sourceAsOfDate, documentLinks: stateRecordDocumentLinks(source, snapshot ?? undefined) },
				questions: snapshot?.ballotQuestions?.filter(question => id === undefined || question.id === id) ?? [],
			};
			response.json(payload);
		}
		catch {
			response.status(503).json({ message: "Ballot questions are temporarily unavailable." });
		}
	});
}
