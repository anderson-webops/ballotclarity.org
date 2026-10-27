import type { StateBallotSource } from "./state-ballot-sources.js";
import { orangeDocumentDigest } from "./state-ballot-orange-collection.js";
import { orangeHash, rejectOrange as reject, validateOrangeDocumentUrl, validateOrangeSource } from "./state-ballot-orange-discovery.js";
import { orangeOfficeGeography, orangePublicationKey } from "./state-ballot-orange-records.js";

export function readOrangeSnapshotMetadata(source: StateBallotSource, data: Record<string, unknown>) {
	validateOrangeSource(source);
	if (!Array.isArray(data.records) || !data.records.length || data.records.length > 5000) return reject();
	for (const row of data.records) {
		if (!row || typeof row !== "object" || typeof row.name !== "string" || (row.party !== undefined && typeof row.party !== "string") || typeof row.office !== "string" || typeof row.sourceAreaLabel !== "string" || row.status !== "qualified" || row.sourceStatus !== "Qualified" || typeof row.sourceCandidateId !== "string" || !/^\d{4}:\d{1,4}$/u.test(row.sourceCandidateId) || typeof row.ballotDesignation !== "string" || !row.ballotDesignation.trim() || !Number.isSafeInteger(row.voteLimit) || row.voteLimit < 1 || row.voteLimit > 40 || ["sourceDistrictLabel", "sourceDivision", "jurisdiction", "seats", "termYears", "termEnd", "incumbent", "candidateUrl"].some(key => row[key] !== undefined)) return reject();
		const expected = orangeOfficeGeography(row.office, row.sourceAreaLabel);
		if (row.scope !== expected.scope || row.district !== expected.district) return reject();
		if (row.id !== orangeHash(JSON.stringify([source.stateCode, source.electionDate, row.office.toLowerCase(), row.district, row.name.toLowerCase(), (row.party ?? "").toLowerCase(), row.sourceCandidateId])).slice(0, 24)) return reject();
	}
	if (typeof data.sourceAsOf !== "string" || typeof data.retrievedAt !== "string" || orangePublicationKey(data.sourceAsOf).slice(0, 10) !== data.sourceAsOfDate || data.sourceAsOfDate > data.retrievedAt.slice(0, 10) || data.sourceAsOfDate > source.electionDate || data.ballotQuestions !== undefined) return reject();
	if (!Array.isArray(data.documents) || data.documents.length !== 1) return reject();
	const document = data.documents[0];
	if (!document || typeof document !== "object" || typeof document.url !== "string" || typeof document.sha256 !== "string") return reject();
	validateOrangeDocumentUrl(document.url, source.electionDate);
	if (data.collectionIndexSha256 !== orangeDocumentDigest([{ url: document.url, sha256: document.sha256, status: 200 }])) return reject();
	return { sourceAsOfDate: data.sourceAsOfDate, sourceAsOf: data.sourceAsOf };
}
