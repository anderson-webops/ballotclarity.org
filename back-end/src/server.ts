import process from "node:process";
import { pathToFileURL } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import {
	demoElection,
	demoElectionSummaries,
	demoLocation,
	getCandidateBySlug,
	getCandidatesBySlugs,
	getElectionBySlug,
	getMeasureBySlug
} from "./demo-data.js";

dotenv.config();

export function createApp() {
	const app = express();

	app.use(cors({
		origin: true
	}));

	app.use(express.json());

	app.get("/health", (_request, response) => {
		response.json({ ok: true });
	});

	app.get("/api/location", (request, response) => {
		const raw = typeof request.query.q === "string" ? request.query.q.trim() : "";

		if (raw.length < 3) {
			response.status(400).json({
				message: "Enter at least a street address or ZIP code fragment to continue."
			});
			return;
		}

		response.json({
			electionSlug: demoElection.slug,
			location: {
				...demoLocation,
				lookupInput: raw
			},
			note: "Demo mode accepts any address or ZIP and returns Metro County sample data."
		});
	});

	app.get("/api/elections", (_request, response) => {
		response.json({
			elections: demoElectionSummaries
		});
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

		response.json({
			candidates,
			note: "Compare tables are informational only. They do not rank or score candidates.",
			office: offices.length === 1 ? offices[0] : null,
			requestedSlugs
		});
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
