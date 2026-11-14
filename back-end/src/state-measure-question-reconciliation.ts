import type { CoverageSnapshot } from "./coverage-repository.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import { createHash } from "node:crypto";
import { coverageElections, coverageJurisdictions } from "./coverage-repository.js";
import { usStates } from "./us-states.js";

const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export function reconcileStateMeasureQuestions(native: StateBallotSnapshot, coverage: CoverageSnapshot, electionSlugs: string[]) {
	const questions = native.ballotQuestions;
	if (!questions?.length || questions.length > 2000 || new Set(questions.map(question => question.id)).size !== questions.length || !electionSlugs.length || electionSlugs.length > 250 || new Set(electionSlugs).size !== electionSlugs.length)
		throw new Error("Question reconciliation requires a bounded native inventory and unique selected elections.");
	const elections = coverageElections(coverage);
	const jurisdictions = coverageJurisdictions(coverage);
	const findings: { code: string; measureSlug?: string; questionId?: string }[] = [];
	const matches = [];
	const seenMeasures = new Set<string>();
	const matchedQuestions = new Set<string>();
	for (const slug of electionSlugs) {
		const selected = elections.filter(election => election.slug === slug);
		if (selected.length !== 1) throw new Error("Question reconciliation requires one exact selected election identity.");
		const election = selected[0]!;
		const jurisdiction = jurisdictions.find(item => item.slug === election.jurisdictionSlug);
		const state = usStates.find(item => item[0] === jurisdiction?.state || item[1] === jurisdiction?.state)?.[0];
		if (!jurisdiction || state !== native.source.stateCode || election.date !== native.source.electionDate)
			throw new Error("Question reconciliation must retain the native state and election date.");
		for (const contest of election.contests) {
			for (const measure of contest.measures ?? []) {
				if (contest.type !== "measure" || measure.contestSlug !== contest.slug || typeof measure.slug !== "string" || seenMeasures.has(measure.slug) || typeof measure.ballotSummary !== "string" || measure.ballotSummary.length > 20000 || seenMeasures.size >= 2000)
					throw new Error("Question reconciliation measure identities or wording require review.");
				seenMeasures.add(measure.slug);
				const candidates = questions.filter(question => clean(question.officialText) === clean(measure.ballotSummary));
				if (candidates.length !== 1) {
					findings.push({ code: candidates.length ? "ambiguous-question-wording" : "unmatched-measure-wording", measureSlug: measure.slug });
					continue;
				}
				const question = candidates[0]!;
				if (matchedQuestions.has(question.id)) findings.push({ code: "question-bound-to-multiple-measures", measureSlug: measure.slug, questionId: question.id });
				matchedQuestions.add(question.id);
				const choices = [measure.ballotOptions?.yes ?? "Yes", measure.ballotOptions?.no ?? "No"];
				if (question.textKind === "notice") findings.push({ code: "notice-is-not-a-measure", measureSlug: measure.slug, questionId: question.id });
				if (JSON.stringify(choices) !== JSON.stringify(question.choices)) findings.push({ code: "printed-choice-mismatch", measureSlug: measure.slug, questionId: question.id });
				if (question.explicitlyAdvisory !== (measure.decisionEffect === "advisory")) findings.push({ code: "advisory-effect-mismatch", measureSlug: measure.slug, questionId: question.id });
				const sourceUrl = question.sourceUrl ?? native.source.url;
				const document = native.documents?.find(item => item.url === sourceUrl);
				if (!document || !question.pages.length) findings.push({ code: "question-document-provenance-unresolved", measureSlug: measure.slug, questionId: question.id });
				for (const root of coverage.measures.filter(item => item.slug === measure.slug)) {
					if (root.ballotSummary !== measure.ballotSummary || JSON.stringify(root.ballotOptions) !== JSON.stringify(measure.ballotOptions) || root.decisionEffect !== measure.decisionEffect || root.contestSlug !== measure.contestSlug)
						findings.push({ code: "root-measure-copy-mismatch", measureSlug: measure.slug, questionId: question.id });
				}
				matches.push({ questionId: question.id, questionTitle: question.title, measureSlug: measure.slug, electionSlug: election.slug, jurisdictionSlug: jurisdiction.slug, jurisdictionType: jurisdiction.jurisdictionType, jurisdictionName: jurisdiction.name, ...(jurisdiction.countyAreaScope ? { countyAreaScope: structuredClone(jurisdiction.countyAreaScope) } : {}), officialText: question.officialText, normalizedTextSha256: hash(clean(question.officialText)), choices: question.choices, pages: question.pages, sourceUrl, documentSha256: document?.sha256 ?? null, originalCapturedAt: document?.retrievedAt ?? null, voterApplicabilityVerified: false });
			}
		}
	}
	for (const question of questions) {
		if (!matchedQuestions.has(question.id)) findings.push({ code: "unmatched-native-question", questionId: question.id });
	}
	return { schemaVersion: 1, type: "state-measure-question-reconciliation", stateCode: native.source.stateCode, sourceId: native.source.id, electionDate: native.source.electionDate, nativeQuestionCount: questions.length, selectedMeasureCount: seenMeasures.size, matchedQuestionCount: matchedQuestions.size, wordingReconciled: findings.length === 0, matches, findings, scopeVerificationComplete: false, publicationApproved: false, automaticImportApproved: false, voterApplicabilityVerified: false };
}
