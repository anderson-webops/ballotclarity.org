import type { Express } from "express";
import type { ElectionReferenceRepository } from "./election-references.js";
import type { RecordPortraitResolver } from "./record-portraits.js";
import type { StateBallotRepository } from "./state-ballot-repository.js";
import type { StateRecordDetailResponse } from "./types/civic.js";
import { matchingCandidateReferences } from "./candidate-reference-matching.js";
import { configuredStateBallotSources } from "./state-ballot-registry.js";
import { orderStateBallotSources } from "./state-ballot-source-state.js";
import { publicStateCandidateRecord, stateRecordDocumentLinks } from "./state-records.js";
import { usStates } from "./us-states.js";

export function registerStateRecordDetailRoutes(app: Express, repository: StateBallotRepository | null, references: ElectionReferenceRepository | null, portraits?: RecordPortraitResolver, now: () => number = Date.now) {
	app.get("/api/state-records/:stateCode/:recordId", async (request, response) => {
		const stateCode = String(request.params.stateCode).toUpperCase();
		const recordId = String(request.params.recordId);
		const state = usStates.find(([code]) => code === stateCode);
		const sources = orderStateBallotSources(repository?.sources ?? configuredStateBallotSources, now());
		const sourceId = request.query.source;
		if (!state || !/^[a-f\d]{24}$/u.test(recordId) || Object.keys(request.query).some(key => key !== "source") || (sourceId !== undefined && (typeof sourceId !== "string" || !sources.some(source => source.id === sourceId && source.stateCode === stateCode)))) {
			response.status(400).json({ message: "The candidate record selection is invalid." });
			return;
		}
		try {
			const preferred = sources.find(source => source.stateCode === stateCode && (sourceId === undefined || source.id === sourceId));
			const snapshot = preferred && repository ? await repository.getSnapshot(stateCode, sourceId as string | undefined) ?? (sourceId === undefined ? await repository.getSnapshot(stateCode, preferred.id) : null) : null;
			if (!snapshot) {
				response.status(404).json({ message: "The candidate record is unavailable." });
				return;
			}
			const selected = sources.find(source => source.id === snapshot.source.id && source.stateCode === stateCode && source.electionDate === snapshot.source.electionDate && (sourceId === undefined || source.id === sourceId));
			if (!selected || (sourceId === undefined && snapshot.source.electionDate !== preferred?.electionDate)) throw new Error("The candidate repository returned a different election or source.");
			const record = snapshot.records.find(record => record.id === recordId);
			if (!record) {
				response.status(404).json({ message: "The candidate record is unavailable." });
				return;
			}
			let publicRecord = publicStateCandidateRecord(record, selected);
			if (portraits) publicRecord = (await portraits(stateCode, [publicRecord]))[0]!;
			const payload: StateRecordDetailResponse = {
				record: publicRecord,
				source: { stateCode, stateName: state[1], configured: true, id: selected.id, label: selected.label, url: selected.pageUrl, electionDate: selected.electionDate, scopeNotice: selected.scopeNotice, retrievedAt: snapshot.retrievedAt, sourceAsOfDate: snapshot.sourceAsOfDate, documentLinks: stateRecordDocumentLinks(selected, snapshot) },
				references: [],
			};
			try {
				const retained = references?.getSnapshots ? await references.getSnapshots(stateCode) : references ? [await references.getSnapshot(stateCode)].filter(item => item !== null) : [];
				payload.references = matchingCandidateReferences(snapshot, record, retained);
			}
			catch { payload.referencesUnavailable = true; }
			response.json(payload);
		}
		catch {
			response.status(503).json({ message: "Candidate records are temporarily unavailable." });
		}
	});
}
