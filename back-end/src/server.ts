import type { Candidate, Measure, SearchResponse, Source, SourceDirectoryItem, SourceRecordResponse } from "./types/civic.js";
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import process from "node:process";
import { pathToFileURL } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createAdminRepository } from "./admin-store.js";
import {
	demoCandidates,
	demoDataSources,
	demoElection,
	demoElectionSummaries,
	demoJurisdiction,
	demoJurisdictionSummaries,
	demoLocation,
	demoMeasures,
	demoSources,
	getCandidateBySlug,
	getCandidatesBySlugs,
	getElectionBySlug,
	getJurisdictionBySlug,
	getMeasureBySlug,
	getSourceById
} from "./demo-data.js";

dotenv.config();

interface CreateAppOptions {
	adminApiKey?: string | null;
	adminDbPath?: string | null;
	bootstrapDisplayName?: string | null;
	bootstrapPassword?: string | null;
	bootstrapUsername?: string | null;
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

function uniqueSources(sources: Source[]) {
	return Array.from(new Map(sources.map(source => [source.id, source])).values());
}

function collectCandidateSources(candidate: Candidate) {
	return uniqueSources([
		...candidate.sources,
		...candidate.biography.flatMap(block => block.sources),
		...candidate.keyActions.flatMap(item => item.sources),
		...candidate.lobbyingContext.flatMap(block => block.sources),
		...candidate.publicStatements.flatMap(block => block.sources),
		...candidate.funding.sources,
		...candidate.whatWeKnow.flatMap(item => item.sources),
		...candidate.whatWeDoNotKnow.flatMap(item => item.sources),
		...candidate.comparison.whyRunning.sources,
		...candidate.comparison.topPriorities.flatMap(item => item.sources),
		...candidate.comparison.questionnaireResponses.flatMap(item => item.sources)
	]);
}

function collectMeasureSources(measure: Measure) {
	return uniqueSources([
		...measure.sources,
		...measure.currentPractice.flatMap(item => item.sources),
		...measure.proposedChanges.flatMap(item => item.sources),
		...measure.implementationTimeline.flatMap(item => item.sources),
		...measure.fiscalSummary.flatMap(item => item.sources),
		...measure.supportArguments.flatMap(item => item.sources),
		...measure.opposeArguments.flatMap(item => item.sources),
		...measure.whatWeKnow.flatMap(item => item.sources),
		...measure.whatWeDoNotKnow.flatMap(item => item.sources)
	]);
}

function buildSourceDirectory(): SourceDirectoryItem[] {
	const citations = new Map<string, SourceDirectoryItem["citedBy"]>();

	function addCitation(sourceId: string, citation: SourceDirectoryItem["citedBy"][number]) {
		const existing = citations.get(sourceId) ?? [];

		if (!existing.some(item => item.id === citation.id))
			existing.push(citation);

		citations.set(sourceId, existing);
	}

	for (const candidate of demoCandidates) {
		for (const source of collectCandidateSources(candidate)) {
			addCitation(source.id, {
				href: `/candidate/${candidate.slug}`,
				id: candidate.slug,
				label: candidate.name,
				type: "candidate"
			});
		}
	}

	for (const measure of demoMeasures) {
		for (const source of collectMeasureSources(measure)) {
			addCitation(source.id, {
				href: `/measure/${measure.slug}`,
				id: measure.slug,
				label: measure.title,
				type: "measure"
			});
		}
	}

	return demoSources
		.map(source => ({
			...source,
			citationCount: (citations.get(source.id) ?? []).length,
			citedBy: citations.get(source.id) ?? []
		}))
		.sort((left, right) => {
			return right.date.localeCompare(left.date) || left.title.localeCompare(right.title);
		});
}

function buildSourceRecord(id: string): SourceRecordResponse | null {
	const source = getSourceById(id);

	if (!source)
		return null;

	const directoryItem = buildSourceDirectory().find(item => item.id === id);

	if (!directoryItem)
		return null;

	return {
		source: directoryItem,
		updatedAt: source.date
	};
}

function buildSearchResponse(rawQuery: string): SearchResponse {
	const query = rawQuery.trim();
	const lowerQuery = query.toLowerCase();
	const suggestions = [
		"Metro County",
		"U.S. House District 7",
		"Charter Amendment A",
		"Sandra Patel",
		"Transit bond"
	];

	if (query.length < 2) {
		return {
			groups: [],
			query,
			suggestions,
			total: 0
		};
	}

	const candidateResults = demoCandidates
		.filter(candidate => [
			candidate.name,
			candidate.officeSought,
			candidate.summary,
			candidate.topIssues.map(issue => issue.label).join(" ")
		].join(" ").toLowerCase().includes(lowerQuery))
		.map(candidate => ({
			href: `/candidate/${candidate.slug}`,
			id: candidate.slug,
			meta: `${candidate.officeSought} · ${candidate.party}`,
			sourceCount: candidate.sources.length,
			summary: candidate.ballotSummary,
			title: candidate.name,
			type: "candidate" as const,
			updatedAt: candidate.updatedAt
		}));

	const measureResults = demoMeasures
		.filter(measure => [
			measure.title,
			measure.summary,
			measure.plainLanguageExplanation,
			measure.yesMeaning,
			measure.noMeaning
		].join(" ").toLowerCase().includes(lowerQuery))
		.map(measure => ({
			href: `/measure/${measure.slug}`,
			id: measure.slug,
			meta: measure.location,
			sourceCount: measure.sources.length,
			summary: measure.ballotSummary,
			title: measure.title,
			type: "measure" as const,
			updatedAt: measure.updatedAt
		}));

	const electionResults = [demoElection]
		.filter(election => [
			election.name,
			election.locationName,
			election.description
		].join(" ").toLowerCase().includes(lowerQuery))
		.map(election => ({
			href: `/elections/${election.slug}`,
			id: election.slug,
			meta: `${demoJurisdiction.displayName} · ${election.date}`,
			summary: election.description,
			title: election.name,
			type: "election" as const,
			updatedAt: election.updatedAt
		}));

	const jurisdictionResults = [demoJurisdiction]
		.filter(jurisdiction => [
			jurisdiction.name,
			jurisdiction.displayName,
			jurisdiction.description
		].join(" ").toLowerCase().includes(lowerQuery))
		.map(jurisdiction => ({
			href: `/locations/${jurisdiction.slug}`,
			id: jurisdiction.slug,
			meta: `${jurisdiction.jurisdictionType} · ${jurisdiction.state}`,
			summary: jurisdiction.description,
			title: jurisdiction.displayName,
			type: "jurisdiction" as const,
			updatedAt: jurisdiction.updatedAt
		}));

	const sourceResults = buildSourceDirectory()
		.filter(source => [
			source.title,
			source.publisher,
			source.sourceSystem,
			source.type
		].join(" ").toLowerCase().includes(lowerQuery))
		.map(source => ({
			authority: source.authority,
			href: `/sources/${source.id}`,
			id: source.id,
			meta: `${source.publisher} · ${source.type}`,
			summary: source.note || `Cited ${source.citationCount} time${source.citationCount === 1 ? "" : "s"} in Ballot Clarity.`,
			title: source.title,
			type: "source" as const,
			updatedAt: source.date
		}));

	const groups = [
		{ items: jurisdictionResults, label: "Jurisdictions", type: "jurisdiction" as const },
		{ items: electionResults, label: "Elections", type: "election" as const },
		{ items: candidateResults, label: "Candidates", type: "candidate" as const },
		{ items: measureResults, label: "Measures", type: "measure" as const },
		{ items: sourceResults, label: "Sources", type: "source" as const }
	].filter(group => group.items.length);

	return {
		groups,
		query,
		suggestions,
		total: groups.reduce((count, group) => count + group.items.length, 0)
	};
}

export function createApp(options: CreateAppOptions = {}) {
	const app = express();
	const adminApiKey = options.adminApiKey ?? process.env.ADMIN_API_KEY ?? null;
	const adminRepository = createAdminRepository({
		bootstrapDisplayName: options.bootstrapDisplayName,
		bootstrapPassword: options.bootstrapPassword,
		bootstrapUsername: options.bootstrapUsername,
		dbPath: options.adminDbPath
	});

	app.use(cors({
		origin: true
	}));

	app.use(express.json());

	app.get("/health", (_request, response) => {
		response.json({ ok: true });
	});

	app.post("/api/admin/auth/login", (request, response) => {
		const username = typeof request.body?.username === "string" ? request.body.username : "";
		const password = typeof request.body?.password === "string" ? request.body.password : "";

		if (!adminRepository.hasUsers()) {
			response.status(503).json({
				message: "No admin users are configured yet. Set bootstrap credentials or create the first admin account."
			});
			return;
		}

		const user = adminRepository.authenticateUser(username, password);

		if (!user) {
			response.status(401).json({
				message: "Invalid admin credentials."
			});
			return;
		}

		response.json({
			authenticated: true,
			configured: true,
			displayName: user.displayName,
			role: user.role,
			username: user.username
		});
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
			note: "The current launch returns staged Metro County coverage while live district integrations are being connected."
		});
	});

	app.post("/api/feedback", (request, response) => {
		try {
			const result = adminRepository.createCorrectionSubmission({
				email: typeof request.body?.email === "string" ? request.body.email : "",
				message: typeof request.body?.message === "string" ? request.body.message : "",
				name: typeof request.body?.name === "string" ? request.body.name : undefined,
				pageUrl: typeof request.body?.pageUrl === "string" ? request.body.pageUrl : undefined,
				sourceLinks: typeof request.body?.sourceLinks === "string" ? request.body.sourceLinks : undefined,
				subject: typeof request.body?.subject === "string" ? request.body.subject : "",
				submissionType: request.body?.submissionType === "correction" ? "correction" : "feedback"
			});

			response.status(201).json(result);
		}
		catch (error) {
			response.status(400).json({
				message: error instanceof Error ? error.message : "Unable to submit feedback."
			});
		}
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

	app.get("/api/search", (request, response) => {
		const query = typeof request.query.q === "string" ? request.query.q : "";

		response.json(buildSearchResponse(query));
	});

	app.get("/api/sources", (_request, response) => {
		response.json({
			sources: buildSourceDirectory(),
			updatedAt: demoElection.updatedAt
		});
	});

	app.get("/api/sources/:id", (request, response) => {
		const record = buildSourceRecord(request.params.id);

		if (!record) {
			response.status(404).json({
				message: "Source record not found."
			});
			return;
		}

		response.json(record);
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
			election,
			location: {
				...demoLocation,
				slug: locationSlug
			},
			note: "Current public coverage uses staged records while live civic-data integrations are being connected. Verify official election logistics with the linked election office.",
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
		response.json(adminRepository.getOverview());
	});

	app.get("/api/admin/corrections", (_request, response) => {
		response.json(adminRepository.listCorrections());
	});

	app.patch("/api/admin/corrections/:id", (request, response) => {
		try {
			response.json(adminRepository.updateCorrection(request.params.id, {
				nextStep: typeof request.body?.nextStep === "string" ? request.body.nextStep : undefined,
				priority: request.body?.priority,
				status: request.body?.status
			}));
		}
		catch (error) {
			response.status(400).json({
				message: error instanceof Error ? error.message : "Unable to update correction."
			});
		}
	});

	app.get("/api/admin/review", (_request, response) => {
		response.json(adminRepository.listReview());
	});

	app.get("/api/admin/content", (_request, response) => {
		response.json(adminRepository.listContent());
	});

	app.patch("/api/admin/content/:id", (request, response) => {
		try {
			response.json(adminRepository.updateContent(request.params.id, {
				assignedTo: typeof request.body?.assignedTo === "string" ? request.body.assignedTo : undefined,
				blocker: request.body?.blocker === null
					? null
					: typeof request.body?.blocker === "string"
						? request.body.blocker
						: undefined,
				priority: request.body?.priority,
				published: typeof request.body?.published === "boolean" ? request.body.published : undefined,
				status: request.body?.status
			}));
		}
		catch (error) {
			response.status(400).json({
				message: error instanceof Error ? error.message : "Unable to update content."
			});
		}
	});

	app.get("/api/admin/sources", (_request, response) => {
		response.json(adminRepository.listSourceMonitor());
	});

	app.patch("/api/admin/sources/:id", (request, response) => {
		try {
			response.json(adminRepository.updateSource(request.params.id, {
				health: request.body?.health,
				nextCheckAt: typeof request.body?.nextCheckAt === "string" ? request.body.nextCheckAt : undefined,
				note: typeof request.body?.note === "string" ? request.body.note : undefined,
				owner: typeof request.body?.owner === "string" ? request.body.owner : undefined
			}));
		}
		catch (error) {
			response.status(400).json({
				message: error instanceof Error ? error.message : "Unable to update source monitor."
			});
		}
	});

	app.get("/api/admin/users", (_request, response) => {
		response.json(adminRepository.listUsers());
	});

	app.post("/api/admin/users", (request, response) => {
		try {
			adminRepository.createUser({
				displayName: typeof request.body?.displayName === "string" ? request.body.displayName : "",
				password: typeof request.body?.password === "string" ? request.body.password : "",
				role: request.body?.role === "editor" ? "editor" : "admin",
				username: typeof request.body?.username === "string" ? request.body.username : ""
			});

			response.status(201).json(adminRepository.listUsers());
		}
		catch (error) {
			response.status(400).json({
				message: error instanceof Error ? error.message : "Unable to create admin user."
			});
		}
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
