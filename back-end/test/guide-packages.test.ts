import assert from "node:assert/strict";
import test from "node:test";
import { defaultContentSeed } from "../src/admin-store.js";
import { buildSeedCoverageSnapshot } from "../src/coverage-repository.js";
import { buildGuidePackageId, buildGuidePackageRecord } from "../src/guide-packages.js";

const coverageSnapshot = buildSeedCoverageSnapshot();
const contentSeed = defaultContentSeed();

const coverageRepository = {
	data: coverageSnapshot,
	getCandidateBySlug(slug: string) {
		return coverageSnapshot.candidates.find(candidate => candidate.slug === slug) ?? null;
	},
	getCandidatesBySlugs(slugs: string[]) {
		const requested = new Set(slugs);
		return coverageSnapshot.candidates.filter(candidate => requested.has(candidate.slug));
	},
	getElectionBySlug(slug: string) {
		return coverageSnapshot.election?.slug === slug ? coverageSnapshot.election : null;
	},
	getJurisdictionBySlug(slug: string) {
		return coverageSnapshot.jurisdiction?.slug === slug ? coverageSnapshot.jurisdiction : null;
	},
	getMeasureBySlug(slug: string) {
		return coverageSnapshot.measures.find(measure => measure.slug === slug) ?? null;
	},
	getSourceById(id: string) {
		return coverageSnapshot.sources.find(source => source.id === id) ?? null;
	},
	mode: "snapshot" as const,
	snapshotPath: ":memory:",
};

test("buildGuidePackageRecord generates the grouped reviewer rubric for draft packages", () => {
	const workflow = {
		coverageLimits: [
			"Precinct-specific ballot variation still belongs to official election tools.",
		],
		coverageNotes: [
			"Draft package assembled from the imported coverage snapshot.",
		],
		createdAt: coverageSnapshot.updatedAt,
		draftedAt: coverageSnapshot.updatedAt,
		electionSlug: coverageSnapshot.election!.slug,
		id: buildGuidePackageId(coverageSnapshot.election!.slug),
		jurisdictionSlug: coverageSnapshot.jurisdiction!.slug,
		status: "draft" as const,
		updatedAt: coverageSnapshot.updatedAt,
	};

	const record = buildGuidePackageRecord(workflow, coverageRepository, contentSeed);

	assert.equal(record.diagnostics.checklistCategories.length, 9);
	assert.equal(record.diagnostics.blockingIssueCount, 0);
	assert.ok(record.diagnostics.warningCount > 0);
	assert.equal(record.diagnostics.recommendation.system, "publish_with_warnings");
	assert.equal(record.diagnostics.recommendation.final, "publish_with_warnings");
	assert.equal(record.diagnostics.readyToPublish, false);
	assert.match(record.diagnostics.recommendation.reason, /reviewer/i);

	const scopeCategory = record.diagnostics.checklistCategories.find(group => group.id === "election_identity_scope");
	assert.ok(scopeCategory);
	assert.ok(scopeCategory.items.some(item => item.label === "Package is attached to the correct locality and election"));
});

test("buildGuidePackageRecord detects blocker failures when package identity is wrong", () => {
	const workflow = {
		coverageLimits: [],
		coverageNotes: [],
		createdAt: coverageSnapshot.updatedAt,
		draftedAt: coverageSnapshot.updatedAt,
		electionSlug: coverageSnapshot.election!.slug,
		id: buildGuidePackageId(coverageSnapshot.election!.slug),
		jurisdictionSlug: "wrong-jurisdiction",
		status: "draft" as const,
		updatedAt: coverageSnapshot.updatedAt,
	};

	const record = buildGuidePackageRecord(workflow, coverageRepository, contentSeed);

	assert.ok(record.diagnostics.blockingIssueCount > 0);
	assert.equal(record.diagnostics.recommendation.system, "needs_revision");
	assert.equal(record.diagnostics.recommendation.final, "needs_revision");
	assert.ok(record.diagnostics.blockers.some(issue => issue.title === "Election identity is present"));
});

test("buildGuidePackageRecord becomes publish-ready after explicit reviewer recommendation", () => {
	const workflow = {
		coverageLimits: [
			"Guide pages remain explanatory and should not be treated as the official ballot service.",
		],
		coverageNotes: [
			"Editorial review confirmed the contest and measure package for publication.",
		],
		createdAt: coverageSnapshot.updatedAt,
		draftedAt: coverageSnapshot.updatedAt,
		electionSlug: coverageSnapshot.election!.slug,
		id: buildGuidePackageId(coverageSnapshot.election!.slug),
		jurisdictionSlug: coverageSnapshot.jurisdiction!.slug,
		reviewNotes: "Reviewed for contest completeness, neutrality, and official-link integrity.",
		reviewRecommendation: "publish" as const,
		reviewedAt: coverageSnapshot.updatedAt,
		reviewer: "QA Reviewer",
		status: "ready_to_publish" as const,
		updatedAt: coverageSnapshot.updatedAt,
	};

	const record = buildGuidePackageRecord(workflow, coverageRepository, contentSeed);

	assert.equal(record.diagnostics.recommendation.system, "publish");
	assert.equal(record.diagnostics.recommendation.reviewer, "publish");
	assert.equal(record.diagnostics.recommendation.final, "publish");
	assert.equal(record.diagnostics.readyToPublish, true);
	assert.equal(record.diagnostics.blockingIssueCount, 0);
});
