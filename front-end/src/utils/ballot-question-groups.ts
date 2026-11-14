import type { PublicBallotQuestion } from "~/types/civic";

export function ballotQuestionAreaLabel(question: PublicBallotQuestion) {
	const area = question.publishedArea;
	return area?.basis === "printed-question" && typeof area.name === "string" && area.name.trim() && area.name.length <= 120 ? area.name : null;
}

export function groupBallotQuestions(questions: PublicBallotQuestion[]) {
	const ranks = { "state": 0, "county": 1, "county-area": 2, "city": 3 };
	const grouped = new Map<string, { audience: string; label: string; questions: PublicBallotQuestion[]; rank: number }>();
	for (const question of questions) {
		const label = ballotQuestionAreaLabel(question);
		const area = label ? question.publishedArea : undefined;
		const audience = area ? JSON.stringify([area.kind, area.stateCode, area.name, area.excludedMunicipalities ?? []]) : question.audience;
		if (!grouped.has(audience)) grouped.set(audience, { audience, label: label ?? question.audience.replace(/^To the Voters of (?:the )?/u, "").replace(/:$/u, ""), questions: [], rank: area ? ranks[area.kind] ?? 4 : 4 });
		grouped.get(audience)!.questions.push(question);
	}
	return [...grouped.values()].sort((first, second) => first.rank - second.rank || (first.rank < 4 ? first.label.localeCompare(second.label, "en") : 0)).map(({ rank: _rank, ...group }) => group);
}
