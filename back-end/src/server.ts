import type { ErrorRequestHandler } from "express";
import type { Candidate, Contest, Election, EvidenceBlock, FundingSummary, Jurisdiction, Measure, MeasureArgument, MeasureChangeItem, MeasureFiscalItem, MeasureTimelineItem, OfficialResource, QuestionnaireResponse, SearchResponse, Source, SourceDirectoryItem, SourceRecordResponse, TrustBullet, VoteRecordSummary } from "./types/civic.js";
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import process from "node:process";
import { pathToFileURL } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createAdminLoginThrottle } from "./admin-login-throttle.js";
import { createAdminRepository } from "./admin-repository.js";
import {
	demoCandidates,
	demoElection,
	demoJurisdiction,
	demoMeasures,
	demoSources,
	getSourceById
} from "./coverage-data.js";
import { createCoverageRepository } from "./coverage-repository.js";
import { createLogger, createRequestLoggingMiddleware } from "./logger.js";
import { createSourceAssetStore } from "./source-asset-store.js";

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

function buildSourceDirectory(candidates: Candidate[] = demoCandidates, measures: Measure[] = demoMeasures, sources: Source[] = demoSources): SourceDirectoryItem[] {
	const citations = new Map<string, SourceDirectoryItem["citedBy"]>();

	function addCitation(sourceId: string, citation: SourceDirectoryItem["citedBy"][number]) {
		const existing = citations.get(sourceId) ?? [];

		if (!existing.some(item => item.id === citation.id))
			existing.push(citation);

		citations.set(sourceId, existing);
	}

	for (const candidate of candidates) {
		for (const source of collectCandidateSources(candidate)) {
			addCitation(source.id, {
				href: `/candidate/${candidate.slug}`,
				id: candidate.slug,
				label: candidate.name,
				type: "candidate"
			});
		}
	}

	for (const measure of measures) {
		for (const source of collectMeasureSources(measure)) {
			addCitation(source.id, {
				href: `/measure/${measure.slug}`,
				id: measure.slug,
				label: measure.title,
				type: "measure"
			});
		}
	}

	return sources
		.map(source => ({
			...source,
			citationCount: (citations.get(source.id) ?? []).length,
			citedBy: citations.get(source.id) ?? []
		}))
		.filter(source => source.citationCount > 0)
		.sort((left, right) => {
			return right.date.localeCompare(left.date) || left.title.localeCompare(right.title);
		});
}

function buildSourceRecord(
	id: string,
	candidates: Candidate[] = demoCandidates,
	measures: Measure[] = demoMeasures,
	sources: Source[] = demoSources
): SourceRecordResponse | null {
	const source = sources.find(item => item.id === id) ?? getSourceById(id);

	if (!source)
		return null;

	const directoryItem = buildSourceDirectory(candidates, measures, sources).find(item => item.id === id);

	if (!directoryItem)
		return null;

	return {
		source: directoryItem,
		updatedAt: source.date
	};
}

