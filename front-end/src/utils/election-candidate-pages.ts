import type { StateRecordsResponse } from "~/types/civic";

export async function loadElectionCandidatePages(request: (offset: number) => Promise<StateRecordsResponse>, includeSupplements: boolean, offset = 0) {
	const first = await request(offset);
	if (!includeSupplements || offset || !first.available || first.matched <= first.limit || first.matched > 1000) return first;
	const records = [...first.records];
	const fingerprint = JSON.stringify([first.source, first.supplementalSources, first.matched, first.total, first.inactive, first.limit]);
	while (records.length < first.matched) {
		const page = await request(records.length);
		if (!page.available || page.offset !== records.length || !page.records.length || fingerprint !== JSON.stringify([page.source, page.supplementalSources, page.matched, page.total, page.inactive, page.limit])) throw new Error("Candidate records changed while loading. Please retry.");
		records.push(...page.records);
	}
	if (records.length !== first.matched || new Set(records.map(record => record.id)).size !== records.length) throw new Error("The candidate pages are inconsistent. Please retry.");
	return { ...first, records, offset: 0, limit: records.length };
}
