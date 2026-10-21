import type { NationwideLookupResultContext } from "../src/types/civic";
import assert from "node:assert/strict";
import test from "node:test";
import { needsBallotPreviewRefresh, restoreMatchingBallotPreviews } from "../src/utils/ballot-preview-refresh";
import { sanitizeNationwideLookupResultForStorage } from "../src/utils/civic-storage-privacy";

test("ballot previews refresh after private storage strips them, only for the same lookup", () => {
	const fresh = {
		result: "resolved",
		inputKind: "zip",
		lookupQuery: "27601",
		location: { state: "North Carolina", slug: "raleigh-nc" },
		districtMatches: [{ districtType: "congressional", districtCode: "2" }],
		actions: [],
		availability: { ballotCandidates: { status: "limited" } },
		ballotContentPreviews: [{ id: "official-records" }],
	} as unknown as NationwideLookupResultContext;
	const stored = sanitizeNationwideLookupResultForStorage(fresh)!;
	assert.deepEqual(stored.ballotContentPreviews, []);
	assert.equal(needsBallotPreviewRefresh(stored), true);
	assert.equal(needsBallotPreviewRefresh(fresh), false);
	assert.deepEqual(restoreMatchingBallotPreviews(stored, fresh)?.ballotContentPreviews, fresh.ballotContentPreviews);
	assert.equal(restoreMatchingBallotPreviews(stored, null), stored);
	for (const changed of [
		{ lookupQuery: "27602" },
		{ inputKind: "address" },
		{ selectionId: "other-area" },
		{ location: { state: "Virginia", slug: "raleigh-nc" } },
		{ districtMatches: [{ districtType: "congressional", districtCode: "3" }] },
	]) {
		assert.equal(restoreMatchingBallotPreviews(stored, { ...fresh, ...changed } as NationwideLookupResultContext), stored);
	}
});
