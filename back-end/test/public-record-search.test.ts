import type { StateBallotRepository, StateBallotSnapshot } from "../src/state-ballot-repository.js";
import type { SearchResultGroup } from "../src/types/civic.js";
import assert from "node:assert/strict";
import test from "node:test";
import { electionReferenceSources } from "../src/election-reference-sources.js";
import { electionReferenceDocumentDigest } from "../src/election-references.js";
import { mergeSearchGroups, searchRetainedRecords } from "../src/public-record-search.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";

const source = stateBallotSources.find(item => item.id === "ga-fulton-2026")!;
const snapshot: StateBallotSnapshot = { source, sha256: "a".repeat(64), retrievedAt: "2026-10-21T22:12:00Z", records: [
	{ id: "retained-person", name: "Shawn Still", office: "State Senate", scope: "state-senate", district: "48", status: "listed", party: "Republican" },
	{ id: "inactive-person", name: "Shawn Other", office: "State Senate", scope: "state-senate", district: "48", status: "withdrawn" }
] };

test("search discovers retained candidate records without collecting publisher data", async () => {
	let reads = 0;
	const candidates: StateBallotRepository = {
		getSnapshot: async () => { throw new Error("Publisher acquisition is forbidden"); },
		getStoredSnapshots: async (state) => {
			reads++;
			return state === "GA" ? [snapshot] : [];
		}
	};
	const result = await searchRetainedRecords({ query: " Ｓｈａｗｎ ", candidates, references: null, stateCode: "GA" });
	assert.equal(reads, 1);
	assert.equal(result.incomplete, false);
	assert.equal(result.items.length, 1);
	assert.equal(result.items[0]?.title, "Shawn Still");
	assert.equal(new URL(result.items[0]!.href, "https://example.test").searchParams.get("source"), source.id);
	assert.equal(snapshot.records[0]?.name, "Shawn Still");
	assert.equal((await searchRetainedRecords({ query: "Shawn", candidates, references: null, stateCode: "AL" })).items.length, 0);
});

test("search reports retained storage failures and limits large results", async () => {
	const failed = await searchRetainedRecords({ query: "Shawn", candidates: {
		getSnapshot: async () => null,
		getStoredSnapshots: async () => { throw new Error("Unavailable"); }
	}, references: null, stateCode: "GA" });
	assert.equal(failed.incomplete, true);
	assert.equal(failed.items.length, 0);
	const many = { ...snapshot, records: Array.from({ length: 200 }, (_, index) => ({ ...snapshot.records[0]!, id: String(index) })) };
	const candidates: StateBallotRepository = { getSnapshot: async () => null, getStoredSnapshots: async () => [many] };
	assert.equal((await searchRetainedRecords({ query: "Shawn", candidates, references: null, stateCode: "GA" })).items.length, 100);
	assert.equal((await searchRetainedRecords({ query: "S", candidates, references: null })).items.length, 0);
});

test("search merges published and retained results by destination without empty groups", () => {
	const candidate = { id: "one", type: "candidate" as const, title: "Person", href: "/record/GA/one", meta: "Office", summary: "", updatedAt: "2026-10-21" };
	const original: SearchResultGroup[] = [{ type: "candidate", label: "Candidates", items: [candidate] }];
	const groups = mergeSearchGroups(original, [{ ...original[0]!, items: [candidate] }, { type: "representative", label: "Representatives", items: [] }]);
	assert.equal(groups.length, 1);
	assert.equal(groups[0]?.items.length, 1);
	assert.equal(original[0]?.items.length, 1);
});

test("a verified candidate profile bridge replaces duplicate representative results, not unrelated names", () => {
	const candidate = { id: "candidate", type: "candidate" as const, title: "Example", href: "/record/GA/one", personProfileSlug: "example", meta: "Office", summary: "", updatedAt: "2026-10-21" };
	const representative = { ...candidate, id: "example", type: "representative" as const, href: "/representatives/example", personProfileSlug: undefined };
	const groups = [{ type: "candidate" as const, label: "Candidates", items: [candidate] }, { type: "representative" as const, label: "Representatives", items: [representative] }];
	assert.deepEqual(mergeSearchGroups([], groups).map(group => group.type), ["candidate"]);
	assert.equal(mergeSearchGroups([], [{ ...groups[0]!, items: [{ ...candidate, personProfileSlug: undefined }] }, groups[1]!]).length, 2);
});

test("matched candidate biographies share one result while fact-only and different-seat hits remain reachable", async () => {
	const collection = electionReferenceSources.find(source => source.id === "openstates-ga-service-2026")!;
	const documents = collection.documents.map(document => ({ url: document.url, sha256: "b".repeat(64), capturedAt: "2026-10-21T22:12:00.000Z", includedRecordCount: 1 }));
	const reference = { schemaVersion: 1 as const, type: "election-references" as const, stateCode: "GA", sourceId: collection.id, electionDate: collection.electionDate, retrievedAt: "2026-10-21T22:12:00.000Z", sourceSha256: electionReferenceDocumentDigest(documents), recordCount: 1, documents, records: [{ id: "a".repeat(24), name: "Shawn Still", office: "State Senate", jurisdiction: "State Senate District 48", scope: "state-senate" as const, facts: ["Occupation: teacher."], sourceDocumentIndex: 0 }] };
	const candidates: StateBallotRepository = { getSnapshot: async () => null, getStoredSnapshots: async () => [snapshot] };
	const references = { getSnapshot: async () => reference, getSnapshots: async () => [reference] };
	const selected = await searchRetainedRecords({ query: "Shawn", stateCode: "GA", candidates, references });
	assert.equal(selected.incomplete, false);
	assert.equal(selected.items.length, 1);
	assert.doesNotMatch(selected.items[0]!.href, /kind=reference/u);
	const fact = await searchRetainedRecords({ query: "teacher", stateCode: "GA", candidates, references });
	assert.equal(fact.items.length, 1);
	assert.match(fact.items[0]!.href, /kind=reference/u);
	reference.records[0]!.jurisdiction = "State Senate District 49";
	assert.equal((await searchRetainedRecords({ query: "Shawn", stateCode: "GA", candidates, references })).items.length, 2);
});
