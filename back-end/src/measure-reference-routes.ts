import type { Express } from "express";
import type { MeasureReferenceRepository } from "./measure-references.js";
import type { PublicRequestThrottle } from "./public-request-throttle.js";
import { buildMeasureReferencesResponse } from "./measure-references.js";
import { createPublicRequestThrottle } from "./public-request-throttle.js";
import { usStates } from "./us-states.js";

export function registerMeasureReferenceRoutes(app: Express, repository: MeasureReferenceRepository | null, throttle: PublicRequestThrottle = createPublicRequestThrottle({ windowMs: 60_000, maxRequests: 120, maxBuckets: 10_000 })) {
	app.use("/api/measure-references", (request, response, next) => {
		response.setHeader("Cache-Control", "no-store");
		const attempt = throttle.attempt(request.ip || request.socket.remoteAddress || "unknown");
		if (!attempt.allowed) {
			response.setHeader("Retry-After", String(attempt.retryAfterSeconds));
			response.status(429).json({ message: "Too many information requests. Please try again shortly." });
			return;
		}
		next();
	});
	app.get("/api/measure-references/:stateCode", async (request, response) => {
		const stateCode = String(request.params.stateCode).toUpperCase();
		if (!usStates.some(([code]) => code === stateCode) || Object.keys(request.query).length) {
			response.status(400).json({ message: "The selected state is invalid." });
			return;
		}
		try {
			response.json(buildMeasureReferencesResponse(stateCode, repository ? await repository.listCollections(stateCode) : []));
		}
		catch {
			response.status(503).json({ message: "Ballot measure information is temporarily unavailable." });
		}
	});
}
