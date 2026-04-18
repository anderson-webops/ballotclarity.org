import type {
	BeforeAfterData,
	Candidate,
	ComparisonMatrixColumn,
	ComparisonMatrixData,
	ComparisonMatrixRow,
	Contest,
	EvidenceCompleteness,
	FactStat,
	FinanceCategoryBreakdown,
	FreshnessMeta,
	GraphicsBadge,
	InfluenceDisclosureSummary,
	LocationDataAvailabilitySummary,
	LocationDistrictMatch,
	LocationGuideAvailability,
	LocationLookupInputKind,
	LocationRepresentativeMatch,
	Measure,
	MeasureImpact,
	OfficeContext,
	ProvenanceSummary,
	RepresentativeCard,
	RepresentativesResponse,
	Source,
	SourceDensityEntity,
	TimelineEvent
} from "~/types/civic";

type DateFormatter = (value: string) => string;
type CompactNumberFormatter = (value: number) => string;
type CurrencyFormatter = (value: number) => string;

function uniqueSources(sources: Source[]) {
	return [...new Map(sources.map(source => [source.id, source])).values()];
}

function toneFromFreshness(freshness: FreshnessMeta): GraphicsBadge["tone"] {
	if (freshness.status === "up-to-date")
		return "accent";

	if (freshness.status === "updating")
		return "warning";

	return "neutral";
}

function notConfidenceNote() {
	return "These summaries describe what the current archive documents, not a score for trustworthiness or suitability.";
}

const federalRepresentativePattern = /u\.s\.|united states|congress|senate|house of representatives/;
const stateRepresentativePattern = /state|general assembly|house district|senate district|legislature/;
const localRepresentativePattern = /county|city|school|commission|board|council|mayor|parish|town/;

export function buildLookupProvenanceSummary(input: {
	fromCache: boolean;
	guideAvailability?: LocationGuideAvailability;
	hasOfficialTools?: boolean;
	inputKind: LocationLookupInputKind | "";
	districtMatches: LocationDistrictMatch[];
	representativeMatches: LocationRepresentativeMatch[];
}): ProvenanceSummary {
	const items: FactStat[] = [
		{
			detail: input.inputKind === "address"
				? "A full address gives the strongest district match."
				: "ZIP-only lookup remains approximate inside shared postal areas.",
			label: "Lookup type",
			value: input.inputKind === "address" ? "Address matched" : "ZIP matched"
		},
		{
			detail: "These district layers drive the person-centered result first.",
			label: "Districts found",
			value: input.districtMatches.length
		},
		{
			detail: "Current officeholder matches come from the provider-backed enrichment layer.",
			label: "Representatives found",
			value: input.representativeMatches.length
		},
		{
			detail: input.guideAvailability === "published"
				? "A deeper Ballot Clarity local guide is available for this result."
				: "Nationwide district and representative results are available even without a published local guide.",
			label: "Guide depth",
			value: input.guideAvailability === "published" ? "Published guide" : "Nationwide lookup"
		}
	];

	const badges = new Map<string, GraphicsBadge>();

	for (const match of input.districtMatches)
		badges.set(match.sourceSystem, { label: match.sourceSystem, tone: "neutral" });

	for (const match of input.representativeMatches)
		badges.set(match.sourceSystem, { label: match.sourceSystem, tone: "accent" });

	if (input.hasOfficialTools)
		badges.set("Official election tools", { label: "Official election tools", tone: "accent" });

	if (input.fromCache)
		badges.set("Cached lookup", { label: "Cached lookup", tone: "neutral" });

	return {
		badges: [...badges.values()],
		items,
		note: "Ballot Clarity keeps the nationwide result first, then layers in local guide depth where it exists.",
		sources: [],
		title: "How this lookup was verified",
		uncertainty: "District and representative results are the first-class nationwide output. Full local guide availability is a separate layer."
	};
}

export function buildLocationAvailabilityItems(availability: LocationDataAvailabilitySummary | null | undefined) {
	if (!availability)
		return [];

	return [
		availability.representatives,
		availability.ballotCandidates,
		availability.financeInfluence,
		availability.fullLocalGuide
	];
}

function inferRepresentativeLevel(card: RepresentativeCard) {
	const text = `${card.officeTitle} ${card.districtLabel}`.toLowerCase();

	if (federalRepresentativePattern.test(text))
		return "Federal";

	if (stateRepresentativePattern.test(text))
		return "State";

	if (localRepresentativePattern.test(text))
		return "Local";

	return "Other";
}

