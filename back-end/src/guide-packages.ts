import type { CoverageRepository } from "./coverage-repository.js";
import type {
	AdminContentItem,
	Candidate,
	Contest,
	Election,
	GuideContentLayerStatus,
	GuideContentStatus,
	GuideContentSummary,
	GuidePackageCandidateSummary,
	GuidePackageChecklistCategory,
	GuidePackageChecklistCategoryGroup,
	GuidePackageChecklistEvaluationMode,
	GuidePackageChecklistItem,
	GuidePackageChecklistItemStatus,
	GuidePackageContestSummary,
	GuidePackageCounts,
	GuidePackageDiagnostics,
	GuidePackageIssue,
	GuidePackageIssueKind,
	GuidePackageListResponse,
	GuidePackageMeasureSummary,
	GuidePackageRecommendationSummary,
	GuidePackageRecord,
	GuidePackageReviewRecommendation,
	GuidePackageSummary,
	GuidePackageWorkflow,
	GuidePipelineClass,
	Jurisdiction,
	Measure,
	OfficialResource,
	Source,
} from "./types/civic.js";

function uniqueById<T extends { id: string }>(items: T[]) {
	return Array.from(new Map(items.map(item => [item.id, item])).values());
}

function uniqueBySlug<T extends { slug: string }>(items: T[]) {
	return Array.from(new Map(items.map(item => [item.slug, item])).values());
}

function uniqueOfficialResources(resources: OfficialResource[]) {
	return Array.from(new Map(
		resources
			.filter(resource => resource.label?.trim() && resource.url?.trim())
			.map(resource => [`${resource.label.trim().toLowerCase()}:${resource.url.trim()}`, resource]),
	).values());
}

function buildPackageId(electionSlug: string) {
	return `guide-package:${electionSlug}`;
}

function getPrimaryElection(coverageRepository: CoverageRepository) {
	return coverageRepository.data.election;
}

function getPrimaryJurisdiction(coverageRepository: CoverageRepository) {
	return coverageRepository.data.jurisdiction;
}

function buildContentIndex(contentItems: AdminContentItem[]) {
	return new Map(contentItems.map(item => [`${item.entityType}:${item.entitySlug}`, item] as const));
}

function buildContestSummary(contest: Contest): GuidePackageContestSummary {
	return {
		candidateCount: contest.candidates?.length ?? 0,
		href: `/contest/${contest.slug}`,
		measureCount: contest.measures?.length ?? 0,
		office: contest.office,
		slug: contest.slug,
		sourceCount: uniqueById(collectContestSources(contest)).length,
		title: contest.title,
		type: contest.type,
	};
}

function buildCandidateSummary(candidate: Candidate, contentIndex: Map<string, AdminContentItem>): GuidePackageCandidateSummary {
	const content = contentIndex.get(`candidate:${candidate.slug}`);
	return {
		contestSlug: candidate.contestSlug,
		href: `/candidate/${candidate.slug}`,
		name: candidate.name,
		officeSought: candidate.officeSought,
		party: candidate.party,
		slug: candidate.slug,
		sourceCount: uniqueById(candidate.sources).length,
		summary: content?.publicSummary?.trim() || candidate.summary,
	};
}

function buildMeasureSummary(measure: Measure, contentIndex: Map<string, AdminContentItem>): GuidePackageMeasureSummary {
	const content = contentIndex.get(`measure:${measure.slug}`);
	return {
		contestSlug: measure.contestSlug,
		href: `/measure/${measure.slug}`,
		slug: measure.slug,
		sourceCount: uniqueById(measure.sources).length,
		summary: content?.publicSummary?.trim() || measure.summary,
		title: measure.title,
	};
}

function collectContestSources(contest: Contest) {
	return uniqueById([
		...(contest.candidates ?? []).flatMap(candidate => candidate.sources),
		...(contest.measures ?? []).flatMap(measure => measure.sources),
	]);
}

function collectElectionSources(election: Election | null, jurisdiction: Jurisdiction | null) {
	return uniqueById([
		...(election?.contests ?? []).flatMap(collectContestSources),
		...(election?.officialResources ?? []).map((resource, index) => ({
			authority: resource.authority,
			date: election?.updatedAt || "",
			id: `official-resource:election:${resource.label}:${index}`,
			note: resource.note,
			publisher: resource.sourceLabel,
			sourceSystem: resource.sourceSystem,
			title: resource.label,
			type: "official record" as const,
			url: resource.url,
		})),
		...(jurisdiction?.officialResources ?? []).map((resource, index) => ({
			authority: resource.authority,
			date: jurisdiction?.updatedAt || "",
			id: `official-resource:jurisdiction:${resource.label}:${index}`,
			note: resource.note,
			publisher: resource.sourceLabel,
			sourceSystem: resource.sourceSystem,
			title: resource.label,
			type: "official record" as const,
			url: resource.url,
		})),
	]);
}

const ballotClarityArchivePattern = /ballot clarity.*archive/i;
const demoPattern = /\bdemo\b/i;
const referenceArchivePattern = /reference[-\s]archive/i;

function isReferenceArchiveSource(source: Source) {
	return source.authority === "ballot-clarity-archive"
		|| referenceArchivePattern.test(source.sourceSystem)
		|| referenceArchivePattern.test(source.publisher)
		|| referenceArchivePattern.test(source.title)
		|| referenceArchivePattern.test(source.url)
		|| ballotClarityArchivePattern.test(source.sourceSystem)
		|| ballotClarityArchivePattern.test(source.publisher);
}

function isSeededDemoSource(source: Source) {
	return demoPattern.test(source.sourceSystem)
		|| demoPattern.test(source.publisher)
		|| demoPattern.test(source.title);
}

function buildGuideContentLayerStatus(
	label: string,
	count: number,
	detailByStatus: Record<GuideContentStatus, string>,
	sources: Source[],
): GuideContentLayerStatus {
	const hasContent = count > 0;
	let status: GuideContentStatus = "verified_local";

	if (!hasContent)
		status = "seeded_demo";
	else if (sources.some(isReferenceArchiveSource))
		status = "staged_reference";
	else if (sources.every(isSeededDemoSource))
		status = "seeded_demo";

	return {
		count,
		detail: detailByStatus[status],
		hasContent,
		label,
		status,
	};
}

