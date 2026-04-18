import type { ActiveNationwideLookupContext } from "./active-nationwide-lookup.js";
import type { LdaClient, LdaContributionReport } from "./lda.js";
import type { OpenFecCandidateSearchRecord, OpenFecClient, OpenFecCommitteeTotalsRecord } from "./openfec.js";
import type {
	EvidenceBlock,
	LocationRepresentativeMatch,
	PersonProfileFunding,
	PersonProfileResponse,
	RepresentativeSummary,
	Source,
	TrustBullet,
} from "./types/civic.js";

const currencyFormatter = new Intl.NumberFormat("en-US", {
	currency: "USD",
	maximumFractionDigits: 2,
	minimumFractionDigits: 0,
	style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	month: "short",
	year: "numeric",
});
const committeeSuffixPattern = /\b(?:inc|llc|committee|for|pac|campaign)\b/gi;
const districtNumberPattern = /\b(\d+)\b/;
const incumbentPattern = /incumbent/i;
const normalizedAddressStateCodePattern = /,\s*([A-Z]{2})\s*,\s*\d{5}(?:-\d{4})?\s*$/i;
const officeholderHonorificPattern = /\b(?:the|hon|honorable|rep|representative|cong|congressman|congresswoman|sen|senator|mr|mrs|ms|dr)\b/gi;
const representativeOfficePattern = /representative/i;
const senatorLabelPrefixPattern = /^senator\s+/;
const senatorOfficePattern = /senator/i;

const stateNameToCode = new Map<string, string>([
	["alabama", "AL"],
	["alaska", "AK"],
	["arizona", "AZ"],
	["arkansas", "AR"],
	["california", "CA"],
	["colorado", "CO"],
	["connecticut", "CT"],
	["delaware", "DE"],
	["district-of-columbia", "DC"],
	["district of columbia", "DC"],
	["florida", "FL"],
	["georgia", "GA"],
	["hawaii", "HI"],
	["idaho", "ID"],
	["illinois", "IL"],
	["indiana", "IN"],
	["iowa", "IA"],
	["kansas", "KS"],
	["kentucky", "KY"],
	["louisiana", "LA"],
	["maine", "ME"],
	["maryland", "MD"],
	["massachusetts", "MA"],
	["michigan", "MI"],
	["minnesota", "MN"],
	["mississippi", "MS"],
	["missouri", "MO"],
	["montana", "MT"],
	["nebraska", "NE"],
	["nevada", "NV"],
	["new-hampshire", "NH"],
	["new jersey", "NJ"],
	["new-jersey", "NJ"],
	["new mexico", "NM"],
	["new-mexico", "NM"],
	["new york", "NY"],
	["new-york", "NY"],
	["north carolina", "NC"],
	["north-carolina", "NC"],
	["north dakota", "ND"],
	["north-dakota", "ND"],
	["ohio", "OH"],
	["oklahoma", "OK"],
	["oregon", "OR"],
	["pennsylvania", "PA"],
	["rhode island", "RI"],
	["rhode-island", "RI"],
	["south carolina", "SC"],
	["south-carolina", "SC"],
	["south dakota", "SD"],
	["south-dakota", "SD"],
	["tennessee", "TN"],
	["texas", "TX"],
	["utah", "UT"],
	["vermont", "VT"],
	["virginia", "VA"],
	["washington", "WA"],
	["west virginia", "WV"],
	["west-virginia", "WV"],
	["wisconsin", "WI"],
	["wyoming", "WY"],
]);

interface CreateRepresentativeModuleResolverOptions {
	ldaClient?: LdaClient | null;
	now?: () => Date;
	openFecClient?: OpenFecClient | null;
}

interface FederalRepresentativeTarget {
	cacheKey: string;
	district?: string;
	name: string;
	office: "H" | "S";
	state: string;
}

interface LdaInfluenceAttachment {
	dataAsOf?: string;
	influenceSummary: string;
	lobbyingContext: EvidenceBlock[];
	publicStatements: EvidenceBlock[];
	sources: Source[];
	whatWeKnow: TrustBullet[];
}

