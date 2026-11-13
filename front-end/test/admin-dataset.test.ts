import type { AdminOperationDataset } from "../src/types/civic";
import assert from "node:assert/strict";
import test from "node:test";
import { adminDatasetCount, adminDatasetStatus } from "../src/utils/admin-dataset";

const dataset: AdminOperationDataset = { id: "ga-fulton-election-calendar", label: "Fulton election calendar", stateCode: "GA", electionDate: "", kind: "calendars", mode: "automatic", status: "review", records: 25, retrievedAt: "2026-11-13T18:36:14.792Z", lastAttemptAt: null, lastImportAt: null, failure: null };

test("calendar summaries describe events and review rather than approved imports", () => {
	assert.equal(adminDatasetCount(dataset), "25 events");
	assert.equal(adminDatasetStatus(dataset), "Review required");
	assert.equal(adminDatasetCount({ ...dataset, records: null }), "Not collected");
	assert.equal(adminDatasetStatus({ ...dataset, status: "pending" }), "Collecting");
	assert.equal(adminDatasetStatus({ ...dataset, status: "missing" }), "Not collected");
});

test("candidate and reference summaries retain their record and import semantics", () => {
	for (const kind of ["candidates", "references", "officeholders"] as const) {
		const item = { ...dataset, kind, status: "current" as const };
		assert.equal(adminDatasetCount(item), "25 records");
		assert.equal(adminDatasetCount({ ...item, records: null }), "Not imported");
		assert.equal(adminDatasetStatus(item), "Available");
		assert.equal(adminDatasetStatus({ ...item, status: "pending" }), "Awaiting records");
	}
});
