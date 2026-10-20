import type {
	Candidate,
	ComparisonMatrixColumn,
	ComparisonMatrixData,
	ComparisonMatrixRow,
	Contest,
	FactStat,
	FinanceCategoryBreakdown,
	GraphicsBadge,
	LocationDistrictMatch,
	LocationGuideAvailability,
	LocationLookupAction,
	LocationLookupInputKind,
	LocationRepresentativeMatch,
	ProvenanceSummary,
	RepresentativeCard,
	Source,
	TimelineEvent
} from "~/types/civic";

type DateFormatter = (value: string) => string;

function uniqueSources(sources: Source[]) {
	return [...new Map(sources.map(source => [source.id, source])).values()];
}

function stableSourceId(prefix: string, value: string) {
	return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function sourceDate(value: string | undefined) {
	const normalizedValue = value || new Date().toISOString();

	return normalizedValue.includes("T") ? normalizedValue.slice(0, 10) : normalizedValue;
}

function buildLookupSources(input: {
	districtMatches: LocationDistrictMatch[];
	officialToolActions: LocationLookupAction[];
	representativeMatches: LocationRepresentativeMatch[];
	resolvedAt?: string;
}) {
	const lookupDate = sourceDate(input.resolvedAt);
	const sources: Source[] = [];
	const hasCensusDistrictMatch = input.districtMatches.some(match => /census/i.test(match.sourceSystem));

	if (hasCensusDistrictMatch) {
		sources.push({
			authority: "official-government",
			date: lookupDate,
			id: "lookup-census-geocoder",
			note: "Used for geographic lookup and district context where provider data is available.",
			publisher: "U.S. Census Bureau",
			sourceSystem: "U.S. Census Geocoder",
			title: "U.S. Census Geocoder district match",
			type: "official record",
			url: "https://geocoding.geo.census.gov/geocoder/"
		});
	}

	for (const action of input.officialToolActions) {
		if (!action.url)
			continue;

		sources.push({
			authority: "official-government",
			date: lookupDate,
			id: stableSourceId("lookup-official-tool", action.id),
			note: action.description,
			publisher: action.badge ?? "Official election tool",
			sourceSystem: action.badge ?? "Official election tool",
			title: action.title,
			type: "official record",
			url: action.url
		});
	}

	// Cite every matched official's actual provider, not only those with an Open States link.
	for (const match of input.representativeMatches) {
		const isOpenStates = Boolean(match.openstatesUrl) || /open states/i.test(match.sourceSystem);

		sources.push({
			authority: isOpenStates
				? "nonprofit-provider"
				: /official|congress\.gov|government/i.test(match.sourceSystem) ? "official-government" : "open-data",
			// Prefer the provider's own record date; only fall back to when this lookup retrieved it.
			date: sourceDate(match.updatedAt ?? input.resolvedAt),
			id: stableSourceId("lookup-representative-source", `${match.id}-${match.sourceSystem}`),
			note: match.updatedAt
				? `Representative record for ${match.officeTitle}.`
				: `Representative record for ${match.officeTitle}, retrieved during this lookup.`,
			publisher: isOpenStates ? "Open States" : match.sourceSystem,
			sourceSystem: match.sourceSystem,
			title: `${match.name} representative record`,
			type: "official record",
			url: match.openstatesUrl ?? ""
		});
	}

	return uniqueSources(sources);
}

export function buildLookupProvenanceSummary(input: {
	fromCache: boolean;
	guideAvailability?: LocationGuideAvailability;
	inputKind: LocationLookupInputKind | "";
	officialToolActions?: LocationLookupAction[];
	resolvedAt?: string;
	districtMatches: LocationDistrictMatch[];
	representativeMatches: LocationRepresentativeMatch[];
}): ProvenanceSummary {
	const officialToolActions = input.officialToolActions ?? [];
	const sources = buildLookupSources({
		districtMatches: input.districtMatches,
		officialToolActions,
		representativeMatches: input.representativeMatches,
		resolvedAt: input.resolvedAt
	});
	const items: FactStat[] = [
		{
			detail: input.inputKind === "address"
				? "A full address gives the strongest district match."
				: "ZIP-only lookup remains approximate inside shared postal areas.",
			label: "Lookup type",
			value: input.inputKind === "address" ? "Address matched" : "ZIP matched"
		},
		{
			detail: "These districts decide which offices and ballot questions apply to you.",
			label: "Districts found",
			value: input.districtMatches.length
		},
		{
			detail: "Current officeholders matched to these districts.",
			label: "Representatives found",
			value: input.representativeMatches.length
		},
		{
			detail: input.guideAvailability === "published"
				? "Open the election overview to see which contest pages are verified."
				: "Districts and officials are still shown where no local guide is published yet.",
			label: "Local coverage",
			value: input.guideAvailability === "published" ? "Overview published" : "Not yet published"
		}
	];

	const badges = new Map<string, GraphicsBadge>();

	for (const match of input.districtMatches)
		badges.set(match.sourceSystem, { label: match.sourceSystem, tone: "neutral" });

	for (const match of input.representativeMatches)
		badges.set(match.sourceSystem, { label: match.sourceSystem, tone: "accent" });

	if (officialToolActions.length)
		badges.set("Official election tools", { label: "Official election tools", tone: "accent" });

	if (input.fromCache)
		badges.set("Cached lookup", { label: "Cached lookup", tone: "neutral" });

	return {
		badges: [...badges.values()],
		items,
		note: "Each match is labeled with the data source it came from.",
		sources,
		title: "Sources behind this result",
		uncertainty: "Your election office is the final authority on your districts and ballot style."
	};
}

export function buildRepresentativeCards(matches: LocationRepresentativeMatch[]): RepresentativeCard[] {
	return matches.map(match => ({
		...match,
		sourceLabel: match.sourceSystem,
		summary: `${match.officeTitle} for ${match.districtLabel}.`
	}));
}

export function buildCandidateTimeline(candidate: Candidate): TimelineEvent[] {
	const events: TimelineEvent[] = [
		{
			date: candidate.comparison.ballotStatus.asOf,
			detail: candidate.comparison.ballotStatus.provenance.detail,
			id: `${candidate.slug}-ballot-status`,
			sources: candidate.comparison.ballotStatus.sources,
			summary: candidate.comparison.ballotStatus.label,
			title: "Ballot status confirmed"
		},
		...candidate.keyActions.map(action => ({
			date: action.date,
			detail: action.significance,
			id: action.id,
			sources: action.sources,
			summary: action.summary,
			title: action.title
		}))
	];

	// Newest first across every event, including the ballot-status entry.
	return events.sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
}

export function buildCandidateFinanceCategoryBreakdown(candidate: Candidate, formatDate: DateFormatter): FinanceCategoryBreakdown {
	const totalsByCategory = new Map<string, number>();

	for (const funder of candidate.funding.topFunders)
		totalsByCategory.set(funder.category, (totalsByCategory.get(funder.category) ?? 0) + funder.amount);

	const totalRaised = candidate.funding.totalRaised;
	const itemizedTotal = [...totalsByCategory.values()].reduce((sum, amount) => sum + amount, 0);
	const unitemizedAmount = Math.max(totalRaised - itemizedTotal, 0);
	const shareOfTotal = (amount: number) => totalRaised > 0 ? Math.round((amount / totalRaised) * 100) : 0;
	const categories = [...totalsByCategory.entries()]
		.map(([label, amount]) => ({ amount, label, note: `${shareOfTotal(amount)}% of total raised.` }))
		.sort((left, right) => right.amount - left.amount);

	// Top funders are a sample; show the rest so the bars don't imply they are the whole picture.
	if (unitemizedAmount > 0) {
		categories.push({
			amount: unitemizedAmount,
			label: "Not itemized among top funders",
			note: `${shareOfTotal(unitemizedAmount)}% of total raised, from contributors outside the top-funder list.`
		});
	}

	return {
		categories,
		confidence: "medium",
		coverageNote: `Top funders account for ${shareOfTotal(itemizedTotal)}% of total raised. Based on filings reviewed through ${formatDate(candidate.freshness.dataLastUpdatedAt ?? candidate.updatedAt)}.`,
		cycleLabel: "Current filing window",
		disclaimer: "Finance figures here are summary-level and cycle-bound. They are for scrutiny, not for ranking candidates or inferring motive.",
		linkageType: "direct",
		sourceLabel: "Campaign-finance filings and Ballot Clarity summary",
		sources: candidate.funding.sources,
		totalAmount: candidate.funding.totalRaised
	};
}

export function buildContestComparisonMatrix(contest: Contest): ComparisonMatrixData {
	const columns: ComparisonMatrixColumn[] = contest.type === "candidate"
		? (contest.candidates ?? []).map(candidate => ({
				badges: [
					{ label: candidate.incumbent ? "Incumbent" : "Not incumbent", tone: candidate.incumbent ? "accent" : "neutral" },
					{ label: candidate.comparison.ballotStatus.label, tone: "neutral" }
				],
				id: candidate.slug,
				label: candidate.comparison.displayName,
				meta: `${candidate.officeSought} · ${candidate.party}`,
				sources: candidate.sources
			}))
		: (contest.measures ?? []).map(measure => ({
				badges: [
					{ label: measure.freshness.statusLabel, tone: measure.freshness.status === "up-to-date" ? "accent" : "neutral" }
				],
				id: measure.slug,
				label: measure.title,
				meta: measure.location,
				sources: measure.sources
			}));

	let rows: ComparisonMatrixRow[];

	if (contest.type === "candidate") {
		rows = [
			{
				cells: (contest.candidates ?? []).map(candidate => ({
					columnId: candidate.slug,
					sources: candidate.comparison.ballotStatus.sources,
					value: candidate.comparison.ballotStatus.label
				})),
				id: "ballot-status",
				label: "Ballot status",
				note: "Whether the candidate is confirmed on the ballot."
			},
			{
				cells: (contest.candidates ?? []).map(candidate => ({
					columnId: candidate.slug,
					sources: candidate.comparison.topPriorities.flatMap(priority => priority.sources),
					value: candidate.comparison.topPriorities[0]?.text ?? "No top priority documented yet."
				})),
				id: "priorities",
				label: "Top priorities",
				note: "The first priority the candidate has stated."
			},
			{
				cells: (contest.candidates ?? []).map(candidate => ({
					columnId: candidate.slug,
					sources: candidate.comparison.questionnaireResponses.flatMap(response => response.sources),
					value: `${candidate.comparison.questionnaireResponses.filter(response => response.responseStatus === "answered").length}/${candidate.comparison.questionnaireResponses.length} answered`
				})),
				id: "questionnaire",
				label: "Questionnaire coverage",
				note: "Questionnaire prompts the candidate answered."
			},
			{
				cells: (contest.candidates ?? []).map(candidate => ({
					columnId: candidate.slug,
					sources: candidate.keyActions.flatMap(action => action.sources),
					value: `${candidate.keyActions.length} documented action${candidate.keyActions.length === 1 ? "" : "s"}`
				})),
				id: "actions",
				label: "Documented actions",
				note: "Actions documented with sources on the profile."
			}
		];
	}
	else {
		rows = [
			{
				cells: (contest.measures ?? []).map(measure => ({
					columnId: measure.slug,
					sources: measure.sources,
					value: measure.ballotSummary
				})),
				id: "ballot-summary",
				label: "Official ballot summary",
				note: "What the voter sees in the official measure description."
			},
			{
				cells: (contest.measures ?? []).map(measure => ({
					columnId: measure.slug,
					sources: measure.sources,
					value: measure.plainLanguageExplanation
				})),
				id: "plain-language",
				label: "Plain-language explanation",
				note: "Ballot Clarity's plain-language summary."
			},
			{
				cells: (contest.measures ?? []).map(measure => ({
					columnId: measure.slug,
					sources: measure.sources,
					value: measure.yesMeaning
				})),
				id: "yes-path",
				label: "If YES",
				note: "Headline effect if the measure passes."
			},
			{
				cells: (contest.measures ?? []).map(measure => ({
					columnId: measure.slug,
					sources: measure.sources,
					value: measure.noMeaning
				})),
				id: "no-path",
				label: "If NO",
				note: "Headline effect if the measure fails."
			}
		];
	}

	return {
		columns,
		note: "Read across a row to compare. This is not a scorecard and does not rank anyone.",
		rows,
		title: contest.type === "candidate" ? "Compare the candidates side by side" : "Compare the measures side by side",
		uncertainty: contest.type === "candidate"
			? "Some candidates will have thinner questionnaire or action coverage than others."
			: "Measure rows can still change as more official explanatory material or fiscal notes are added."
	};
}
