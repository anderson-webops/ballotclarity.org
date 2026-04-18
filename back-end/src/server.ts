import type { ErrorRequestHandler } from "express";
import type { AddressEnrichmentService } from "./address-enrichment.js";
import type { CoverageRepository } from "./coverage-repository.js";
import type {
	AdminActivityItem,
	AdminContentItem,
	AdminCorrectionRequest,
	AdminSourceMonitorItem,
	Candidate,
	Contest,
	ContestLinkSummary,
	ContestRecordResponse,
	CoverageResponse,
	DistrictRecordResponse,
	DistrictsResponse,
	Election,
	EvidenceBlock,
	FundingSummary,
	Jurisdiction,
	JurisdictionSummary,
	LocationLookupSelectionOption,
	Measure,
	MeasureArgument,
	MeasureChangeItem,
	MeasureFiscalItem,
	MeasureTimelineItem,
	OfficialResource,
	PersonProfileResponse,
	PublicCorrectionsResponse,
	PublicStatusResponse,
	QuestionnaireResponse,
	RepresentativesResponse,
	RepresentativeSummary,
	SearchResponse,
	Source,
	SourceDirectoryItem,
	SourceRecordResponse,
	TrustBullet,
	VoteRecordSummary
} from "./types/civic.js";
import type { ZipLocationMatch, ZipLocationService } from "./zip-location.js";
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import process from "node:process";
import { pathToFileURL } from "node:url";
import cors from "cors";
import express from "express";
import { createAddressCacheRepository } from "./address-cache-repository.js";
import { createAddressEnrichmentService } from "./address-enrichment.js";
import { createAdminLoginThrottle } from "./admin-login-throttle.js";
import { createAdminRepository } from "./admin-repository.js";
import { createCensusGeocoderClient } from "./census-geocoder.js";
import { createCoverageRepository } from "./coverage-repository.js";
import { createGoogleCivicClient } from "./google-civic.js";
import { buildCoverageResponse } from "./launch-profile.js";
import { buildLocationGuessNotePrefix, createLocationGuessService } from "./location-guess.js";
import { buildLocationLookupResponse, classifyLookupInput, findSupportedCoverageSummaries, validateLookupInput } from "./location-lookup.js";
import { createLogger, createRequestLoggingMiddleware } from "./logger.js";
import { createOpenStatesClient } from "./openstates.js";
import { buildProviderSummary } from "./provider-config.js";
import { createSourceAssetStore } from "./source-asset-store.js";
import { createZipLocationService } from "./zip-location.js";

