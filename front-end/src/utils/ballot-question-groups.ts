import type { PublicBallotQuestion } from "~/types/civic";

export function groupBallotQuestions(questions: PublicBallotQuestion[]) {
	const grouped = new Map<string, PublicBallotQuestion[]>();
	for (const question of questions) grouped.set(question.audience, [...(grouped.get(question.audience) ?? []), question]);
	return [...grouped].map(([audience, items]) => ({ audience, label: audience.replace(/^To the Voters of (?:the )?/u, "").replace(/:$/u, ""), questions: items }));
}