function buildGuideContentSummary(
	workflow: GuidePackageWorkflow,
	contests: Contest[],
	candidates: Candidate[],
	measures: Measure[],
	officialResources: OfficialResource[],
): GuideContentSummary {
	const contestSources = uniqueById(contests.flatMap(collectContestSources));
	const candidateSources = uniqueById(candidates.flatMap(candidate => candidate.sources));
	const measureSources = uniqueById(measures.flatMap(measure => measure.sources));
	const officialLogisticsSourceCount = officialResources.filter(resource => resource.authority === "official-government").length;
	const officialLogistics = buildGuideContentLayerStatus(
		"Official logistics",
		officialLogisticsSourceCount,
		{
			official_logistics_only: "Official election links are attached, but this layer still needs direct local verification.",
			seeded_demo: "No official election links are attached yet.",
			staged_reference: "Election links still point to staged reference material instead of current local sources.",
			verified_local: officialLogisticsSourceCount
				? "Official county and statewide election logistics are attached from current official sources."
				: "Official election links are not attached yet.",
		},
		officialResources.map((resource, index) => ({
			authority: resource.authority,
			date: workflow.updatedAt,
			id: `official-logistics:${resource.label}:${index}`,
			publisher: resource.sourceLabel,
			sourceSystem: resource.sourceSystem,
			title: resource.label,
			type: "official record" as const,
			url: resource.url,
		})),
	);
	const contestsLayer = buildGuideContentLayerStatus(
		"Contests",
		contests.length,
		{
			official_logistics_only: "Contest records are present, but they are still waiting on local review.",
			seeded_demo: "No contest records are attached yet.",
			staged_reference: "Contest records still rely on staged reference material instead of verified local content.",
			verified_local: "Contest records are attached with verified local source coverage.",
		},
		contestSources,
	);
	const candidatesLayer = buildGuideContentLayerStatus(
		"Candidates",
		candidates.length,
		{
			official_logistics_only: "Candidate records are present, but they are still waiting on local review.",
			seeded_demo: "No candidate records are attached yet.",
			staged_reference: "Candidate records still rely on staged reference material instead of verified local content.",
			verified_local: "Candidate records are attached with verified local source coverage.",
		},
		candidateSources,
	);
	const measuresLayer = buildGuideContentLayerStatus(
		"Measures",
		measures.length,
		{
			official_logistics_only: "Measure records are present, but they are still waiting on local review.",
			seeded_demo: "No measure records are attached yet.",
			staged_reference: "Measure records still rely on staged reference material instead of verified local content.",
			verified_local: "Measure records are attached with verified local source coverage.",
		},
		measureSources,
	);
	const contestLayers = [contestsLayer, candidatesLayer, measuresLayer].filter(layer => layer.hasContent);
	const verifiedContestPackage = contestLayers.length > 0
		&& contestLayers.every(layer => layer.status === "verified_local");
	const mixedContent = new Set([
		officialLogistics.status,
		...contestLayers.map(layer => layer.status),
	]).size > 1;
	const guideShellStatus: GuideContentStatus = verifiedContestPackage
		? "verified_local"
		: officialLogistics.status === "verified_local"
			? "official_logistics_only"
			: contestLayers.some(layer => layer.status === "staged_reference")
				? "staged_reference"
				: "seeded_demo";

	const guideShellDetailByStatus: Record<GuideContentStatus, string> = {
		official_logistics_only: "This local guide is published with verified official election links, but the contest pages still need local review.",
		seeded_demo: "This local guide is published, but its contest pages still read as demo content.",
		staged_reference: "This local guide is published, but some contest, candidate, or measure pages still rely on staged reference content.",
		verified_local: "This local guide is published with verified local contest, candidate, and measure pages.",
	};
	const draftGuideShellDetailByStatus: Record<GuideContentStatus, string> = {
		official_logistics_only: "This draft already has verified official election links, but the contest pages still need local review before publication.",
		seeded_demo: "This draft still reads as demo content and is not ready for publication.",
		staged_reference: "This draft still depends on staged reference content and is not ready to represent a verified local guide.",
		verified_local: "This draft carries verified local contest, candidate, and measure pages and can move toward publication review.",
	};

	return {
		candidates: candidatesLayer,
		contests: contestsLayer,
		guideShell: {
			count: Number(workflow.status === "published"),
			detail: workflow.status === "published"
				? guideShellDetailByStatus[guideShellStatus]
				: draftGuideShellDetailByStatus[guideShellStatus],
			hasContent: workflow.status === "published",
			label: "Local guide",
			status: guideShellStatus,
		},
		mixedContent,
		measures: measuresLayer,
		officialLogistics,
		publishedGuideShell: workflow.status === "published",
		summary: workflow.status === "published"
			? verifiedContestPackage
				? "This local guide includes verified official election links and verified contest, candidate, and measure pages."
				: officialLogistics.status === "verified_local"
					? "This local guide includes verified official election links, but some contest, candidate, or measure pages are still under local review."
					: "This local guide is available, but its contest pages still need local verification."
			: verifiedContestPackage
				? "This draft already carries verified official election links and verified contest, candidate, and measure pages."
				: officialLogistics.status === "verified_local"
					? "This draft has verified official election links, but some contest, candidate, or measure pages are still under local review."
					: "This draft still needs local verification before it should be promoted as a guide.",
		verifiedContestPackage,
	};
}

const guidePackageRubricVersion = "2026-04-19";
const electionOfficeLabelPattern = /county|clerk|registrar|election/i;
const repeatedWhitespacePattern = /\s{2,}/;
const runoffOrSpecialPattern = /\b(runoff|special)\b/i;

const checklistCategoryMeta: Record<GuidePackageChecklistCategory, { description: string; label: string }> = {
	candidate_completeness: {
		description: "Confirms candidates are attached to the right contests, normalized, and free of obvious duplication or mismatch.",
		label: "Candidate completeness",
	},
	content_quality_neutrality: {
		description: "Checks whether plain-language guide content is readable, neutral, and honest about uncertainty.",
		label: "Content quality and neutrality",
	},
	contest_completeness: {
		description: "Verifies the contest roster, office-title normalization, and claimed guide scope before publication.",
		label: "Contest completeness",
	},
	election_identity_scope: {
		description: "Verifies the package is attached to the correct election, jurisdiction, and coverage scope.",
		label: "Election identity and scope",
	},
	freshness_timing: {
		description: "Checks timestamps, election-window relevance, and whether a reviewer still considers the package timely enough to publish.",
		label: "Freshness and timing",
	},
	known_limitations: {
		description: "Makes sure Ballot Clarity discloses what the guide does not cover and avoids overstating lookup-only data as a published guide.",
		label: "Known limitations",
	},
	measure_completeness: {
		description: "Checks measure titles, numbering, official text coverage, and scope framing where measures exist.",
		label: "Measure completeness",
	},
	official_resources: {
		description: "Verifies the guide includes current official voter and election-administration links where they should exist.",
		label: "Official resources",
	},
	source_coverage: {
		description: "Confirms the guide has enough supporting records, valid links, and transparent provenance on high-impact content.",
		label: "Source coverage",
	},
};

function createChecklistItem({
	autoSignal,
	blocking,
	category,
	detail,
	evaluationMode,
	failStandard,
	id,
	issueKind,
	label,
	passStandard,
	pipelineClass,
	reviewerSignal,
	status,
	warningStandard,
	whatToCheck,
	whyItMatters,
}: {
	autoSignal?: string;
	blocking: boolean;
	category: GuidePackageChecklistCategory;
	detail: string;
	evaluationMode: GuidePackageChecklistEvaluationMode;
	failStandard: string;
	id: string;
	issueKind: GuidePackageIssueKind;
	label: string;
	passStandard: string;
	pipelineClass: GuidePipelineClass;
	reviewerSignal?: string;
	status: GuidePackageChecklistItemStatus;
	warningStandard: string;
	whatToCheck: string;
	whyItMatters: string;
}): GuidePackageChecklistItem {
	return {
		autoSignal,
		blocking,
		category,
		detail,
		evaluationMode,
		failStandard,
		id,
		issueKind,
		label,
		passStandard,
		pipelineClass,
		reviewerSignal,
		status,
		warningStandard,
		whatToCheck,
		whyItMatters,
	};
}