export function buildRepresentativeCards(matches: LocationRepresentativeMatch[]): RepresentativeCard[] {
	return matches.map(match => ({
		...match,
		badges: [
			{ label: inferRepresentativeLevel(match), tone: inferRepresentativeLevel(match) === "Federal" ? "accent" : "neutral" },
			{ label: match.sourceSystem, tone: "neutral" }
		],
		confidence: "medium",
		linkageType: "direct",
		sourceLabel: match.sourceSystem,
		summary: `${match.officeTitle} for ${match.districtLabel}.`
	}));
}

export function buildCandidateProvenanceSummary(candidate: Candidate, formatDate: DateFormatter): ProvenanceSummary {
	return {
		badges: [
			{
				label: candidate.freshness.statusLabel,
				tone: toneFromFreshness(candidate.freshness)
			},
			{
				label: candidate.comparison.ballotStatus.provenance.label,
				title: candidate.comparison.ballotStatus.provenance.detail,
				tone: candidate.comparison.ballotStatus.provenance.status === "verified-official"
					? "accent"
					: candidate.comparison.ballotStatus.provenance.status === "unclear"
						? "warning"
						: "neutral"
			}
		],
		items: [
			{
				detail: candidate.freshness.statusNote,
				label: "Data through",
				value: formatDate(candidate.freshness.dataLastUpdatedAt ?? candidate.updatedAt)
			},
			{
				detail: "Planned next review window for this profile.",
				label: "Next review",
				value: formatDate(candidate.freshness.nextReviewAt)
			},
			{
				detail: "Total source records attached to this profile page.",
				label: "Source records",
				value: candidate.sources.length
			},
			{
				detail: "Explicit gaps or unresolved checks called out on this page.",
				label: "Open questions",
				value: candidate.whatWeDoNotKnow.length
			}
		],
		note: "This strip keeps ballot verification, review timing, and source depth in one place so the profile body can stay focused on the public record.",
		sources: candidate.sources,
		title: "Verification and review status",
		uncertainty: notConfidenceNote()
	};
}

export function buildCandidateOfficeContext(candidate: Candidate, formatCurrency: CurrencyFormatter, formatCompactNumber: CompactNumberFormatter, dataThroughLabel: string): OfficeContext {
	const influenceSectors = [...new Set(candidate.funding.topFunders.map(funder => funder.category))].slice(0, 2);

	return {
		badges: [
			{ label: candidate.incumbent ? "Incumbent" : "Challenger", tone: candidate.incumbent ? "accent" : "neutral" },
			{ label: candidate.party, tone: "neutral" }
		],
		officeLabel: `${candidate.officeSought} · ${candidate.location}`,
		responsibilities: [
			"Ballot status and issue statements tied to current source records.",
			"Selected actions or public record items included in the current archive.",
			"Funding and influence context separated from endorsement or scorecard language."
		],
		sources: candidate.sources,
		stats: [
			{
				label: candidate.incumbent ? "Documented votes and actions" : "Documented campaign actions",
				detail: candidate.incumbent
					? "Selected official actions in the current project archive. This page is not a full legislative ledger."
					: "Published policy releases, local-government actions, and other source-backed items included in the current project archive.",
				value: formatCompactNumber(candidate.keyActions.length)
			},
			{
				label: "Money in",
				detail: `Reported fundraising in the current filing window. Data through ${dataThroughLabel}.`,
				value: formatCurrency(candidate.funding.totalRaised)
			},
			{
				label: "Influence context",
				detail: influenceSectors.length
					? `Context draws on ${influenceSectors.join(" and ")}. This is context only, not proof of influence.`
					: "Influence notes are shown as context only, not proof of influence.",
				value: `${candidate.lobbyingContext.length} note${candidate.lobbyingContext.length === 1 ? "" : "s"}`
			},
			{
				label: "Source records",
				detail: "Attached records supporting this profile.",
				value: candidate.sources.length
			}
		],
		summary: candidate.summary,
		title: "Office and record context",
		uncertainty: "This profile summarizes the current archive. It does not claim to be a complete career, voting, donor, or lobbying file.",
		whyItMatters: "Start here to understand the office, the candidate’s current documented record, and how much of that record is sourced in the current Ballot Clarity archive."
	};
}

