import type { PublicStateCandidateRecord } from "~/types/civic";

export function groupElectionCandidates(records: PublicStateCandidateRecord[]) {
	const levels = [{ id: "federal", label: "Federal" }, { id: "state", label: "State" }, { id: "local", label: "Local" }];
	return levels.map((level) => {
		const offices = new Map<string, { id: string; title: string; candidates: PublicStateCandidateRecord[] }>();
		for (const record of records) {
			const recordLevel = record.scope === "congressional" || /^(?:United States|U\.S\.|President|Congress)/iu.test(record.office) ? "federal" : record.scope === "local" ? "local" : "state";
			if (recordLevel !== level.id) continue;
			const id = JSON.stringify([record.office, record.district, record.jurisdiction]);
			const office = offices.get(id) ?? { id, title: record.office + (record.district && !record.office.toLowerCase().includes(record.district.toLowerCase()) ? `, District ${record.district}` : ""), candidates: [] };
			office.candidates.push(record);
			offices.set(id, office);
		}
		return { ...level, offices: [...offices.values()] };
	}).filter(level => level.offices.length);
}