interface RepresentativeModuleAttachment {
	dataAsOf?: string;
	funding: PersonProfileFunding | null;
	fundingAvailable: boolean;
	fundingSummary: string;
	influenceAvailable: boolean;
	influenceSummary: string;
	lobbyingContext: EvidenceBlock[];
	methodologyNotes: string[];
	publicStatements: EvidenceBlock[];
	sources: Source[];
	statusNote?: string;
	whatWeKnow: TrustBullet[];
}

export interface RepresentativeModuleResolver {
	enrichLocationFinanceInfluenceAvailability: (context: ActiveNationwideLookupContext, currentDetail: string, currentStatus: "available" | "unavailable") => Promise<{
		detail: string;
		status: "available" | "unavailable";
	}>;
	enrichNationwideDistrictRepresentatives: (context: ActiveNationwideLookupContext, representatives: RepresentativeSummary[]) => Promise<RepresentativeSummary[]>;
	enrichNationwidePersonProfile: (context: ActiveNationwideLookupContext, response: PersonProfileResponse) => Promise<PersonProfileResponse>;
	enrichNationwideRepresentativeDirectory: (context: ActiveNationwideLookupContext, representatives: RepresentativeSummary[]) => Promise<RepresentativeSummary[]>;
}

function normalizeValue(value: string | null | undefined) {
	return String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function normalizeText(value: string | null | undefined) {
	return String(value ?? "")
		.toLowerCase()
		.replace(officeholderHonorificPattern, " ")
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");
}

function toLookupSlug(value: string) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[\s_]+/g, "-")
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

function formatCurrency(amount: number) {
	return currencyFormatter.format(amount || 0);
}