interface CreateAppOptions {
	adminApiKey?: string | null;
	adminDbPath?: string | null;
	addressEnrichmentService?: AddressEnrichmentService | null;
	bootstrapDisplayName?: string | null;
	bootstrapPassword?: string | null;
	bootstrapUsername?: string | null;
	coverageRepository?: CoverageRepository;
	contentSeed?: AdminContentItem[];
	correctionSeed?: AdminCorrectionRequest[];
	activitySeed?: AdminActivityItem[];
	googleCivicClient?: ReturnType<typeof createGoogleCivicClient>;
	locationGuessOptions?: Parameters<typeof createLocationGuessService>[0];
	sourceMonitorSeed?: AdminSourceMonitorItem[];
	zipLocationService?: ZipLocationService | null;
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

function summarizeMatchedDistricts(labels: string[]) {
	if (!labels.length)
		return "District matches will load after you choose this area.";

	if (labels.length === 1)
		return `Matched district: ${labels[0]}.`;

	return `Matched districts: ${labels.join(", ")}.`;
}

function buildZipSelectionOption(
	match: ZipLocationMatch,
	jurisdictionSummaries: JurisdictionSummary[]
): LocationLookupSelectionOption {
	const geoContext = {
		countyFips: match.countyFips,
		countyName: match.countyName,
		locality: match.locality,
		postalCode: match.postalCode,
		sourceSystem: match.sourceSystem,
		stateAbbreviation: match.stateAbbreviation,
		stateName: match.stateName
	};
	const supportedCoverageSummaries = findSupportedCoverageSummaries(jurisdictionSummaries, geoContext);
	const representativeCount = match.representativeMatches.length;
	const displayName = [match.locality, match.stateName || match.stateAbbreviation].filter(Boolean).join(", ")
		|| match.postalCode;
	const guideSentence = supportedCoverageSummaries.length
		? supportedCoverageSummaries.length === 1
			? "A published local guide is available after you choose this area."
			: `${supportedCoverageSummaries.length} published local guide areas still match this ZIP area.`
		: "No published local guide is available for this area yet.";

	return {
		description: [
			summarizeMatchedDistricts(match.districtMatches.map(item => item.label)),
			representativeCount
				? `${representativeCount} representative match${representativeCount === 1 ? "" : "es"} will load for this area.`
				: "Representative data is not available for this area yet.",
			guideSentence
		].join(" "),
		districtMatches: match.districtMatches,
		guideAvailability: supportedCoverageSummaries.length ? "published" : "not-published",
		id: match.id,
		label: displayName,
		representativeMatches: match.representativeMatches
	};
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

function collectContestSources(contest: Contest) {
	if (contest.type === "candidate")
		return uniqueSources((contest.candidates ?? []).flatMap(candidate => collectCandidateSources(candidate)));

	return uniqueSources((contest.measures ?? []).flatMap(measure => collectMeasureSources(measure)));
}

function buildSourceDirectory(
	candidates: Candidate[],
	measures: Measure[],
	contests: Contest[],
	sources: Source[]
): SourceDirectoryItem[] {
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

	for (const contest of contests) {
		for (const source of collectContestSources(contest)) {
			addCitation(source.id, {
				href: `/contest/${contest.slug}`,
				id: contest.slug,
				label: contest.office,
				type: "contest"
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
	candidates: Candidate[],
	measures: Measure[],
	contests: Contest[],
	sources: Source[]
): SourceRecordResponse | null {
	const source = sources.find(item => item.id === id);

	if (!source)
		return null;

	const directoryItem = buildSourceDirectory(candidates, measures, contests, sources).find(item => item.id === id);

	if (!directoryItem)
		return null;

	return {
		source: directoryItem,
		updatedAt: source.date
	};
}

function buildRepresentativeSummary(candidate: Candidate): RepresentativeSummary {
	return {
		location: candidate.location,
		districtLabel: candidate.officeSought,
		districtSlug: candidate.contestSlug,
		fundingSummary: candidate.funding.summary,
		href: `/candidate/${candidate.slug}`,
		officeholderLabel: candidate.incumbent ? "Current officeholder" : "Incumbent contender",
		influenceSummary: candidate.lobbyingContext[0]?.summary ?? "No published influence-context note is attached to this profile yet.",
		incumbent: candidate.incumbent,
		onCurrentBallot: true,
		name: candidate.name,
		officeSought: candidate.officeSought,
		party: candidate.party,
		slug: candidate.slug,
		ballotStatusLabel: candidate.comparison.ballotStatus.label,
		provenance: {
			label: "Published guide coverage",
			status: "direct",
			note: "Matched from the active published guide context for this district."
		},
		sourceCount: collectCandidateSources(candidate).length,
		summary: candidate.summary,
		updatedAt: candidate.updatedAt
	};
}

function _buildPersonProfileFromCandidate(candidate: Candidate): PersonProfileResponse {
	const funding: PersonProfileResponse["person"]["funding"] = candidate.funding
		? {
				...candidate.funding,
				provenanceLabel: "Published guide filing summary"
			}
		: null;

	return {
		note: "Representative profile assembled from active guide layer candidate data.",
		person: {
			ballotStatusLabel: candidate.comparison.ballotStatus.label,
			contestSlug: candidate.contestSlug,
			comparison: candidate.comparison,
			districtLabel: candidate.officeSought,
			districtSlug: candidate.contestSlug,
			funding,
			keyActions: candidate.keyActions,
			lobbyingContext: candidate.lobbyingContext,
			methodologyNotes: candidate.methodologyNotes,
			name: candidate.name,
			officeSought: candidate.officeSought,
			officeholderLabel: candidate.incumbent ? "Current officeholder" : "Candidate",
			onCurrentBallot: true,
			openstatesUrl: undefined,
			party: candidate.party,
			provenance: {
				asOf: candidate.updatedAt,
				label: "Published local guide",
				note: "Derived from the active published election layer.",
				source: "guide",
				status: "direct"
			},
			publicStatements: candidate.publicStatements,
			whatWeKnow: candidate.whatWeKnow,
			whatWeDoNotKnow: candidate.whatWeDoNotKnow,
			topIssues: candidate.topIssues,
			biography: candidate.biography,
			incumbent: candidate.incumbent,
			location: candidate.location,
			slug: candidate.slug,
			sources: candidate.sources,
			summary: candidate.summary,
			sourceCount: candidate.sources.length,
			updatedAt: candidate.updatedAt,
			freshness: candidate.freshness
		},
		updatedAt: candidate.updatedAt
	};
}

function buildDistrictSummary(contest: Contest, election: Election) {
	return {
		candidateCount: contest.candidates?.length ?? 0,
		href: `/districts/${contest.slug}`,
		jurisdiction: contest.jurisdiction,
		office: contest.office,
		representativeCount: (contest.candidates ?? []).filter(candidate => candidate.incumbent).length,
		slug: contest.slug,
		summary: contest.description,
		title: contest.office,
		updatedAt: election.updatedAt
	};
}

function buildSearchResponse(
	rawQuery: string,
	candidates: Candidate[],
	measures: Measure[],
	contests: Contest[],
	election: Election | null,
	jurisdiction: Jurisdiction | null,
	sourceDirectory: SourceDirectoryItem[],
	districts: ReturnType<typeof buildDistrictSummary>[]
): SearchResponse {
	const query = rawQuery.trim();
	const lowerQuery = query.toLowerCase();
	const suggestions = [
		"official election office",
		"district page",
		"representatives",
		"campaign finance",
		"source directory",
		"contest page"
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

	const contestResults = contests
		.filter(contest => [
			contest.title,
			contest.office,
			contest.description,
			contest.roleGuide.summary,
			contest.roleGuide.whyItMatters,
			contest.type === "candidate"
				? (contest.candidates ?? []).map(candidate => candidate.name).join(" ")
				: (contest.measures ?? []).map(measure => measure.title).join(" ")
		].join(" ").toLowerCase().includes(lowerQuery))
		.map(contest => ({
			href: `/contest/${contest.slug}`,
			id: contest.slug,
			meta: `${contest.jurisdiction} · ${contest.type === "candidate" ? `${contest.candidates?.length ?? 0} candidate${contest.candidates?.length === 1 ? "" : "s"}` : `${contest.measures?.length ?? 0} measure${contest.measures?.length === 1 ? "" : "s"}`}`,
			sourceCount: collectContestSources(contest).length,
			summary: contest.description,
			title: contest.office,
			type: "contest" as const,
			updatedAt: election?.updatedAt ?? ""
		}));

	const districtResults = districts
		.filter(district => [
			district.title,
			district.office,
			district.summary
		].join(" ").toLowerCase().includes(lowerQuery))
		.map(district => ({
			href: district.href,
			id: district.slug,
			meta: `${district.jurisdiction} · ${district.candidateCount} candidate${district.candidateCount === 1 ? "" : "s"}`,
			summary: district.summary,
			title: district.title,
			type: "district" as const,
			updatedAt: district.updatedAt
		}));

	const electionResults = [election]
		.filter((item): item is Election => Boolean(item))
		.filter(election => [
			election.name,
			election.locationName,
			election.description
		].join(" ").toLowerCase().includes(lowerQuery))
		.map(election => ({
			href: `/elections/${election.slug}`,
			id: election.slug,
			meta: `${jurisdiction?.displayName ?? election.locationName} · ${election.date}`,
			summary: election.description,
			title: election.name,
			type: "election" as const,
			updatedAt: election.updatedAt
		}));

	const jurisdictionResults = [jurisdiction]
		.filter((item): item is Jurisdiction => Boolean(item))
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
		{ items: districtResults, label: "Districts", type: "district" as const },
		{ items: contestResults, label: "Contests", type: "contest" as const },
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
	const coverageRepository = options.coverageRepository ?? await createCoverageRepository();
	const adminRepository = await createAdminRepository({
		activitySeed: options.activitySeed,
		bootstrapDisplayName: options.bootstrapDisplayName,
		bootstrapPassword: options.bootstrapPassword,
		bootstrapUsername: options.bootstrapUsername,
		contentSeed: options.contentSeed,
		correctionSeed: options.correctionSeed,
		dbPath: options.adminDbPath,
		databaseUrl: process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL || null,
		sourceMonitorSeed: options.sourceMonitorSeed
	});
	const logger = createLogger("ballot-clarity-api");
	const sourceAssetStore = createSourceAssetStore();
	const locationGuessService = createLocationGuessService(options.locationGuessOptions);
	const adminLoginThrottle = createAdminLoginThrottle();
	const googleCivicClient = options.googleCivicClient === undefined ? createGoogleCivicClient() : options.googleCivicClient;
	const openStatesClient = createOpenStatesClient();
	const zipLocationService = options.zipLocationService === undefined
		? createZipLocationService({ openStatesClient })
		: options.zipLocationService;
	const addressEnrichmentService = options.addressEnrichmentService === undefined
		? createAddressEnrichmentService(
				createCensusGeocoderClient(),
				openStatesClient,
				await createAddressCacheRepository(process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL || "")
			)
		: options.addressEnrichmentService;
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

	function getPrimaryElectionSlug() {
		return coverageRepository.data.election?.slug ?? null;
	}

	function getJurisdictionSummary(slug: string | null | undefined) {
		if (!slug)
			return coverageRepository.data.jurisdictionSummaries[0] ?? null;

		return coverageRepository.data.jurisdictionSummaries.find(item => item.slug === slug)
			?? coverageRepository.data.jurisdictionSummaries[0]
			?? null;
	}

	function buildFallbackJurisdictionSummary(election: Election): JurisdictionSummary {
		return {
			description: "Published jurisdiction details are not available for this election in the current snapshot.",
			displayName: election.locationName,
			jurisdictionType: "local",
			name: election.locationName,
			nextElectionName: election.name,
			nextElectionSlug: election.slug,
			slug: election.jurisdictionSlug,
			state: coverageRepository.data.location?.state ?? "",
			updatedAt: election.updatedAt
		};
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

	async function listPublicContests() {
		const primaryElectionSlug = getPrimaryElectionSlug();

		if (!primaryElectionSlug)
			return [];

		const election = await getPublicElection(primaryElectionSlug);
		return election?.contests ?? [];
	}

	async function listPublicDistricts() {
		const primaryElectionSlug = getPrimaryElectionSlug();

		if (!primaryElectionSlug)
			return [];

		const election = await getPublicElection(primaryElectionSlug);

		if (!election)
			return [];

		return election.contests
			.filter(contest => contest.type === "candidate")
			.map(contest => buildDistrictSummary(contest, election));
	}

	async function getPublicDistrict(slug: string) {
		const primaryElectionSlug = getPrimaryElectionSlug();

		if (!primaryElectionSlug)
			return null;

		const election = await getPublicElection(primaryElectionSlug);

		if (!election)
			return null;

		const contest = election.contests.find(item => item.slug === slug && item.type === "candidate");

		if (!contest)
			return null;

		return {
			contest,
			election
		};
	}

	async function getPublicContest(slug: string) {
		const primaryElectionSlug = getPrimaryElectionSlug();

		if (!primaryElectionSlug)
			return null;

		const election = await getPublicElection(primaryElectionSlug);

		if (!election)
			return null;

		const contest = election.contests.find(item => item.slug === slug);

		if (!contest)
			return null;

		return {
			contest,
			election
		};
	}

	async function listPublicRepresentatives() {
		const primaryElectionSlug = getPrimaryElectionSlug();

		if (!primaryElectionSlug)
			return [];

		const election = await getPublicElection(primaryElectionSlug);

		if (!election)
			return [];

		return election.contests
			.filter(contest => contest.type === "candidate")
			.flatMap(contest => (contest.candidates ?? [])
				.filter(candidate => candidate.incumbent)
				.map(candidate => ({
					...buildRepresentativeSummary(candidate),
					districtLabel: contest.office
				})));
	}

	function buildContestRecordResponse(contest: Contest, election: Election): ContestRecordResponse {
		const sources = collectContestSources(contest).map(resolveSource);
		const jurisdictionSummary = getJurisdictionSummary(election.jurisdictionSlug) ?? buildFallbackJurisdictionSummary(election);
		const relatedContests: ContestLinkSummary[] = election.contests
			.filter(item => item.slug !== contest.slug)
			.map(item => ({
				href: `/contest/${item.slug}`,
				jurisdiction: item.jurisdiction,
				office: item.office,
				slug: item.slug,
				title: item.title,
				type: item.type
			}));

		return {
			contest,
			election: {
				date: election.date,
				jurisdictionSlug: election.jurisdictionSlug,
				locationName: election.locationName,
				name: election.name,
				slug: election.slug,
				updatedAt: election.updatedAt
			},
			jurisdiction: jurisdictionSummary,
			note: "Contest pages are the canonical public reading surface for one office or ballot question. Use them for citations and source review, then return to the ballot guide for the full ballot context.",
			relatedContests,
			sourceCount: sources.length,
			sources,
			updatedAt: election.updatedAt
		};
	}

	function buildDistrictRecordResponse(contest: Contest, election: Election): DistrictRecordResponse {
		const sources = collectContestSources(contest).map(resolveSource);
		const representatives = (contest.candidates ?? [])
			.filter(candidate => candidate.incumbent)
			.map(candidate => ({
				...buildRepresentativeSummary(candidate),
				districtLabel: contest.office
			}));
		const relatedContests: ContestLinkSummary[] = election.contests
			.filter(item => item.slug !== contest.slug)
			.map(item => ({
				href: `/contest/${item.slug}`,
				jurisdiction: item.jurisdiction,
				office: item.office,
				slug: item.slug,
				title: item.title,
				type: item.type
			}));

		return {
			candidates: contest.candidates ?? [],
			district: {
				...buildDistrictSummary(contest, election),
				description: contest.description,
				electionSlug: election.slug,
				roleGuide: contest.roleGuide
			},
			election: {
				date: election.date,
				jurisdictionSlug: election.jurisdictionSlug,
				locationName: election.locationName,
				name: election.name,
				slug: election.slug,
				updatedAt: election.updatedAt
			},
			note: "District pages group the current representative, the upcoming contest, and the strongest available source links for one office area. Use them when you want district context without the full ballot stack.",
			relatedContests,
			representatives,
			sources,
			updatedAt: election.updatedAt
		};
	}

	function buildDistrictsResponse(districts: Awaited<ReturnType<typeof listPublicDistricts>>): DistrictsResponse {
		return {
			districts,
			note: "District pages separate office-area context from the full ballot guide so voters can orient around one race at a time.",
			updatedAt: districts.map(district => district.updatedAt).sort((left, right) => right.localeCompare(left))[0] ?? coverageRepository.data.updatedAt
		};
	}

	function buildRepresentativesResponse(
		representatives: Awaited<ReturnType<typeof listPublicRepresentatives>>,
		districts: Awaited<ReturnType<typeof listPublicDistricts>>
	): RepresentativesResponse {
		return {
			districts,
			note: "This directory highlights currently serving officials who also appear on the active ballot coverage, then links back to district, funding, and influence pages for deeper review.",
			representatives,
			updatedAt: representatives.map(item => item.updatedAt).sort((left, right) => right.localeCompare(left))[0] ?? coverageRepository.data.updatedAt
		};
	}

	function buildPublicCorrectionsResponse(corrections: Awaited<ReturnType<typeof adminRepository.listCorrections>>["corrections"]): PublicCorrectionsResponse {
		const pageLookup = new Map<string, string>();

		for (const candidate of coverageRepository.data.candidates)
			pageLookup.set(`candidate:${candidate.name}`, `/candidate/${candidate.slug}`);

		for (const measure of coverageRepository.data.measures)
			pageLookup.set(`measure:${measure.title}`, `/measure/${measure.slug}`);

		pageLookup.set("policy:Privacy Policy", "/privacy");
		pageLookup.set("policy:Terms of Service", "/terms");
		pageLookup.set("policy:Methodology", "/methodology");
		pageLookup.set("policy:Neutrality policy", "/neutrality");

		return {
			corrections: corrections.map(item => ({
				entityLabel: item.entityLabel,
				entityType: item.entityType,
				id: item.id,
				outcome: item.nextStep,
				pageLabel: item.entityLabel,
				pageUrl: item.pageUrl || pageLookup.get(`${item.entityType}:${item.entityLabel}`),
				priority: item.priority,
				status: item.status,
				subject: item.subject,
				submittedAt: item.submittedAt,
				summary: item.summary
			})),
			updatedAt: corrections
				.map(item => item.submittedAt)
				.sort((left, right) => right.localeCompare(left))[0] ?? coverageRepository.data.updatedAt
		};
	}

	function buildPublicStatusResponse(
		sources: Awaited<ReturnType<typeof adminRepository.listSourceMonitor>>["sources"],
		overview: Awaited<ReturnType<typeof adminRepository.getOverview>>
	): PublicStatusResponse {
		if (coverageRepository.mode === "empty") {
			return {
				coverageMode: coverageRepository.mode,
				coverageUpdatedAt: coverageRepository.data.updatedAt,
				incidents: [],
				notes: [
					"No published local coverage snapshot is active right now.",
					"Nationwide civic lookup is available across the public site.",
					"Local guide publication status remains generic until a verified local snapshot is published."
				],
				overallStatus: "reviewing",
				sourceSummary: {
					"healthy": 0,
					"incident": 0,
					"review-soon": 0,
					"stale": 0
				},
				sources: [],
				updatedAt: new Date().toISOString()
			};
		}

		const sourceSummary = {
			"healthy": sources.filter(source => source.health === "healthy").length,
			"incident": sources.filter(source => source.health === "incident").length,
			"review-soon": sources.filter(source => source.health === "review-soon").length,
			"stale": sources.filter(source => source.health === "stale").length
		};
		let overallStatus: PublicStatusResponse["overallStatus"] = "healthy";

		if (sourceSummary.incident)
			overallStatus = "degraded";
		else if (sourceSummary["review-soon"] || sourceSummary.stale)
			overallStatus = "reviewing";
		const nextPublishWindow = overview.metrics.find(metric => metric.id === "next-publish")?.value;
		const notes = [
			...overview.needsAttention,
			"Public pages are serving an imported coverage snapshot."
		];

		return {
			coverageMode: coverageRepository.mode,
			coverageUpdatedAt: coverageRepository.data.updatedAt,
			incidents: sources
				.filter(source => source.health !== "healthy")
				.map(source => ({
					id: source.id,
					summary: source.note,
					title: source.label
				})),
			nextPublishWindow,
			nextReviewAt: sources
				.map(source => source.nextCheckAt)
				.sort((left, right) => left.localeCompare(right))[0],
			notes,
			overallStatus,
			sourceSummary,
			sources,
			updatedAt: new Date().toISOString()
		};
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

	async function resolveLocationLookup(raw: string, requestId?: string, selectionId?: string) {
		const coverage = buildCoverageResponse(
			coverageRepository.mode,
			coverageRepository.data.updatedAt,
			locationGuessService.publicConfig,
			coverageRepository.data.dataSources.launchTarget
		);

		let officialLookup = null;
		let addressEnrichment = null;
		let geoContext = null;
		let selectionOptions: LocationLookupSelectionOption[] | undefined;

		if (classifyLookupInput(raw) === "address") {
			if (addressEnrichmentService) {
				try {
					addressEnrichment = await addressEnrichmentService.lookupAddress(raw);

					if (addressEnrichment) {
						geoContext = {
							countyFips: addressEnrichment.countyFips,
							normalizedAddress: addressEnrichment.normalizedAddress,
							postalCode: addressEnrichment.zip5,
							sourceSystem: "U.S. Census Geocoder",
							stateAbbreviation: addressEnrichment.state
						};
					}
					else {
						geoContext = null;
					}
				}
				catch (error) {
					logger.warn("provider.census-openstates.lookup-failed", {
						message: error instanceof Error ? error.message : "Unknown provider error.",
						requestId
					});
				}
			}

			if (googleCivicClient) {
				try {
					officialLookup = await googleCivicClient.lookupVoterInfo(raw);
				}
				catch (error) {
					logger.warn("provider.google-civic.lookup-failed", {
						message: error instanceof Error ? error.message : "Unknown provider error.",
						requestId
					});
				}
			}
		}
		else if (zipLocationService) {
			try {
				const zipLookup = await zipLocationService.lookupZip(raw);

				if (zipLookup) {
					const selectedZipMatch = selectionId
						? zipLookup.matches.find(match => match.id === selectionId) ?? null
						: zipLookup.matches.length === 1
							? zipLookup.matches[0]
							: null;

					if (selectedZipMatch) {
						addressEnrichment = {
							benchmark: "ZIP_CENTROID",
							countyFips: selectedZipMatch.countyFips,
							districtMatches: selectedZipMatch.districtMatches,
							fromCache: false,
							latitude: selectedZipMatch.latitude,
							longitude: selectedZipMatch.longitude,
							normalizedAddress: selectedZipMatch.postalCode,
							representativeMatches: selectedZipMatch.representativeMatches,
							state: selectedZipMatch.stateAbbreviation,
							vintage: "ZIP_CENTROID",
							zip5: selectedZipMatch.postalCode
						};
						geoContext = {
							countyFips: selectedZipMatch.countyFips,
							countyName: selectedZipMatch.countyName,
							locality: selectedZipMatch.locality,
							postalCode: selectedZipMatch.postalCode,
							sourceSystem: selectedZipMatch.sourceSystem,
							stateAbbreviation: selectedZipMatch.stateAbbreviation,
							stateName: selectedZipMatch.stateName
						};
					}
					else if (zipLookup.matches[0]) {
						const fallbackZipMatch = zipLookup.matches[0];

						geoContext = {
							countyFips: fallbackZipMatch.countyFips,
							countyName: fallbackZipMatch.countyName,
							locality: fallbackZipMatch.locality,
							postalCode: fallbackZipMatch.postalCode,
							sourceSystem: fallbackZipMatch.sourceSystem,
							stateAbbreviation: fallbackZipMatch.stateAbbreviation,
							stateName: fallbackZipMatch.stateName
						};
						selectionOptions = zipLookup.matches.map(match => buildZipSelectionOption(
							match,
							coverageRepository.data.jurisdictionSummaries
						));
					}
				}
				else {
					geoContext = null;
				}
			}
			catch (error) {
				logger.warn("provider.zip-lookup.lookup-failed", {
					message: error instanceof Error ? error.message : "Unknown provider error.",
					requestId
				});
			}
		}

		return buildLocationLookupResponse(
			raw,
			coverageRepository.data.jurisdiction,
			coverageRepository.data.jurisdictionSummaries,
			coverageRepository.data.location,
			coverageRepository.data.election?.slug,
			coverageRepository.mode,
			coverage,
			geoContext,
			officialLookup,
			addressEnrichment,
			selectionOptions
		);
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
				providerSummary: buildProviderSummary(),
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
				providerSummary: buildProviderSummary(),
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

	app.post("/api/location", async (request, response) => {
		const raw = typeof request.body?.q === "string" ? request.body.q.trim() : "";
		const selectionId = typeof request.body?.selectionId === "string" ? request.body.selectionId.trim() : "";

		response.set("Cache-Control", "no-store");

		const validationError = validateLookupInput(raw);

		if (validationError) {
			response.status(400).json({
				message: validationError
			});
			return;
		}

		response.json(await resolveLocationLookup(raw, response.locals.requestId, selectionId || undefined));
	});

	app.get("/api/location/guess", async (request, response) => {
		const guess = locationGuessService.buildGuess(request);

		response.set("Cache-Control", "no-store");
		if (locationGuessService.varyHeaders.length)
			response.set("Vary", locationGuessService.varyHeaders.join(", "));

		if (!guess) {
			response.status(404).json({
				message: locationGuessService.publicConfig.canGuessOnLoad
					? "Automatic location guessing is not available for this request."
					: "Automatic location guessing is not configured for this host."
			});
			return;
		}

		const lookupResponse = await resolveLocationLookup(guess.rawQuery, response.locals.requestId);

		if (lookupResponse.result !== "resolved") {
			response.status(404).json({
				message: "IP-based location guess did not resolve to civic results for this request."
			});
			return;
		}

		response.json({
			...lookupResponse,
			detectedFromIp: true,
			note: `${buildLocationGuessNotePrefix(guess)} ${lookupResponse.note}`.trim()
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

	app.get("/api/coverage", (_request, response) => {
		const payload: CoverageResponse = buildCoverageResponse(
			coverageRepository.mode,
			coverageRepository.data.updatedAt,
			locationGuessService.publicConfig,
			coverageRepository.data.dataSources.launchTarget
		);
		response.json(payload);
	});

	app.get("/api/status", async (_request, response) => {
		response.json(buildPublicStatusResponse(
			(await adminRepository.listSourceMonitor()).sources,
			await adminRepository.getOverview()
		));
	});

	app.get("/api/corrections", async (_request, response) => {
		response.json(buildPublicCorrectionsResponse((await adminRepository.listCorrections()).corrections));
	});

	app.get("/api/search", async (request, response) => {
		const query = typeof request.query.q === "string" ? request.query.q : "";
		const primaryElectionSlug = getPrimaryElectionSlug();
		const election = primaryElectionSlug ? await getPublicElection(primaryElectionSlug) : null;
		const candidates = await listPublicCandidates();
		const measures = await listPublicMeasures();
		const contests = await listPublicContests();
		const sourceDirectory = buildSourceDirectory(candidates, measures, contests, resolvedSourceInventory);
		const districts = await listPublicDistricts();

		response.json(buildSearchResponse(
			query,
			candidates,
			measures,
			contests,
			election,
			coverageRepository.data.jurisdiction,
			sourceDirectory,
			districts
		));
	});

	app.get("/api/sources", async (_request, response) => {
		const candidates = await listPublicCandidates();
		const measures = await listPublicMeasures();
		const contests = await listPublicContests();

		response.json({
			sources: buildSourceDirectory(candidates, measures, contests, resolvedSourceInventory),
			updatedAt: coverageRepository.data.updatedAt
		});
	});

	app.get("/api/sources/:id", async (request, response) => {
		const record = buildSourceRecord(
			request.params.id,
			await listPublicCandidates(),
			await listPublicMeasures(),
			await listPublicContests(),
			resolvedSourceInventory
		);

		if (!record) {
			response.status(404).json({
				message: "Source record not found."
			});
			return;
		}

		response.json(record);
	});

	app.get("/api/districts", async (_request, response) => {
		response.json(buildDistrictsResponse(await listPublicDistricts()));
	});

	app.get("/api/districts/:slug", async (request, response) => {
		const result = await getPublicDistrict(request.params.slug);

		if (!result) {
			response.status(404).json({
				message: "District page not found."
			});
			return;
		}

		response.json(buildDistrictRecordResponse(result.contest, result.election));
	});

	app.get("/api/representatives", async (_request, response) => {
		const [districts, representatives] = await Promise.all([
			listPublicDistricts(),
			listPublicRepresentatives()
		]);

		response.json(buildRepresentativesResponse(representatives, districts));
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
		const requestedLocationSlug = typeof request.query.location === "string" ? request.query.location : "";

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

		if (!defaultLocation) {
			response.status(404).json({
				message: "Ballot location context is not available for the requested election."
			});
			return;
		}

		response.json({
			election,
			location: {
				...defaultLocation,
				slug: requestedLocationSlug || defaultLocation.slug
			},
			note: "Current public coverage is running from the latest imported civic-data snapshot. Verify official election logistics with the linked election office.",
			updatedAt: election.updatedAt
		});
	});

	app.get("/api/contests/:slug", async (request, response) => {
		const result = await getPublicContest(request.params.slug);

		if (!result) {
			response.status(404).json({
				message: "Contest not found."
			});
			return;
		}

		response.json(buildContestRecordResponse(result.contest, result.election));
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
