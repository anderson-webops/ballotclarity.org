import type { PublicElectionReference } from "~/types/civic";

export function referenceJurisdiction(record: Pick<PublicElectionReference, "office" | "jurisdiction">) {
	if (!record.jurisdiction) return undefined;
	const normalize = (value: string) => value.normalize("NFC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
	const office = normalize(record.office).replace(/(?:\s*\([^()]*\))+$/u, "").trim();
	const jurisdiction = normalize(record.jurisdiction);
	const preceding = office.at(office.length - jurisdiction.length - 1);
	return office.endsWith(jurisdiction) && (office === jurisdiction || !preceding || !/[\p{L}\p{N}]/u.test(preceding)) ? undefined : record.jurisdiction;
}
