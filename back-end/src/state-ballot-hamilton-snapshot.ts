import type { StateBallotQuestion } from "./state-ballot-questions.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { hamiltonDocumentDigest, validateHamiltonDocumentUrl, validateHamiltonSource } from "./state-ballot-hamilton-collection.js";
import { hamiltonChoicePairs, hamiltonQuestionId } from "./state-ballot-hamilton.js";
import { containsControlCharacters } from "./text-validation.js";

export function readHamiltonSnapshotMetadata(source: StateBallotSource, data: Record<string, unknown>) {
	validateHamiltonSource(source);
	if (data.sourceAsOfDate !== undefined || data.sourceAsOf !== undefined || !Array.isArray(data.documents) || data.documents.length !== 1 || !Array.isArray(data.ballotQuestions) || data.ballotQuestions.length > 100)
		throw new Error("The stored Hamilton County publication requires review.");
	const document = data.documents[0];
	if (!document || typeof document !== "object" || typeof document.url !== "string" || typeof document.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(document.sha256))
		throw new Error("The stored Hamilton County source requires review.");
	validateHamiltonDocumentUrl(document.url);
	if (data.collectionIndexSha256 !== hamiltonDocumentDigest([document]))
		throw new Error("The stored Hamilton County publication fingerprint requires review.");
	const ballotQuestions = data.ballotQuestions.map((value: unknown) => {
		if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== "audience,choices,explicitlyAdvisory,id,officialText,pages,title,voterApplicabilityVerified")
			throw new Error("The stored Hamilton County question fields require review.");
		const question = value as StateBallotQuestion;
		for (const [field, maximum] of [["audience", 300], ["title", 350], ["officialText", 5000]] as const) {
			if (typeof question[field] !== "string" || !question[field].trim() || question[field].length > maximum || containsControlCharacters(field === "officialText" ? question[field].replace(/\n\n/gu, "") : question[field]))
				throw new Error("The stored Hamilton County wording requires review.");
		}
		if (question.audience !== "Tennessee" && !/^(?:City|Town) of [\p{L} .'-]+$/u.test(question.audience))
			throw new Error("The stored Hamilton County question jurisdiction requires review.");
		if (!/^(?:Constitutional Amendment #[1-9]\d?|Charter Amendment [1-9]\d?|Charter Referendum|General Obligation Bond Referendum)$/u.test(question.title) || question.title.startsWith("Constitutional") !== (question.audience === "Tennessee") || question.explicitlyAdvisory !== false || question.voterApplicabilityVerified !== false || !hamiltonChoicePairs.some(pair => JSON.stringify(pair) === JSON.stringify(question.choices)) || !Array.isArray(question.pages) || !question.pages.length || question.pages.length > 20 || question.pages.some((page, index) => !Number.isInteger(page) || page < 1 || page > 20 || (index > 0 && page <= question.pages[index - 1]!)) || question.id !== hamiltonQuestionId(source, question))
			throw new Error("The stored Hamilton County question identity or choices require review.");
		return question;
	});
	if (new Set(ballotQuestions.map(question => question.id)).size !== ballotQuestions.length)
		throw new Error("The stored Hamilton County questions are duplicated.");
	return { ballotQuestions };
}