function normalizeForDuplicateCheck(value: string) {
	return value.trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").replaceAll(/\s+/g, " ").trim();
}

function countDuplicates(values: string[]) {
	const counts = new Map<string, number>();

	for (const value of values) {
		const normalized = normalizeForDuplicateCheck(value);

		if (!normalized)
			continue;

		counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
	}

	return Array.from(counts.values()).filter(count => count > 1).length;
}

function isPublicSourceHref(value: string) {
	if (value.startsWith("/"))
		return true;

	try {
		const parsed = new URL(value);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	}
	catch {
		return false;
	}
}

function daysBetween(left: string | undefined, right: string | undefined) {
	if (!left || !right)
		return Number.POSITIVE_INFINITY;

	const leftValue = new Date(left).getTime();
	const rightValue = new Date(right).getTime();

	if (Number.isNaN(leftValue) || Number.isNaN(rightValue))
		return Number.POSITIVE_INFINITY;

	return Math.abs(leftValue - rightValue) / (1000 * 60 * 60 * 24);
}

function reviewerConfirmed(workflow: GuidePackageWorkflow) {
	return Boolean(
		workflow.reviewer?.trim()
		&& (workflow.reviewNotes?.trim() || workflow.reviewedAt || workflow.reviewRecommendation),
	);
}

function reviewerReadyRecommendation(recommendation: GuidePackageReviewRecommendation | undefined) {
	return recommendation === "publish" || recommendation === "publish_with_warnings";
}