export function buildCandidateComparisonMatrix(candidate: Candidate): ComparisonMatrixData {
	const answeredQuestionnaire = candidate.comparison.questionnaireResponses.filter(response => response.responseStatus === "answered");
	const firstPriority = candidate.comparison.topPriorities[0];
	const secondPriority = candidate.comparison.topPriorities[1];
	const latestStatement = candidate.publicStatements[0];

	const columns: ComparisonMatrixColumn[] = [
		{
			badges: [{ label: candidate.comparison.whyRunning.provenance.label, tone: "neutral" }],
			id: "why-running",
			label: "Why running",
			meta: "Candidate-framed rationale",
			sources: candidate.comparison.whyRunning.sources
		},
		{
			badges: [{ label: `${candidate.topIssues.length} issue tags`, tone: "accent" }],
			id: "priorities",
			label: "Top priorities",
			meta: `${candidate.comparison.topPriorities.length} stated priorities`,
			sources: candidate.comparison.topPriorities.flatMap(priority => priority.sources)
		},
		{
			badges: [{ label: "Candidate-submitted responses", tone: "neutral" }],
			id: "questionnaire",
			label: "Questionnaire",
			meta: `${answeredQuestionnaire.length}/${candidate.comparison.questionnaireResponses.length} answered`,
			sources: candidate.comparison.questionnaireResponses.flatMap(response => response.sources)
		},
		{
			badges: [{ label: "Archive-linked", tone: "accent" }],
			id: "public-record",
			label: "Public statements",
			meta: `${candidate.publicStatements.length} attached statement blocks`,
			sources: candidate.publicStatements.flatMap(statement => statement.sources)
		}
	];

	const rows: ComparisonMatrixRow[] = [
		{
			cells: [
				{ columnId: "why-running", value: candidate.comparison.whyRunning.text ? "Documented" : "Not documented yet" },
				{ columnId: "priorities", value: `${candidate.topIssues.length} issue tag${candidate.topIssues.length === 1 ? "" : "s"}` },
				{ columnId: "questionnaire", value: `${answeredQuestionnaire.length} answered response${answeredQuestionnaire.length === 1 ? "" : "s"}` },
				{ columnId: "public-record", value: `${candidate.publicStatements.length} statement block${candidate.publicStatements.length === 1 ? "" : "s"}` }
			],
			id: "coverage",
			label: "Issue coverage",
			note: "How many issue-bearing surfaces are documented in this profile right now."
		},
		{
			cells: [
				{ columnId: "why-running", value: candidate.comparison.whyRunning.text ?? "No source-backed statement in this archive." },
				{ columnId: "priorities", value: firstPriority?.text ?? "No top priority documented yet." },
				{ columnId: "questionnaire", value: answeredQuestionnaire[0]?.answerText ?? "No answered questionnaire response in this archive." },
				{ columnId: "public-record", value: latestStatement?.summary ?? "No public statement block attached yet." }
			],
			id: "first-signal",
			label: "First policy signal",
			note: "The first readable issue clue a voter encounters in each evidence channel."
		},
		{
			cells: [
				{ columnId: "why-running", value: candidate.topIssues[0]?.label ?? "No issue tag attached yet." },
				{ columnId: "priorities", value: secondPriority?.text ?? "No second priority documented yet." },
				{ columnId: "questionnaire", value: answeredQuestionnaire[1]?.answerText ?? "No second answered questionnaire response in this archive." },
				{ columnId: "public-record", value: candidate.publicStatements[1]?.summary ?? "No second public statement block attached yet." }
			],
			id: "second-signal",
			label: "Second policy signal",
			note: "A second row so the matrix exposes whether the archive has depth beyond one isolated quote."
		}
	];

	return {
		columns,
		note: "This matrix is a reading surface, not a scorecard. It separates issue-bearing channels so voters can see what type of evidence is attached to each claim.",
		rows,
		title: "Issue and position evidence by source channel",
		uncertainty: "Different channels can describe the same issue at different levels of detail, and some candidates will have partial questionnaire or public-statement coverage."
	};
}

export function buildCandidateTimeline(candidate: Candidate): TimelineEvent[] {
	const orderedActions = [...candidate.keyActions].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

	return [
		{
			date: candidate.comparison.ballotStatus.asOf,
			detail: candidate.comparison.ballotStatus.provenance.detail,
			id: `${candidate.slug}-ballot-status`,
			sources: candidate.comparison.ballotStatus.sources,
			summary: candidate.comparison.ballotStatus.label,
			title: "Ballot status verified"
		},
		...orderedActions.map(action => ({
			date: action.date,
			detail: action.significance,
			id: action.id,
			sources: action.sources,
			summary: action.summary,
			title: action.title
		}))
	];
}

