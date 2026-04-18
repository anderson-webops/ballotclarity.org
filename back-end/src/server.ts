import type { ErrorRequestHandler } from "express";
import type { AddressEnrichmentService } from "./address-enrichment.js";
import type { CongressClient, CongressMemberDetail, CongressMemberRecord } from "./congress.js";
import type { CoverageRepository } from "./coverage-repository.js";
import type { OpenStatesRepresentativeRecord } from "./openstates.js";
import type { SupplementalOfficeholderRecord } from "./supplemental-officeholders.js";
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
	LocationDistrictMatch,
	LocationLookupSelectionOption,
	LocationRepresentativeMatch,
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
import {
	buildActiveNationwideLookupContext,
	buildActiveNationwideLookupCookie,
	buildNationwideDistrictRecordResponse,
	buildNationwideDistrictRoleGuide,
	buildNationwideDistrictsResponse,
	buildNationwidePersonProfileResponse,
	buildNationwideRepresentativeSlug,
	buildNationwideRepresentativesResponse,
	buildRouteFallbackDistrictRecordResponse,
	buildRouteFallbackPersonProfileResponse,
	clearActiveNationwideLookupCookie,
	persistActiveNationwideLookupCookie,
	readActiveNationwideLookupContext,
} from "./active-nationwide-lookup.js";
import { createAddressCacheRepository } from "./address-cache-repository.js";
import { createAddressEnrichmentService } from "./address-enrichment.js";
import { createAdminLoginThrottle } from "./admin-login-throttle.js";
import { createAdminRepository } from "./admin-repository.js";
import { createCensusGeocoderClient } from "./census-geocoder.js";
import { createCongressClient } from "./congress.js";
import { createCoverageRepository } from "./coverage-repository.js";
import { createGoogleCivicClient } from "./google-civic.js";
import { buildCoverageResponse } from "./launch-profile.js";
import { createLdaClient } from "./lda.js";
import { buildLocationGuessNotePrefix, createLocationGuessService } from "./location-guess.js";
import { buildLocationLookupResponse, classifyLookupInput, findSupportedCoverageSummaries, validateLookupInput } from "./location-lookup.js";
import { createLogger, createRequestLoggingMiddleware } from "./logger.js";
import { getOfficialToolsForState, getStateAbbreviationForName, getStateNameForAbbreviation } from "./official-election-tools.js";
import { createOpenFecClient } from "./openfec.js";
import { createOpenStatesClient } from "./openstates.js";
import { buildProviderSummary } from "./provider-config.js";
import { createRepresentativeModuleResolver } from "./representative-modules.js";
import { createSourceAssetStore } from "./source-asset-store.js";
import {
	buildSupplementalRepresentativeMatch,
	findSupplementalOfficeholderByRepresentativeSlug,
	findSupplementalOfficeholdersByDistrictSlug,
	mergeRepresentativeMatchesWithSupplementalRecords,
} from "./supplemental-officeholders.js";
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
	congressClient?: CongressClient | null;
	correctionSeed?: AdminCorrectionRequest[];
	activitySeed?: AdminActivityItem[];
	googleCivicClient?: ReturnType<typeof createGoogleCivicClient>;
	ldaClient?: ReturnType<typeof createLdaClient>;
	locationGuessOptions?: Parameters<typeof createLocationGuessService>[0];
	openFecClient?: ReturnType<typeof createOpenFecClient>;
	openStatesClient?: ReturnType<typeof createOpenStatesClient>;
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
	const sources = collectCandidateSources(candidate);

	return {
		location: candidate.location,
		districtLabel: candidate.officeSought,
		districtSlug: candidate.contestSlug,
		fundingAvailable: Boolean(candidate.funding),
		fundingSummary: candidate.funding.summary,
		href: `/representatives/${candidate.slug}`,
		officeholderLabel: candidate.incumbent ? "Current officeholder" : "Incumbent contender",
		influenceAvailable: candidate.lobbyingContext.length > 0 || candidate.publicStatements.length > 0,
		influenceSummary: candidate.lobbyingContext[0]?.summary ?? "No published influence-context note is attached to this profile yet.",
		incumbent: candidate.incumbent,
		onCurrentBallot: true,
		name: candidate.name,
		officeSought: candidate.officeSought,
		party: candidate.party,
		slug: candidate.slug,
		ballotStatusLabel: candidate.comparison.ballotStatus.label,
		provenance: {
			label: "Source-backed local person record",
			status: "direct",
			note: "Matched from Ballot Clarity's published local person record for this office."
		},
		sourceCount: sources.length,
		sources,
		summary: candidate.summary,
		updatedAt: candidate.updatedAt
	};
}

const cityRoutePattern = /^([a-z0-9-]+)-city$/i;
const congressionalDistrictCodePattern = /^([A-Z]{2})-(\d+)$/i;
const congressionalRoutePattern = /^congressional-(\d+)$/i;
const countyRoutePattern = /^([a-z0-9-]+)-county$/i;
const districtNumberPattern = /\b(\d+)\b/;
const ocdPersonRoutePattern = /^ocd-person-/i;
const representativeOfficePattern = /representative/i;
const representativeRoutePattern = /^representative-(\d+)$/i;
const representativeStateRoutePattern = /^representative-([a-z]{2})-(\d+)$/i;
const routeDivisionStatePattern = /\/state:([a-z]{2})(?:\/|$)/i;
const senateChamberPattern = /senate/i;
const senatorOfficePattern = /senator/i;
const senatorRoutePattern = /^senator-(\d+)$/i;
const senatorStatewideCodeRoutePattern = /^([a-z]{2})-sen-statewide$/i;
const senatorStatewideNameRoutePattern = /^senator-([a-z0-9-]+)$/i;
const stateAbbreviationRouteTokenPattern = /^[a-z]{2}$/i;
const stateHouseRoutePattern = /^state-house-(\d+)$/i;
const stateSenateRoutePattern = /^state-senate-(\d+)$/i;
const directRouteOfficeholderHonorificPattern = /\b(?:the|hon|honorable|rep|representative|cong|congressman|congresswoman|sen|senator|mr|mrs|ms|dr)\b/gi;
const directRoutePersonNameSuffixPattern = /\b(?:jr|sr|ii|iii|iv|v|md|phd|dds|esq)\b/gi;

const directRouteCanonicalFirstNameAliases = new Map<string, string>([
	["andy", "andrew"],
	["bill", "william"],
	["billy", "william"],
	["bob", "robert"],
	["bobby", "robert"],
	["dan", "daniel"],
	["danny", "daniel"],
	["dave", "david"],
	["jim", "james"],
	["jimmy", "james"],
	["joe", "joseph"],
	["jon", "jonathan"],
	["kate", "katherine"],
	["katie", "katherine"],
	["liz", "elizabeth"],
	["matt", "matthew"],
	["mike", "michael"],
	["nick", "nicholas"],
	["pat", "patrick"],
	["rich", "richard"],
	["rob", "robert"],
	["sam", "samuel"],
	["steve", "steven"],
	["tom", "thomas"],
	["will", "william"],
]);