function buildChecklist(
	workflow: GuidePackageWorkflow,
	election: Election | null,
	jurisdiction: Jurisdiction | null,
	contests: Contest[],
	officialResources: OfficialResource[],
	candidates: Candidate[],
	measures: Measure[],
	contentIndex: Map<string, AdminContentItem>,
): GuidePackageChecklistItem[] {
	const hasReviewerConfirmation = reviewerConfirmed(workflow);
	const measurePackagesExpected = contests.some(contest => contest.type === "measure") || measures.length > 0;
	const candidateContestLinks = candidates.every(candidate => contests.some(contest => contest.slug === candidate.contestSlug));
	const measureContestLinks = measures.every(measure => contests.some(contest => contest.slug === measure.contestSlug));
	const contestTitleDuplicates = countDuplicates(
		contests
			.filter(contest => contest.type === "candidate")
			.map(contest => `${contest.jurisdiction}:${contest.office}:${contest.title}`),
	);
	const candidateDuplicates = countDuplicates(candidates.map(candidate => `${candidate.contestSlug}:${candidate.name}`));
	const missingCandidateContestAttachmentCount = contests
		.filter(contest => contest.type === "candidate")
		.filter(contest => !(contest.candidates?.length ?? 0))
		.length;
	const missingMeasureContestAttachmentCount = contests
		.filter(contest => contest.type === "measure")
		.filter(contest => !(contest.measures?.length ?? 0))
		.length;
	const invalidOfficialResourceCount = officialResources.filter(resource => !isPublicSourceHref(resource.url)).length;
	const officialVoterPortalCount = officialResources.filter(resource => resource.authority === "official-government" && isPublicSourceHref(resource.url)).length;
	const officialElectionOfficeCount = officialResources.filter(resource => electionOfficeLabelPattern.test(resource.label)).length;
	const sourceRecords = uniqueById([
		...candidates.flatMap(candidate => candidate.sources),
		...measures.flatMap(measure => measure.sources),
	]);
	const invalidSourceUrlCount = sourceRecords.filter(source => !isPublicSourceHref(source.url)).length;
	const candidateSourceCoverage = candidates.every(candidate => candidate.sources.length > 0);
	const measureSourceCoverage = measures.every(measure => measure.sources.length > 0);
	const measureOfficialSummaryCoverage = measures.every(
		measure => Boolean(measure.plainLanguageExplanation?.trim()) || Boolean(contentIndex.get(`measure:${measure.slug}`)?.publicSummary?.trim()),
	);
	const candidatePartyCoverage = candidates.every(candidate => Boolean(candidate.party?.trim()));
	const candidateNamesNormalized = candidates.every(candidate => Boolean(candidate.name.trim()) && !repeatedWhitespacePattern.test(candidate.name));
	const contestTitlesNormalized = contests.every(contest => Boolean(contest.title.trim()) && Boolean(contest.office.trim()) && !repeatedWhitespacePattern.test(contest.title));
	const candidateReviewFlags = candidates.filter(candidate => contentIndex.get(`candidate:${candidate.slug}`)?.status === "needs-sources").length;
	const candidateSummaryCoverage = candidates.every((candidate) => {
		const content = contentIndex.get(`candidate:${candidate.slug}`);
		return Boolean(content?.publicSummary?.trim() || candidate.summary?.trim());
	});
	const measureSummaryCoverage = measures.every((measure) => {
		const content = contentIndex.get(`measure:${measure.slug}`);
		return Boolean(content?.publicSummary?.trim() || measure.summary?.trim() || measure.plainLanguageExplanation?.trim());
	});
	const staleRecordCount = [
		...candidates.map(candidate => candidate.updatedAt),
		...measures.map(measure => measure.updatedAt),
	].filter(updatedAt => daysBetween(updatedAt, election?.date) > 365).length;
	const packageFreshnessPresent = Boolean(workflow.updatedAt && election?.updatedAt && jurisdiction?.updatedAt);
	const limitationNotesPresent = workflow.coverageLimits.length > 0 || workflow.coverageNotes.length > 0;
	const lookupOnlyMislabel = workflow.status === "published" && !contests.length;
	const electionWindowRequiresSpecialHandling = Boolean(election?.name.match(runoffOrSpecialPattern));
	const scopeIdentityPass = Boolean(
		election?.name?.trim()
		&& election?.date?.trim()
		&& jurisdiction?.displayName?.trim()
		&& election.jurisdictionSlug === workflow.jurisdictionSlug
		&& jurisdiction.slug === workflow.jurisdictionSlug,
	);

	return [
		createChecklistItem({
			autoSignal: election?.name?.trim() && election?.date?.trim()
				? `${election.name} is dated ${election.date}.`
				: "Election name or date is missing from the package.",
			blocking: true,
			category: "election_identity_scope",
			detail: scopeIdentityPass
				? `Election identity is attached to ${election?.name} in ${jurisdiction?.displayName}.`
				: "Election name, election date, and jurisdiction identity all need to exist before publication.",
			evaluationMode: "auto",
			failStandard: "Fail when the election name, election date, or jurisdiction identity is missing or mismatched.",
			id: "election-identity-present",
			issueKind: "missing_field",
			label: "Election identity is present",
			passStandard: "Pass when the package shows the correct election name, date, and jurisdiction for the claimed guide.",
			pipelineClass: "fully_automatable",
			status: scopeIdentityPass ? "pass" : "fail",
			warningStandard: "Warning is not used here; Ballot Clarity should not publish without election identity.",
			whatToCheck: "Check the election name, election date, jurisdiction label, and the package's election/jurisdiction slugs.",
			whyItMatters: "A guide cannot be trusted if it points at the wrong election or locality.",
		}),
		createChecklistItem({
			autoSignal: workflow.electionSlug && workflow.jurisdictionSlug
				? `${workflow.electionSlug} is paired with ${workflow.jurisdictionSlug}.`
				: "Coverage scope slugs are incomplete.",
			blocking: true,
			category: "election_identity_scope",
			detail: hasReviewerConfirmation
				? "A reviewer confirmed the package belongs to the intended locality and election."
				: "Reviewer confirmation for the package scope is still needed before promotion.",
			evaluationMode: "reviewer_confirmed",
			failStandard: "Fail when the package is attached to the wrong locality or the intended guide scope is clearly wrong.",
			id: "scope-review-confirmed",
			issueKind: "publish_gate",
			label: "Package is attached to the correct locality and election",
			passStandard: "Pass when a reviewer confirms the package belongs to the intended jurisdiction and election scope.",
			pipelineClass: "review_first_manual",
			reviewerSignal: hasReviewerConfirmation
				? `${workflow.reviewer} recorded review notes or recommendation for this package.`
				: "No reviewer confirmation is recorded yet.",
			status: !scopeIdentityPass ? "fail" : hasReviewerConfirmation ? "pass" : "warning",
			warningStandard: "Warning when the automated identity looks correct but a reviewer has not confirmed the intended coverage scope yet.",
			whatToCheck: "Verify the package really belongs to the locality and election Ballot Clarity claims to publish.",
			whyItMatters: "A technically assembled package can still be attached to the wrong local election if the scope is not reviewed.",
		}),
		createChecklistItem({
			autoSignal: contests.length
				? `${contests.length} contest records are attached to the package.`
				: "The contest roster is empty.",
			blocking: true,
			category: "contest_completeness",
			detail: contests.length
				? `${contests.length} contests are attached to this package draft.`
				: "No contest roster is attached to this package yet.",
			evaluationMode: "auto",
			failStandard: "Fail when no contests are attached for a guide that claims to publish a local ballot package.",
			id: "contest-roster-present",
			issueKind: "missing_field",
			label: "Contests are present where expected",
			passStandard: "Pass when the package includes an actual contest roster for the intended guide scope.",
			pipelineClass: "automatable_with_review",
			status: contests.length ? "pass" : "fail",
			warningStandard: "Warning is not used here; an empty contest list is a blocker.",
			whatToCheck: "Check whether the package actually includes contests instead of only lookup-layer metadata.",
			whyItMatters: "Ballot Clarity should not call something a local guide if it does not contain a real contest package.",
		}),
		createChecklistItem({
			autoSignal: contestTitleDuplicates
				? `${contestTitleDuplicates} normalized contest title duplicate group${contestTitleDuplicates === 1 ? "" : "s"} detected.`
				: "Contest titles and office labels look normalized.",
			blocking: true,
			category: "contest_completeness",
			detail: contestTitleDuplicates
				? "One or more contest titles collapse to the same normalized form and still need review."
				: "Contest titles and office labels look normalized and non-duplicative.",
			evaluationMode: "hybrid",
			failStandard: "Fail when contest titles are blank, office titles are missing, or clear duplicates remain unresolved.",
			id: "contest-normalization",
			issueKind: contestTitleDuplicates ? "normalization_issue" : "publish_gate",
			label: "Office titles are normalized and no duplicate contests remain",
			passStandard: "Pass when contest titles and office labels read cleanly and no obvious duplicate contests remain.",
			pipelineClass: "automatable_with_review",
			reviewerSignal: hasReviewerConfirmation
				? "Reviewer confirmation is recorded for contest normalization."
				: "Contest normalization still relies only on automated checks.",
			status: !contestTitlesNormalized || contestTitleDuplicates ? "fail" : hasReviewerConfirmation ? "pass" : "warning",
			warningStandard: "Warning when contest titles look normal automatically, but a reviewer has not yet confirmed the list is publication-ready.",
			whatToCheck: "Check office titles, normalized contest names, and whether any contest appears twice under slightly different labels.",
			whyItMatters: "Readers lose trust quickly if the contest roster contains messy titles or duplicate races.",
		}),
		createChecklistItem({
			autoSignal: electionWindowRequiresSpecialHandling
				? "Election name suggests a special election or runoff that needs explicit handling."
				: "No special-election or runoff keywords were detected.",
			blocking: false,
			category: "contest_completeness",
			detail: electionWindowRequiresSpecialHandling
				? "This election looks like a runoff or special election, so a reviewer should confirm the contest roster is complete for that case."
				: "No runoff or special-election signal was detected for this package.",
			evaluationMode: "reviewer_confirmed",
			failStandard: "Fail when a runoff or special-election package clearly omits the contest handling needed for that election type.",
			id: "special-election-handling",
			issueKind: "normalization_issue",
			label: "Special elections and runoffs are handled correctly",
			passStandard: "Pass when a reviewer confirms special-election or runoff handling is correct, or when no such handling is needed.",
			pipelineClass: "automatable_with_review",
			reviewerSignal: hasReviewerConfirmation
				? "Reviewer signoff is available for election-type handling."
				: "No reviewer signoff is attached yet.",
			status: electionWindowRequiresSpecialHandling
				? hasReviewerConfirmation ? "pass" : "warning"
				: "not_applicable",
			warningStandard: "Warning when the election appears to be a runoff or special election and Ballot Clarity still needs reviewer confirmation.",
			whatToCheck: "Check whether the package needs special-election or runoff handling and whether that handling is reflected correctly.",
			whyItMatters: "These elections often have unusual scope and timing, so automated assembly alone is less trustworthy.",
		}),
		createChecklistItem({
			autoSignal: candidateContestLinks && !missingCandidateContestAttachmentCount
				? `${candidates.length} candidates are attached to contests.`
				: `${missingCandidateContestAttachmentCount} candidate contest${missingCandidateContestAttachmentCount === 1 ? "" : "s"} are missing candidate attachments or mismatch contest links.`,
			blocking: true,
			category: "candidate_completeness",
			detail: candidateContestLinks && !missingCandidateContestAttachmentCount
				? "Candidates are attached to the right contests."
				: "One or more candidate contests are missing candidate attachments or contain contest mismatches.",
			evaluationMode: "auto",
			failStandard: "Fail when candidates are missing from candidate contests or attached to the wrong contest.",
			id: "candidate-contest-attachments",
			issueKind: "missing_field",
			label: "Candidates are attached to the right contests",
			passStandard: "Pass when candidate contests have attached candidates and each candidate points at a valid contest in the package.",
			pipelineClass: "automatable_with_review",
			status: candidateContestLinks && !missingCandidateContestAttachmentCount ? "pass" : "fail",
			warningStandard: "Warning is not used here; a broken candidate roster is a blocker.",
			whatToCheck: "Check whether candidate contests actually include candidates and whether each candidate belongs to a known contest.",
			whyItMatters: "A published guide becomes misleading fast if candidates appear under the wrong race or disappear entirely.",
		}),
		createChecklistItem({
			autoSignal: candidateDuplicates || candidateReviewFlags
				? `${candidateDuplicates} duplicate candidate group${candidateDuplicates === 1 ? "" : "s"} and ${candidateReviewFlags} candidate review flag${candidateReviewFlags === 1 ? "" : "s"} detected.`
				: "Candidate names, party labels, and incumbency fields look internally consistent.",
			blocking: true,
			category: "candidate_completeness",
			detail: candidateDuplicates
				? "Candidate normalization still shows duplicate names in at least one contest."
				: candidateReviewFlags
					? "One or more candidate records are still flagged as needing sources or editorial review."
					: "Candidate names, party labels, and incumbency context look consistent.",
			evaluationMode: "hybrid",
			failStandard: "Fail when obvious duplicate candidates remain unresolved or candidate names/labels are clearly broken.",
			id: "candidate-normalization",
			issueKind: candidateDuplicates ? "ambiguous_match" : candidateReviewFlags ? "source_gap" : "normalization_issue",
			label: "Candidate normalization looks publishable",
			passStandard: "Pass when candidate names look normalized, obvious duplicates are resolved, and reviewer-confirmed mismatches are cleared.",
			pipelineClass: "automatable_with_review",
			reviewerSignal: hasReviewerConfirmation
				? "Reviewer confirmation is present for candidate completeness."
				: "Candidate completeness still lacks reviewer confirmation.",
			status: candidateDuplicates || !candidateNamesNormalized || !candidatePartyCoverage
				? "fail"
				: hasReviewerConfirmation
					? "pass"
					: "warning",
			warningStandard: "Warning when the candidate roster looks internally consistent but still needs reviewer confirmation.",
			whatToCheck: "Check candidate names, party labels, incumbency context, and whether duplicate or mismatched person records remain.",
			whyItMatters: "Candidate mistakes are some of the easiest errors for voters to notice and the hardest to explain away after publish.",
		}),
		createChecklistItem({
			autoSignal: measurePackagesExpected
				? `${measures.length} measure record${measures.length === 1 ? "" : "s"} are attached.`
				: "No measures were detected for this guide scope.",
			blocking: true,
			category: "measure_completeness",
			detail: measurePackagesExpected
				? measures.length
					? "Measure records are present for the measure contests detected in this package."
					: "Measure contests appear to exist, but no measure records are attached."
				: "No measures appear to apply to this guide scope.",
			evaluationMode: "auto",
			failStandard: "Fail when a measure contest exists but the package lacks the measure records needed to publish it.",
			id: "measure-records-present",
			issueKind: "missing_field",
			label: "Measures are included where applicable",
			passStandard: "Pass when measures are attached for measure contests, or mark not applicable when the guide has no measures.",
			pipelineClass: "automatable_with_review",
			status: !measurePackagesExpected
				? "not_applicable"
				: measures.length && measureContestLinks && !missingMeasureContestAttachmentCount
					? "pass"
					: "fail",
			warningStandard: "Warning is not used here; missing measure records block publication for measure contests.",
			whatToCheck: "Check whether measure contests have attached measure records and valid contest links.",
			whyItMatters: "A local guide that claims to cover ballot measures needs the actual measure package, not just contest shells.",
		}),
		createChecklistItem({
			autoSignal: measurePackagesExpected
				? measureOfficialSummaryCoverage
					? "Measures include official text or a supported official summary/explainer."
					: "One or more measures lack official text coverage or a usable official summary."
				: "No measures need official-text review for this package.",
			blocking: true,
			category: "measure_completeness",
			detail: measurePackagesExpected
				? measureOfficialSummaryCoverage
					? "Measure titles, numbers, and summaries have supporting source coverage."
					: "A measure is missing official text coverage or a publishable official summary."
				: "No measures are attached to this package.",
			evaluationMode: "hybrid",
			failStandard: "Fail when a measure is missing official text coverage, official summary coverage, or a clear scope statement.",
			id: "measure-source-and-scope",
			issueKind: "source_gap",
			label: "Measure records have official text or official summary coverage",
			passStandard: "Pass when each measure includes correct identifying text and enough official coverage for voters to inspect the primary record.",
			pipelineClass: "review_first_manual",
			reviewerSignal: hasReviewerConfirmation
				? "Reviewer notes are present for measure framing."
				: "A reviewer has not yet confirmed measure framing.",
			status: !measurePackagesExpected
				? "not_applicable"
				: !measureSourceCoverage || !measureOfficialSummaryCoverage
						? "fail"
						: hasReviewerConfirmation
							? "pass"
							: "warning",
			warningStandard: "Warning when measure coverage exists, but a reviewer still needs to confirm the summary is fair and readable.",
			whatToCheck: "Check measure titles, numbering, official text or official summary coverage, and whether the scope of the measure is stated correctly.",
			whyItMatters: "Ballot measures are easy to misread if the guide does not anchor itself in official language and transparent limits.",
		}),
		createChecklistItem({
			autoSignal: officialResources.length
				? `${officialResources.length} official resource link${officialResources.length === 1 ? "" : "s"} are attached.`
				: "No official resources are attached.",
			blocking: true,
			category: "official_resources",
			detail: officialResources.length && !invalidOfficialResourceCount
				? "Official voter and election resources are attached and their URLs parse correctly."
				: invalidOfficialResourceCount
					? "One or more official resource links are malformed."
					: "Official election resources must be attached before publish.",
			evaluationMode: "auto",
			failStandard: "Fail when official voter or election-administration resources are missing or malformed.",
			id: "official-resource-links",
			issueKind: invalidOfficialResourceCount ? "publish_gate" : "missing_field",
			label: "Official verification resources are attached and valid",
			passStandard: "Pass when the package includes current official voter or election-administration links and their URLs resolve syntactically.",
			pipelineClass: "fully_automatable",
			status: officialResources.length && !invalidOfficialResourceCount ? "pass" : "fail",
			warningStandard: "Warning is not used here; broken official links are blockers.",
			whatToCheck: "Check that official voter portals, election offices, or equivalent verification links are attached and look valid.",
			whyItMatters: "Official links are Ballot Clarity's primary reader safety valve for final ballot confirmation.",
		}),
		createChecklistItem({
			autoSignal: `${officialVoterPortalCount} official voter portal link${officialVoterPortalCount === 1 ? "" : "s"} and ${officialElectionOfficeCount} local election office link${officialElectionOfficeCount === 1 ? "" : "s"} detected.`,
			blocking: false,
			category: "official_resources",
			detail: officialElectionOfficeCount
				? "The package includes both statewide and more local official resource context."
				: "The package still looks thin on local official-election-office context.",
			evaluationMode: "reviewer_confirmed",
			failStandard: "Fail when the official-resource set is clearly stale or irrelevant for the intended guide.",
			id: "official-resource-relevance",
			issueKind: "publish_gate",
			label: "Official resources look current and relevant",
			passStandard: "Pass when a reviewer confirms the attached official links are still the right ones for this election window.",
			pipelineClass: "review_first_manual",
			reviewerSignal: hasReviewerConfirmation
				? "Reviewer confirmation exists for official resources."
				: "Official resources still need reviewer confirmation.",
			status: !officialResources.length
				? "fail"
				: hasReviewerConfirmation
					? "pass"
					: "warning",
			warningStandard: "Warning when official links exist but still need a reviewer to confirm they are current enough to publish.",
			whatToCheck: "Check whether the official links still point at the right voter portal, election office, and verification resources for this package.",
			whyItMatters: "An old official link can misdirect voters even when the rest of the package looks complete.",
		}),
		createChecklistItem({
			autoSignal: invalidSourceUrlCount
				? `${invalidSourceUrlCount} attached source link${invalidSourceUrlCount === 1 ? "" : "s"} are malformed.`
				: `${sourceRecords.length} attached source record${sourceRecords.length === 1 ? "" : "s"} have valid URL syntax.`,
			blocking: true,
			category: "source_coverage",
			detail: candidateSourceCoverage && measureSourceCoverage && !invalidSourceUrlCount
				? "Candidate and measure source links are attached and look valid."
				: "A core contest, candidate, or measure entry still lacks sufficient source coverage or contains a broken source URL.",
			evaluationMode: "auto",
			failStandard: "Fail when core guide pages lack attached sources or any attached source link is clearly broken.",
			id: "core-source-coverage",
			issueKind: "source_gap",
			label: "Core contest, candidate, and measure pages have source coverage",
			passStandard: "Pass when every core guide entity has attached source records and those links are syntactically valid.",
			pipelineClass: "automatable_with_review",
			status: candidateSourceCoverage && measureSourceCoverage && !invalidSourceUrlCount ? "pass" : "fail",
			warningStandard: "Warning is not used here; Ballot Clarity should not publish unsupported core pages.",
			whatToCheck: "Check whether candidate and measure pages actually carry source records and whether those source links parse.",
			whyItMatters: "Source coverage is the backbone of a source-first civic guide, especially on the core guide pages.",
		}),
		createChecklistItem({
			autoSignal: candidateSummaryCoverage && measureSummaryCoverage
				? "High-impact summaries have visible supporting records and text coverage."
				: "One or more summaries are missing visible supporting text or source-backed context.",
			blocking: true,
			category: "source_coverage",
			detail: candidateSummaryCoverage && measureSummaryCoverage
				? "Summary layers are present for candidates and measures with attached source coverage."
				: "A core summary is missing, under-sourced, or still lacks visible support for publication.",
			evaluationMode: "hybrid",
			failStandard: "Fail when a high-impact summary appears without visible supporting records or the supporting summary text is missing.",
			id: "summary-source-visibility",
			issueKind: "source_gap",
			label: "High-impact summaries have visible supporting records",
			passStandard: "Pass when summary layers are both present and transparently tied to supporting records.",
			pipelineClass: "automatable_with_review",
			reviewerSignal: hasReviewerConfirmation
				? "Reviewer confirmation is recorded for source visibility."
				: "Source-backed summary visibility still needs reviewer confirmation.",
			status: !candidateSummaryCoverage || !measureSummaryCoverage
				? "fail"
				: hasReviewerConfirmation
					? "pass"
					: "warning",
			warningStandard: "Warning when summaries and sources exist but a reviewer has not yet confirmed the supporting record trail is clear enough.",
			whatToCheck: "Check whether major summaries have visible supporting records and whether those source trails remain understandable.",
			whyItMatters: "Readers should be able to see that major summary claims come from identifiable records, not just trust the page shell.",
		}),
		createChecklistItem({
			autoSignal: candidateSummaryCoverage || measureSummaryCoverage
				? "Plain-language summary layers are present on at least part of the package."
				: "The package lacks publishable summary layers.",
			blocking: true,
			category: "content_quality_neutrality",
			detail: hasReviewerConfirmation
				? "Reviewer confirmation is recorded for readability and neutrality checks."
				: "Readable, neutral summary wording still needs reviewer confirmation.",
			evaluationMode: "reviewer_confirmed",
			failStandard: "Fail when public summaries contain unsupported claims, obvious advocacy, or missing core summary text.",
			id: "summary-neutrality-review",
			issueKind: "publish_gate",
			label: "Plain-language summaries are understandable and neutral",
			passStandard: "Pass when a reviewer confirms the summaries are readable, non-advocacy, and honest about uncertainty.",
			pipelineClass: "review_first_manual",
			reviewerSignal: hasReviewerConfirmation
				? `${workflow.reviewer} recorded editorial review for summary quality.`
				: "No reviewer-confirmed neutrality check is attached yet.",
			status: !candidateSummaryCoverage && measurePackagesExpected && !measureSummaryCoverage
				? "fail"
				: hasReviewerConfirmation
					? "pass"
					: "warning",
			warningStandard: "Warning when summary text exists but a reviewer has not yet confirmed it is neutral and readable.",
			whatToCheck: "Check plain-language summaries for readability, neutrality, stated limitations, and unsupported claims.",
			whyItMatters: "Publishing a civic guide without an editorial-quality content check is how incomplete or slanted summaries slip through.",
		}),
		createChecklistItem({
			autoSignal: packageFreshnessPresent
				? `Workflow, election, and jurisdiction freshness timestamps are present through ${workflow.updatedAt.slice(0, 10)}.`
				: "One or more core package freshness timestamps are missing.",
			blocking: true,
			category: "freshness_timing",
			detail: packageFreshnessPresent
				? "Freshness timestamps are present on the package and its core election context."
				: "Freshness timestamps are missing from part of the package context.",
			evaluationMode: "auto",
			failStandard: "Fail when package freshness timestamps are missing from the workflow or its core election/jurisdiction context.",
			id: "freshness-timestamps",
			issueKind: "missing_field",
			label: "Freshness timestamps are present",
			passStandard: "Pass when the package, election, and jurisdiction context all carry freshness timestamps.",
			pipelineClass: "fully_automatable",
			status: packageFreshnessPresent ? "pass" : "fail",
			warningStandard: "Warning is not used here; Ballot Clarity should not publish a guide with missing freshness timestamps.",
			whatToCheck: "Check that the package itself and its election/jurisdiction context carry usable freshness timestamps.",
			whyItMatters: "Reviewers need visible timing context before deciding whether the package is still safe to publish.",
		}),
		createChecklistItem({
			autoSignal: staleRecordCount
				? `${staleRecordCount} candidate or measure records look older than Ballot Clarity's standard election window.`
				: "No obviously stale candidate or measure records were detected by the election-window check.",
			blocking: false,
			category: "freshness_timing",
			detail: staleRecordCount
				? "One or more candidate or measure records look stale relative to the election date."
				: "No obvious stale-record signal was detected from the package timestamps.",
			evaluationMode: "hybrid",
			failStandard: "Fail when a reviewer determines the package is too stale to publish for the current election window.",
			id: "freshness-review",
			issueKind: "publish_gate",
			label: "Reviewer confirms the package is still timely enough to publish",
			passStandard: "Pass when record timestamps look reasonable and a reviewer confirms the package is still timely for the election window.",
			pipelineClass: "review_first_manual",
			reviewerSignal: hasReviewerConfirmation
				? "Reviewer confirmation exists for freshness and timing."
				: "Freshness still needs reviewer confirmation.",
			status: staleRecordCount
				? hasReviewerConfirmation ? "warning" : "warning"
				: hasReviewerConfirmation
					? "pass"
					: "warning",
			warningStandard: "Warning when stale signals exist or when a reviewer has not yet confirmed the package is still timely enough to publish.",
			whatToCheck: "Check whether the package still falls inside a safe election window and whether any obviously stale records should block publish.",
			whyItMatters: "Even a complete guide can mislead readers if it was assembled too long before the current election window.",
		}),
		createChecklistItem({
			autoSignal: limitationNotesPresent
				? `${workflow.coverageLimits.length} coverage limit note${workflow.coverageLimits.length === 1 ? "" : "s"} and ${workflow.coverageNotes.length} coverage note${workflow.coverageNotes.length === 1 ? "" : "s"} are attached.`
				: "No package-level coverage limits or notes are currently disclosed.",
			blocking: false,
			category: "known_limitations",
			detail: limitationNotesPresent
				? "Guide limitations and package notes are attached for reviewers and public readers."
				: "The package still needs an explicit limitations note before publish.",
			evaluationMode: "hybrid",
			failStandard: "Fail when the guide hides meaningful scope gaps or presents lookup-only data as a published local guide.",
			id: "limitations-disclosed",
			issueKind: "coverage_limit",
			label: "Guide limits are stated honestly",
			passStandard: "Pass when Ballot Clarity openly states guide limits, missing pieces, and any precinct-specific variation risk that matters.",
			pipelineClass: "review_first_manual",
			reviewerSignal: hasReviewerConfirmation
				? "Reviewer confirmation exists for limitation disclosure."
				: "Limitation disclosure still needs reviewer confirmation.",
			status: lookupOnlyMislabel
				? "fail"
				: limitationNotesPresent && hasReviewerConfirmation
					? "pass"
					: "warning",
			warningStandard: "Warning when limitation notes exist but still need reviewer confirmation, or when the package lacks sufficient disclosure detail.",
			whatToCheck: "Check whether the package honestly states guide limits, omissions, and any known locality or precinct variation risk.",
			whyItMatters: "Readers need clear limits so Ballot Clarity does not overclaim completeness where source quality is uneven.",
		}),
	];
}