export function buildCandidateEvidenceCompleteness(candidate: Candidate): EvidenceCompleteness {
	return {
		freshness: candidate.freshness,
		known: candidate.whatWeKnow,
		note: "The documented and open columns are direct lifts from the current profile methodology notes.",
		sources: candidate.sources,
		title: "How complete is this candidate profile?",
		uncertainty: "This is an archive-completeness view. It does not imply anything about candidate quality or likely future behavior.",
		unknown: candidate.whatWeDoNotKnow
	};
}

export function buildCandidateFinanceCategoryBreakdown(candidate: Candidate, formatDate: DateFormatter): FinanceCategoryBreakdown {
	const totalsByCategory = new Map<string, number>();

	for (const funder of candidate.funding.topFunders)
		totalsByCategory.set(funder.category, (totalsByCategory.get(funder.category) ?? 0) + funder.amount);

	return {
		categories: [...totalsByCategory.entries()].map(([label, amount]) => ({ amount, label })).sort((left, right) => right.amount - left.amount),
		confidence: "medium",
		coverageNote: `Derived from the current finance summary and attached filing sources reviewed through ${formatDate(candidate.freshness.dataLastUpdatedAt ?? candidate.updatedAt)}.`,
		cycleLabel: "Current filing window",
		disclaimer: "Finance figures here are summary-level and cycle-bound. They are for scrutiny, not for ranking candidates or inferring motive.",
		linkageType: "direct",
		sourceLabel: "Campaign-finance filings and Ballot Clarity summary",
		sources: candidate.funding.sources,
		totalAmount: candidate.funding.totalRaised
	};
}

export function buildCandidateInfluenceDisclosureSummary(candidate: Candidate): InfluenceDisclosureSummary {
	return {
		confidence: candidate.lobbyingContext.length >= 3 ? "medium" : "low",
		coverageNote: "This summary is built from Ballot Clarity influence-context notes and linked public statements. It is not a full lobbying registry crosswalk.",
		disclaimer: "Influence context is a caution layer. It can highlight overlap or relevant sectors, but it does not prove control, coordination, or causation.",
		issueAreas: candidate.topIssues.map(issue => issue.label),
		linkageType: candidate.lobbyingContext.length >= 3 ? "crosswalked" : "inferred",
		lobbyingOrganizations: candidate.lobbyingContext.map(block => block.title),
		sourceCount: uniqueSources(candidate.lobbyingContext.flatMap(block => block.sources)).length,
		sourceLabel: "Influence-context notes and linked public records",
		sources: uniqueSources(candidate.lobbyingContext.flatMap(block => block.sources))
	};
}

export function buildMeasureProvenanceSummary(measure: Measure, formatDate: DateFormatter): ProvenanceSummary {
	return {
		badges: [
			{
				label: measure.freshness.statusLabel,
				tone: toneFromFreshness(measure.freshness)
			}
		],
		items: [
			{
				detail: measure.freshness.statusNote,
				label: "Data through",
				value: formatDate(measure.freshness.dataLastUpdatedAt ?? measure.updatedAt)
			},
			{
				detail: "Planned next review window for this measure page.",
				label: "Next review",
				value: formatDate(measure.freshness.nextReviewAt)
			},
			{
				detail: "Source records attached to this measure explainer.",
				label: "Source records",
				value: measure.sources.length
			},
			{
				detail: "Open questions or unresolved implementation details on this page.",
				label: "Open questions",
				value: measure.whatWeDoNotKnow.length
			}
		],
		note: "Measure pages separate freshness, provenance, and uncertainty from the practical reading flow below.",
		sources: measure.sources,
		title: "Verification and review status",
		uncertainty: notConfidenceNote()
	};
}

export function buildMeasureBeforeAfterData(measure: Measure): BeforeAfterData {
	return {
		afterItems: measure.proposedChanges.map(item => ({ id: item.id, sources: item.sources, text: item.text })),
		afterLabel: "After",
		afterSummary: measure.yesMeaning,
		beforeItems: measure.currentPractice.map(item => ({ id: item.id, sources: item.sources, text: item.text })),
		beforeLabel: "Before",
		beforeSummary: measure.currentLawOverview,
		sources: uniqueSources([
			...measure.currentPractice.flatMap(item => item.sources),
			...measure.proposedChanges.flatMap(item => item.sources)
		]),
		title: "What changes and what stays the same",
		uncertainty: measure.whatWeDoNotKnow[0]?.text ?? "Later legal interpretation, budget choices, or implementation rules can still change the practical effect after passage."
	};
}

