import assert from "node:assert/strict";
import test from "node:test";
import { buildEmptyCoverageSnapshot, buildSeedCoverageSnapshot, createCoverageRepository } from "../src/coverage-repository.js";
import { buildGuidePackageId, buildGuidePackageList } from "../src/guide-packages.js";

test("publication options come from loaded elections with a real jurisdiction, not summaries or guessed identifiers", async () => {
	const data = buildSeedCoverageSnapshot();
	const repository = {
		...await createCoverageRepository(),
		data,
		getElectionBySlug: (slug: string) => data.election?.slug === slug ? data.election : null,
		getJurisdictionBySlug: (slug: string) => data.jurisdiction?.slug === slug ? data.jurisdiction : null,
		getCandidateBySlug: (slug: string) => data.candidates.find(item => item.slug === slug) ?? null,
		getCandidatesBySlugs: (slugs: string[]) => data.candidates.filter(item => slugs.includes(item.slug)),
		getMeasureBySlug: (slug: string) => data.measures.find(item => item.slug === slug) ?? null,
		getSourceById: (id: string) => data.sources.find(item => item.id === id) ?? null,
	};
	const list = buildGuidePackageList([], repository, []);
	assert.deepEqual(list.reviewOptions, [{ electionSlug: data.election!.slug, name: data.election!.name, jurisdictionName: data.jurisdiction!.name }]);
	const workflow = {
		id: buildGuidePackageId(data.election!.slug),
		electionSlug: data.election!.slug,
		jurisdictionSlug: data.jurisdiction!.slug,
		status: "draft" as const,
		createdAt: data.updatedAt,
		draftedAt: data.updatedAt,
		updatedAt: data.updatedAt,
		coverageLimits: [],
		coverageNotes: [],
	};
	const existing = buildGuidePackageList([workflow], repository, []);
	assert.deepEqual(existing.reviewOptions, []);
	for (const warning of existing.packages[0]!.diagnostics.warnings) {
		const check = existing.packages[0]!.diagnostics.checklist.find(item => warning.id === `checklist:${item.id}:${item.status}`)!;
		assert.equal(warning.summary, check.reviewerSignal || check.detail);
		assert.notEqual(warning.summary, check.warningStandard);
	}
	assert.deepEqual(buildGuidePackageList([], { ...repository, getJurisdictionBySlug: () => null }, []).reviewOptions, []);
	assert.deepEqual(buildGuidePackageList([], { ...repository, data: buildEmptyCoverageSnapshot() }, []).reviewOptions, []);
});