function buildSearchResponse(
	rawQuery: string,
	candidates: Candidate[] = demoCandidates,
	measures: Measure[] = demoMeasures,
	election: Election = demoElection,
	jurisdiction: Jurisdiction = demoJurisdiction,
	sourceDirectory: SourceDirectoryItem[] = buildSourceDirectory(candidates, measures)
): SearchResponse {
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

	const candidateResults = candidates
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

	const measureResults = measures
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

	const electionResults = [election]
		.filter(election => [
			election.name,
			election.locationName,
			election.description
		].join(" ").toLowerCase().includes(lowerQuery))
		.map(election => ({
			href: `/elections/${election.slug}`,
			id: election.slug,
			meta: `${jurisdiction.displayName} · ${election.date}`,
			summary: election.description,
			title: election.name,
			type: "election" as const,
			updatedAt: election.updatedAt
		}));

	const jurisdictionResults = [jurisdiction]
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

	const sourceResults = sourceDirectory
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

export async function createApp(options: CreateAppOptions = {}) {
	const app = express();
	const adminApiKey = options.adminApiKey ?? process.env.ADMIN_API_KEY ?? null;
	const coverageRepository = await createCoverageRepository();
	const adminRepository = await createAdminRepository({
		bootstrapDisplayName: options.bootstrapDisplayName,
		bootstrapPassword: options.bootstrapPassword,
		bootstrapUsername: options.bootstrapUsername,
		dbPath: options.adminDbPath,
		databaseUrl: process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL || null
	});
	const logger = createLogger("ballot-clarity-api");
	const sourceAssetStore = createSourceAssetStore();
	const adminLoginThrottle = createAdminLoginThrottle();
	const resolvedSourceInventory = resolveSources(coverageRepository.data.sources);

	function maxUpdatedAt(...values: Array<string | undefined>) {
		return values
			.filter((value): value is string => Boolean(value))
			.sort((left, right) => right.localeCompare(left))[0];
	}

	function resolveSource(source: Source): Source {
		return {
			...source,
			url: sourceAssetStore.resolve(source.url)
		};
	}

	function resolveSources(sources: Source[]) {
		return sources.map(resolveSource);
	}

	function resolveOfficialResource(resource: OfficialResource): OfficialResource {
		return {
			...resource,
			url: sourceAssetStore.resolve(resource.url)
		};
	}

	function resolveEvidenceBlock(block: EvidenceBlock): EvidenceBlock {
		return {
			...block,
			sources: resolveSources(block.sources)
		};
	}

	function resolveVoteRecord(item: VoteRecordSummary): VoteRecordSummary {
		return {
			...item,
			sources: resolveSources(item.sources)
		};
	}

	function resolveTrustBullet(item: TrustBullet): TrustBullet {
		return {
			...item,
			sources: resolveSources(item.sources)
		};
	}

	function resolveFundingSummary(funding: FundingSummary): FundingSummary {
		return {
			...funding,
			sources: resolveSources(funding.sources)
		};
	}

	function resolveQuestionnaireResponse(item: QuestionnaireResponse): QuestionnaireResponse {
		return {
			...item,
			sources: resolveSources(item.sources)
		};
	}

	function resolveMeasureChangeItem(item: MeasureChangeItem): MeasureChangeItem {
		return {
			...item,
			sources: resolveSources(item.sources)
		};
	}

	function resolveMeasureTimelineItem(item: MeasureTimelineItem): MeasureTimelineItem {
		return {
			...item,
			sources: resolveSources(item.sources)
		};
	}

	function resolveMeasureFiscalItem(item: MeasureFiscalItem): MeasureFiscalItem {
		return {
			...item,
			sources: resolveSources(item.sources)
		};
	}

	function resolveMeasureArgument(item: MeasureArgument): MeasureArgument {
		return {
			...item,
			sources: resolveSources(item.sources)
		};
	}

	function resolveCandidate(candidate: Candidate): Candidate {
		return {
			...candidate,
			biography: candidate.biography.map(resolveEvidenceBlock),
			comparison: {
				...candidate.comparison,
				ballotStatus: {
					...candidate.comparison.ballotStatus,
					sources: resolveSources(candidate.comparison.ballotStatus.sources)
				},
				campaignWebsiteUrl: sourceAssetStore.resolve(candidate.comparison.campaignWebsiteUrl),
				contactChannels: candidate.comparison.contactChannels.map(channel => ({
					...channel,
					url: sourceAssetStore.resolve(channel.url)
				})),
				questionnaireResponses: candidate.comparison.questionnaireResponses.map(resolveQuestionnaireResponse),
				topPriorities: candidate.comparison.topPriorities.map(item => ({
					...item,
					sources: resolveSources(item.sources)
				})),
				whyRunning: {
					...candidate.comparison.whyRunning,
					sources: resolveSources(candidate.comparison.whyRunning.sources)
				}
			},
			funding: resolveFundingSummary(candidate.funding),
			keyActions: candidate.keyActions.map(resolveVoteRecord),
			lobbyingContext: candidate.lobbyingContext.map(resolveEvidenceBlock),
			publicStatements: candidate.publicStatements.map(resolveEvidenceBlock),
			sources: resolveSources(candidate.sources),
			whatWeDoNotKnow: candidate.whatWeDoNotKnow.map(resolveTrustBullet),
			whatWeKnow: candidate.whatWeKnow.map(resolveTrustBullet)
		};
	}

	function resolveMeasure(measure: Measure): Measure {
		return {
			...measure,
			argumentsAndConsiderations: measure.argumentsAndConsiderations.map(resolveEvidenceBlock),
			currentPractice: measure.currentPractice.map(resolveMeasureChangeItem),
			fiscalSummary: measure.fiscalSummary.map(resolveMeasureFiscalItem),
			implementationTimeline: measure.implementationTimeline.map(resolveMeasureTimelineItem),
			opposeArguments: measure.opposeArguments.map(resolveMeasureArgument),
			potentialImpacts: measure.potentialImpacts.map(resolveEvidenceBlock),
			proposedChanges: measure.proposedChanges.map(resolveMeasureChangeItem),
			sources: resolveSources(measure.sources),
			supportArguments: measure.supportArguments.map(resolveMeasureArgument),
			whatWeDoNotKnow: measure.whatWeDoNotKnow.map(resolveTrustBullet),
			whatWeKnow: measure.whatWeKnow.map(resolveTrustBullet)
		};
	}

	function resolveContest(contest: Contest): Contest {
		if (contest.type === "candidate") {
			return {
				...contest,
				candidates: (contest.candidates ?? []).map(resolveCandidate)
			};
		}

		return {
			...contest,
			measures: (contest.measures ?? []).map(resolveMeasure)
		};
	}

	function resolveElection(election: Election): Election {
		return {
			...election,
			contests: election.contests.map(resolveContest),
			officialResources: election.officialResources.map(resolveOfficialResource)
		};
	}

	async function getContentIndex() {
		const content = await adminRepository.listContent();

		return new Map(content.items.map(item => [`${item.entityType}:${item.entitySlug}`, item] as const));
	}

	function applyCandidateContent(candidate: Candidate, contentIndex: Map<string, Awaited<ReturnType<typeof adminRepository.listContent>>["items"][number]>): Candidate | null {
		const content = contentIndex.get(`candidate:${candidate.slug}`);

		if (content && !content.published)
			return null;

		const resolvedCandidate = resolveCandidate(candidate);

		return {
			...resolvedCandidate,
			ballotSummary: content?.publicBallotSummary?.trim() || resolvedCandidate.ballotSummary,
			summary: content?.publicSummary?.trim() || resolvedCandidate.summary,
			updatedAt: maxUpdatedAt(content?.updatedAt, resolvedCandidate.updatedAt) || resolvedCandidate.updatedAt
		};
	}

	function applyMeasureContent(measure: Measure, contentIndex: Map<string, Awaited<ReturnType<typeof adminRepository.listContent>>["items"][number]>): Measure | null {
		const content = contentIndex.get(`measure:${measure.slug}`);

		if (content && !content.published)
			return null;

		const resolvedMeasure = resolveMeasure(measure);

		return {
			...resolvedMeasure,
			ballotSummary: content?.publicBallotSummary?.trim() || resolvedMeasure.ballotSummary,
			summary: content?.publicSummary?.trim() || resolvedMeasure.summary,
			updatedAt: maxUpdatedAt(content?.updatedAt, resolvedMeasure.updatedAt) || resolvedMeasure.updatedAt
		};
	}

	function applyContestContent(contest: Contest, contentIndex: Map<string, Awaited<ReturnType<typeof adminRepository.listContent>>["items"][number]>): Contest | null {
		if (contest.type === "candidate") {
			const candidates = (contest.candidates ?? [])
				.map(candidate => applyCandidateContent(candidate, contentIndex))
				.filter((candidate): candidate is Candidate => Boolean(candidate));

			if (!candidates.length)
				return null;

			return {
				...contest,
				candidates
			};
		}

		const measures = (contest.measures ?? [])
			.map(measure => applyMeasureContent(measure, contentIndex))
			.filter((measure): measure is Measure => Boolean(measure));

		if (!measures.length)
			return null;

		return {
			...contest,
			measures
		};
	}

	function applyElectionContent(election: Election, contentIndex: Map<string, Awaited<ReturnType<typeof adminRepository.listContent>>["items"][number]>): Election | null {
		const content = contentIndex.get(`election:${election.slug}`);

		if (content && !content.published)
			return null;

		const resolvedElection = resolveElection(election);
		const contests = resolvedElection.contests
			.map(contest => applyContestContent(contest, contentIndex))
			.filter((contest): contest is Contest => Boolean(contest));

		return {
			...resolvedElection,
			contests,
			description: content?.publicSummary?.trim() || resolvedElection.description,
			updatedAt: maxUpdatedAt(content?.updatedAt, resolvedElection.updatedAt) || resolvedElection.updatedAt
		};
	}

	async function listPublicCandidates() {
		const contentIndex = await getContentIndex();

		return coverageRepository.data.candidates
			.map(candidate => applyCandidateContent(candidate, contentIndex))
			.filter((candidate): candidate is Candidate => Boolean(candidate));
	}

	async function listPublicMeasures() {
		const contentIndex = await getContentIndex();

		return coverageRepository.data.measures
			.map(measure => applyMeasureContent(measure, contentIndex))
			.filter((measure): measure is Measure => Boolean(measure));
	}

	async function getPublicCandidate(slug: string) {
		const candidate = coverageRepository.getCandidateBySlug(slug);
		const contentIndex = await getContentIndex();
		return candidate ? applyCandidateContent(candidate, contentIndex) : null;
	}

	async function getPublicMeasure(slug: string) {
		const measure = coverageRepository.getMeasureBySlug(slug);
		const contentIndex = await getContentIndex();
		return measure ? applyMeasureContent(measure, contentIndex) : null;
	}

	async function getPublicCandidatesBySlugs(slugs: string[]) {
		const contentIndex = await getContentIndex();

		return coverageRepository.getCandidatesBySlugs(slugs)
			.map(candidate => applyCandidateContent(candidate, contentIndex))
			.filter((candidate): candidate is Candidate => Boolean(candidate));
	}

	async function getPublicElection(slug: string) {
		const election = coverageRepository.getElectionBySlug(slug);
		const contentIndex = await getContentIndex();
		return election ? applyElectionContent(election, contentIndex) : null;
	}

	async function getPublicElectionSummaries() {
		const contentIndex = await getContentIndex();
		return coverageRepository.data.electionSummaries.filter((summary) => {
			const election = coverageRepository.getElectionBySlug(summary.slug);
			return Boolean(election && applyElectionContent(election, contentIndex));
		});
	}

	function applyJurisdictionAssets(jurisdiction: Jurisdiction): Jurisdiction {
		return {
			...jurisdiction,
			archivedGuides: jurisdiction.archivedGuides.map(guide => ({
				...guide,
				href: sourceAssetStore.resolve(guide.href)
			})),
			officialOffice: {
				...jurisdiction.officialOffice,
				website: sourceAssetStore.resolve(jurisdiction.officialOffice.website)
			},
			officialResources: jurisdiction.officialResources.map(resolveOfficialResource),
			votingMethods: jurisdiction.votingMethods.map(method => ({
				...method,
				officialResource: method.officialResource ? resolveOfficialResource(method.officialResource) : undefined
			}))
		};
	}

	if (process.env.TRUST_PROXY === "true")
		app.set("trust proxy", true);

	app.use(cors({
		origin: true
	}));

	app.use(express.json());
	app.use(createRequestLoggingMiddleware(logger));
	logger.info("coverage.loaded", {
		assetMode: sourceAssetStore.mode,
		coverageMode: coverageRepository.mode,
		coverageUpdatedAt: coverageRepository.data.updatedAt,
		snapshotPath: coverageRepository.mode === "snapshot" ? coverageRepository.snapshotPath : undefined
	});

	app.get("/health", async (_request, response) => {
		try {
			await adminRepository.getHealth();
			response.json({
				assetMode: sourceAssetStore.mode,
				coverageMode: coverageRepository.mode,
				coverageUpdatedAt: coverageRepository.data.updatedAt,
				driver: adminRepository.driver,
				ok: true,
				ready: true,
				timestamp: new Date().toISOString()
			});
		}
		catch (error) {
			response.status(503).json({
				assetMode: sourceAssetStore.mode,
				coverageMode: coverageRepository.mode,
				driver: adminRepository.driver,
				message: error instanceof Error ? error.message : "Admin repository health check failed.",
				ok: false,
				ready: false,
				timestamp: new Date().toISOString()
			});
		}
	});

	app.post("/api/admin/auth/login", async (request, response) => {
		const username = typeof request.body?.username === "string" ? request.body.username : "";
		const password = typeof request.body?.password === "string" ? request.body.password : "";
		const throttleState = adminLoginThrottle.check(username, request.header("x-forwarded-for") || request.ip || "");

		if (!await adminRepository.hasUsers()) {
			response.status(503).json({
				message: "No admin users are configured yet. Set bootstrap credentials or create the first admin account."
			});
			return;
		}

		if (!throttleState.allowed) {
			logger.warn("admin.login.throttled", {
				ip: request.header("x-forwarded-for") || request.ip || "",
				requestId: response.locals.requestId,
				retryAfterSeconds: throttleState.retryAfterSeconds,
				username
			});
			response.setHeader("Retry-After", String(throttleState.retryAfterSeconds));
			response.status(429).json({
				message: "Too many failed admin login attempts. Try again later.",
				retryAfterSeconds: throttleState.retryAfterSeconds
			});
			return;
		}

		const user = await adminRepository.authenticateUser(username, password);

		if (!user) {
			adminLoginThrottle.recordFailure(throttleState.key);
			logger.warn("admin.login.failed", {
				ip: request.header("x-forwarded-for") || request.ip || "",
				requestId: response.locals.requestId,
				username
			});
			response.status(401).json({
				message: "Invalid admin credentials."
			});
			return;
		}

		adminLoginThrottle.clear(throttleState.key);
		logger.info("admin.login.succeeded", {
			requestId: response.locals.requestId,
			role: user.role,
			username: user.username
		});

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
			electionSlug: coverageRepository.data.election.slug,
			location: coverageRepository.data.location,
			note: coverageRepository.mode === "snapshot"
				? "This lookup is returning the latest imported coverage snapshot for the configured jurisdiction."
				: "The current launch returns Metro County coverage from the current release while live district integrations are being connected."
		});
	});

	app.post("/api/feedback", async (request, response) => {
		try {
			const result = await adminRepository.createCorrectionSubmission({
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

	app.get("/api/elections", async (_request, response) => {
		response.json({
			elections: await getPublicElectionSummaries()
		});
	});

	app.get("/api/jurisdictions", (_request, response) => {
		response.json({
			jurisdictions: coverageRepository.data.jurisdictionSummaries
		});
	});

	app.get("/api/data-sources", (_request, response) => {
		response.json({
			...coverageRepository.data.dataSources,
			assetMode: sourceAssetStore.mode,
			coverageMode: coverageRepository.mode,
			sourceAssetBaseUrl: sourceAssetStore.baseUrl
		});
	});

	app.get("/api/search", async (request, response) => {
		const query = typeof request.query.q === "string" ? request.query.q : "";
		const election = await getPublicElection(coverageRepository.data.election.slug);
		const candidates = await listPublicCandidates();
		const measures = await listPublicMeasures();
		const sourceDirectory = buildSourceDirectory(candidates, measures, resolvedSourceInventory);

		if (!election) {
			response.json({
				groups: [],
				query: query.trim(),
				suggestions: [
					"Metro County",
					"U.S. House District 7",
					"Charter Amendment A",
					"Sandra Patel",
					"Transit bond"
				],
				total: 0
			});
			return;
		}

		response.json(buildSearchResponse(query, candidates, measures, election, coverageRepository.data.jurisdiction, sourceDirectory));
	});

	app.get("/api/sources", async (_request, response) => {
		const candidates = await listPublicCandidates();
		const measures = await listPublicMeasures();

		response.json({
			sources: buildSourceDirectory(candidates, measures, resolvedSourceInventory),
			updatedAt: coverageRepository.data.updatedAt
		});
	});

	app.get("/api/sources/:id", async (request, response) => {
		const record = buildSourceRecord(request.params.id, await listPublicCandidates(), await listPublicMeasures(), resolvedSourceInventory);

		if (!record) {
			response.status(404).json({
				message: "Source record not found."
			});
			return;
		}

		response.json(record);
	});

	app.get("/api/jurisdictions/:slug", (request, response) => {
		const jurisdiction = coverageRepository.getJurisdictionBySlug(request.params.slug);

		if (!jurisdiction) {
			response.status(404).json({
				message: "Jurisdiction not found."
			});
			return;
		}

		response.json(applyJurisdictionAssets(jurisdiction));
	});

	app.get("/api/ballot", async (request, response) => {
		const electionSlug = typeof request.query.election === "string" ? request.query.election : "";
		const defaultLocation = coverageRepository.data.location;
		const locationSlug = typeof request.query.location === "string" ? request.query.location : defaultLocation.slug;

		if (!electionSlug) {
			response.status(400).json({
				message: "Election slug is required."
			});
			return;
		}

		const election = await getPublicElection(electionSlug);

		if (!election) {
			response.status(404).json({
				message: "Ballot not found for the requested election."
			});
			return;
		}

		response.json({
			election,
			location: {
				...defaultLocation,
				slug: locationSlug
			},
			note: coverageRepository.mode === "snapshot"
				? "Current public coverage is running from the latest imported civic-data snapshot. Verify official election logistics with the linked election office."
				: "Current public coverage uses the current release while live civic-data integrations are being connected. Verify official election logistics with the linked election office.",
			updatedAt: election.updatedAt
		});
	});

	app.get("/api/candidates/:slug", async (request, response) => {
		const candidate = await getPublicCandidate(request.params.slug);

		if (!candidate) {
			response.status(404).json({
				message: "Candidate not found."
			});
			return;
		}

		response.json(candidate);
	});

	app.get("/api/measures/:slug", async (request, response) => {
		const measure = await getPublicMeasure(request.params.slug);

		if (!measure) {
			response.status(404).json({
				message: "Measure not found."
			});
			return;
		}

		response.json(measure);
	});

	app.get("/api/compare", async (request, response) => {
		const raw = typeof request.query.slugs === "string" ? request.query.slugs : "";
		const requestedSlugs = raw.split(",").map(item => item.trim()).filter(Boolean).slice(0, 3);
		const candidates = await getPublicCandidatesBySlugs(requestedSlugs);
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

	app.get("/api/admin/overview", async (_request, response) => {
		response.json(await adminRepository.getOverview());
	});

	app.get("/api/admin/corrections", async (_request, response) => {
		response.json(await adminRepository.listCorrections());
	});

	app.patch("/api/admin/corrections/:id", async (request, response) => {
		try {
			response.json(await adminRepository.updateCorrection(request.params.id, {
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

	app.get("/api/admin/review", async (_request, response) => {
		response.json(await adminRepository.listReview());
	});

	app.get("/api/admin/content", async (_request, response) => {
		response.json(await adminRepository.listContent());
	});

	app.patch("/api/admin/content/:id", async (request, response) => {
		try {
			response.json(await adminRepository.updateContent(request.params.id, {
				assignedTo: typeof request.body?.assignedTo === "string" ? request.body.assignedTo : undefined,
				blocker: request.body?.blocker === null
					? null
					: typeof request.body?.blocker === "string"
						? request.body.blocker
						: undefined,
				priority: request.body?.priority,
				publicBallotSummary: request.body?.publicBallotSummary === null
					? null
					: typeof request.body?.publicBallotSummary === "string"
						? request.body.publicBallotSummary
						: undefined,
				publicSummary: typeof request.body?.publicSummary === "string" ? request.body.publicSummary : undefined,
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

	app.get("/api/admin/sources", async (_request, response) => {
		response.json(await adminRepository.listSourceMonitor());
	});

	app.patch("/api/admin/sources/:id", async (request, response) => {
		try {
			response.json(await adminRepository.updateSource(request.params.id, {
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

	app.get("/api/admin/users", async (_request, response) => {
		response.json(await adminRepository.listUsers());
	});

	app.post("/api/admin/users", async (request, response) => {
		try {
			await adminRepository.createUser({
				displayName: typeof request.body?.displayName === "string" ? request.body.displayName : "",
				password: typeof request.body?.password === "string" ? request.body.password : "",
				role: request.body?.role === "editor" ? "editor" : "admin",
				username: typeof request.body?.username === "string" ? request.body.username : ""
			});

			response.status(201).json(await adminRepository.listUsers());
		}
		catch (error) {
			response.status(400).json({
				message: error instanceof Error ? error.message : "Unable to create admin user."
			});
		}
	});

	const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
		logger.error("request.failed", {
			error: error instanceof Error ? error.message : "Unhandled request error.",
			method: request.method,
			path: request.originalUrl,
			requestId: response.locals.requestId,
			stack: error instanceof Error ? error.stack : undefined
		});

		if (response.headersSent)
			return;

		response.status(500).json({
			message: "Internal server error.",
			requestId: response.locals.requestId
		});
	};

	app.use(errorHandler);

	return app;
}

export async function startServer(port = Number(process.env.PORT || 3001)) {
	const app = await createApp();
	const server = app.listen(port, () => {
		console.log(`Ballot Clarity API listening on http://127.0.0.1:${port}`);
	});

	return { app, port, server };
}

function isDirectExecution(metaUrl: string) {
	return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === metaUrl;
}

if (isDirectExecution(import.meta.url))
	void startServer();