export function buildMeasureImpact(measure: Measure): MeasureImpact {
	return {
		currentPath: {
			items: measure.currentPractice.slice(0, 3).map(item => ({ id: item.id, sources: item.sources, text: item.text })),
			label: "Today",
			sources: uniqueSources(measure.currentPractice.flatMap(item => item.sources)),
			summary: measure.currentLawOverview,
			title: "Current practice"
		},
		fiscalItems: measure.fiscalSummary.slice(0, 3).map(item => ({
			detail: `${item.scope} · ${item.horizon}. ${item.note}`,
			id: item.id,
			label: item.label,
			sources: item.sources,
			value: item.value
		})),
		fiscalSummary: measure.fiscalContextNote,
		implementationSummary: measure.implementationOverview,
		implementationTimeline: measure.implementationTimeline.slice(0, 3).map(item => ({
			date: item.timing,
			id: item.id,
			sources: item.sources,
			summary: item.summary,
			title: item.label
		})),
		noPath: {
			items: measure.noHighlights.map((text, index) => ({ id: `${measure.slug}-no-${index + 1}`, text })),
			label: "If NO",
			sources: uniqueSources(measure.currentPractice.flatMap(item => item.sources)),
			summary: measure.noMeaning,
			title: "Status quo remains"
		},
		note: "This diagram separates current rules from the YES and NO paths so you can compare practical effects without reading advocacy copy.",
		title: "What changes if this passes, and what stays if it fails?",
		uncertainty: measure.whatWeDoNotKnow[0]?.text ?? "Later budgets, legal interpretation, or agency rulemaking can still change the real-world effect after passage.",
		yesPath: {
			items: measure.yesHighlights.map((text, index) => ({ id: `${measure.slug}-yes-${index + 1}`, text })),
			label: "If YES",
			sources: uniqueSources(measure.proposedChanges.flatMap(item => item.sources)),
			summary: measure.yesMeaning,
			title: "Change takes effect"
		}
	};
}

export function buildMeasureEvidenceCompleteness(measure: Measure): EvidenceCompleteness {
	return {
		freshness: measure.freshness,
		known: measure.whatWeKnow,
		note: "These completeness bullets tell you what the current measure explainer documents directly and what still needs verification.",
		sources: measure.sources,
		title: "How complete is this measure page?",
		uncertainty: "This is an evidence-coverage aid. It is not a recommendation or prediction of legal effect.",
		unknown: measure.whatWeDoNotKnow
	};
}

export function buildContestOfficeContext(contest: Contest, sourceCount: number, relatedContestCount: number): OfficeContext {
	const entryCount = contest.type === "candidate"
		? contest.candidates?.length ?? 0
		: contest.measures?.length ?? 0;

	return {
		badges: [
			{ label: contest.jurisdiction, tone: "neutral" },
			{ label: contest.type === "candidate" ? "Candidate contest" : "Ballot measure", tone: "accent" }
		],
		officeLabel: contest.office,
		responsibilities: [
			"Read the office or ballot-question context before opening deeper candidate or measure pages.",
			"Use the comparison surface to see which evidence channels are attached to each entity.",
			"Open related contests when you need full-ballot context around this office."
		],
		stats: [
			{
				label: "Source records",
				detail: "Attached across the full contest surface.",
				value: sourceCount
			},
			{
				label: contest.type === "candidate" ? "Candidates" : "Measures",
				detail: contest.type === "candidate"
					? "People currently included in this contest surface."
					: "Measure explainers included in this contest surface.",
				value: entryCount
			},
			{
				label: "Related contests",
				detail: "Linked follow-on surfaces in the same public guide.",
				value: relatedContestCount
			}
		],
		summary: contest.description,
		title: "Contest and office context",
		uncertainty: "Contest pages are canonical reading surfaces for one office or ballot question, but candidate and measure record depth can still vary across entities.",
		whyItMatters: contest.roleGuide.whyItMatters
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
				note: "Verified ballot inclusion and provenance."
			},
			{
				cells: (contest.candidates ?? []).map(candidate => ({
					columnId: candidate.slug,
					sources: candidate.comparison.topPriorities.flatMap(priority => priority.sources),
					value: candidate.comparison.topPriorities[0]?.text ?? "No top priority documented yet."
				})),
				id: "priorities",
				label: "Top priorities",
				note: "First readable issue signal in the current archive."
			},
			{
				cells: (contest.candidates ?? []).map(candidate => ({
					columnId: candidate.slug,
					sources: candidate.comparison.questionnaireResponses.flatMap(response => response.sources),
					value: `${candidate.comparison.questionnaireResponses.filter(response => response.responseStatus === "answered").length}/${candidate.comparison.questionnaireResponses.length} answered`
				})),
				id: "questionnaire",
				label: "Questionnaire coverage",
				note: "Answered prompts in the current archive."
			},
			{
				cells: (contest.candidates ?? []).map(candidate => ({
					columnId: candidate.slug,
					sources: candidate.keyActions.flatMap(action => action.sources),
					value: `${candidate.keyActions.length} documented action${candidate.keyActions.length === 1 ? "" : "s"}`
				})),
				id: "actions",
				label: "Documented actions",
				note: "Source-backed actions attached to the current profile."
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
				note: "Ballot Clarity explanation layer."
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
		note: "The matrix is designed to make evidence channels comparable without collapsing them into a single score.",
		rows,
		title: contest.type === "candidate" ? "Contest comparison matrix" : "Measure comparison matrix",
		uncertainty: contest.type === "candidate"
			? "Some candidates will have thinner questionnaire or action coverage than others."
			: "Measure rows can still change as more official explanatory material or fiscal notes are added."
	};
}

