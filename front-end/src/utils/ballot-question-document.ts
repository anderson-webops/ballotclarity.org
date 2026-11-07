import type { PublicBallotQuestion, StateRecordsResponse } from "~/types/civic";

export function ballotQuestionDocument(source: StateRecordsResponse["source"] | undefined, question: PublicBallotQuestion | undefined) {
	if (!source || !question) return undefined;
	const link = question.sourceUrl ? source.documentLinks?.find(item => item.url === question.sourceUrl) : source.documentLinks?.[0];
	return link ? `${link.url}#${link.pageAnchor === "page-" ? "page-" : "page="}${question.pages[0]}` : source.url;
}
