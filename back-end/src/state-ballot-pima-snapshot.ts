import type { StateBallotSource } from "./state-ballot-sources.js";
import { pimaDocumentDigest, validatePimaElection, validatePimaSource } from "./state-ballot-pima-collection.js";

export function readPimaSnapshotMetadata(source: StateBallotSource, data: Record<string, unknown>) {
	validatePimaSource(source);
	if (!Array.isArray(data.documents) || !data.documents.length || data.documents.length > 2 || data.ballotQuestions !== undefined || data.sourceAsOf !== undefined) throw new Error("The stored Pima publication set requires review.");
	const documents = data.documents.map((item: unknown, index) => {
		if (!item || typeof item !== "object" || Array.isArray(item) || !("url" in item) || typeof item.url !== "string" || !("sha256" in item) || typeof item.sha256 !== "string") throw new Error("The stored Pima publication requires review.");
		return { kind: index ? "write-ins" as const : "candidates" as const, url: item.url, sha256: item.sha256 };
	});
	validatePimaElection({ electionId: null, electionDate: source.electionDate, pageUrl: source.pageUrl, pimaDocuments: documents });
	if (data.collectionIndexSha256 !== pimaDocumentDigest(documents) || typeof data.sourceAsOfDate !== "string" || !/^20\d{2}-\d{2}-\d{2}$/u.test(data.sourceAsOfDate) || !Number.isFinite(Date.parse(data.sourceAsOfDate)) || new Date(`${data.sourceAsOfDate}T00:00:00Z`).toISOString().slice(0, 10) !== data.sourceAsOfDate || data.sourceAsOfDate.slice(0, 4) !== source.electionDate.slice(0, 4) || data.sourceAsOfDate > source.electionDate || typeof data.retrievedAt !== "string" || data.sourceAsOfDate > data.retrievedAt.slice(0, 10)) throw new Error("The stored Pima publication date or fingerprint requires review.");
	return { sourceAsOfDate: data.sourceAsOfDate };
}
