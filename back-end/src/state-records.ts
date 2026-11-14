import type { Express } from "express";
import type { PublicRequestThrottle } from "./public-request-throttle.js";
import type { RecordPortraitResolver } from "./record-portraits.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotRepository, StateBallotSnapshot } from "./state-ballot-repository.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import type { PublicStateCandidateRecord, StateQuestionsResponse, StateRecordsResponse } from "./types/civic.js";
import { johnsonBallotMapUrl, validateJohnsonStoredDocuments } from "./johnson-ballot-publications.js";
import { johnsonSampleStyle } from "./johnson-ballot-questions.js";
import { publishedBallotQuestionArea } from "./public-ballot-question-area.js";
import { normalizePublicHref } from "./public-href.js";
import { createPublicRequestThrottle } from "./public-request-throttle.js";
import { validateBoulderCandidateUrl } from "./state-ballot-boulder.js";
import { validateBucksDocumentUrl } from "./state-ballot-bucks.js";
import { validateCassiaDocumentUrl, validateCassiaSource } from "./state-ballot-cassia.js";
import { validateChicagoDocumentUrl } from "./state-ballot-chicago-collection.js";
import { validateFairbanksSource } from "./state-ballot-fairbanks.js";
import { validateFranklinDocumentUrl, validateFranklinSource } from "./state-ballot-franklin-collection.js";
import { fultonMunicipalDocumentUrl, validateFultonMunicipalSource } from "./state-ballot-fulton-municipal.js";
import { validateGoffstownDocumentUrl } from "./state-ballot-goffstown-discovery.js";
import { validateHamiltonDocumentUrl } from "./state-ballot-hamilton-collection.js";
import { validateIowaJohnsonSource } from "./state-ballot-iowa-johnson.js";
import { validateKanawhaDocumentUrl } from "./state-ballot-kanawha-discovery.js";
import { validateNycDocumentUrl } from "./state-ballot-nyc-collection.js";
import { validateOklahomaSource } from "./state-ballot-oklahoma.js";
import { validateOrangeDocumentUrl } from "./state-ballot-orange-discovery.js";
import { validatePimaDocumentUrl } from "./state-ballot-pima-discovery.js";
import { isActiveStateCandidateRecord } from "./state-ballot-records.js";
import { configuredStateBallotSources } from "./state-ballot-registry.js";
import { orderStateBallotSources, stateBallotSourceIsCurrent } from "./state-ballot-source-state.js";
import { applicableStateRecordSupplements, readStateRecordSupplements } from "./state-ballot-supplements.js";
import { validateTuscolaDocumentUrl, validateTuscolaSource } from "./state-ballot-tuscola-collection.js";
import { containsControlCharacters } from "./text-validation.js";
import { usStates } from "./us-states.js";

const scopes = ["all", "statewide", "congressional", "state-senate", "state-house", "state-board-of-education", "local"];

