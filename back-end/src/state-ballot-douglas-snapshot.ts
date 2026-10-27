import type { DouglasFiling } from "./state-ballot-douglas.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { douglasDocumentDigest, validateDouglasElection, validateDouglasSource } from "./state-ballot-douglas-collection.js";
import { douglasDiscoveryUrl, douglasRecord, validateDouglasProfileUrl } from "./state-ballot-douglas.js";

export function validateDouglasStoredSnapshot(source: StateBallotSource, data: Record<string, unknown>) {
	validateDouglasSource(source);
	if (!Array.isArray(data.documents) || !data.documents.length || data.documents.length > 401 || !Array.isArray(data.records) || !data.records.length || data.records.length > 500) throw new Error("The stored Douglas County filing inventory requires review.");
	const documents = data.documents;
	const publications = documents.map(item => ({ url: item?.url, sha256: item?.sha256 }));
	validateDouglasElection({ electionId: null, electionDate: source.electionDate, pageUrl: douglasDiscoveryUrl, douglasDocuments: publications });
	if (data.collectionIndexSha256 !== douglasDocumentDigest(publications)) throw new Error("The stored Douglas County publication fingerprint requires review.");
	const ordinary: string[] = [];
	let writeIns = 0;
	for (const input of data.records) {
		if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("The stored Douglas County filing fields require review.");
		const row = input as Record<string, unknown>;
		if (typeof row.name !== "string" || !/^[\p{L}\p{M} .,'’"()-]{1,200}$/u.test(row.name) || typeof row.office !== "string" || typeof row.sourceStatus !== "string" || typeof row.candidateUrl !== "string" || (row.party !== undefined && (typeof row.party !== "string" || row.party.length > 120 || !/^[\p{L}\p{N} .,'’()/-]+$/u.test(row.party)))) throw new Error("The stored Douglas County filing text requires review.");
		const isWriteIn = row.status === "write-in";
		const status = /^(Filed|Write-in filed) (20\d{2}-\d{2}-\d{2})$/u.exec(row.sourceStatus);
		if ((!isWriteIn && row.status !== "filed") || !status || (status[1] === "Write-in filed") !== isWriteIn || status[2]!.slice(0, 4) !== source.electionDate.slice(0, 4) || !Number.isFinite(Date.parse(status[2]!)) || new Date(status[2]!).toISOString().slice(0, 10) !== status[2] || status[2]! > source.electionDate) throw new Error("The stored Douglas County filing date or status requires review.");
		let officeId = "";
		if (isWriteIn) {
			if (row.candidateUrl !== `${douglasDiscoveryUrl}#WriteIns` || row.sourceCandidateId !== undefined || row.party !== undefined) throw new Error("The stored Douglas County write-in evidence requires review.");
			writeIns++;
		}
		else {
			const identity = validateDouglasProfileUrl(row.candidateUrl, source.electionDate.slice(0, 4));
			if (row.sourceCandidateId !== identity.candidateId) throw new Error("The stored Douglas County profile identity requires review.");
			officeId = identity.officeId;
			ordinary.push(row.candidateUrl);
		}
		const filing: DouglasFiling = { name: row.name, office: { id: officeId, title: row.office, category: "Partisan" }, filedDate: status[2]!, ...(isWriteIn ? {} : { candidateId: row.sourceCandidateId as string, profileUrl: row.candidateUrl }), writeIn: isWriteIn };
		const expected = douglasRecord(source, filing, row.party as string | undefined);
		if (Object.keys(row).sort().join(",") !== Object.keys(expected).filter(key => expected[key as keyof typeof expected] !== undefined).sort().join(",") || Object.entries(expected).some(([key, value]) => value !== undefined && row[key] !== value)) throw new Error("The stored Douglas County filing geography or identity requires review.");
	}
	if (documents.length !== ordinary.length + 1 || documents[0].includedRecordCount !== writeIns || ordinary.some((url, index) => documents[index + 1].url !== url || documents[index + 1].includedRecordCount !== 1)) throw new Error("The stored Douglas County profile contributions require review.");
}