function buildChecklistCategoryGroups(checklist: GuidePackageChecklistItem[]): GuidePackageChecklistCategoryGroup[] {
	return (Object.keys(checklistCategoryMeta) as GuidePackageChecklistCategory[]).map((category) => {
		const items = checklist.filter(item => item.category === category);
		const failItems = items.filter(item => item.status === "fail");

		return {
			blockingIssueCount: failItems.filter(item => item.blocking).length,
			description: checklistCategoryMeta[category].description,
			failCount: failItems.length,
			id: category,
			items,
			label: checklistCategoryMeta[category].label,
			warningCount: items.filter(item => item.status === "warning").length,
		};
	});
}

function buildRecommendationSummary(
	workflow: GuidePackageWorkflow,
	checklist: GuidePackageChecklistItem[],
): GuidePackageRecommendationSummary {
	const blockingFailures = checklist.filter(item => item.blocking && item.status === "fail");
	const anyFailures = checklist.some(item => item.status === "fail");
	const anyWarnings = checklist.some(item => item.status === "warning");
	let system: GuidePackageReviewRecommendation = "publish";

	if (blockingFailures.length || anyFailures)
		system = "needs_revision";
	else if (anyWarnings)
		system = "publish_with_warnings";

	const reviewer = workflow.reviewRecommendation;
	let final: GuidePackageReviewRecommendation = system;

	if (reviewer === "do_not_publish")
		final = "do_not_publish";
	else if (system === "needs_revision")
		final = "needs_revision";
	else if (reviewer)
		final = reviewer;

	let reason = "";

	if (blockingFailures.length) {
		reason = `${blockingFailures.length} blocking checklist item${blockingFailures.length === 1 ? "" : "s"} still fail.`;
	}
	else if (reviewer === "do_not_publish") {
		reason = "A reviewer explicitly marked this package do not publish.";
	}
	else if (system === "publish_with_warnings" && !reviewer) {
		reason = "Automated checks pass, but reviewer-confirmed rubric items are still open.";
	}
	else if (reviewer && reviewerReadyRecommendation(reviewer) && anyWarnings) {
		reason = "Reviewer signoff is recorded, but one or more non-blocking rubric items still carry warnings.";
	}
	else if (reviewer === "needs_revision") {
		reason = "Reviewer marked the package as needing revision before publication.";
	}
	else if (reviewerReadyRecommendation(reviewer)) {
		reason = "Reviewer signoff and checklist results support publication.";
	}
	else {
		reason = "Checklist items currently support publication without open blockers.";
	}

	return {
		final,
		reason,
		reviewer: reviewer || undefined,
		system,
	};
}

