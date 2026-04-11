import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import process from "node:process";
import { pathToFileURL } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import {
	demoAdminCorrections,
	demoAdminOverview,
	demoAdminReview,
	demoAdminSourceMonitor,
	demoDataSources,
	demoElection,
	demoElectionSummaries,
	demoJurisdictionSummaries,
	demoLocation,
	getCandidateBySlug,
	getCandidatesBySlugs,
	getElectionBySlug,
	getJurisdictionBySlug,
	getMeasureBySlug
} from "./demo-data.js";

dotenv.config();

interface CreateAppOptions {
	adminApiKey?: string | null;
}

function isAuthorizedAdminRequest(requestKey: string | undefined, configuredKey: string | null) {
	if (!requestKey || !configuredKey)
		return false;

	const left = Buffer.from(requestKey);
	const right = Buffer.from(configuredKey);

	if (left.length !== right.length)
		return false;

	return timingSafeEqual(left, right);
}

export function createApp(options: CreateAppOptions = {}) {
	const app = express();
	const adminApiKey = options.adminApiKey ?? process.env.ADMIN_API_KEY ?? null;

	app.use(cors({
		origin: true
	}));

	app.use(express.json());

	app.get("/health", (_request, response) => {
		response.json({ ok: true });
	});

	app.use("/api/admin", (request, response, next) => {
		if (!adminApiKey) {
			response.status(503).json({
				message: "Admin API is not configured on this server."
			});
			return;
		}

		const requestKey = request.header("x-admin-api-key");

		if (!isAuthorizedAdminRequest(requestKey, adminApiKey)) {
			response.status(401).json({
				message: "Unauthorized admin request."
			});
			return;
		}

		next();
	});

	app.post("/api/location", (request, response) => {
		const raw = typeof request.body?.q === "string" ? request.body.q.trim() : "";

		response.set("Cache-Control", "no-store");

		if (raw.length < 3) {
			response.status(400).json({
				message: "Enter at least a street address or ZIP code fragment to continue."
			});
			return;
		}

		response.json({
			electionSlug: demoElection.slug,
			location: demoLocation,
			note: "Demo mode accepts any address or ZIP and returns Metro County sample data."
		});
	});

	app.get("/api/elections", (_request, response) => {
		response.json({
			elections: demoElectionSummaries
		});
	});

	app.get("/api/jurisdictions", (_request, response) => {
		response.json({
			jurisdictions: demoJurisdictionSummaries
		});
	});

	app.get("/api/data-sources", (_request, response) => {
		response.json(demoDataSources);
	});

	app.get("/api/jurisdictions/:slug", (request, response) => {
		const jurisdiction = getJurisdictionBySlug(request.params.slug);

		if (!jurisdiction) {
			response.status(404).json({
				message: "Jurisdiction not found."
			});
			return;
		}

		response.json(jurisdiction);
	});

	app.get("/api/ballot", (request, response) => {
		const electionSlug = typeof request.query.election === "string" ? request.query.election : "";
		const locationSlug = typeof request.query.location === "string" ? request.query.location : demoLocation.slug;

		if (!electionSlug) {
			response.status(400).json({
				message: "Election slug is required."
			});
			return;
		}

		const election = getElectionBySlug(electionSlug);

		if (!election) {
			response.status(404).json({
				message: "Ballot not found for the requested election."
			});
			return;
		}

		response.json({
			demo: true,
			election,
			location: {
				...demoLocation,
				slug: locationSlug
			},
			note: "This ballot is built from realistic demo records and should not be used as a real election guide.",
			updatedAt: election.updatedAt
		});
	});

	app.get("/api/candidates/:slug", (request, response) => {
		const candidate = getCandidateBySlug(request.params.slug);

		if (!candidate) {
			response.status(404).json({
				message: "Candidate not found."
			});
			return;
		}

		response.json(candidate);
	});

	app.get("/api/measures/:slug", (request, response) => {
		const measure = getMeasureBySlug(request.params.slug);

		if (!measure) {
			response.status(404).json({
				message: "Measure not found."
			});
			return;
		}

		response.json(measure);
	});

	app.get("/api/compare", (request, response) => {
		const raw = typeof request.query.slugs === "string" ? request.query.slugs : "";
		const requestedSlugs = raw.split(",").map(item => item.trim()).filter(Boolean).slice(0, 3);
		const candidates = getCandidatesBySlugs(requestedSlugs);
		const offices = Array.from(new Set(candidates.map(candidate => candidate.officeSought)));
		const contests = Array.from(new Set(candidates.map(candidate => candidate.contestSlug)));
		const sameContest = contests.length === 1;

		response.json({
			candidates,
			contestSlug: sameContest ? contests[0] : null,
			note: "Compare pages are informational only. They do not rank candidates, show polls, or score fit.",
			office: offices.length === 1 ? offices[0] : null,
			sameContest,
			requestedSlugs
		});
	});

	app.get("/api/admin/overview", (_request, response) => {
		response.json(demoAdminOverview);
	});

	app.get("/api/admin/corrections", (_request, response) => {
		response.json(demoAdminCorrections);
	});

	app.get("/api/admin/review", (_request, response) => {
		response.json(demoAdminReview);
	});

	app.get("/api/admin/sources", (_request, response) => {
		response.json(demoAdminSourceMonitor);
	});

	return app;
}

export function startServer(port = Number(process.env.PORT || 3001)) {
	const app = createApp();
	const server = app.listen(port, () => {
		console.log(`Ballot Clarity API listening on http://127.0.0.1:${port}`);
	});

	return { app, port, server };
}

function isDirectExecution(metaUrl: string) {
	return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === metaUrl;
}

if (isDirectExecution(import.meta.url))
	startServer();
