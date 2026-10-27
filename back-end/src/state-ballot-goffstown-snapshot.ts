import type { ChicagoQuestion } from "./state-ballot-chicago.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { createHash } from "node:crypto";
import { goffstownDocumentDigest, validateGoffstownSource } from "./state-ballot-goffstown-collection.js";
import { validateGoffstownDocumentUrl } from "./state-ballot-goffstown-discovery.js";
import { containsControlCharacters } from "./text-validation.js";

export function readGoffstownSnapshotMetadata(source: StateBallotSource, data: Record<string, unknown>) {
	validateGoffstownSource(source);
	if (data.sourceAsOfDate !== undefined || data.sourceAsOf !== undefined || !Array.isArray(data.documents) || data.documents.length !== 1) throw new Error("The Goffstown snapshot metadata requires review.");
	const document: unknown = data.documents[0];
	if (!document || typeof document !== "object" || !("url" in document) || typeof document.url !== "string" || !("sha256" in document) || typeof document.sha256 !== "string" || !("includedRecordCount" in document) || document.includedRecordCount !== data.recordCount || !("retrievedAt" in document) || document.retrievedAt !== data.retrievedAt || data.sourceSha256 !== data.collectionIndexSha256) throw new Error("The Goffstown snapshot publication requires review.");
	validateGoffstownDocumentUrl(document.url, source.electionDate);
	if (data.collectionIndexSha256 !== goffstownDocumentDigest([{ url: document.url, sha256: document.sha256 }]) || !Array.isArray(data.ballotQuestions) || !data.ballotQuestions.length || data.ballotQuestions.length > 20) throw new Error("The Goffstown snapshot questions require review.");
	const ballotQuestions = data.ballotQuestions.map((value: unknown, index): ChicagoQuestion => {
		if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== "audience,choices,explicitlyAdvisory,id,officialText,pages,title,voterApplicabilityVerified") throw new Error("The Goffstown stored question fields require review.");
		const item = value as Record<string, unknown>;
		if (item.audience !== "Goffstown sample ballot" || item.title !== `Question ${index + 1}` || typeof item.officialText !== "string" || item.officialText.length < 30 || item.officialText.length > 5000 || containsControlCharacters(item.officialText) || typeof item.explicitlyAdvisory !== "boolean" || item.voterApplicabilityVerified !== false || JSON.stringify(item.choices) !== "[\"Yes\",\"No\"]" || JSON.stringify(item.pages) !== "[2]") throw new Error("The Goffstown stored question text requires review.");
		const id = createHash("sha256").update(JSON.stringify([source.id, source.electionDate, item.audience, index + 1, item.officialText])).digest("hex").slice(0, 24);
		if (item.id !== id) throw new Error("The Goffstown stored question identity requires review.");
		return item as unknown as ChicagoQuestion;
	});
	if (new Set(ballotQuestions.map(question => question.id)).size !== ballotQuestions.length) throw new Error("The Goffstown stored questions repeat.");
	return { ballotQuestions };
}