export function buildContestSourceDensityByEntity(contest: Contest): SourceDensityEntity[] {
	if (contest.type === "candidate") {
		return (contest.candidates ?? []).map(candidate => ({
			count: candidate.sources.length,
			detail: `${candidate.keyActions.length} action item${candidate.keyActions.length === 1 ? "" : "s"} and ${candidate.publicStatements.length} public statement block${candidate.publicStatements.length === 1 ? "" : "s"} are attached to this profile.`,
			id: candidate.slug,
			label: candidate.name,
			sources: candidate.sources
		}));
	}

	return (contest.measures ?? []).map(measure => ({
		count: measure.sources.length,
		detail: `${measure.implementationTimeline.length} implementation item${measure.implementationTimeline.length === 1 ? "" : "s"} and ${measure.fiscalSummary.length} fiscal item${measure.fiscalSummary.length === 1 ? "" : "s"} are attached to this explainer.`,
		id: measure.slug,
		label: measure.title,
		sources: measure.sources
	}));
}

export function buildRepresentativesDirectoryProvenanceSummary(data: RepresentativesResponse, formatDateTime: DateFormatter): ProvenanceSummary {
	const totalSources = data.representatives.reduce((total, representative) => total + representative.sourceCount, 0);

	return {
		badges: [
			{ label: "Linked profile sources", tone: "accent" },
			{ label: "Directory refresh visible", tone: "neutral" }
		],
		items: [
			{
				detail: "Current directory rows tied to the active district and candidate surfaces.",
				label: "Directory entries",
				value: data.representatives.length
			},
			{
				detail: "Aggregate source counts attached to the linked representative profiles.",
				label: "Linked sources",
				value: totalSources
			},
			{
				detail: "District hubs available from this directory.",
				label: "District hubs",
				value: data.districts.length
			},
			{
				detail: "Last representative-directory refresh in the current build.",
				label: "Updated",
				value: formatDateTime(data.updatedAt)
			}
		],
		note: "The representative directory is a crosswalk surface. Record-level source detail lives on the linked candidate, district, funding, and influence pages.",
		sources: [],
		title: "How the representative directory is grounded",
		uncertainty: "This page summarizes linked source depth rather than repeating every profile source inline. Open the profile or district page when you need the full evidence trail."
	};
}

export function buildRepresentativesDirectoryTimeline(data: RepresentativesResponse): TimelineEvent[] {
	return [
		{
			date: data.updatedAt,
			id: "directory-refresh",
			summary: "The current representative directory was refreshed for the active coverage build.",
			title: "Representative directory refreshed"
		},
		{
			date: data.updatedAt,
			id: "district-links",
			summary: `${data.districts.length} district hubs are linked from the directory for office context and contest depth.`,
			title: "District crosswalk attached"
		},
		{
			date: data.updatedAt,
			id: "profile-links",
			summary: "Each current representative row points to funding and influence follow-on surfaces when those pages exist.",
			title: "Profile follow-ons published"
		}
	];
}