export function stateRecordDocumentLinks(source: StateBallotSource | undefined, snapshot?: StateBallotSnapshot) {
	if (source?.format === "iowa-johnson-html" && snapshot?.documents) {
		validateIowaJohnsonSource(source);
		if (snapshot.source.id !== source.id) throw new Error("The Johnson County publication source is mismatched.");
		validateJohnsonStoredDocuments(source, { documents: snapshot.documents, ballotQuestions: snapshot.ballotQuestions, sourceSha256: snapshot.sha256, collectionIndexSha256: snapshot.collectionIndexSha256 });
		const candidates = { label: "Candidate list", url: source.pageUrl };
		if (snapshot.documents.length === 1) return [candidates];
		const questions = [...new Set(snapshot.ballotQuestions?.map(question => question.sourceUrl))].map((url) => {
			if (!url || !snapshot.documents!.some(document => document.url === url)) throw new Error("The Johnson County question publication is missing.");
			return { label: `Ballot style ${johnsonSampleStyle(url, source.electionDate)}`, url };
		});
		return [{ label: "Sample ballot lookup", url: johnsonBallotMapUrl }, candidates, ...questions];
	}
	if (source?.format === "tuscola-pdf" && snapshot?.documents) {
		validateTuscolaSource(source);
		if (snapshot.source.id !== source.id || snapshot.documents.length !== 2) throw new Error("The Tuscola source publications require review.");
		return snapshot.documents.map((document, index) => {
			validateTuscolaDocumentUrl(document.url, index ? "samples" : "candidates", source.electionDate.slice(0, 4));
			return { label: index ? "Sample ballot" : "Candidate list", url: document.url };
		});
	}
	if (source?.format === "franklin-pdf" && snapshot?.documents) {
		validateFranklinSource(source);
		if (snapshot.source.id !== source.id || ![2, 3].includes(snapshot.documents.length)) throw new Error("The Franklin source publications require review.");
		return snapshot.documents.map((document, index) => {
			validateFranklinDocumentUrl(document.url);
			return { label: ["Candidate list", "Absentee notice", "Certified issues"][index]!, url: document.url };
		});
	}
	if (source?.format === "cassia-pdf" && snapshot?.documents) {
		validateCassiaSource(source);
		if (snapshot.source.id !== source.id || !snapshot.documents.length || snapshot.documents.length > 12) throw new Error("The Cassia source publications require review.");
		return snapshot.documents.map((document, index) => {
			validateCassiaDocumentUrl(document.url, source.electionDate);
			return { label: index === 0 ? "Sample ballot" : /School/iu.test(document.url) ? "School ballot" : /Fire/iu.test(document.url) ? "Fire ballot" : "Supporting ballot", url: document.url };
		});
	}
	if (source?.format === "fulton-municipal-pdf" && snapshot?.documents) {
		validateFultonMunicipalSource(source);
		if (snapshot.documents.length !== 1) throw new Error("The municipal sample ballot requires review.");
		return [{ label: "Sample ballot", url: fultonMunicipalDocumentUrl(snapshot.documents[0]!.url) }];
	}
	if (source?.format === "fairbanks-pdf" && snapshot?.documents) {
		validateFairbanksSource(source);
		if (snapshot.documents.length !== 2 || snapshot.documents.some((document, index) => document.url !== source.documentUrls?.[index])) throw new Error("The Fairbanks source publications require review.");
		return [{ label: "Sample ballot", url: snapshot.documents[1]!.url }, { label: "Election office", url: source.pageUrl }];
	}
	if (source?.format === "oklahoma-html") {
		validateOklahomaSource(source);
		return [{ label: "Candidate list", url: source.pageUrl }];
	}
	if (source?.format === "iowa-county-pdf" && snapshot?.documents) return [{ label: "Sample ballots", url: source.pageUrl }];
	if (source?.format === "everett-pdf" && snapshot?.documents) return [{ label: "Sample ballots", url: source.pageUrl }];
	if (source?.format === "bucks-pdf" && snapshot?.documents) {
		return snapshot.documents.map((document) => {
			validateBucksDocumentUrl(document.url, source.electionDate);
			return { label: "Candidate list", url: document.url };
		});
	}
	if (source?.format === "boulder-html" && snapshot?.documents) {
		return snapshot.documents.map((document) => {
			validateBoulderCandidateUrl(document.url, source.electionDate);
			return { label: "Candidate websites", url: document.url };
		});
	}
	if (source?.format === "kanawha-pdf" && snapshot?.documents) {
		return snapshot.documents.map((document) => {
			validateKanawhaDocumentUrl(document.url, source.electionDate.slice(0, 4));
			return { label: "Test report", url: document.url };
		});
	}
	if (source?.format === "orange-pdf" && snapshot?.documents) {
		return snapshot.documents.map((document) => {
			validateOrangeDocumentUrl(document.url, source.electionDate);
			return { label: "Candidate list", url: document.url };
		});
	}
	if (source?.format === "hamilton-html" && snapshot?.documents) {
		return snapshot.documents.map((document) => {
			validateHamiltonDocumentUrl(document.url);
			return { label: "Sample ballot", url: document.url, pageAnchor: "page-" as const };
		});
	}
	if (source?.format === "pima-pdf" && snapshot?.documents) {
		return snapshot.documents.map((document, index) => {
			validatePimaDocumentUrl(document.url);
			return { label: index ? "Write-ins" : "Candidates", url: document.url };
		});
	}
	if (source?.format === "goffstown-pdf" && snapshot?.documents) {
		return snapshot.documents.map((document) => {
			validateGoffstownDocumentUrl(document.url, source.electionDate);
			return { label: "Sample ballot", url: document.url };
		});
	}
	if (source?.format === "nyc-pdf" && snapshot?.documents) {
		return snapshot.documents.map((document) => {
			validateNycDocumentUrl(document.url, source.electionDate);
			return { label: "Candidate and proposal list", url: document.url };
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

export function reportedFultonIncumbency(record: StateCandidateRecord, source: StateBallotSource) {
	return (source.id === "ga-fulton-2026" || source.format === "fulton-pdf") && /^\(Incumbent\)?(?:; |$)/u.test(record.ballotDesignation ?? "");
}

export function publicStateCandidateRecord(record: StateCandidateRecord, source: StateBallotSource): PublicStateCandidateRecord {
	const candidateUrl = record.candidateUrl ? normalizePublicHref(record.candidateUrl) : undefined;
	const fultonIncumbent = reportedFultonIncumbency(record, source);
	return {
		id: record.id,
		name: record.name,
		office: record.office,
		district: record.district,
		scope: record.scope,
		status: record.status,
		party: record.party,
		incumbent: record.incumbent || fultonIncumbent ? true : undefined,
		jurisdiction: record.jurisdiction,
		sourceStatus: record.sourceStatus,
		ballotDesignation: fultonIncumbent ? record.ballotDesignation!.replace(/^\(Incumbent\)?(?:; )?/u, "") || undefined : record.ballotDesignation,
		candidateUrl: candidateUrl && /^https?:\/\//u.test(candidateUrl) ? candidateUrl : undefined,
		sourceDistrictLabel: record.sourceDistrictLabel,
		sourceAreaLabel: source.format === "orange-pdf" ? undefined : record.sourceAreaLabel,
		termYears: record.termYears,
		termEnd: record.termEnd,
		seats: record.seats,
		voteLimit: record.voteLimit,
	};
}

export function buildStateRecordPage(snapshot: StateBallotSnapshot, filters: ReturnType<typeof parseStateRecordFilters>, recordSources?: ReadonlyMap<string, StateBallotSource>) {
	const matching = snapshot.records.filter(record => (filters.status === "all" || isActiveStateCandidateRecord(record))
		&& (filters.scope === "all" || record.scope === filters.scope)
		&& (!filters.search || [record.name, record.office, record.party, record.incumbent || reportedFultonIncumbency(record, snapshot.source) ? "incumbent" : "", record.district, record.jurisdiction, record.sourceAreaLabel, record.sourceDistrictLabel, record.sourceStatus].join(" ").toLowerCase().includes(filters.search)));
	const offset = filters.offset >= matching.length ? Math.max(0, Math.floor((matching.length - 1) / filters.limit) * filters.limit) : filters.offset;
	return {
		total: snapshot.records.length,
		matched: matching.length,
		inactive: snapshot.records.filter(record => !isActiveStateCandidateRecord(record)).length,
		offset,
		limit: filters.limit,
		records: matching.slice(offset, offset + filters.limit).map((record) => {
			const source = recordSources?.get(record.id) ?? snapshot.source;
			return { ...publicStateCandidateRecord(record, source), ...(source.id !== snapshot.source.id ? { sourceId: source.id } : {}) };
		}),
	};
}

export function registerStateRecordRoutes(app: Express, repository: StateBallotRepository | null, throttle: PublicRequestThrottle = createPublicRequestThrottle({ windowMs: 60_000, maxRequests: 120, maxBuckets: 10_000 }), now: () => number = Date.now, portraits?: RecordPortraitResolver) {
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
			return { stateCode, stateName, configured: Boolean(options.length), electionDate: options.find(source => stateBallotSourceIsCurrent(source, now()))?.electionDate, sources: options.map(({ id, label, electionDate }) => ({ id, label, electionDate })) };
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
		let includeSupplements = false;
		try {
			if (request.query.includeSupplements !== undefined) {
				if (!["true", "false"].includes(singleQuery(request.query.includeSupplements, ""))) throw new Error("The supplement selection must be a single boolean.");
				includeSupplements = request.query.includeSupplements === "true";
			}
			if (Object.keys(request.query).some(key => key.startsWith("source[") || key.startsWith("includeSupplements[")))
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
		const source = sources.find(source => source.stateCode === stateCode && (sourceId === undefined ? stateBallotSourceIsCurrent(source, now()) : source.id === sourceId));
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
				if (!selected || snapshot.source.stateCode !== stateCode || (sourceId === undefined && (!stateBallotSourceIsCurrent(selected, now()) || (source && snapshot.source.electionDate !== source.electionDate))))
					throw new Error("The repository returned a mismatched candidate source.");
				payload.source = { stateCode, stateName: state[1], configured: true, id: selected.id, label: selected.label, url: selected.pageUrl, electionDate: selected.electionDate, scopeNotice: selected.scopeNotice, documentLinks: stateRecordDocumentLinks(selected, snapshot), sourceAsOfDate: snapshot.sourceAsOfDate };
				const retained = includeSupplements ? await readStateRecordSupplements(snapshot, repository!) : { snapshots: [], unavailable: false };
				const supplements = applicableStateRecordSupplements(snapshot, retained.snapshots);
				const recordSources = new Map(supplements.flatMap(item => item.records.map(record => [record.id, item.source] as const)));
				Object.assign(payload, buildStateRecordPage({ ...snapshot, records: [...snapshot.records, ...supplements.flatMap(item => item.records)] }, filters, recordSources));
				if (supplements.length) payload.source.documentLinks = [...(payload.source.documentLinks ?? []), ...supplements.flatMap(item => stateRecordDocumentLinks(item.source, item) ?? [])];
				if (supplements.length) payload.supplementalSources = supplements.map(item => ({ id: item.source.id, retrievedAt: item.retrievedAt, sha256: item.sha256 }));
				if (retained.unavailable) payload.supplementsUnavailable = true;
				if (portraits) payload.records = await portraits(stateCode, payload.records);
				payload.available = true;
				payload.source.retrievedAt = snapshot.retrievedAt;
				payload.questionCount = snapshot.ballotQuestions?.length;
				if (snapshot.ballotQuestions?.length && snapshot.ballotQuestions.every(question => question.textKind === "notice")) payload.source.questionKind = "notice";
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
				source: { stateCode, stateName: state[1], configured: true, id: source.id, label: source.label, url: source.pageUrl, electionDate: source.electionDate, retrievedAt: snapshot?.retrievedAt, sourceAsOfDate: snapshot?.sourceAsOfDate, ...(snapshot?.ballotQuestions?.length && snapshot.ballotQuestions.every(question => question.textKind === "notice") ? { questionKind: "notice" as const } : {}), documentLinks: stateRecordDocumentLinks(source, snapshot ?? undefined) },
				questions: snapshot?.ballotQuestions?.filter(question => id === undefined || question.id === id).map((question) => {
					const publishedArea = publishedBallotQuestionArea(source, question);
					return publishedArea ? { ...question, publishedArea } : question;
				}) ?? [],
			};
			response.json(payload);
		}
		catch {
			response.status(503).json({ message: "Ballot questions are temporarily unavailable." });
		}
	});
}
