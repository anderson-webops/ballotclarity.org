import type { StateBallotSnapshot } from "./state-ballot-repository.js";

export function serializeStateBallotSnapshots(snapshots: readonly StateBallotSnapshot[]) {
	if (!snapshots.length || new Set(snapshots.map(snapshot => snapshot.source.stateCode)).size !== snapshots.length)
		throw new Error("A candidate export requires distinct, available state snapshots.");
	const manifest = {
		type: "manifest",
		schemaVersion: 1,
		purpose: "official-candidate-records-not-a-personal-ballot",
		states: snapshots.map(snapshot => ({
			stateCode: snapshot.source.stateCode,
			electionDate: snapshot.source.electionDate,
			sourceId: snapshot.source.id,
			sourceUrl: snapshot.source.pageUrl,
			documentUrls: snapshot.source.documentUrls,
			retrievalPolicy: snapshot.source.retrievalPolicy ?? "automatic",
			retrievedAt: snapshot.retrievedAt,
			sourceSha256: snapshot.sha256,
			recordCount: snapshot.records.length,
		})),
	};
	const lines = [JSON.stringify(manifest)];
	for (const snapshot of snapshots) {
		for (const record of snapshot.records) {
			lines.push(JSON.stringify({
				type: "candidate",
				stateCode: snapshot.source.stateCode,
				electionDate: snapshot.source.electionDate,
				id: record.id,
				name: record.name,
				party: record.party,
				office: record.office,
				district: record.district,
				jurisdiction: record.jurisdiction,
				scope: record.scope,
				status: record.status,
				sourceStatus: record.sourceStatus,
				candidateUrl: record.candidateUrl,
			}));
		}
	}
	return `${lines.join("\n")}\n`;
}