function buildIssues(
	workflow: GuidePackageWorkflow,
	checklist: GuidePackageChecklistItem[],
): GuidePackageIssue[] {
	const checklistIssues = checklist.flatMap((item) => {
		if (item.status === "pass" || item.status === "not_applicable")
			return [];

		return [{
			blocking: item.blocking && item.status === "fail",
			id: `checklist:${item.id}:${item.status}`,
			kind: item.issueKind,
			pipelineClass: item.pipelineClass,
			severity: item.status === "fail" && item.blocking ? "error" : "warning",
			summary: item.status === "fail" ? item.failStandard : item.warningStandard,
			title: item.label,
		} satisfies GuidePackageIssue];
	});

	const coverageLimitIssues = workflow.coverageLimits.map(note => ({
		blocking: false,
		id: `coverage-limit:${note}`,
		kind: "coverage_limit" as const,
		pipelineClass: "review_first_manual" as const,
		severity: "info" as const,
		summary: note,
		title: "Coverage limit",
	}));

	return [...checklistIssues, ...coverageLimitIssues];
}

function buildDiagnostics(
	workflow: GuidePackageWorkflow,
	election: Election | null,
	jurisdiction: Jurisdiction | null,
	contests: Contest[],
	candidates: Candidate[],
	measures: Measure[],
	officialResources: OfficialResource[],
	contentIndex: Map<string, AdminContentItem>,
): GuidePackageDiagnostics {
	const checklist = buildChecklist(workflow, election, jurisdiction, contests, officialResources, candidates, measures, contentIndex);
	const checklistCategories = buildChecklistCategoryGroups(checklist);
	const issues = buildIssues(workflow, checklist);
	const blockers = issues.filter(issue => issue.blocking);
	const warnings = issues.filter(issue => issue.severity === "warning");
	const scoredItems = checklist.filter(item => item.status !== "not_applicable");
	const completenessScore = scoredItems.length
		? Math.round((
				scoredItems.reduce((total, item) => total + (
					item.status === "pass"
						? 1
						: item.status === "warning"
							? 0.5
							: 0
				), 0) / scoredItems.length
			) * 100)
		: 100;
	const recommendation = buildRecommendationSummary(workflow, checklist);
	const readyToPublish = blockers.length === 0
		&& Boolean(workflow.reviewer?.trim())
		&& reviewerReadyRecommendation(workflow.reviewRecommendation)
		&& (recommendation.final === "publish" || recommendation.final === "publish_with_warnings");

	return {
		blockers,
		blockingIssueCount: blockers.length,
		checklist,
		checklistCategories,
		completenessScore,
		issues,
		recommendation,
		readyToPublish,
		rubricVersion: guidePackageRubricVersion,
		warningCount: warnings.length,
		warnings,
	};
}