function formatDate(value: string | undefined) {
	if (!value)
		return "";

	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function toStateCode(value: string | null | undefined) {
	const normalized = normalizeValue(value);

	if (!normalized)
		return "";

	if (normalized.length === 2)
		return normalized.toUpperCase();

	return stateNameToCode.get(normalized) || "";
}

function buildTrustBullet(id: string, text: string, sources: Source[], note?: string): TrustBullet {
	return { id, note, sources, text };
}

function uniqueSources(sources: Source[]) {
	return Array.from(new Map(sources.map(source => [source.id, source])).values());
}

function mergeDate(...values: Array<string | undefined>) {
	return values.filter(Boolean).sort().slice(-1)[0];
}

function personSlug(match: LocationRepresentativeMatch) {
	return toLookupSlug(match.id || match.name);
}

function findRepresentativeMatch(context: ActiveNationwideLookupContext, representativeSlug: string) {
	return context.representativeMatches.find(match => personSlug(match) === representativeSlug) ?? null;
}

function inferContextStateCode(context: ActiveNationwideLookupContext) {
	const explicitStateCode = toStateCode(context.location?.state);

	if (explicitStateCode)
		return explicitStateCode;

	const normalizedAddressMatch = context.normalizedAddress.match(normalizedAddressStateCodePattern);
	return normalizedAddressMatch?.[1]?.toUpperCase() || "";
}

function inferDistrictNumber(value: string | null | undefined) {
	return value?.match(districtNumberPattern)?.[1] ?? null;
}

function inferFederalRepresentativeTarget(context: ActiveNationwideLookupContext, match: LocationRepresentativeMatch): FederalRepresentativeTarget | null {
	const stateCode = inferContextStateCode(context);

	if (!stateCode)
		return null;

	if (representativeOfficePattern.test(match.officeTitle)) {
		const explicitDistrictCode = inferDistrictNumber(match.districtLabel);

		if (explicitDistrictCode) {
			return {
				cacheKey: `federal:${stateCode}:house:${explicitDistrictCode}:${normalizeText(match.name)}`,
				district: explicitDistrictCode.padStart(2, "0"),
				name: match.name,
				office: "H",
				state: stateCode,
			};
		}

		const congressionalDistrict = context.districtMatches.find((district) => {
			return normalizeValue(district.districtType).includes("congress")
				&& normalizeText(district.label) === normalizeText(match.districtLabel);
		}) ?? context.districtMatches.find(district => normalizeValue(district.districtType).includes("congress"));

		if (!congressionalDistrict?.districtCode)
			return null;

		return {
			cacheKey: `federal:${stateCode}:house:${congressionalDistrict.districtCode}:${normalizeText(match.name)}`,
			district: String(congressionalDistrict.districtCode).padStart(2, "0"),
			name: match.name,
			office: "H",
			state: stateCode,
		};
	}

	if (senatorOfficePattern.test(match.officeTitle)) {
		const normalizedDistrictLabel = normalizeText(match.districtLabel).replace(senatorLabelPrefixPattern, "");
		const normalizedStateName = normalizeText(context.location?.state);

		if (!normalizedDistrictLabel || (normalizedDistrictLabel !== normalizedStateName && normalizedDistrictLabel !== stateCode.toLowerCase()))
			return null;

		return {
			cacheKey: `federal:${stateCode}:senate:${normalizeText(match.name)}`,
			name: match.name,
			office: "S",
			state: stateCode,
		};
	}

	return null;
}

function namesReliablyMatch(left: string, right: string) {
	const leftTokens = new Set(normalizeText(left).split(" ").filter(Boolean));
	const rightTokens = new Set(normalizeText(right).split(" ").filter(Boolean));

	if (!leftTokens.size || !rightTokens.size || leftTokens.size !== rightTokens.size)
		return false;

	return [...leftTokens].every(token => rightTokens.has(token));
}

function rankCandidateMatch(candidate: OpenFecCandidateSearchRecord, target: FederalRepresentativeTarget) {
	let score = 0;

	if (candidate.office === target.office)
		score += 40;

	if (normalizeValue(candidate.state) === normalizeValue(target.state))
		score += 40;

	if (target.district && normalizeValue(candidate.district) === normalizeValue(target.district))
		score += 20;

	if (namesReliablyMatch(candidate.name, target.name))
		score += 100;

	if (incumbentPattern.test(candidate.incumbentChallengeFull || ""))
		score += 5;

	return score;
}

function pickBestCandidate(candidates: OpenFecCandidateSearchRecord[], target: FederalRepresentativeTarget) {
	const rankedCandidates = [...candidates]
		.map(candidate => ({ candidate, score: rankCandidateMatch(candidate, target) }))
		.sort((left, right) => right.score - left.score);

	return rankedCandidates[0]?.score >= 120 ? rankedCandidates[0].candidate : null;
}

function buildFundingLineItems(totals: OpenFecCommitteeTotalsRecord) {
	const candidates = [
		["Itemized individual donors", "OpenFEC receipt category", totals.individualItemizedContributions],
		["Unitemized individual donors", "OpenFEC receipt category", totals.individualUnitemizedContributions],
		["Other political committees", "OpenFEC receipt category", totals.otherPoliticalCommitteeContributions],
		["Party committees", "OpenFEC receipt category", totals.politicalPartyCommitteeContributions],
		["Authorized committee transfers", "OpenFEC receipt category", totals.transfersFromOtherAuthorizedCommittee],
		["Other receipts", "OpenFEC receipt category", totals.otherReceipts],
		["Candidate contributions", "OpenFEC receipt category", totals.candidateContribution],
	] as const;

	return candidates
		.filter(([, , amount]) => amount > 0)
		.sort((left, right) => right[2] - left[2])
		.slice(0, 4)
		.map(([name, category, amount]) => ({ amount, category, name }));
}

function buildOpenFecSources(candidate: OpenFecCandidateSearchRecord, committeeTotals: OpenFecCommitteeTotalsRecord): Source[] {
	const sourceDate = committeeTotals.coverageEndDate || new Date().toISOString();
	const sources: Source[] = [
		{
			authority: "official-government",
			date: sourceDate,
			id: `openfec:candidate:${candidate.candidateId}`,
			note: "Federal candidate record matched to this officeholder through state, office, district, and name crosswalk checks.",
			publisher: "OpenFEC",
			sourceSystem: "OpenFEC candidate search",
			title: candidate.name,
			type: "campaign filing",
			url: `https://www.fec.gov/data/candidate/${candidate.candidateId}/`,
		},
		{
			authority: "official-government",
			date: sourceDate,
			id: `openfec:committee:${committeeTotals.committeeId}:${committeeTotals.cycle}`,
			note: "Current finance totals are attached from the matched principal committee for this officeholder.",
			publisher: "OpenFEC",
			sourceSystem: "OpenFEC committee totals",
			title: committeeTotals.committeeName,
			type: "campaign filing",
			url: `https://www.fec.gov/data/committee/${committeeTotals.committeeId}/`,
		},
	];

	return uniqueSources(sources);
}

async function resolveFundingAttachment(
	openFecClient: OpenFecClient | null | undefined,
	target: FederalRepresentativeTarget,
	currentYear: number,
): Promise<{
	candidate: OpenFecCandidateSearchRecord;
	dataAsOf?: string;
	funding: PersonProfileFunding;
	fundingSummary: string;
	sources: Source[];
} | null> {
	if (!openFecClient)
		return null;

	const candidates = await openFecClient.searchCandidates({
		district: target.district,
		name: target.name,
		office: target.office,
		state: target.state,
	});
	const candidate = pickBestCandidate(candidates, target);

	if (!candidate)
		return null;

	const cycles = Array.from(new Set([
		...candidate.cycles,
		currentYear,
		currentYear - 2,
	])).sort((left, right) => right - left);
	const committeeId = candidate.principalCommittees[0]?.committeeId;

	if (!committeeId)
		return null;

	let committeeTotals: OpenFecCommitteeTotalsRecord | null = null;

	for (const cycle of cycles) {
		committeeTotals = await openFecClient.getCommitteeTotals(committeeId, cycle);

		if (committeeTotals)
			break;
	}

	if (!committeeTotals)
		return null;

	const coverageLabel = [
		`${committeeTotals.cycle} cycle`,
		committeeTotals.coverageEndDate ? `through ${formatDate(committeeTotals.coverageEndDate)}` : "",
	].filter(Boolean).join(" ");
	const sources = buildOpenFecSources(candidate, committeeTotals);
	const totalRaised = committeeTotals.receipts;
	const smallDonorShare = committeeTotals.receipts > 0
		? Math.min(1, committeeTotals.individualUnitemizedContributions / committeeTotals.receipts)
		: 0;
	const committeeName = candidate.principalCommittees[0]?.name || committeeTotals.committeeName;

	return {
		candidate,
		dataAsOf: committeeTotals.coverageEndDate || candidate.principalCommittees[0]?.lastFileDate,
		funding: {
			cashOnHand: committeeTotals.lastCashOnHandEndPeriod || committeeTotals.cashOnHandBeginningPeriod,
			provenanceLabel: `OpenFEC principal committee totals (${coverageLabel})`,
			smallDonorShare,
			sources,
			summary: `${committeeName} reported ${formatCurrency(totalRaised)} in receipts${committeeTotals.lastCashOnHandEndPeriod ? ` and ${formatCurrency(committeeTotals.lastCashOnHandEndPeriod)} cash on hand` : ""} in the ${coverageLabel}.`,
			topFunders: buildFundingLineItems(committeeTotals),
			totalRaised,
		},
		fundingSummary: `OpenFEC finance summary attached for the ${coverageLabel}.`,
		sources,
	};
}

function normalizeCommitteeName(value: string | undefined) {
	return normalizeText(value).replace(committeeSuffixPattern, " ").trim().replace(/\s+/g, " ");
}

function matchesCommitteePayee(payeeName: string | undefined, committeeName: string | undefined) {
	const normalizedPayee = normalizeCommitteeName(payeeName);
	const normalizedCommittee = normalizeCommitteeName(committeeName);

	if (!normalizedPayee || !normalizedCommittee)
		return false;

	return normalizedPayee === normalizedCommittee || normalizedPayee.includes(normalizedCommittee) || normalizedCommittee.includes(normalizedPayee);
}

function buildLdaReportSource(report: LdaContributionReport, note: string): Source {
	return {
		authority: "official-government",
		date: report.postedAt || `${report.filingYear}-01-01`,
		id: `lda:${report.filingUuid}`,
		note,
		publisher: "LDA.gov",
		sourceSystem: "LDA.gov LD-203 contribution report",
		title: `${report.registrantName} contribution report`,
		type: "ethics filing",
		url: report.filingDocumentUrl || report.url,
	};
}

async function resolveInfluenceAttachment(
	ldaClient: LdaClient | null | undefined,
	target: FederalRepresentativeTarget,
	committeeName: string | undefined,
	currentYear: number,
): Promise<LdaInfluenceAttachment | null> {
	if (!ldaClient || !committeeName)
		return null;

	const yearsToTry = [currentYear, currentYear - 1, currentYear - 2];
	let reports: LdaContributionReport[] = [];
	let resolvedYear = 0;

	for (const year of yearsToTry) {
		const yearReports = await ldaClient.listContributionReports({
			contributionPayee: committeeName,
			filingYear: year,
		});
		const matchedItems = yearReports.flatMap(report => report.contributionItems.filter(item => matchesCommitteePayee(item.payeeName, committeeName)));

		if (matchedItems.length) {
			reports = yearReports;
			resolvedYear = year;
			break;
		}
	}

	if (!reports.length || !resolvedYear)
		return null;

	const filteredReports = reports
		.map((report) => {
			const matchingItems = report.contributionItems.filter(item => matchesCommitteePayee(item.payeeName, committeeName));

			if (!matchingItems.length)
				return null;

			return {
				...report,
				contributionItems: matchingItems,
			};
		})
		.filter((report): report is LdaContributionReport => Boolean(report));

	const totalAmount = filteredReports.reduce((sum, report) => {
		return sum + report.contributionItems.reduce((reportSum, item) => reportSum + item.amount, 0);
	}, 0);
	const contributionCount = filteredReports.reduce((sum, report) => sum + report.contributionItems.length, 0);

	if (!contributionCount)
		return null;

	const registrantTotals = new Map<string, number>();

	for (const report of filteredReports) {
		const reportAmount = report.contributionItems.reduce((sum, item) => sum + item.amount, 0);
		registrantTotals.set(report.registrantName, (registrantTotals.get(report.registrantName) ?? 0) + reportAmount);
	}

	const topRegistrants = [...registrantTotals.entries()]
		.sort((left, right) => right[1] - left[1])
		.slice(0, 3)
		.map(([name, amount]) => `${name} (${formatCurrency(amount)})`);
	const sources = uniqueSources(filteredReports
		.slice(0, 6)
		.map(report => buildLdaReportSource(report, `LD-203 contribution report matched to ${committeeName}.`)));
	const latestPostedAt = mergeDate(...filteredReports.map(report => report.postedAt));
	const summary = `${contributionCount} LD-203 contribution item${contributionCount === 1 ? "" : "s"} across ${filteredReports.length} report${filteredReports.length === 1 ? "" : "s"} in ${resolvedYear} matched ${committeeName}, totaling ${formatCurrency(totalAmount)}.${topRegistrants.length ? ` Largest reporting registrants: ${topRegistrants.join(", ")}.` : ""}`;

	return {
		dataAsOf: latestPostedAt,
		influenceSummary: `LD-203 contribution disclosure context attached from ${resolvedYear} reports.`,
		lobbyingContext: [
			{
				id: `lda:${target.cacheKey}:${resolvedYear}`,
				sources,
				summary,
				title: "Lobbying-disclosure contribution reports",
			},
		],
		publicStatements: [],
		sources,
		whatWeKnow: [
			buildTrustBullet(
				"lda-contributions",
				`LD-203 contribution reports filed in ${resolvedYear} are attached to this officeholder through the matched federal committee ${committeeName}.`,
				sources,
			),
		],
	};
}

function buildUnavailableFundingSummary(target: FederalRepresentativeTarget | null) {
	return target
		? "No OpenFEC finance summary matched this officeholder's current federal campaign record yet."
		: "No person-level funding record is attached to this representative yet.";
}

function buildUnavailableInfluenceSummary(target: FederalRepresentativeTarget | null) {
	return target
		? "No LD-203 contribution disclosure is attached to this officeholder's current federal campaign record yet."
		: "No person-level influence record is attached to this representative yet.";
}

function buildStatusNote(hasModules: boolean) {
	return hasModules
		? "This profile reflects the latest nationwide lookup plus attached federal finance and disclosure records. Verify critical details against the provider record, FEC filings, and official election tools."
		: "This profile reflects the latest nationwide lookup currently saved in this browser. Verify critical details against the attached provider record and official election tools.";
}

export function createRepresentativeModuleResolver({
	ldaClient = null,
	now = () => new Date(),
	openFecClient = null,
}: CreateRepresentativeModuleResolverOptions = {}): RepresentativeModuleResolver {
	const attachmentCache = new Map<string, Promise<RepresentativeModuleAttachment>>();

	async function resolveAttachment(context: ActiveNationwideLookupContext, match: LocationRepresentativeMatch): Promise<RepresentativeModuleAttachment> {
		const target = inferFederalRepresentativeTarget(context, match);
		const cacheKey = target?.cacheKey || `nonfederal:${context.location?.state || "unknown"}:${personSlug(match)}`;
		const cached = attachmentCache.get(cacheKey);

		if (cached)
			return await cached;

		const currentYear = now().getUTCFullYear();
		const pending = (async () => {
			const fundingAttachment = target
				? await resolveFundingAttachment(openFecClient, target, currentYear)
				: null;
			const influenceAttachment = target
				? await resolveInfluenceAttachment(
						ldaClient,
						target,
						fundingAttachment?.candidate.principalCommittees[0]?.name,
						currentYear,
					)
				: null;
			const funding = fundingAttachment?.funding ?? null;
			const lobbyingContext = influenceAttachment?.lobbyingContext ?? [];
			const publicStatements = influenceAttachment?.publicStatements ?? [];
			const sources = uniqueSources([
				...(fundingAttachment?.sources ?? []),
				...(influenceAttachment?.sources ?? []),
			]);
			const whatWeKnow: TrustBullet[] = [
				...(influenceAttachment?.whatWeKnow ?? []),
				...(funding
					? [
							buildTrustBullet(
								"openfec-finance",
								`${funding.provenanceLabel || "OpenFEC finance summary"} is attached to this officeholder through a reliable federal crosswalk.`,
								funding.sources,
							),
						]
					: []),
			];

			return {
				dataAsOf: mergeDate(fundingAttachment?.dataAsOf, influenceAttachment?.dataAsOf),
				funding,
				fundingAvailable: Boolean(funding),
				fundingSummary: fundingAttachment?.fundingSummary || buildUnavailableFundingSummary(target),
				influenceAvailable: lobbyingContext.length > 0 || publicStatements.length > 0,
				influenceSummary: influenceAttachment?.influenceSummary || buildUnavailableInfluenceSummary(target),
				lobbyingContext,
				methodologyNotes: [
					...(funding
						? ["Federal finance data is attached through an OpenFEC candidate and principal-committee crosswalk anchored to the current officeholder match."]
						: []),
					...(lobbyingContext.length
						? ["Influence context is attached through LD-203 contribution reports matched to the officeholder's current federal campaign committee."]
						: []),
				],
				publicStatements,
				sources,
				statusNote: buildStatusNote(Boolean(funding || lobbyingContext.length || publicStatements.length)),
				whatWeKnow,
			};
		})().catch((error) => {
			attachmentCache.delete(cacheKey);
			throw error;
		});

		attachmentCache.set(cacheKey, pending);
		return await pending;
	}

	async function enrichRepresentatives(context: ActiveNationwideLookupContext, representatives: RepresentativeSummary[]) {
		return await Promise.all(representatives.map(async (representative) => {
			const match = findRepresentativeMatch(context, representative.slug);

			if (!match)
				return representative;

			const attachment = await resolveAttachment(context, match);

			return {
				...representative,
				fundingAvailable: attachment.fundingAvailable,
				fundingSummary: attachment.fundingSummary,
				influenceAvailable: attachment.influenceAvailable,
				influenceSummary: attachment.influenceSummary,
			};
		}));
	}

	return {
		async enrichLocationFinanceInfluenceAvailability(context, currentDetail, currentStatus) {
			const enrichedRepresentatives = await enrichRepresentatives(
				context,
				context.representativeMatches.map(match => ({
					ballotStatusLabel: "Published ballot status unavailable in this area",
					districtLabel: match.districtLabel,
					districtSlug: "",
					fundingAvailable: false,
					fundingSummary: "",
					href: "",
					incumbent: true,
					influenceAvailable: false,
					influenceSummary: "",
					location: context.location?.displayName || context.normalizedAddress || "Nationwide lookup",
					name: match.name,
					officeSought: match.officeTitle,
					officeholderLabel: "Current officeholder",
					onCurrentBallot: false,
					openstatesUrl: match.openstatesUrl,
					party: match.party ?? "Unknown",
					provenance: null,
					slug: personSlug(match),
					sourceCount: 0,
					summary: "",
					updatedAt: context.resolvedAt,
				}) satisfies RepresentativeSummary),
			);
			const hasModules = enrichedRepresentatives.some(
				representative => representative.fundingAvailable || representative.influenceAvailable,
			);

			if (!hasModules)
				return { detail: currentDetail, status: currentStatus };

			return {
				detail: "Some matched representative pages now include person-level funding and influence modules through reliable federal crosswalks. Open the representative directory or a person page to inspect those records.",
				status: "available",
			};
		},
		async enrichNationwideDistrictRepresentatives(context, representatives) {
			return await enrichRepresentatives(context, representatives);
		},
		async enrichNationwidePersonProfile(context, response) {
			const match = findRepresentativeMatch(context, response.person.slug);

			if (!match)
				return response;

			const attachment = await resolveAttachment(context, match);
			const addedSources = uniqueSources([
				...response.person.sources,
				...attachment.sources,
				...(attachment.funding?.sources ?? []),
				...attachment.lobbyingContext.flatMap(block => block.sources),
				...attachment.publicStatements.flatMap(block => block.sources),
			]);
			const biography = attachment.sources.length
				? [
						...response.person.biography,
						{
							id: `federal-crosswalk:${response.person.slug}`,
							sources: attachment.sources,
							summary: "Ballot Clarity attached federal finance and disclosure records to this officeholder through a structured crosswalk from the active nationwide lookup.",
							title: "Federal finance and disclosure crosswalk",
						} satisfies EvidenceBlock,
					]
				: response.person.biography;
			const whatWeKnow = uniqueSources([
				...response.person.whatWeKnow.flatMap(item => item.sources),
				...attachment.whatWeKnow.flatMap(item => item.sources),
			]).length
				? [...response.person.whatWeKnow, ...attachment.whatWeKnow]
				: response.person.whatWeKnow;

			return {
				...response,
				person: {
					...response.person,
					biography,
					freshness: {
						...response.person.freshness,
						dataLastUpdatedAt: attachment.dataAsOf || response.person.freshness.dataLastUpdatedAt,
						statusNote: attachment.statusNote || response.person.freshness.statusNote,
					},
					funding: attachment.funding,
					lobbyingContext: attachment.lobbyingContext,
					methodologyNotes: [
						...response.person.methodologyNotes,
						...attachment.methodologyNotes,
					],
					publicStatements: attachment.publicStatements,
					sourceCount: addedSources.length,
					sources: addedSources,
					whatWeKnow,
				},
				updatedAt: response.updatedAt,
			};
		},
		async enrichNationwideRepresentativeDirectory(context, representatives) {
			return await enrichRepresentatives(context, representatives);
		},
	};
}
