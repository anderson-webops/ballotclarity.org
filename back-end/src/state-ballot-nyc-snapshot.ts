import type { StateBallotQuestion } from "./state-ballot-questions.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { createHash } from "node:crypto";
import { nycCivilPublicationKey, nycDocumentDigest, validateNycDocumentUrl, validateNycSource } from "./state-ballot-nyc-collection.js";
import { nycOfficeGeography, nycPublicationDate } from "./state-ballot-nyc.js";
import { containsControlCharacters } from "./text-validation.js";

export function readNycSnapshotMetadata(source: StateBallotSource, data: Record<string, unknown>) {
	validateNycSource(source);
	if (!Array.isArray(data.records) || !data.records.length || data.records.length > 5000) throw new Error("The NYC stored candidate inventory is invalid.");
	for (const row of data.records) {
		if (!row || typeof row !== "object" || typeof row.office !== "string" || row.status !== "listed" || row.sourceStatus !== "Tentative" || row.sourceDistrictLabel !== row.office || !Number.isSafeInteger(row.seats) || row.seats < 1 || row.seats > 99 || ["voteLimit", "termYears", "candidateUrl", "termEnd", "incumbent", "sourceCandidateId", "sourceDivision"].some(key => row[key] !== undefined)) throw new Error("The NYC stored candidate fields require review.");
		const expected = nycOfficeGeography(row.office);
		if (["scope", "district", "jurisdiction"].some(key => row[key] !== expected[key as keyof typeof expected])) throw new Error("The NYC stored candidate geography requires review.");
	}
	if (typeof data.sourceAsOf !== "string" || typeof data.sourceAsOfDate !== "string" || typeof data.retrievedAt !== "string" || nycPublicationDate(data.sourceAsOf, source.electionDate) !== data.sourceAsOfDate || data.sourceAsOfDate > data.retrievedAt.slice(0, 10)) throw new Error("The NYC stored publication date is invalid.");
	nycCivilPublicationKey(data.sourceAsOf, source.electionDate);
	if (!Array.isArray(data.documents) || data.documents.length !== 1) throw new Error("The NYC stored document inventory is invalid.");
	const document = data.documents[0];
	if (!document || typeof document !== "object" || typeof document.url !== "string" || typeof document.sha256 !== "string") throw new Error("The NYC stored document is invalid.");
	validateNycDocumentUrl(document.url, source.electionDate);
	if (data.collectionIndexSha256 !== nycDocumentDigest([{ url: document.url, sha256: document.sha256 }])) throw new Error("The NYC stored publication fingerprint is invalid.");
	if (!Array.isArray(data.ballotQuestions) || data.ballotQuestions.length > 100) throw new Error("The NYC stored question inventory is invalid.");
	const numbers = new Set<number>();
	const questions = data.ballotQuestions.map((value: unknown) => {
		if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== "audience,choices,explicitlyAdvisory,id,officialText,pages,title,voterApplicabilityVerified") throw new Error("The NYC stored question fields are invalid.");
		const item = value as Record<string, unknown>;
		if (typeof item.title !== "string" || typeof item.officialText !== "string" || !item.officialText.trim() || item.officialText.length > 12000 || item.title.length > 1200 || containsControlCharacters(item.title + item.officialText) || item.audience !== "New York City" || item.voterApplicabilityVerified !== false || item.explicitlyAdvisory !== false || JSON.stringify(item.choices) !== "[\"Yes\",\"No\"]") throw new Error("The NYC stored question text or audience is invalid.");
		const title = /^Proposal ([1-9]\d?): (.+)$/u.exec(item.title);
		if (!title || numbers.has(Number(title[1]))) throw new Error("The NYC stored proposal identity repeats or is invalid.");
		numbers.add(Number(title[1]));
		if (!Array.isArray(item.pages) || item.pages.length !== 5 || item.pages.some((page, index, pages) => !Number.isInteger(page) || page < 2 || page > 60 || (index > 0 && page <= pages[index - 1]))) throw new Error("The NYC stored proposal pages are invalid.");
		const id = createHash("sha256").update(JSON.stringify([source.id, source.electionDate, Number(title[1]), title[2], item.officialText])).digest("hex").slice(0, 24);
		if (item.id !== id) throw new Error("The NYC stored question identity is invalid.");
		return item as unknown as StateBallotQuestion;
	});
	if (new Set(questions.map(item => item.id)).size !== questions.length) throw new Error("The NYC stored questions repeat.");
	return { ballotQuestions: questions, sourceAsOfDate: data.sourceAsOfDate, sourceAsOf: data.sourceAsOf };
}
