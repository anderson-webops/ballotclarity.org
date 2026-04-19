import type { CoverageRepository } from "./coverage-repository.js";
import type {
	AdminContentItem,
	Candidate,
	Contest,
	Election,
	GuidePackageCandidateSummary,
	GuidePackageChecklistItem,
	GuidePackageContestSummary,
	GuidePackageCounts,
	GuidePackageDiagnostics,
	GuidePackageIssue,
	GuidePackageListResponse,
	GuidePackageMeasureSummary,
	GuidePackageRecord,
	GuidePackageSummary,
	GuidePackageWorkflow,
	Jurisdiction,
	Measure,
	OfficialResource,
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

function buildChecklist(
	election: Election | null,
	jurisdiction: Jurisdiction | null,
	contests: Contest[],
	officialResources: OfficialResource[],
	candidates: Candidate[],
	measures: Measure[],
): GuidePackageChecklistItem[] {
	const candidateSourceCoverage = candidates.length
		? candidates.every(candidate => candidate.sources.length > 0)
		: true;
	const measureSourceCoverage = measures.length
		? measures.every(measure => measure.sources.length > 0 && Boolean(measure.plainLanguageExplanation?.trim()))
		: true;

	return [
		{
			blocking: true,
			detail: election?.name && election.date && jurisdiction?.displayName
				? `Election identity is present for ${election.name} in ${jurisdiction.displayName}.`
				: "Election name, date, and jurisdiction identity all need to exist before the package can publish.",
			id: "election-identity",
			label: "Election identity exists",
			passed: Boolean(election?.name && election?.date && jurisdiction?.displayName),
			pipelineClass: "fully_automatable",
		},
		{
			blocking: true,
			detail: contests.length
				? `${contests.length} contest records are attached to this package draft.`
				: "No contest roster is attached to this package yet.",
			id: "contest-roster",
			label: "Contest roster detected",
			passed: contests.length > 0,
			pipelineClass: "automatable_with_review",
		},
		{
			blocking: true,
			detail: officialResources.length
				? `${officialResources.length} official election resources are attached.`
				: "Official election resources must be attached before publish.",
			id: "official-resources",
			label: "Official resources attached",
			passed: officialResources.length > 0,
			pipelineClass: "fully_automatable",
		},
		{
			blocking: true,
			detail: candidateSourceCoverage && measureSourceCoverage
				? "Candidate and measure entries all carry attached source records."
				: "One or more candidate or measure entries still lack the source coverage needed for publication.",
			id: "source-coverage",
			label: "Source coverage attached",
			passed: candidateSourceCoverage && measureSourceCoverage,
			pipelineClass: "automatable_with_review",
		},
		{
			blocking: false,
			detail: measures.length
				? "Measures with explanation text should still receive final review before publish."
				: "No measures detected in this package.",
			id: "manual-measure-review",
			label: "Manual summary review tracked",
			passed: true,
			pipelineClass: "review_first_manual",
		},
	];
}

function buildIssues(
	workflow: GuidePackageWorkflow,
	election: Election | null,
	jurisdiction: Jurisdiction | null,
	contests: Contest[],
	candidates: Candidate[],
	measures: Measure[],
	officialResources: OfficialResource[],
	contentIndex: Map<string, AdminContentItem>,
): GuidePackageIssue[] {
	const issues: GuidePackageIssue[] = [];

	if (!election?.name || !election?.date) {
		issues.push({
			blocking: true,
			id: "missing-election-identity",
			kind: "missing_field",
			pipelineClass: "fully_automatable",
			severity: "error",
			summary: "Election name and date must exist before Ballot Clarity can publish the local guide package.",
			title: "Election identity is incomplete",
		});
	}

	if (!jurisdiction?.displayName) {
		issues.push({
			blocking: true,
			id: "missing-jurisdiction",
			kind: "missing_field",
			pipelineClass: "fully_automatable",
			severity: "error",
			summary: "Jurisdiction identity must exist before the package can publish.",
			title: "Jurisdiction identity is incomplete",
		});
	}

	if (!officialResources.length) {
		issues.push({
			blocking: true,
			id: "missing-official-resources",
			kind: "missing_field",
			pipelineClass: "fully_automatable",
			severity: "error",
			summary: "Official election resources are required before Ballot Clarity can promote a draft package to published.",
			title: "Official election resources are missing",
		});
	}

	if (!contests.length) {
		issues.push({
			blocking: true,
			id: "missing-contests",
			kind: "missing_field",
			pipelineClass: "automatable_with_review",
			severity: "error",
			summary: "No contest roster is attached to this package draft.",
			title: "Contest roster is empty",
		});
	}

	for (const candidate of candidates) {
		if (!candidate.sources.length) {
			issues.push({
				blocking: true,
				entitySlug: candidate.slug,
				entityType: "candidate",
				id: `candidate-source-gap:${candidate.slug}`,
				kind: "source_gap",
				pipelineClass: "automatable_with_review",
				severity: "error",
				summary: `${candidate.name} does not yet have attached source records in the current package.`,
				title: "Candidate source coverage is incomplete",
			});
		}

		const content = contentIndex.get(`candidate:${candidate.slug}`);
		if (content && content.status === "needs-sources") {
			issues.push({
				blocking: false,
				entitySlug: candidate.slug,
				entityType: "candidate",
				id: `candidate-review-warning:${candidate.slug}`,
				kind: "normalization_issue",
				pipelineClass: "automatable_with_review",
				severity: "warning",
				summary: `${candidate.name} is still flagged as needing sources in the editorial queue.`,
				title: "Candidate record still needs review",
			});
		}
	}

	for (const measure of measures) {
		if (!measure.sources.length) {
			issues.push({
				blocking: true,
				entitySlug: measure.slug,
				entityType: "measure",
				id: `measure-source-gap:${measure.slug}`,
				kind: "source_gap",
				pipelineClass: "automatable_with_review",
				severity: "error",
				summary: `${measure.title} does not yet have attached source records in the current package.`,
				title: "Measure source coverage is incomplete",
			});
		}

		if (!measure.plainLanguageExplanation?.trim()) {
			issues.push({
				blocking: true,
				entitySlug: measure.slug,
				entityType: "measure",
				id: `measure-explainer-gap:${measure.slug}`,
				kind: "missing_field",
				pipelineClass: "review_first_manual",
				severity: "error",
				summary: `${measure.title} is missing the plain-language explanation required for a published guide.`,
				title: "Measure plain-language summary is missing",
			});
		}
	}

	for (const note of workflow.coverageLimits) {
		issues.push({
			blocking: false,
			id: `coverage-limit:${note}`,
			kind: "coverage_limit",
			pipelineClass: "review_first_manual",
			severity: "info",
			summary: note,
			title: "Coverage limit",
		});
	}

	return issues;
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
	const checklist = buildChecklist(election, jurisdiction, contests, officialResources, candidates, measures);
	const issues = buildIssues(workflow, election, jurisdiction, contests, candidates, measures, officialResources, contentIndex);
	const blockingIssueCount = issues.filter(issue => issue.blocking).length;
	const warningCount = issues.filter(issue => issue.severity === "warning").length;
	const passedCount = checklist.filter(item => item.passed).length;
	const completenessScore = checklist.length ? Math.round((passedCount / checklist.length) * 100) : 0;

	return {
		blockingIssueCount,
		checklist,
		completenessScore,
		issues,
		readyToPublish: blockingIssueCount === 0 && checklist.filter(item => item.blocking).every(item => item.passed),
		warningCount,
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
			],
			coverageNotes: [
				"Draft package assembled from the imported coverage snapshot and the current editorial content store.",
				"Final publish state still depends on explicit reviewer promotion, even when the package is already active in this environment.",
			],
			createdAt: election.updatedAt,
			draftedAt: election.updatedAt,
			electionSlug: election.slug,
			id: buildPackageId(election.slug),
			jurisdictionSlug: jurisdiction.slug,
			publishedAt,
			reviewNotes: "Imported coverage snapshot promoted as the current public local guide package.",
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

	return {
		attachedSources,
		candidates: candidates.map(candidate => buildCandidateSummary(candidate, contentIndex)),
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
		counts: packageRecord.counts,
		coverageScope: packageRecord.coverageScope,
		diagnostics: {
			blockingIssueCount: packageRecord.diagnostics.blockingIssueCount,
			completenessScore: packageRecord.diagnostics.completenessScore,
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
