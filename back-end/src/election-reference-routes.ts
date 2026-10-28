import type { Express } from "express";
import type { ElectionReferenceRepository } from "./election-references.js";
import type { PublicRequestThrottle } from "./public-request-throttle.js";
import type { RecordPortraitResolver } from "./record-portraits.js";
import type { ElectionReferencesResponse } from "./types/civic.js";
import { electionReferenceSources } from "./election-reference-sources.js";
import { buildElectionReferencePages, selectElectionReferenceSources } from "./election-references.js";
import { createPublicRequestThrottle } from "./public-request-throttle.js";
import { parseStateRecordFilters } from "./state-records.js";
import { usStates } from "./us-states.js";

export function registerElectionReferenceRoutes(app: Express, repository: ElectionReferenceRepository | null, throttle: PublicRequestThrottle = createPublicRequestThrottle({ windowMs: 60_000, maxRequests: 120, maxBuckets: 10_000 }), portraits?: RecordPortraitResolver) {
	app.use("/api/election-references", (request, response, next) => {
		response.setHeader("Cache-Control", "no-store");
		const attempt = throttle.attempt(request.ip || request.socket.remoteAddress || "unknown");
		if (!attempt.allowed) {
			response.setHeader("Retry-After", String(attempt.retryAfterSeconds));
			response.status(429).json({ message: "Too many information requests. Please try again shortly." });
			return;
		}
		next();
	});
	app.get("/api/election-references/:stateCode", async (request, response) => {
		const stateCode = String(request.params.stateCode).toUpperCase();
		if (!usStates.some(([code]) => code === stateCode)) {
			response.status(400).json({ message: "The selected state is invalid." });
			return;
		}
		let filters: ReturnType<typeof parseStateRecordFilters>;
		try {
			if (Object.keys(request.query).some(key => !["q", "scope", "offset", "limit"].includes(key))) throw new Error("The selected information filter is invalid.");
			filters = parseStateRecordFilters(request.query);
		}
		catch (error) {
			response.status(400).json({ message: error instanceof Error ? error.message : "The selected information filter is invalid." });
			return;
		}
		const sources = electionReferenceSources.filter(item => item.stateCode === stateCode);
		const selected = selectElectionReferenceSources(sources, stateCode);
		const payload: ElectionReferencesResponse = { available: false, collections: selected.map(source => source.id), stateCode, electionDate: selected[0]?.electionDate, total: 0, matched: 0, offset: filters.offset, limit: filters.limit, records: [] };
		try {
			const snapshots = sources.length && repository ? repository.getSnapshots ? await repository.getSnapshots(stateCode) : [await repository.getSnapshot(stateCode)].filter(item => item !== null) : [];
			if (snapshots.length) {
				const collections = snapshots.map((snapshot) => {
					const source = sources.find(item => item.id === snapshot.sourceId);
					if (!source) throw new Error("The reference collection is not configured for this state.");
					return { source, snapshot };
				});
				Object.assign(payload, buildElectionReferencePages(collections, filters));
				payload.available = true;
				payload.electionDate = snapshots[0]!.electionDate;
				payload.collections = sources.filter(source => source.electionDate === payload.electionDate).map(source => source.id);
				if (sources.some(source => source.electionDate === payload.electionDate && !source.optional && !snapshots.some(snapshot => snapshot.sourceId === source.id))) payload.incomplete = true;
			}
			if (portraits) payload.records = await portraits(stateCode, payload.records);
			response.json(payload);
		}
		catch {
			response.status(503).json({ message: "Candidate information is temporarily unavailable." });
		}
	});
}
