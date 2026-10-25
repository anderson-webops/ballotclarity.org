import type { Express } from "express";
import type { JudicialEvaluationRepository } from "./judicial-evaluations.js";
import type { PublicRequestThrottle } from "./public-request-throttle.js";
import type { StateBallotRepository } from "./state-ballot-repository.js";
import { judicialEvaluationSources } from "./judicial-evaluations.js";
import { createPublicRequestThrottle } from "./public-request-throttle.js";

export function registerJudicialEvaluationRoutes(app: Express, repository: JudicialEvaluationRepository | null, rosters: StateBallotRepository | null, throttle: PublicRequestThrottle = createPublicRequestThrottle({ windowMs: 60_000, maxRequests: 120, maxBuckets: 10_000 })) {
	app.use("/api/judicial-evaluations", (request, response, next) => {
		response.setHeader("Cache-Control", "no-store");
		const attempt = throttle.attempt(request.ip || request.socket.remoteAddress || "unknown");
		if (!attempt.allowed) {
			response.setHeader("Retry-After", String(attempt.retryAfterSeconds));
			response.status(429).json({ message: "Too many information requests. Please try again shortly." });
			return;
		}
		next();
	});
	app.get("/api/judicial-evaluations/:stateCode/:recordId", async (request, response) => {
		const stateCode = String(request.params.stateCode).toUpperCase();
		const recordId = String(request.params.recordId);
		const sourceId = request.query.source;
		if (!/^[A-Z]{2}$/u.test(stateCode) || !/^[a-f\d]{24}$/u.test(recordId) || typeof sourceId !== "string" || !/^[a-z\d-]{1,160}$/u.test(sourceId) || Object.keys(request.query).some(key => key !== "source")) {
			response.status(400).json({ message: "The selected evaluation record is invalid." });
			return;
		}
		if (!repository || !rosters || !judicialEvaluationSources.some(source => source.stateCode === stateCode && source.rosterSourceId === sourceId)) {
			response.status(404).json({ message: "An official evaluation is unavailable for this record." });
			return;
		}
		try {
			const roster = await rosters.getSnapshot(stateCode, sourceId);
			const evaluation = roster ? await repository.getEvaluation(roster, recordId) : null;
			if (!evaluation) {
				response.status(404).json({ message: "An official evaluation is unavailable for this record." });
				return;
			}
			response.json(evaluation);
		}
		catch { response.status(503).json({ message: "Official evaluations are temporarily unavailable." }); }
	});
}
