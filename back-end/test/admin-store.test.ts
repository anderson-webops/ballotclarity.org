import assert from "node:assert/strict";
import test from "node:test";
import { defaultContentSeed } from "../src/admin-store.js";

test("default content seed keeps staged candidate and measure records unpublished", () => {
	const contentSeed = defaultContentSeed();
	const stagedRecords = contentSeed.filter(item => item.entityType === "candidate" || item.entityType === "measure");

	assert.ok(stagedRecords.length > 0);

	for (const item of stagedRecords) {
		assert.equal(item.published, false);
		assert.equal(item.publishedAt, undefined);
		assert.equal(item.publishApprovedAt, undefined);
		assert.equal(item.publishApprovedBy, undefined);
		assert.equal(item.publishApprovalNote, undefined);
		assert.notEqual(item.status, "published");
		assert.match(item.sourceCoverage, /not approved for public/i);
	}
});

test("default content seed scopes the published election shell approval to official logistics", () => {
	const electionRecord = defaultContentSeed().find(item => item.entityType === "election");

	assert.ok(electionRecord);
	assert.equal(electionRecord.published, true);
	assert.equal(electionRecord.publishApprovedBy, "Editorial review");
	assert.match(electionRecord.publishApprovalNote ?? "", /official-logistics guide shell/i);
	assert.match(electionRecord.publishApprovalNote ?? "", /contest, candidate, and measure content remains unpublished/i);
});
