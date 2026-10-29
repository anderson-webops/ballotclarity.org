import type { PublicStateCandidateRecord } from "~/types/civic";

export interface ElectionSectionLink {
	href: string;
	label: string;
	title?: string;
	children?: ElectionSectionLink[];
}

export function electionOfficeLabel(title: string) {
	const compact = title
		.replace(/\bUnited States\b/giu, "U.S.")
		.replace(/\bHouse of Representatives\b/giu, "House")
		.replace(/\bPublic Service Commissioner\b/giu, "Public Service")
		.replace(/\bCounty Commissioner\b/giu, "Commission")
		.replace(/\bLieutenant\b/giu, "Lt.")
		.replace(/\bChairperson\b/giu, "Chair")
		.replace(/^.*\bSoil\s+(?:&|and)\s+Water\b.*$/iu, "Soil & Water")
		.replace(/\bPresident and Vice President\b/giu, "President & VP")
		.replace(/\bDistrict\s+/giu, "")
		.replace(/\(\s*Unexpired(?:\s+Term)?\s*\)/giu, "Unexpired")
		.replace(/[(),\u2013\u2014]/gu, " ")
		.replace(/\s+-\s+/gu, " ")
		.replace(/\s+/gu, " ")
		.trim();
	const words = compact.split(" ");
	if (words.length <= 3) return compact;
	const seat = words.findLast(word => /^#?\d+[a-z-]*$/iu.test(word));
	if (seat && /\bUnexpired\b/iu.test(compact)) return `${words[0]} ${seat} Unexpired`;
	return `${words.slice(0, 2).join(" ")} ${seat ?? words.at(-1)}`;
}

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
		return { ...level, offices: [...offices.values()].map(office => ({ ...office, anchorId: `candidate-office-${office.candidates[0]!.id}` })) };
	}).filter(level => level.offices.length);
}
