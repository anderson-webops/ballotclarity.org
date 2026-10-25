import type { Measure, PlannedMeasureDecision, Source } from "../types/civic";

const present = (text: string) => Boolean(text.trim());
const normalized = (text: string) => text.trim().replace(/\s+/gu, " ").replace(/[.!?]+$/u, "").toLowerCase();

export function measureCardSummary(measure: Pick<Measure, "summary" | "plainLanguageExplanation">) {
	return measure.summary.trim() || measure.plainLanguageExplanation.trim();
}

export function measureBallotOptions(measure: Pick<Measure, "ballotOptions"> | null | undefined) {
	return measure?.ballotOptions ?? { yes: "Yes", no: "No" };
}

export function hasLongMeasureOptions(measure: Pick<Measure, "ballotOptions"> | null | undefined) {
	const options = measureBallotOptions(measure);
	return Math.max(options.yes.length, options.no.length) > 20 || options.yes.length + options.no.length > 26;
}

export function measureDetailPath(measure: Pick<Measure, "slug" | "electionSlug">, electionSlug?: string) {
	const path = `/measure/${encodeURIComponent(measure.slug)}`;
	return electionSlug && measure.electionSlug && electionSlug !== measure.electionSlug ? `${path}?election=${encodeURIComponent(electionSlug)}` : path;
}

export function measureDecisionLabel(measure: Pick<Measure, "ballotOptions">, decision: PlannedMeasureDecision) {
	return decision === "review" ? "Marked for review" : `Marked ${measure.ballotOptions?.[decision] ?? decision.toUpperCase()}`;
}

export function measureDecisionEffectLabel(measure: Pick<Measure, "decisionEffect">) {
	return measure.decisionEffect === "advisory" ? "Non-binding advisory vote" : "";
}

export function measureGuideLink(measure: Pick<Measure, "electionSlug"> | null | undefined) {
	const slug = measure?.electionSlug?.trim();
	return slug ? { label: "Ballot guide", to: `/ballot/${encodeURIComponent(slug)}` } : null;
}

export function measureContent(measure: Measure | null | undefined) {
	const summaries: { title: string; text: string }[] = [];
	const sources = new Map<string, Source>();
	const sections: { href: string; label: string }[] = [];
	if (!measure) return { summaries, sources: [], sections };
	const seen = new Set([normalized(measure.summary)]);
	for (const [title, text] of [["Official ballot summary", measure.ballotSummary], ["Explanation", measure.plainLanguageExplanation]]) {
		if (!present(text!) || seen.has(normalized(text!))) continue;
		summaries.push({ title: title!, text: text! });
		seen.add(normalized(text!));
	}
	const baselineLabel = measure.currentPractice.length || present(measure.currentLawOverview)
		? measure.proposedChanges.length ? "Current law and changes" : "Current law"
		: "Proposed changes";
	const options = measureBallotOptions(measure);
	const entries: [string, string, boolean][] = [
		["fiscal", "Fiscal impact", present(measure.fiscalContextNote) || measure.fiscalSummary.length > 0 || measure.potentialImpacts.length > 0 || measure.argumentsAndConsiderations.length > 0],
		["limitations", "Limitations", measure.whatWeDoNotKnow.length > 0],
		["outcomes", hasLongMeasureOptions(measure) ? "Vote options" : `${options.yes} / ${options.no}`, present(measure.yesMeaning) || present(measure.noMeaning) || measure.yesHighlights.length > 0 || measure.noHighlights.length > 0],
		["at-a-glance", "Summary", summaries.length > 0],
		["baseline", baselineLabel, present(measure.currentLawOverview) || measure.currentPractice.length > 0 || measure.proposedChanges.length > 0],
		["implementation", "Timeline", present(measure.implementationOverview) || measure.implementationTimeline.length > 0],
		["arguments", "Arguments", measure.supportArguments.length > 0 || measure.opposeArguments.length > 0],
	];
	sections.push(...entries.filter(([, , visible]) => visible).map(([id, label]) => ({ href: `#${id}`, label })));
	for (const source of [
		...measure.sources,
		...[...measure.currentPractice, ...measure.proposedChanges, ...measure.implementationTimeline, ...measure.fiscalSummary, ...measure.potentialImpacts, ...measure.supportArguments, ...measure.opposeArguments, ...measure.argumentsAndConsiderations, ...measure.whatWeKnow, ...measure.whatWeDoNotKnow].flatMap(item => item.sources),
	]) sources.set(source.id, source);
	if (sources.size || measure.whatWeKnow.length || present(measure.freshness.contentLastVerifiedAt)) sections.push({ href: "#sources", label: "Sources" });
	return { summaries, sources: [...sources.values()], sections };
}