export function buildDefaultGuidePackageSeed(coverageRepository: CoverageRepository): GuidePackageWorkflow[] {
	if (coverageRepository.mode !== "snapshot")
		return [];

	const election = getPrimaryElection(coverageRepository);
	const jurisdiction = getPrimaryJurisdiction(coverageRepository);

	if (!election || !jurisdiction)
		return [];

	const publishedAt = election.updatedAt;

	return [
		{
			coverageLimits: [
				"Guide pages remain explanatory and should not be treated as the official ballot service.",
				"District confirmation still belongs to official election tools for the final personalized ballot.",
				"Contest, candidate, and measure pages stay under local review until verified Fulton-specific ballot content replaces the reference archive.",
			],
			coverageNotes: [
				"The local guide is live so official links and core election pages stay public.",
				"Contest, candidate, and measure pages still include staged reference material until verified Fulton-specific ballot content is loaded.",
			],
			createdAt: election.updatedAt,
			draftedAt: election.updatedAt,
			electionSlug: election.slug,
			id: buildPackageId(election.slug),
			jurisdictionSlug: jurisdiction.slug,
			publishedAt,
			reviewRecommendation: "publish",
			reviewNotes: "Imported coverage snapshot published with verified official links and staged contest layers still under local review.",
			reviewedAt: publishedAt,
			reviewer: "Imported snapshot",
			status: "published",
			updatedAt: election.updatedAt,
		},
	];
}

