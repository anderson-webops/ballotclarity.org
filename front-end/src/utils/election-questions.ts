import type { BallotResponse, StateQuestionsResponse } from "~/types/civic";

export function electionQuestions(response: StateQuestionsResponse | null, source: NonNullable<BallotResponse["candidateRecordSource"]>, electionDate: string) {
	return response?.available && response.source.stateCode === source.stateCode && response.source.id === source.sourceId && response.source.electionDate === electionDate
		? response.questions
		: [];
}
