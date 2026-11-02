import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotRepository, StateBallotSnapshot } from "./state-ballot-repository.js";
import type { StateBallotSource } from "./state-ballot-sources.js";

const normalized = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function stateRecordOfficeKey(record: Pick<StateCandidateRecord, "scope" | "office" | "district">) {
	return JSON.stringify([record.scope, record.district, record.scope === "statewide" ? normalized(record.office) : ""]);
}

export function stateRecordSupplementSources(source: StateBallotSource, sources: readonly StateBallotSource[]) {
	return sources.filter(candidate => candidate.id !== source.id && candidate.stateCode === source.stateCode && candidate.electionDate === source.electionDate && candidate.recordRole === "certified-writeins" && candidate.ballotPreview !== false);
}

export async function readStateRecordSupplements(snapshot: StateBallotSnapshot, repository: StateBallotRepository) {
	const sources = stateRecordSupplementSources(snapshot.source, repository.sources ?? []);
	if (!sources.length) return { snapshots: [], unavailable: false };
	if (sources.length > 8 || !repository.getStoredSnapshots) return { snapshots: [], unavailable: true };
	try {
		const retained = await repository.getStoredSnapshots(snapshot.source.stateCode, sources.map(source => source.id));
		if (retained.some(item => !sources.some(source => source.id === item.source.id && source.electionDate === item.source.electionDate && source.stateCode === item.source.stateCode && source.pageUrl === item.source.pageUrl && item.source.recordRole === "certified-writeins"))) throw new Error("A certified supplement belongs to another source or election.");
		return { snapshots: retained, unavailable: retained.length !== sources.length };
	}
	catch { return { snapshots: [], unavailable: true }; }
}

export function applicableStateRecordSupplements(primary: StateBallotSnapshot, snapshots: StateBallotSnapshot[]) {
	const offices = new Set(primary.records.filter(record => record.scope !== "local").map(stateRecordOfficeKey));
	const identities = new Set(primary.records.map(record => `${stateRecordOfficeKey(record)}:${normalized(record.name)}`));
	return snapshots.map(snapshot => ({
		...snapshot,
		records: snapshot.records.filter((record) => {
			if (snapshot.source.stateCode !== primary.source.stateCode || snapshot.source.electionDate !== primary.source.electionDate || snapshot.source.recordRole !== "certified-writeins" || record.scope === "local" || record.status !== "write-in" || !offices.has(stateRecordOfficeKey(record))) return false;
			const identity = `${stateRecordOfficeKey(record)}:${normalized(record.name)}`;
			if (identities.has(identity)) return false;
			identities.add(identity);
			return true;
		}),
	})).filter(snapshot => snapshot.records.length);
}