export function buildGuidePackageId(electionSlug: string) {
	return buildPackageId(electionSlug);
}

export function buildGuidePackageRecord(
	workflow: GuidePackageWorkflow,
	coverageRepository: CoverageRepository,
	contentItems: AdminContentItem[],
): GuidePackageRecord {
	const election = coverageRepository.getElectionBySlug(workflow.electionSlug);
	const jurisdiction = coverageRepository.getJurisdictionBySlug(workflow.jurisdictionSlug);
	const contests = election?.contests ?? [];
	const candidates = uniqueBySlug(contests.flatMap(contest => contest.candidates ?? []));
	const measures = uniqueBySlug(contests.flatMap(contest => contest.measures ?? []));
	const officialResources = uniqueOfficialResources([
		...(election?.officialResources ?? []),
		...(jurisdiction?.officialResources ?? []),
	]);
	const attachedSources = collectElectionSources(election, jurisdiction);
	const contentIndex = buildContentIndex(contentItems);
	const diagnostics = buildDiagnostics(workflow, election, jurisdiction, contests, candidates, measures, officialResources, contentIndex);
	const contentStatus = buildGuideContentSummary(workflow, contests, candidates, measures, officialResources);

	return {
		attachedSources,
		candidates: candidates.map(candidate => buildCandidateSummary(candidate, contentIndex)),
		contentStatus,
		contests: contests.map(buildContestSummary),
		counts: {
			attachedSources: attachedSources.length,
			candidates: candidates.length,
			contests: contests.length,
			measures: measures.length,
			officialResources: officialResources.length,
		} satisfies GuidePackageCounts,
		coverageScope: {
			districtSlugs: contests.filter(contest => contest.type === "candidate").map(contest => contest.slug),
			electionSlug: workflow.electionSlug,
			jurisdictionSlug: workflow.jurisdictionSlug,
			label: election && jurisdiction
				? `${jurisdiction.displayName} · ${election.name}`
				: workflow.electionSlug,
			locationSlug: coverageRepository.data.location?.slug,
			routeFamilies: [
				"/ballot",
				"/contest",
				"/candidate",
				"/measure",
				"/compare",
				"/plan",
			],
		},
		diagnostics,
		election: election
			? {
					date: election.date,
					jurisdictionSlug: election.jurisdictionSlug,
					locationName: election.locationName,
					name: election.name,
					slug: election.slug,
					updatedAt: election.updatedAt,
				}
			: null,
		electionRecord: election,
		jurisdiction: jurisdiction
			? {
					description: jurisdiction.description,
					displayName: jurisdiction.displayName,
					jurisdictionType: jurisdiction.jurisdictionType,
					name: jurisdiction.name,
					nextElectionName: jurisdiction.nextElectionName,
					nextElectionSlug: jurisdiction.nextElectionSlug,
					slug: jurisdiction.slug,
					state: jurisdiction.state,
					updatedAt: jurisdiction.updatedAt,
				}
			: null,
		jurisdictionRecord: jurisdiction,
		measures: measures.map(measure => buildMeasureSummary(measure, contentIndex)),
		officialResources,
		workflow,
	};
}

export function buildGuidePackageSummary(packageRecord: GuidePackageRecord): GuidePackageSummary {
	return {
		contentStatus: packageRecord.contentStatus,
		counts: packageRecord.counts,
		coverageScope: packageRecord.coverageScope,
		diagnostics: {
			blockingIssueCount: packageRecord.diagnostics.blockingIssueCount,
			completenessScore: packageRecord.diagnostics.completenessScore,
			recommendation: packageRecord.diagnostics.recommendation,
			readyToPublish: packageRecord.diagnostics.readyToPublish,
			warningCount: packageRecord.diagnostics.warningCount,
		},
		election: packageRecord.election,
		jurisdiction: packageRecord.jurisdiction,
		workflow: packageRecord.workflow,
	};
}

export function buildGuidePackageList(
	workflows: GuidePackageWorkflow[],
	coverageRepository: CoverageRepository,
	contentItems: AdminContentItem[],
): GuidePackageListResponse {
	const packages = workflows.map(workflow => buildGuidePackageRecord(workflow, coverageRepository, contentItems));
	return {
		packages,
		updatedAt: packages.map(item => item.workflow.updatedAt).sort((left, right) => right.localeCompare(left))[0] ?? new Date().toISOString(),
	};
}
