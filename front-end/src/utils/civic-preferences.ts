import type { BallotPlanSelection } from "../types/civic";

export function normalizeStoredStrings(value: unknown): string[] {
	if (!Array.isArray(value))
		return [];

	return Array.from(new Set(value
		.filter((item): item is string => typeof item === "string")
		.map(item => item.trim())
		.filter(Boolean)));
}

export function normalizeStoredBallotPlan(value: unknown): Record<string, BallotPlanSelection> {
	if (!value || typeof value !== "object" || Array.isArray(value))
		return {};

	return Object.fromEntries(Object.entries(value).filter(([slug, selection]) => {
		if (!selection || typeof selection !== "object" || Array.isArray(selection))
			return false;
		if (selection.contestSlug !== slug || !slug.trim()
			|| typeof selection.savedAt !== "string" || !Number.isFinite(Date.parse(selection.savedAt))) {
			return false;
		}

		return selection.type === "candidate"
			? typeof selection.candidateSlug === "string" && Boolean(selection.candidateSlug.trim())
			: selection.type === "measure"
				&& typeof selection.measureSlug === "string" && Boolean(selection.measureSlug.trim())
				&& ["yes", "no", "review"].includes(selection.decision);
	}));
}
