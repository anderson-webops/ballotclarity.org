import type { ElectionReferenceSnapshot } from "./election-references.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import type { PublicElectionReference, StateRecordScope } from "./types/civic.js";
import { electionReferenceSources } from "./election-reference-sources.js";
import { buildElectionReferencePages, parseElectionReferenceSnapshot } from "./election-references.js";

const normalized = (value: string) => value.normalize("NFC").toLowerCase().replace(/[‘’]/gu, "'").replace(/[“”]/gu, "\"").replace(/\s+/gu, " ").trim();
const name = (value: string) => normalized(value);

function office(value: string) {
	const label = normalized(value).replaceAll(".", "");
	if (/^(?:united states|us|u s) senat(?:e|or)$/u.test(label)) return "us-senate";
	return label;
}

function district(value: string) {
	return /^\d{1,3}$/u.test(value.trim()) ? String(Number(value.trim())) : null;
}

function referenceDistrict(record: Pick<PublicElectionReference, "office" | "jurisdiction">) {
	const values = [...`${record.office} ${record.jurisdiction ?? ""}`.matchAll(/\bdistrict\s+0*(\d{1,3})\b/giu)].map(match => String(Number(match[1])));
	return values.length && new Set(values).size === 1 ? values[0]! : null;
}

function compatibleScope(scope: StateRecordScope) {
	return ["statewide", "congressional", "state-senate", "state-house", "local"].includes(scope);
}

function sameOffice(record: StateCandidateRecord, reference: Pick<PublicElectionReference, "scope" | "office" | "jurisdiction">) {
	if (record.scope !== reference.scope || !compatibleScope(record.scope)) return false;
	if (record.scope === "statewide") return office(record.office) === office(reference.office);
	if (record.scope === "local") return Boolean(record.jurisdiction && reference.jurisdiction && normalized(record.jurisdiction) === normalized(reference.jurisdiction) && office(record.office) === office(reference.office) && (record.district ? district(record.district) !== null && district(record.district) === referenceDistrict(reference) : referenceDistrict(reference) === null));
	const seat = district(record.district);
	const explicit = referenceDistrict({ office: record.office });
	return seat !== null && (!/\bdistrict\s+\d/iu.test(record.office) || explicit === seat) && seat === referenceDistrict(reference);
}

export function matchingCandidateReferences(snapshot: StateBallotSnapshot, candidate: StateCandidateRecord, snapshots: readonly ElectionReferenceSnapshot[]) {
	if (!compatibleScope(candidate.scope) || !snapshot.records.some(record => record.id === candidate.id)) return [];
	const possibleIdentities = snapshot.records.filter(record => name(record.name) === name(candidate.name) && record.scope === candidate.scope && (record.scope === "statewide" ? office(record.office) === office(candidate.office) : record.scope === "local" ? record.jurisdiction && candidate.jurisdiction && normalized(record.jurisdiction) === normalized(candidate.jurisdiction) && office(record.office) === office(candidate.office) : district(record.district) !== null && district(record.district) === district(candidate.district)));
	if (possibleIdentities.length !== 1) return [];
	const collections = snapshots.filter(reference => reference.electionDate === snapshot.source.electionDate).map((reference) => {
		const source = electionReferenceSources.find(source => source.id === reference.sourceId && source.stateCode === snapshot.source.stateCode && source.electionDate === snapshot.source.electionDate);
		if (!source || reference.stateCode !== snapshot.source.stateCode) throw new Error("Candidate background belongs to a different configured state or election.");
		parseElectionReferenceSnapshot(source, JSON.stringify(reference));
		return { source, snapshot: reference };
	});
	if (!collections.length) return [];
	const matches = collections.flatMap(({ source, snapshot: reference }) => {
		const selected = reference.records.filter(record => name(record.name) === name(candidate.name) && sameOffice(candidate, record));
		if (selected.length > 1) return [];
		return selected.map(record => buildElectionReferencePages([{ source, snapshot: reference }], { search: "", scope: "all", offset: reference.records.indexOf(record), limit: 1 }).records[0]!);
	});
	return matches;
}
