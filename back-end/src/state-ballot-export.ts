import type { StateBallotSnapshot } from "./state-ballot-repository.js";

export function serializeStateBallotSnapshots(snapshots: readonly StateBallotSnapshot[]) {
	if (!snapshots.length || new Set(snapshots.map(snapshot => snapshot.source.id)).size !== snapshots.length)
		throw new Error("A candidate export requires distinct, available source snapshots.");
	const multipleSourcesPerState = new Set(snapshots.map(snapshot => snapshot.source.stateCode)).size !== snapshots.length;
	const manifest = {
		type: "manifest",
		schemaVersion: multipleSourcesPerState ? 2 : 1,
		purpose: "official-candidate-records-not-a-personal-ballot",
		[multipleSourcesPerState ? "sources" : "states"]: snapshots.map(snapshot => ({
			stateCode: snapshot.source.stateCode,
			electionDate: snapshot.source.electionDate,
			sourceId: snapshot.source.id,
			sourceUrl: snapshot.source.pageUrl,
			documentUrls: snapshot.source.documentUrls,
			retrievalPolicy: snapshot.source.retrievalPolicy ?? "automatic",
			scopeNotice: snapshot.source.scopeNotice,
			retrievedAt: snapshot.retrievedAt,
			sourceSha256: snapshot.sha256,
			recordCount: snapshot.records.length,
			documents: snapshot.documents,
		})),
	};
	const lines = [JSON.stringify(manifest)];
	for (const snapshot of snapshots) {
		for (const record of snapshot.records) {
			lines.push(JSON.stringify({
				type: "candidate",
				stateCode: snapshot.source.stateCode,
				electionDate: snapshot.source.electionDate,
				...(multipleSourcesPerState ? { sourceId: snapshot.source.id } : {}),
				id: record.id,
				name: record.name,
				party: record.party,
				office: record.office,
				district: record.district,
				jurisdiction: record.jurisdiction,
				scope: record.scope,
				status: record.status,
				sourceStatus: record.sourceStatus,
				ballotDesignation: record.ballotDesignation,
				candidateUrl: record.candidateUrl,
				sourceCandidateId: record.sourceCandidateId,
				sourceDistrictLabel: record.sourceDistrictLabel,
				sourceDivision: record.sourceDivision,
				sourceAreaLabel: record.sourceAreaLabel,
				incumbent: record.incumbent,
				termYears: record.termYears,
				termEnd: record.termEnd,
				seats: record.seats,
			}));
		}
	}
	return `${lines.join("\n")}\n`;
}