function toLookupSlug(value: string | null | undefined) {
	return String(value ?? "")
		.toLowerCase()
		.trim()
		.replace(/[\s_]+/g, "-")
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

function titleCaseToken(value: string) {
	return value
		.split("-")
		.filter(Boolean)
		.map((segment) => {
			if (segment.length <= 2)
				return segment.toUpperCase();

			if (segment.startsWith("mc") && segment.length > 2)
				return `Mc${segment.charAt(2).toUpperCase()}${segment.slice(3)}`;

			return segment.charAt(0).toUpperCase() + segment.slice(1);
		})
		.join(" ");
}

function buildStateIdentityFromRouteToken(token: string) {
	const normalizedToken = toLookupSlug(token);

	if (!normalizedToken)
		return null;

	if (stateAbbreviationRouteTokenPattern.test(normalizedToken)) {
		const stateCode = normalizedToken.toUpperCase();
		const stateName = getStateNameForAbbreviation(stateCode) || titleCaseToken(normalizedToken);

		return {
			officialResources: getOfficialToolsForState(stateCode),
			stateCode,
			stateName,
		};
	}

	const stateName = titleCaseToken(normalizedToken);
	const stateCode = getStateAbbreviationForName(stateName);

	return {
		officialResources: getOfficialToolsForState(stateCode),
		stateCode,
		stateName,
	};
}

function buildSearchNameFromRepresentativeSlug(slug: string) {
	const normalizedSlug = toLookupSlug(slug);

	if (!normalizedSlug || ocdPersonRoutePattern.test(normalizedSlug))
		return "";

	return titleCaseToken(normalizedSlug);
}

function normalizeDirectRoutePersonText(value: string | null | undefined) {
	return String(value ?? "")
		.toLowerCase()
		.replace(directRouteOfficeholderHonorificPattern, " ")
		.replace(directRoutePersonNameSuffixPattern, " ")
		.replace(/\./g, " ")
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");
}

function canonicalizeDirectRouteFirstName(value: string | null | undefined) {
	const normalized = normalizeDirectRoutePersonText(value);
	return directRouteCanonicalFirstNameAliases.get(normalized) || normalized;
}

function normalizeDirectRouteNameParts(value: string | null | undefined) {
	return normalizeDirectRoutePersonText(value)
		.split(" ")
		.filter(Boolean);
}

function pickCanonicalDirectRouteGivenName(tokens: string[]) {
	for (const token of tokens) {
		if (token.length > 1)
			return canonicalizeDirectRouteFirstName(token);
	}

	return canonicalizeDirectRouteFirstName(tokens[0]);
}

function parseDirectRoutePersonName(value: string | null | undefined) {
	const raw = String(value ?? "")
		.toLowerCase()
		.replace(/\./g, " ")
		.trim();

	if (!raw) {
		return {
			canonicalGivenName: "",
			surname: "",
			tokens: [] as string[],
		};
	}

	if (raw.includes(",")) {
		const [surnamePart, givenPart] = raw.split(",", 2);
		const surnameTokens = normalizeDirectRouteNameParts(surnamePart);
		const givenTokens = normalizeDirectRouteNameParts(givenPart);

		return {
			canonicalGivenName: pickCanonicalDirectRouteGivenName(givenTokens),
			surname: surnameTokens.join(" "),
			tokens: [...surnameTokens, ...givenTokens],
		};
	}

	const tokens = normalizeDirectRouteNameParts(raw);
	const surname = tokens.slice(-1).join(" ");
	const givenTokens = tokens.slice(0, -1);

	return {
		canonicalGivenName: pickCanonicalDirectRouteGivenName(givenTokens),
		surname,
		tokens,
	};
}

function directRouteSurnamesReliablyMatch(left: string, right: string) {
	if (!left || !right)
		return false;

	return left === right || left.endsWith(` ${right}`) || right.endsWith(` ${left}`);
}

function directRouteNamesReliablyMatch(left: string | null | undefined, right: string | null | undefined) {
	const leftName = parseDirectRoutePersonName(left);
	const rightName = parseDirectRoutePersonName(right);

	if (!leftName.tokens.length || !rightName.tokens.length)
		return false;

	if (!directRouteSurnamesReliablyMatch(leftName.surname, rightName.surname))
		return false;

	if (!leftName.canonicalGivenName || !rightName.canonicalGivenName)
		return false;

	return leftName.canonicalGivenName === rightName.canonicalGivenName;
}

function buildRouteSource({
	authority,
	date,
	id,
	note,
	publisher,
	sourceSystem,
	title,
	url,
}: {
	authority: Source["authority"];
	date: string;
	id: string;
	note: string;
	publisher: string;
	sourceSystem: string;
	title: string;
	url: string;
}) {
	return {
		authority,
		date,
		id,
		note,
		publisher,
		sourceSystem,
		title,
		type: "official record",
		url,
	} satisfies Source;
}

function buildOfficialToolSources(resources: OfficialResource[], updatedAt: string) {
	return resources.map(resource => buildRouteSource({
		authority: resource.authority,
		date: updatedAt,
		id: `official:${toLookupSlug(resource.label)}`,
		note: resource.note || "",
		publisher: resource.sourceLabel,
		sourceSystem: resource.sourceSystem,
		title: resource.label,
		url: resource.url,
	}));
}

function inferRepresentativeStateCode(record: OpenStatesRepresentativeRecord) {
	const divisionStateMatch = record.currentRoleDivisionId?.match(routeDivisionStatePattern);

	if (divisionStateMatch?.[1])
		return divisionStateMatch[1].toUpperCase();

	const districtStateMatch = record.currentRoleDistrict?.match(congressionalDistrictCodePattern);
	return districtStateMatch?.[1]?.toUpperCase() || "";
}

function buildRepresentativeOfficeContext(record: OpenStatesRepresentativeRecord) {
	const officeTitle = record.officeTitle || "Representative";
	const stateCode = inferRepresentativeStateCode(record);
	const stateName = getStateNameForAbbreviation(stateCode) || record.jurisdictionName || stateCode || "Unknown jurisdiction";
	const districtCodeMatch = record.currentRoleDistrict?.match(congressionalDistrictCodePattern);
	const numericDistrictMatch = record.currentRoleDistrict?.match(districtNumberPattern);
	const isSenator = senatorOfficePattern.test(officeTitle);
	const isRepresentative = representativeOfficePattern.test(officeTitle);

	if (isRepresentative && districtCodeMatch?.[2]) {
		const districtNumber = String(Number.parseInt(districtCodeMatch[2], 10));

		return {
			districtLabel: `Congressional District ${districtNumber}`,
			districtSlug: `congressional-${districtNumber}`,
			location: stateName,
			officeSought: `U.S. House, District ${districtNumber}`,
			stateCode,
			stateName,
		};
	}

	if (isSenator && stateCode) {
		return {
			districtLabel: stateName,
			districtSlug: `${stateCode.toLowerCase()}-sen-statewide`,
			location: stateName,
			officeSought: "U.S. Senate",
			stateCode,
			stateName,
		};
	}

	if (isSenator && numericDistrictMatch?.[1]) {
		const districtNumber = String(Number.parseInt(numericDistrictMatch[1], 10));

		return {
			districtLabel: `State Senate District ${districtNumber}`,
			districtSlug: `state-senate-${districtNumber}`,
			location: stateName,
			officeSought: `State Senate District ${districtNumber}`,
			stateCode,
			stateName,
		};
	}

	if (isRepresentative && numericDistrictMatch?.[1]) {
		const districtNumber = String(Number.parseInt(numericDistrictMatch[1], 10));

		return {
			districtLabel: `State House District ${districtNumber}`,
			districtSlug: `state-house-${districtNumber}`,
			location: stateName,
			officeSought: `State House District ${districtNumber}`,
			stateCode,
			stateName,
		};
	}

	return {
		districtLabel: record.districtLabel,
		districtSlug: toLookupSlug(record.districtLabel),
		location: stateName,
		officeSought: officeTitle,
		stateCode,
		stateName,
	};
}

function buildRepresentativeLookupContext(record: OpenStatesRepresentativeRecord, representativeSlug: string, updatedAt: string) {
	const officeContext = buildRepresentativeOfficeContext(record);
	const officialResources = getOfficialToolsForState(officeContext.stateCode);

	return {
		actions: officialResources.map((resource, index) => ({
			badge: resource.sourceLabel,
			description: resource.note || "",
			id: `official:${officeContext.stateCode || "unknown"}:${index}`,
			kind: "official-verification" as const,
			title: resource.label,
			url: resource.url,
		})),
		detectedFromIp: false,
		districtMatches: officeContext.districtLabel
			? [
					{
						districtCode: officeContext.districtLabel.match(districtNumberPattern)?.[1] || officeContext.districtLabel,
						districtType: officeContext.officeSought,
						id: officeContext.districtSlug,
						label: officeContext.districtLabel,
						sourceSystem: "Open States",
					},
				]
			: [],
		guideAvailability: "not-published" as const,
		inputKind: "address" as const,
		location: {
			coverageLabel: "Nationwide civic results available",
			displayName: officeContext.stateName,
			slug: toLookupSlug(officeContext.stateName),
			state: officeContext.stateName,
		},
		normalizedAddress: officeContext.stateCode || officeContext.stateName,
		representativeMatches: [
			{
				districtLabel: officeContext.districtLabel,
				id: representativeSlug,
				name: record.name,
				officeTitle: record.officeTitle,
				openstatesUrl: record.openstatesUrl,
				party: record.party,
				sourceSystem: "Open States",
			},
		],
		resolvedAt: updatedAt,
		result: "resolved" as const,
	};
}

function buildRepresentativeLookupContextFromSupplementalOfficeholder(
	record: SupplementalOfficeholderRecord,
	representativeSlug: string,
	updatedAt: string,
) {
	const officialResources = getOfficialToolsForState(record.stateCode);
	const districtCodeMatch = record.districtSlug.match(districtNumberPattern);

	return {
		actions: officialResources.map((resource, index) => ({
			badge: resource.sourceLabel,
			description: resource.note || "",
			id: `official:${record.stateCode || "unknown"}:${index}`,
			kind: "official-verification" as const,
			title: resource.label,
			url: resource.url,
		})),
		detectedFromIp: false,
		districtMatches: [
			{
				districtCode: districtCodeMatch?.[1] || record.districtSlug,
				districtType: record.districtType,
				id: record.districtSlug,
				label: record.districtLabel,
				sourceSystem: record.sourceSystem,
			},
		],
		guideAvailability: "not-published" as const,
		inputKind: "address" as const,
		location: {
			coverageLabel: "Nationwide civic results available",
			displayName: record.location,
			slug: toLookupSlug(record.location),
			state: record.stateName,
		},
		normalizedAddress: record.stateCode || record.location,
		representativeMatches: [
			buildSupplementalRepresentativeMatch(record),
		],
		resolvedAt: updatedAt,
		result: "resolved" as const,
	};
}

function buildRepresentativeProfileFromSupplementalOfficeholder(record: SupplementalOfficeholderRecord): PersonProfileResponse {
	const updatedAt = record.updatedAt || new Date().toISOString();
	const officialResources = getOfficialToolsForState(record.stateCode);
	const sources = [
		...record.sources,
		...buildOfficialToolSources(officialResources, updatedAt),
	];
	const provenanceStatus = record.sourceSystem.toLowerCase().includes("official")
		? "direct"
		: "crosswalked";
	const methodologyNotes = [
		record.jurisdiction === "State"
			? "This representative route is backed by a reviewed state officeholder record that Ballot Clarity keeps available when live provider lookups are unavailable or incomplete."
			: "This representative route is backed by a reviewed official local-government officeholder source so the public person page can stay stable even where nationwide provider coverage is incomplete.",
		"An active nationwide lookup can still add exact district confirmation for the current user when multiple local layers overlap.",
	];

	return {
		note: "Representative profile assembled from a reviewed officeholder record Ballot Clarity can attach to this public route without requiring browser lookup state.",
		person: {
			ballotStatusLabel: "Current ballot status requires active lookup confirmation",
			biography: [
				{
					id: `provider:${record.slug}`,
					sources,
					summary: record.biographySummary,
					title: "Reviewed officeholder record",
				},
			],
			comparison: null,
			contestSlug: record.districtSlug,
			districtLabel: record.districtLabel,
			districtSlug: record.districtSlug,
			freshness: {
				contentLastVerifiedAt: updatedAt,
				dataLastUpdatedAt: updatedAt,
				nextReviewAt: updatedAt,
				status: "up-to-date",
				statusLabel: "Reviewed officeholder record",
				statusNote: record.jurisdiction === "State"
					? "This page is route-backed from a reviewed current state officeholder record. Active lookup context can still add user-specific district confirmation and stronger locality context."
					: "This page is route-backed from a reviewed current local officeholder source. Active lookup context can still confirm whether this officeholder is part of the user's exact matched district stack.",
			},
			funding: null,
			incumbent: true,
			keyActions: [],
			lobbyingContext: [],
			location: record.location,
			methodologyNotes,
			name: record.name,
			officeholderLabel: "Current officeholder",
			officeSought: record.officeSought,
			onCurrentBallot: false,
			officialWebsiteUrl: record.officialWebsiteUrl,
			openstatesUrl: record.openstatesUrl,
			party: record.party || "Unknown",
			provenance: {
				asOf: updatedAt,
				label: record.provenanceLabel,
				note: record.provenanceNote,
				source: "nationwide",
				status: provenanceStatus,
			},
			publicStatements: [],
			slug: record.slug,
			sourceCount: sources.length,
			sources,
			summary: record.summary,
			topIssues: [],
			updatedAt,
			whatWeDoNotKnow: [
				{
					id: "lookup-confirmation",
					note: "A user-specific address or ZIP lookup is still required for exact district confirmation in Ballot Clarity's active nationwide context.",
					sources,
					text: "This route resolves a stable public officeholder identity, but a current lookup is still needed to confirm that this officeholder matches your exact district and locality.",
				},
			],
			whatWeKnow: [
				{
					id: "reviewed-officeholder-record",
					note: record.provenanceNote,
					sources,
					text: record.summary,
				},
			],
		},
		updatedAt,
	};
}

function formatCongressLookupName(value: string) {
	const trimmed = value.trim();

	if (!trimmed.includes(","))
		return trimmed;

	const [lastName, firstName] = trimmed.split(",", 2).map(item => item.trim()).filter(Boolean);
	return [firstName, lastName].filter(Boolean).join(" ");
}

function mergeRepresentativeMatches(representativeMatches: LocationRepresentativeMatch[]) {
	const uniqueMatches = new Map<string, LocationRepresentativeMatch>();

	for (const match of representativeMatches) {
		const normalizedName = toLookupSlug(match.name);
		const normalizedDistrict = toLookupSlug(match.districtLabel);
		const normalizedOffice = toLookupSlug(match.officeTitle);
		const normalizedId = toLookupSlug(match.id);
		const keys = [
			normalizedId ? `id:${normalizedId}` : "",
			normalizedName ? `name:${normalizedName}:${normalizedOffice}:${normalizedDistrict}` : "",
			normalizedName ? `name:${normalizedName}` : "",
		].filter(Boolean);
		const existingKey = keys.find(key => uniqueMatches.has(key));

		if (!existingKey) {
			for (const key of keys)
				uniqueMatches.set(key, match);
			continue;
		}

		const existingMatch = uniqueMatches.get(existingKey) ?? match;
		const preferredMatch = existingMatch.openstatesUrl
			? existingMatch
			: match.openstatesUrl
				? match
				: existingMatch.sourceSystem === "Open States"
					? existingMatch
					: match.sourceSystem === "Open States"
						? match
						: existingMatch;

		for (const key of keys)
			uniqueMatches.set(key, preferredMatch);
	}

	return Array.from(new Map(
		Array.from(uniqueMatches.values()).map(match => [toLookupSlug(match.name), match]),
	).values());
}

async function buildCongressRepresentativeMatchesFromDistrictContext(
	congressClient: CongressClient | null | undefined,
	stateCode: string,
	districtMatches: LocationDistrictMatch[],
	existingMatches: LocationRepresentativeMatch[],
) {
	if (!congressClient || !stateCode)
		return [];

	const stateMembers = await congressClient.listMembersByState(stateCode);
	const stateName = getStateNameForAbbreviation(stateCode) || stateCode;
	const congressionalDistrictMatch = districtMatches.find(district => toLookupSlug(district.districtType).includes("congress"));
	const congressionalDistrictNumber = congressionalDistrictMatch?.districtCode
		? String(Number.parseInt(String(congressionalDistrictMatch.districtCode), 10))
		: "";
	const normalizedExistingNames = new Set(existingMatches.map(match => toLookupSlug(match.name)));

	return stateMembers.flatMap((member) => {
		const directName = formatCongressLookupName(member.name);
		const normalizedName = toLookupSlug(directName);

		if (!normalizedName || normalizedExistingNames.has(normalizedName))
			return [];

		if (typeof member.district === "number") {
			if (!congressionalDistrictNumber || String(member.district) !== congressionalDistrictNumber)
				return [];

			return [{
				districtLabel: `Congressional District ${congressionalDistrictNumber}`,
				id: `congress:${member.bioguideId}`,
				name: directName,
				officeTitle: "Representative",
				party: member.party,
				sourceSystem: "Congress.gov",
			} satisfies LocationRepresentativeMatch];
		}

		return [{
			districtLabel: stateName,
			id: `congress:${member.bioguideId}`,
			name: directName,
			officeTitle: "Senator",
			party: member.party,
			sourceSystem: "Congress.gov",
		} satisfies LocationRepresentativeMatch];
	});
}

async function augmentRepresentativeMatchesForLookup(
	congressClient: CongressClient | null | undefined,
	stateCode: string,
	districtMatches: LocationDistrictMatch[],
	representativeMatches: LocationRepresentativeMatch[],
) {
	const withSupplemental = mergeRepresentativeMatches(
		mergeRepresentativeMatchesWithSupplementalRecords(representativeMatches, districtMatches),
	);
	const congressionalFallbackMatches = await buildCongressRepresentativeMatchesFromDistrictContext(
		congressClient,
		stateCode,
		districtMatches,
		withSupplemental,
	);
	return mergeRepresentativeMatches([
		...withSupplemental,
		...congressionalFallbackMatches,
	]);
}

function buildRepresentativeProfileFromOpenStates(record: OpenStatesRepresentativeRecord): PersonProfileResponse {
	const updatedAt = record.updatedAt || new Date().toISOString();
	const officeContext = buildRepresentativeOfficeContext(record);
	const officialResources = getOfficialToolsForState(officeContext.stateCode);
	const sources = [
		buildRouteSource({
			authority: record.openstatesUrl ? "nonprofit-provider" : "open-data",
			date: updatedAt,
			id: `representative:${toLookupSlug(record.name)}`,
			note: "Current officeholder identity attached from the Open States person record matched to this public representative route.",
			publisher: "Open States",
			sourceSystem: "Open States",
			title: `${record.name} current officeholder record`,
			url: record.openstatesUrl || "https://openstates.org",
		}),
		...buildOfficialToolSources(officialResources, updatedAt),
	];

	return {
		note: "Representative profile assembled from a public provider-backed officeholder record, with route-backed enrichment attached wherever Ballot Clarity can verify it reliably.",
		person: {
			ballotStatusLabel: "Current ballot status requires active lookup confirmation",
			biography: [
				{
					id: `provider:${toLookupSlug(record.name)}`,
					sources,
					summary: `${record.name} is attached here from a current Open States officeholder record. This route can render a stable public identity even before Ballot Clarity has a user-specific lookup context for district confirmation.`,
					title: "Provider-backed officeholder record",
				},
			],
			comparison: null,
			contestSlug: officeContext.districtSlug,
			districtLabel: officeContext.districtLabel,
			districtSlug: officeContext.districtSlug,
			freshness: {
				contentLastVerifiedAt: updatedAt,
				dataLastUpdatedAt: updatedAt,
				nextReviewAt: updatedAt,
				status: "up-to-date",
				statusLabel: "Provider-backed",
				statusNote: "This page is route-backed from a current officeholder record. An active lookup can still add user-specific district confirmation and locality-specific official-tool context.",
			},
			funding: null,
			incumbent: true,
			keyActions: [],
			lobbyingContext: [],
			location: officeContext.location,
			methodologyNotes: [
				"This route resolves a stable public person identity from the representative slug before any browser-held lookup context is restored.",
				"Active nationwide lookup context can still add user-specific district confirmation and locality-specific official tools, but route-backed enrichment modules also attach directly when Ballot Clarity can verify them reliably.",
			],
			name: record.name,
			officeholderLabel: "Current officeholder",
			officeSought: officeContext.officeSought,
			onCurrentBallot: false,
			openstatesUrl: record.openstatesUrl,
			party: record.party || "Unknown",
			provenance: {
				asOf: updatedAt,
				label: "Open States current officeholder record",
				note: "Matched from the representative route slug to the current provider-backed person record.",
				source: "nationwide",
				status: "crosswalked",
			},
			publicStatements: [],
			slug: buildNationwideRepresentativeSlug({ id: record.id, name: record.name }),
			sourceCount: sources.length,
			sources,
			summary: `${record.name} is the current ${record.party ? `${record.party} ` : ""}${officeContext.officeSought} record Ballot Clarity can attach from the public provider layer without requiring browser lookup state.`,
			topIssues: [],
			updatedAt,
			whatWeDoNotKnow: [
				{
					id: "lookup-confirmation",
					note: "A user-specific address or ZIP lookup is still required for exact district confirmation in Ballot Clarity's active nationwide context.",
					sources,
					text: "This route resolves the public officeholder identity, but a current lookup is still needed to confirm that this officeholder matches your exact district and locality.",
				},
			],
			whatWeKnow: [
				{
					id: "provider-identity",
					note: "The Open States person record anchors the identity, office, and public provider link on this page.",
					sources,
					text: `Ballot Clarity attached ${record.name} as a current officeholder from the Open States provider record for this route.`,
				},
			],
		},
		updatedAt,
	};
}

function rankDirectFederalMemberMatch(member: CongressMemberRecord, searchName: string) {
	let score = 0;

	if (directRouteNamesReliablyMatch(member.name, searchName))
		score += 100;

	if (member.district === undefined)
		score += 10;

	return score;
}

function buildRepresentativeOfficeContextFromCongressMember(member: CongressMemberDetail) {
	const latestTerm = [...member.terms].sort((left, right) => right.congress - left.congress)[0];
	const stateCode = latestTerm?.stateCode || getStateAbbreviationForName(member.state) || member.state.slice(0, 2).toUpperCase();
	const stateName = latestTerm?.stateName || getStateNameForAbbreviation(stateCode) || member.state || stateCode || "Unknown jurisdiction";
	const chamber = latestTerm?.chamber || "";

	if (senateChamberPattern.test(chamber) || latestTerm?.memberType === "Senator" || member.district === undefined) {
		return {
			districtLabel: stateName,
			districtSlug: `${stateCode.toLowerCase()}-sen-statewide`,
			location: stateName,
			officeSought: "U.S. Senate",
			stateCode,
			stateName,
		};
	}

	const districtNumber = String(Number.parseInt(String(latestTerm?.district ?? member.district ?? ""), 10));

	return {
		districtLabel: `Congressional District ${districtNumber}`,
		districtSlug: `congressional-${districtNumber}`,
		location: stateName,
		officeSought: `U.S. House, District ${districtNumber}`,
		stateCode,
		stateName,
	};
}

function buildRepresentativeLookupContextFromCongressMember(
	member: CongressMemberDetail,
	representativeSlug: string,
	updatedAt: string,
) {
	const officeContext = buildRepresentativeOfficeContextFromCongressMember(member);
	const officialResources = getOfficialToolsForState(officeContext.stateCode);
	const officeTitle = officeContext.officeSought === "U.S. Senate" ? "Senator" : "Representative";

	return {
		actions: officialResources.map((resource, index) => ({
			badge: resource.sourceLabel,
			description: resource.note || "",
			id: `official:${officeContext.stateCode || "unknown"}:${index}`,
			kind: "official-verification" as const,
			title: resource.label,
			url: resource.url,
		})),
		detectedFromIp: false,
		districtMatches: [
			{
				districtCode: officeContext.districtLabel.match(districtNumberPattern)?.[1] || officeContext.stateCode,
				districtType: officeContext.officeSought,
				id: officeContext.districtSlug,
				label: officeContext.districtLabel,
				sourceSystem: "Congress.gov",
			},
		],
		guideAvailability: "not-published" as const,
		inputKind: "address" as const,
		location: {
			coverageLabel: "Nationwide civic results available",
			displayName: officeContext.stateName,
			slug: toLookupSlug(officeContext.stateName),
			state: officeContext.stateName,
		},
		normalizedAddress: officeContext.stateCode || officeContext.stateName,
		representativeMatches: [
			{
				districtLabel: officeContext.districtLabel,
				id: representativeSlug,
				name: member.directOrderName,
				officeTitle,
				party: member.party,
				sourceSystem: "Congress.gov",
			},
		],
		resolvedAt: updatedAt,
		result: "resolved" as const,
	};
}

function buildRepresentativeProfileFromCongressMember(
	member: CongressMemberDetail,
	representativeSlug: string,
): PersonProfileResponse {
	const updatedAt = member.updatedAt || new Date().toISOString();
	const officeContext = buildRepresentativeOfficeContextFromCongressMember(member);
	const officialResources = getOfficialToolsForState(officeContext.stateCode);
	const sources = [
		buildRouteSource({
			authority: "official-government",
			date: updatedAt,
			id: `congress:member:${member.bioguideId}`,
			note: "Current officeholder identity attached from the Congress.gov member record matched to this public representative route.",
			publisher: "Congress.gov",
			sourceSystem: "Congress.gov member detail",
			title: `${member.directOrderName} member record`,
			url: member.url || "https://api.congress.gov/",
		}),
		...buildOfficialToolSources(officialResources, updatedAt),
	];

	return {
		note: "Representative profile assembled from current federal officeholder records, with route-backed enrichment attached wherever Ballot Clarity can verify it reliably.",
		person: {
			ballotStatusLabel: "Current ballot status requires active lookup confirmation",
			biography: [
				{
					id: `provider:${representativeSlug}`,
					sources,
					summary: `${member.directOrderName} is attached here from a current Congress.gov officeholder record. This route can render a stable public identity even before Ballot Clarity has a user-specific lookup context for district confirmation.`,
					title: "Provider-backed officeholder record",
				},
			],
			comparison: null,
			contestSlug: officeContext.districtSlug,
			districtLabel: officeContext.districtLabel,
			districtSlug: officeContext.districtSlug,
			freshness: {
				contentLastVerifiedAt: updatedAt,
				dataLastUpdatedAt: updatedAt,
				nextReviewAt: updatedAt,
				status: "up-to-date",
				statusLabel: "Provider-backed",
				statusNote: "This page is route-backed from a current federal officeholder record. An active lookup can still add user-specific district confirmation and locality-specific official-tool context.",
			},
			funding: null,
			incumbent: true,
			keyActions: [],
			lobbyingContext: [],
			location: officeContext.location,
			methodologyNotes: [
				"This route resolves a stable public person identity from the representative slug before any browser-held lookup context is restored.",
				"When Open States route lookup is unavailable, Ballot Clarity can still build a federal officeholder base record from Congress.gov and then attach finance and lobbying modules through the federal provider crosswalk.",
			],
			name: member.directOrderName,
			officeholderLabel: "Current officeholder",
			officeSought: officeContext.officeSought,
			onCurrentBallot: false,
			party: member.party || "Unknown",
			provenance: {
				asOf: updatedAt,
				label: "Congress.gov current officeholder record",
				note: "Matched from the representative route slug to a current federal officeholder record.",
				source: "nationwide",
				status: "crosswalked",
			},
			publicStatements: [],
			slug: representativeSlug,
			sourceCount: sources.length,
			sources,
			summary: `${member.directOrderName} is the current ${member.party ? `${member.party} ` : ""}${officeContext.officeSought} record Ballot Clarity can attach from the federal public provider layer without requiring browser lookup state.`,
			topIssues: [],
			updatedAt,
			whatWeDoNotKnow: [
				{
					id: "lookup-confirmation",
					note: "A user-specific address or ZIP lookup is still required for exact district confirmation in Ballot Clarity's active nationwide context.",
					sources,
					text: "This route resolves the public officeholder identity, but a current lookup is still needed to confirm that this officeholder matches your exact district and locality.",
				},
			],
			whatWeKnow: [
				{
					id: "provider-identity",
					note: "The Congress.gov current member record anchors the identity, office, and official links on this page.",
					sources,
					text: `Ballot Clarity attached ${member.directOrderName} as a current officeholder from the federal provider layer for this route.`,
				},
			],
		},
		updatedAt,
	};
}

interface PublicDistrictRouteIdentity {
	jurisdiction: Contest["jurisdiction"];
	locationName: string;
	office: string;
	officialResources: OfficialResource[];
	originLabel: string;
	originNote: string;
	representativeAvailabilityNote: string;
	slug: string;
	summary: string;
	title: string;
}

function buildPublicDistrictRouteIdentity(slug: string): PublicDistrictRouteIdentity | null {
	const normalizedSlug = toLookupSlug(slug);
	const updatedSlug = normalizedSlug;
	const congressionalMatch = normalizedSlug.match(congressionalRoutePattern);
	const representativeStateMatch = normalizedSlug.match(representativeStateRoutePattern);
	const representativeMatch = normalizedSlug.match(representativeRoutePattern);
	const senatorStatewideCodeMatch = normalizedSlug.match(senatorStatewideCodeRoutePattern);
	const senatorStatewideNameMatch = normalizedSlug.match(senatorStatewideNameRoutePattern);
	const senatorMatch = normalizedSlug.match(senatorRoutePattern);
	const stateSenateMatch = normalizedSlug.match(stateSenateRoutePattern);
	const stateHouseMatch = normalizedSlug.match(stateHouseRoutePattern);
	const countyMatch = normalizedSlug.match(countyRoutePattern);
	const cityMatch = normalizedSlug.match(cityRoutePattern);

	if (representativeStateMatch?.[1] && representativeStateMatch?.[2]) {
		const stateIdentity = buildStateIdentityFromRouteToken(representativeStateMatch[1]);
		const districtNumber = String(Number.parseInt(representativeStateMatch[2], 10));

		return {
			jurisdiction: "Federal",
			locationName: stateIdentity?.stateName || "State-specific district confirmation pending",
			office: `Congressional District ${districtNumber}`,
			officialResources: stateIdentity?.officialResources ?? [],
			originLabel: "Provider-qualified district route",
			originNote: "This district route carries a state-qualified congressional district slug, so Ballot Clarity can resolve the district identity and attach any configured state-level official election tools without requiring browser lookup state.",
			representativeAvailabilityNote: "This public district route identifies the correct congressional district and state context from the slug itself. Active lookup context can still add user-specific district confirmation and stronger officeholder linkage.",
			slug: updatedSlug,
			summary: "This public district route identifies a state-qualified congressional district even before active nationwide lookup context is restored in the browser.",
			title: `${stateIdentity?.stateName || representativeStateMatch[1].toUpperCase()} Congressional District ${districtNumber}`,
		};
	}

	if (congressionalMatch?.[1]) {
		const districtNumber = String(Number.parseInt(congressionalMatch[1], 10));

		return {
			jurisdiction: "Federal",
			locationName: "State-specific district confirmation pending",
			office: `Congressional District ${districtNumber}`,
			officialResources: [],
			originLabel: "Canonical district route",
			originNote: "This district route identifies a congressional district number, but a state-qualified slug or active lookup is still required before Ballot Clarity can attach the exact officeholder and state election tools for it.",
			representativeAvailabilityNote: "Ballot Clarity can identify this district route, but the current officeholder cannot be confirmed from the district number alone without a state-qualified route or active lookup context.",
			slug: updatedSlug,
			summary: "This public district route is stable and identifies a congressional district number even without an attached browser lookup context.",
			title: `Congressional District ${districtNumber}`,
		};
	}

	if (senatorStatewideCodeMatch?.[1]) {
		const stateIdentity = buildStateIdentityFromRouteToken(senatorStatewideCodeMatch[1]);

		return {
			jurisdiction: "Federal",
			locationName: stateIdentity?.stateName || senatorStatewideCodeMatch[1].toUpperCase(),
			office: "U.S. Senate",
			officialResources: stateIdentity?.officialResources ?? [],
			originLabel: "Provider-qualified district route",
			originNote: "This district route identifies a statewide U.S. Senate office area from the slug itself, so Ballot Clarity can render a stable public district identity without waiting for browser-held lookup state.",
			representativeAvailabilityNote: "This public district route identifies the statewide Senate office area for the state in the slug. Active lookup context can still confirm locality-specific election tools and stronger officeholder linkage for the current user.",
			slug: updatedSlug,
			summary: "This public district route identifies a statewide U.S. Senate office area even without an attached active nationwide lookup context.",
			title: `${stateIdentity?.stateName || senatorStatewideCodeMatch[1].toUpperCase()} statewide Senate seat`,
		};
	}

	if (senatorStatewideNameMatch?.[1]) {
		const stateIdentity = buildStateIdentityFromRouteToken(senatorStatewideNameMatch[1]);

		return {
			jurisdiction: "Federal",
			locationName: stateIdentity?.stateName || titleCaseToken(senatorStatewideNameMatch[1]),
			office: "U.S. Senate",
			officialResources: stateIdentity?.officialResources ?? [],
			originLabel: "Provider-qualified district route",
			originNote: "This district route identifies a statewide U.S. Senate office area from the state name in the slug, so Ballot Clarity can render a stable public district identity without requiring browser lookup state.",
			representativeAvailabilityNote: "This public district route identifies the statewide Senate office area for the state in the slug. Active lookup context can still confirm the user's exact district stack and add any stronger locality-specific enrichment.",
			slug: updatedSlug,
			summary: "This public district route identifies a statewide U.S. Senate office area even without an attached active nationwide lookup context.",
			title: `${stateIdentity?.stateName || titleCaseToken(senatorStatewideNameMatch[1])} statewide Senate seat`,
		};
	}

	if (senatorMatch?.[1]) {
		const districtNumber = String(Number.parseInt(senatorMatch[1], 10));

		return {
			jurisdiction: "State",
			locationName: "State-specific district confirmation pending",
			office: `State Senate District ${districtNumber}`,
			officialResources: [],
			originLabel: "Canonical district route",
			originNote: "This district route identifies a state senate district number from a provider-style route slug, even when the state-qualified officeholder and official-tool attachments still require an active lookup or more specific route context.",
			representativeAvailabilityNote: "Ballot Clarity can identify this state senate district route from the slug itself, but the exact state-specific officeholder still requires an active lookup or a more specific route context.",
			slug: updatedSlug,
			summary: "This public district route resolves a state senate district identity even when user-specific lookup context is not yet available on the server.",
			title: `State Senate District ${districtNumber}`,
		};
	}

	if (stateSenateMatch?.[1]) {
		const districtNumber = String(Number.parseInt(stateSenateMatch[1], 10));

		return {
			jurisdiction: "State",
			locationName: "State-specific district confirmation pending",
			office: `State Senate District ${districtNumber}`,
			officialResources: [],
			originLabel: "Canonical district route",
			originNote: "This district route identifies a state senate district number, but the state-specific officeholder and election-tool attachments still require an active lookup or a state-qualified route slug.",
			representativeAvailabilityNote: "Ballot Clarity can identify this state senate district route, but the current officeholder cannot be confirmed from the district number alone without a state-qualified route or active lookup context.",
			slug: updatedSlug,
			summary: "This public district route resolves the district identity even when the user-specific lookup context is not available on the server.",
			title: `State Senate District ${districtNumber}`,
		};
	}

	if (representativeMatch?.[1]) {
		const districtNumber = String(Number.parseInt(representativeMatch[1], 10));

		return {
			jurisdiction: "State",
			locationName: "State-specific district confirmation pending",
			office: `State House District ${districtNumber}`,
			officialResources: [],
			originLabel: "Canonical district route",
			originNote: "This district route identifies a state house district number from a provider-style route slug, even when the state-qualified officeholder and official-tool attachments still require an active lookup or more specific route context.",
			representativeAvailabilityNote: "Ballot Clarity can identify this state house district route from the slug itself, but the exact state-specific officeholder still requires an active lookup or a more specific route context.",
			slug: updatedSlug,
			summary: "This public district route resolves a state house district identity even when user-specific lookup context is not yet available on the server.",
			title: `State House District ${districtNumber}`,
		};
	}

	if (stateHouseMatch?.[1]) {
		const districtNumber = String(Number.parseInt(stateHouseMatch[1], 10));

		return {
			jurisdiction: "State",
			locationName: "State-specific district confirmation pending",
			office: `State House District ${districtNumber}`,
			officialResources: [],
			originLabel: "Canonical district route",
			originNote: "This district route identifies a state house district number, but the state-specific officeholder and election-tool attachments still require an active lookup or a state-qualified route slug.",
			representativeAvailabilityNote: "Ballot Clarity can identify this state house district route, but the current officeholder cannot be confirmed from the district number alone without a state-qualified route or active lookup context.",
			slug: updatedSlug,
			summary: "This public district route resolves the district identity even when the user-specific lookup context is not available on the server.",
			title: `State House District ${districtNumber}`,
		};
	}

	if (countyMatch?.[1]) {
		const title = titleCaseToken(normalizedSlug);

		return {
			jurisdiction: "Local",
			locationName: title,
			office: title,
			officialResources: [],
			originLabel: "Canonical district route",
			originNote: "This local government route identifies the county geography itself, even when Ballot Clarity does not yet have a county officeholder pipeline attached for it.",
			representativeAvailabilityNote: "No county officeholder data is connected for this area yet. This does not mean the county has no officials, only that Ballot Clarity does not yet have a county officeholder source attached here.",
			slug: updatedSlug,
			summary: "This county route stays public so users can orient around the government area even when Ballot Clarity does not yet have a county officeholder pipeline for it.",
			title,
		};
	}

	if (cityMatch?.[1]) {
		const title = titleCaseToken(normalizedSlug);

		return {
			jurisdiction: "Local",
			locationName: title,
			office: title,
			officialResources: [],
			originLabel: "Canonical district route",
			originNote: "This local government route identifies the city geography itself, even when Ballot Clarity does not yet have a city officeholder pipeline attached for it.",
			representativeAvailabilityNote: "City officeholder data is not yet available from the current nationwide provider set. This does not mean the city has no officials, only that Ballot Clarity cannot yet attach them here.",
			slug: updatedSlug,
			summary: "This city route stays public so users can orient around the government area even when Ballot Clarity does not yet have a city officeholder pipeline for it.",
			title,
		};
	}

	return null;
}

function buildPublicDistrictRecordFromSlug(slug: string): DistrictRecordResponse | null {
	const districtIdentity = buildPublicDistrictRouteIdentity(slug);

	if (!districtIdentity)
		return null;

	const supplementalOfficeholders = findSupplementalOfficeholdersByDistrictSlug(districtIdentity.slug);
	const updatedAt = new Date().toISOString();
	const resolvedUpdatedAt = supplementalOfficeholders[0]?.updatedAt || updatedAt;
	const resolvedOfficialResources = supplementalOfficeholders[0]?.stateCode
		? getOfficialToolsForState(supplementalOfficeholders[0].stateCode)
		: districtIdentity.officialResources;
	const representatives = supplementalOfficeholders.map(record => ({
		ballotStatusLabel: "Published ballot status unavailable in this area",
		districtLabel: record.districtLabel,
		districtSlug: record.districtSlug,
		fundingAvailable: false,
		fundingSummary: record.jurisdiction === "State"
			? `No reviewed state finance source is configured yet for ${record.stateName} officeholder routes.`
			: "No reviewed local finance source is configured yet for this officeholder route.",
		href: `/representatives/${record.slug}`,
		incumbent: true,
		influenceAvailable: false,
		influenceSummary: record.jurisdiction === "State"
			? `No reviewed state disclosure or lobbying source is configured yet for ${record.stateName} officeholder routes.`
			: "No reviewed local disclosure or lobbying source is configured yet for this officeholder route.",
		location: record.location,
		name: record.name,
		officeSought: record.officeSought,
		officeholderLabel: "Current officeholder",
		onCurrentBallot: false,
		openstatesUrl: record.openstatesUrl,
		party: record.party,
		provenance: {
			label: record.provenanceLabel,
			note: record.provenanceNote,
			status: record.sourceSystem.toLowerCase().includes("official") ? "direct" : "crosswalked",
		},
		slug: record.slug,
		sourceCount: record.sources.length,
		sources: record.sources,
		summary: record.summary,
		updatedAt: record.updatedAt,
	})) satisfies RepresentativeSummary[];
	const sources = [
		buildRouteSource({
			authority: "open-data",
			date: resolvedUpdatedAt,
			id: `district:${districtIdentity.slug}:identity`,
			note: supplementalOfficeholders.length
				? "This public district route resolves a stable district identity and reviewed officeholder records from Ballot Clarity's public route layer even when no active browser lookup context is attached to the request."
				: "This public district route resolves a stable district identity from the slug itself even when no active browser lookup context is attached to the request.",
			publisher: "Ballot Clarity nationwide route layer",
			sourceSystem: "Ballot Clarity nationwide route layer",
			title: `${districtIdentity.title} route identity`,
			url: "/coverage",
		}),
		...supplementalOfficeholders.flatMap(record => record.sources),
		...buildOfficialToolSources(resolvedOfficialResources, resolvedUpdatedAt),
	];
	const representativeAvailabilityNote = supplementalOfficeholders.length
		? districtIdentity.jurisdiction === "Local"
			? `${supplementalOfficeholders.length} reviewed local officeholder record${supplementalOfficeholders.length === 1 ? "" : "s"} ${supplementalOfficeholders.length === 1 ? "is" : "are"} attached to this district route. This is Ballot Clarity's current local officeholder pipeline for this area, not a claim that all local offices are covered yet.`
			: `${supplementalOfficeholders.length} reviewed state officeholder record${supplementalOfficeholders.length === 1 ? "" : "s"} ${supplementalOfficeholders.length === 1 ? "is" : "are"} attached to this district route from the current public officeholder layer.`
		: districtIdentity.representativeAvailabilityNote;
	const districtOriginLabel = supplementalOfficeholders.length
		? supplementalOfficeholders[0]?.jurisdiction === "Local"
			? "Reviewed local officeholder record"
			: "Reviewed state officeholder record"
		: districtIdentity.originLabel;
	const districtOriginNote = supplementalOfficeholders.length
		? `${supplementalOfficeholders[0]?.provenanceNote || districtIdentity.originNote} Active lookup context can still add exact user-specific district confirmation and any stronger locality-specific election tools.`
		: districtIdentity.originNote;
	const note = supplementalOfficeholders.length
		? "This district page resolves as a first-class public route with reviewed officeholder records attached from Ballot Clarity's nationwide officeholder layer. Active nationwide lookup context can still enrich it further with user-specific district confirmation and locality-specific official tools."
		: "This district page resolves as a first-class public route even without browser lookup state. Active nationwide lookup context can still enrich it further with user-specific district confirmation and official tools.";

	return {
		candidateAvailabilityNote: "Candidate field records and local ballot-guide layers remain guide-dependent here. This district route can still show canonical district identity, provenance, and official tools where Ballot Clarity can infer them.",
		candidates: [],
		district: {
			candidateCount: 0,
			description: supplementalOfficeholders.length
				? `${districtIdentity.summary} ${representativeAvailabilityNote}`
				: districtIdentity.summary,
			electionSlug: "nationwide-lookup",
			href: `/districts/${districtIdentity.slug}`,
			jurisdiction: districtIdentity.jurisdiction,
			office: districtIdentity.office,
			representativeCount: representatives.length,
			roleGuide: buildNationwideDistrictRoleGuide({
				jurisdiction: districtIdentity.jurisdiction,
				office: districtIdentity.office,
				title: districtIdentity.title,
			}),
			slug: districtIdentity.slug,
			summary: districtIdentity.summary,
			title: districtIdentity.title,
			updatedAt: resolvedUpdatedAt,
		},
		districtOriginLabel,
		districtOriginNote,
		election: {
			date: resolvedUpdatedAt,
			jurisdictionSlug: "",
			locationName: supplementalOfficeholders[0]?.location || districtIdentity.locationName,
			name: "Public district record",
			slug: "nationwide-lookup",
			updatedAt: resolvedUpdatedAt,
		},
		mode: "nationwide",
		note,
		officialResources: resolvedOfficialResources,
		relatedContests: [],
		representativeAvailabilityNote,
		representatives,
		sources,
		updatedAt: resolvedUpdatedAt,
	};
}

function buildPersonProfileFromCandidate(candidate: Candidate): PersonProfileResponse {
	const sources = collectCandidateSources(candidate);
	const funding: PersonProfileResponse["person"]["funding"] = candidate.funding
		? {
				...candidate.funding,
				provenanceLabel: "Source-backed published filing summary"
			}
		: null;

	return {
		note: "Representative profile assembled from Ballot Clarity's published local person record for this office.",
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
				label: "Source-backed local person record",
				note: "Derived from Ballot Clarity's published local person record for this office.",
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
			sources,
			summary: candidate.summary,
			sourceCount: sources.length,
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
	const ldaClient = options.ldaClient === undefined ? createLdaClient() : options.ldaClient;
	const congressClient = options.congressClient === undefined ? createCongressClient() : options.congressClient;
	const openStatesClient = options.openStatesClient === undefined ? createOpenStatesClient() : options.openStatesClient;
	const openFecClient = options.openFecClient === undefined ? createOpenFecClient() : options.openFecClient;
	const representativeModuleResolver = createRepresentativeModuleResolver({
		congressClient,
		ldaClient,
		openFecClient,
	});
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

	const publicFederalRepresentativeCache = new Map<string, Promise<PersonProfileResponse | null>>();

	async function getPublicFederalRepresentative(slug: string) {
		const normalizedSlug = toLookupSlug(slug);

		if (!normalizedSlug || !congressClient)
			return null;

		const cached = publicFederalRepresentativeCache.get(normalizedSlug);

		if (cached)
			return await cached;

		const pending = (async () => {
			const searchName = buildSearchNameFromRepresentativeSlug(normalizedSlug);

			if (!searchName)
				return null;

			const members = await congressClient.listMembers();
			const rankedMembers = [...members]
				.map(item => ({
					item,
					score: rankDirectFederalMemberMatch(item, searchName),
				}))
				.filter(item => item.score >= 100)
				.sort((left, right) => right.score - left.score);
			const member = rankedMembers[0]?.item;

			if (!member)
				return null;

			const detail = await congressClient.getMember(member.bioguideId);

			if (!detail?.currentMember)
				return null;

			const baseProfile = buildRepresentativeProfileFromCongressMember(detail, normalizedSlug);
			const lookupContext = buildRepresentativeLookupContextFromCongressMember(detail, baseProfile.person.slug, baseProfile.updatedAt);
			return await representativeModuleResolver.enrichNationwidePersonProfile(lookupContext, baseProfile);
		})().catch((error) => {
			publicFederalRepresentativeCache.delete(normalizedSlug);
			throw error;
		});

		publicFederalRepresentativeCache.set(normalizedSlug, pending);
		return await pending;
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

	async function getPublicRepresentative(slug: string) {
		const candidate = await getPublicCandidate(slug);

		if (candidate?.incumbent)
			return buildPersonProfileFromCandidate(candidate);

		const searchName = buildSearchNameFromRepresentativeSlug(slug);

		if (!searchName)
			return null;

		let representativeRecord = null;

		if (openStatesClient) {
			try {
				representativeRecord = (await openStatesClient.searchPeopleByName(searchName, {
					current: true,
					perPage: 10
				})).find(record => toLookupSlug(record.name) === toLookupSlug(slug)) ?? null;
			}
			catch (error) {
				logger.warn("provider.openstates.representative-route-lookup-failed", {
					message: error instanceof Error ? error.message : "Unknown provider error.",
					representativeSlug: slug,
					searchName,
				});
			}
		}

		if (representativeRecord) {
			const baseProfile = buildRepresentativeProfileFromOpenStates(representativeRecord);
			const lookupContext = buildRepresentativeLookupContext(representativeRecord, baseProfile.person.slug, baseProfile.updatedAt);
			return await representativeModuleResolver.enrichNationwidePersonProfile(lookupContext, baseProfile);
		}

		const supplementalOfficeholder = findSupplementalOfficeholderByRepresentativeSlug(slug);

		if (supplementalOfficeholder) {
			const baseProfile = buildRepresentativeProfileFromSupplementalOfficeholder(supplementalOfficeholder);
			const lookupContext = buildRepresentativeLookupContextFromSupplementalOfficeholder(
				supplementalOfficeholder,
				baseProfile.person.slug,
				baseProfile.updatedAt,
			);
			return await representativeModuleResolver.enrichNationwidePersonProfile(lookupContext, baseProfile);
		}

		try {
			const federalRepresentative = await getPublicFederalRepresentative(slug);

			if (federalRepresentative)
				return federalRepresentative;
		}
		catch (error) {
			logger.warn("provider.federal.representative-route-lookup-failed", {
				message: error instanceof Error ? error.message : "Unknown provider error.",
				representativeSlug: slug,
				searchName,
			});
		}

		return null;
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
			candidateAvailabilityNote: contest.candidates?.length
				? "Candidate field records are attached to this district page from the published local guide."
				: "No source-backed candidate field is attached to this district page yet.",
			candidates: contest.candidates ?? [],
			district: {
				...buildDistrictSummary(contest, election),
				description: contest.description,
				electionSlug: election.slug,
				roleGuide: contest.roleGuide
			},
			districtOriginLabel: "Published district page",
			districtOriginNote: "This district page comes from Ballot Clarity's published local guide layer.",
			election: {
				date: election.date,
				jurisdictionSlug: election.jurisdictionSlug,
				locationName: election.locationName,
				name: election.name,
				slug: election.slug,
				updatedAt: election.updatedAt
			},
			mode: "guide",
			note: "District pages group the current representative, the upcoming contest, and the strongest available source links for one office area. Use them when you want district context without the full ballot stack.",
			officialResources: election.officialResources,
			relatedContests,
			representativeAvailabilityNote: representatives.length
				? `${representatives.length} current officeholder${representatives.length === 1 ? "" : "s"} ${representatives.length === 1 ? "is" : "are"} attached to this published district page.`
				: "This published district page does not currently have an incumbent officeholder card attached.",
			representatives,
			sources,
			updatedAt: election.updatedAt
		};
	}

	function buildDistrictsResponse(districts: Awaited<ReturnType<typeof listPublicDistricts>>): DistrictsResponse {
		return {
			districts,
			mode: "guide",
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
			mode: "guide",
			note: "This directory highlights currently serving officials Ballot Clarity can attach to either the active nationwide lookup or the published local guide layer, then links back to district, funding, and influence pages where those modules exist.",
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
						addressEnrichment.representativeMatches = await augmentRepresentativeMatchesForLookup(
							congressClient,
							addressEnrichment.state || "",
							addressEnrichment.districtMatches,
							addressEnrichment.representativeMatches,
						);
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
					const resolvedZipMatches = await Promise.all(zipLookup.matches.map(async match => ({
						...match,
						representativeMatches: await augmentRepresentativeMatchesForLookup(
							congressClient,
							match.stateAbbreviation || "",
							match.districtMatches,
							match.representativeMatches,
						),
					})));
					const selectedZipMatch = selectionId
						? resolvedZipMatches.find(match => match.id === selectionId) ?? null
						: resolvedZipMatches.length === 1
							? resolvedZipMatches[0]
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
					else if (resolvedZipMatches[0]) {
						const fallbackZipMatch = resolvedZipMatches[0];

						geoContext = {
							countyFips: fallbackZipMatch.countyFips,
							countyName: fallbackZipMatch.countyName,
							locality: fallbackZipMatch.locality,
							postalCode: fallbackZipMatch.postalCode,
							sourceSystem: fallbackZipMatch.sourceSystem,
							stateAbbreviation: fallbackZipMatch.stateAbbreviation,
							stateName: fallbackZipMatch.stateName
						};
						selectionOptions = resolvedZipMatches.map(match => buildZipSelectionOption(
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

		const lookupResponse = buildLocationLookupResponse(
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
			selectionOptions,
			selectionId
		);

		const activeLookupContext = buildActiveNationwideLookupContext(lookupResponse);

		if (lookupResponse.result === "resolved" && lookupResponse.availability && activeLookupContext) {
			const financeInfluenceAvailability = await representativeModuleResolver.enrichLocationFinanceInfluenceAvailability(
				activeLookupContext,
				lookupResponse.availability.financeInfluence.detail,
				lookupResponse.availability.financeInfluence.status
			);

			lookupResponse.availability.financeInfluence = {
				...lookupResponse.availability.financeInfluence,
				detail: financeInfluenceAvailability.detail,
				status: financeInfluenceAvailability.status,
			};
		}

		return lookupResponse;
	}

	async function resolveActiveNationwideLookup(request: express.Request, response: express.Response) {
		const routeLookup = typeof request.query.lookup === "string" ? request.query.lookup.trim() : "";
		const routeSelectionId = typeof request.query.selection === "string" ? request.query.selection.trim() : "";

		if (routeLookup) {
			const lookupResponse = await resolveLocationLookup(routeLookup, response.locals.requestId, routeSelectionId || undefined);
			const activeLookupContext = buildActiveNationwideLookupContext(lookupResponse);
			const activeLookupCookie = buildActiveNationwideLookupCookie(lookupResponse);

			if (activeLookupCookie)
				persistActiveNationwideLookupCookie(response, activeLookupCookie);

			return activeLookupContext;
		}

		return readActiveNationwideLookupContext(request.header("cookie"));
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

		const lookupResponse = await resolveLocationLookup(raw, response.locals.requestId, selectionId || undefined);
		const activeLookupCookie = buildActiveNationwideLookupCookie(lookupResponse);

		if (activeLookupCookie)
			persistActiveNationwideLookupCookie(response, activeLookupCookie);
		else
			clearActiveNationwideLookupCookie(response);

		response.json(lookupResponse);
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

		const guessedLookupResponse = {
			...lookupResponse,
			detectedFromIp: true,
			note: `${buildLocationGuessNotePrefix(guess)} ${lookupResponse.note}`.trim()
		};
		const activeLookupCookie = buildActiveNationwideLookupCookie(guessedLookupResponse);

		if (activeLookupCookie)
			persistActiveNationwideLookupCookie(response, activeLookupCookie);
		else
			clearActiveNationwideLookupCookie(response);

		response.json(guessedLookupResponse);
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

	app.get("/api/districts", async (request, response) => {
		const activeNationwideLookup = await resolveActiveNationwideLookup(request, response);

		if (activeNationwideLookup) {
			response.json(buildNationwideDistrictsResponse(activeNationwideLookup));
			return;
		}

		response.json(buildDistrictsResponse(await listPublicDistricts()));
	});

	app.get("/api/districts/:slug", async (request, response) => {
		const activeNationwideLookup = await resolveActiveNationwideLookup(request, response);

		if (activeNationwideLookup) {
			const nationwideDistrict = buildNationwideDistrictRecordResponse(activeNationwideLookup, request.params.slug);

			if (nationwideDistrict) {
				response.json({
					...nationwideDistrict,
					representatives: await representativeModuleResolver.enrichNationwideDistrictRepresentatives(
						activeNationwideLookup,
						nationwideDistrict.representatives
					),
				});
				return;
			}
		}

		const result = await getPublicDistrict(request.params.slug);

		if (!result) {
			response.json(buildPublicDistrictRecordFromSlug(request.params.slug) ?? buildRouteFallbackDistrictRecordResponse(request.params.slug));
			return;
		}

		response.json(buildDistrictRecordResponse(result.contest, result.election));
	});

	app.get("/api/representatives", async (request, response) => {
		const activeNationwideLookup = await resolveActiveNationwideLookup(request, response);

		if (activeNationwideLookup) {
			const nationwideRepresentatives = buildNationwideRepresentativesResponse(activeNationwideLookup);
			response.json({
				...nationwideRepresentatives,
				representatives: await representativeModuleResolver.enrichNationwideRepresentativeDirectory(
					activeNationwideLookup,
					nationwideRepresentatives.representatives
				),
			});
			return;
		}

		const [districts, representatives] = await Promise.all([
			listPublicDistricts(),
			listPublicRepresentatives()
		]);

		response.json(buildRepresentativesResponse(representatives, districts));
	});

	app.get("/api/representatives/:slug", async (request, response) => {
		const activeNationwideLookup = await resolveActiveNationwideLookup(request, response);

		if (activeNationwideLookup) {
			const representativeFromLookup = buildNationwidePersonProfileResponse(activeNationwideLookup, request.params.slug);

			if (representativeFromLookup) {
				response.json(await representativeModuleResolver.enrichNationwidePersonProfile(
					activeNationwideLookup,
					representativeFromLookup
				));
				return;
			}
		}

		const representative = await getPublicRepresentative(request.params.slug);

		if (!representative) {
			response.json(buildRouteFallbackPersonProfileResponse(request.params.slug));
			return;
		}

		response.json(representative);
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
