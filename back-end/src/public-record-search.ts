import type { ElectionReferenceRepository } from "./election-references.js";
import type { RecordPortraitResolver } from "./record-portraits.js";
import type { StateBallotRepository } from "./state-ballot-repository.js";
import type { SearchResultGroup, SearchResultItem } from "./types/civic.js";
import { buildStateRecordPage } from "./state-records.js";
import { usStates } from "./us-states.js";

export async function searchRetainedRecords(options: {
	query: string;
	stateCode?: string;
	candidates: StateBallotRepository | null;
	references: ElectionReferenceRepository | null;
	portraits?: RecordPortraitResolver;
}) {
	const query = options.query.normalize("NFKC").trim().toLowerCase();
	const items: SearchResultItem[] = [];
	let incomplete = false;
	if (query.length < 2) return { items, incomplete };
	const states = usStates.filter(([stateCode]) => !options.stateCode || stateCode === options.stateCode);
	for (let offset = 0; offset < states.length && items.length < 100; offset += 4) {
		await Promise.all(states.slice(offset, offset + 4).map(async ([stateCode, stateName]) => {
			try {
				for (const snapshot of await options.candidates?.getStoredSnapshots?.(stateCode) ?? []) {
					const page = buildStateRecordPage(snapshot, { search: query, scope: "all", status: "active", limit: 100, offset: 0 });
					const records = options.portraits ? await options.portraits(stateCode, page.records) : page.records;
					for (const record of records) {
						if (items.length >= 100) break;
						const parameters = new URLSearchParams({ source: snapshot.source.id, name: record.name });
						items.push({ id: `${snapshot.source.id}:${record.id}`, type: "candidate", title: record.name, href: `/record/${stateCode}/${record.id}?${parameters}`, meta: [record.office, stateName, record.incumbent ? "Incumbent" : ""].filter(Boolean).join(" · "), party: record.party, personProfileSlug: record.personProfileSlug, summary: "", updatedAt: snapshot.retrievedAt, profileImages: record.profileImages });
					}
				}
			}
			catch { incomplete = true; }
			try {
				const snapshots = options.references?.getSnapshots ? await options.references.getSnapshots(stateCode) : options.references ? [await options.references.getSnapshot(stateCode)].filter(snapshot => snapshot !== null) : [];
				for (const snapshot of snapshots) {
					for (const record of snapshot.records) {
						if (items.length >= 100) break;
						if (![record.name, record.office, ...record.facts].join(" ").normalize("NFKC").toLowerCase().includes(query)) continue;
						const parameters = new URLSearchParams({ kind: "reference", source: snapshot.sourceId, name: record.name });
						items.push({ id: `${snapshot.sourceId}:${record.id}`, type: "candidate", title: record.name, href: `/record/${stateCode}/${record.id}?${parameters}`, meta: [record.office, stateName].join(" · "), summary: record.facts[0] ?? "", updatedAt: snapshot.retrievedAt });
					}
				}
			}
			catch { incomplete = true; }
		}));
	}
	return { items: items.sort((left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id)), incomplete };
}

export function mergeSearchGroups(groups: SearchResultGroup[], additions: SearchResultGroup[]) {
	const linkedPeople = new Set([...groups, ...additions].flatMap(group => group.items.flatMap(item => item.type === "candidate" && item.personProfileSlug ? [item.personProfileSlug] : [])));
	const merged = new Map(groups.map(group => [group.type, { ...group, items: [...group.items] }]));
	for (const group of additions) {
		const existing = merged.get(group.type);
		if (!existing) merged.set(group.type, group);
		else existing.items = [...new Map([...existing.items, ...group.items].map(item => [item.href, item])).values()].slice(0, 100);
	}
	return [...merged.values()].map(group => ({ ...group, items: group.items.filter(item => item.type !== "representative" || !linkedPeople.has(item.id)) })).filter(group => group.items.length);
}
