import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildSeedCoverageSnapshot, parseCoverageSnapshot, readCoverageSnapshotMetadata } from "../src/coverage-repository.js";
import { buildFultonOfficialLogisticsOnlySnapshot } from "../src/fulton-reviewed-coverage.js";
import { prepareStateMeasureGuideFiles } from "../src/state-measure-guides.js";

const now = Date.parse("2026-10-23T10:00:00Z");
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

function fixture() {
	const directory = mkdtempSync(join(tmpdir(), "ballot-measure-guide-"));
	const capture = "%PDF-1.7\nIsolated source fixture\n";
	const documentUrl = "https://www.eac.gov/isolated-fixture.pdf";
	const capturedAt = "2026-10-22T12:00:00.000Z";
	const source = { id: "fixture-source", title: "Official fixture", publisher: "Isolated official publisher", authority: "official-government", type: "official record", sourceSystem: "Isolated source", date: "", url: `${documentUrl}#page=1` };
	const measure = structuredClone(buildSeedCoverageSnapshot().measures[0]!);
	for (const field of ["currentPractice", "proposedChanges", "yesHighlights", "noHighlights", "implementationTimeline", "fiscalSummary", "potentialImpacts", "supportArguments", "opposeArguments", "argumentsAndConsiderations", "whatWeKnow", "whatWeDoNotKnow"] as const) measure[field] = [];
	Object.assign(measure, { slug: "nd-fixture-measure", contestSlug: "nd-fixture-contest", title: "Approval threshold", location: "North Dakota", summary: "Change the approval threshold.", plainLanguageExplanation: "", yesMeaning: "Change the threshold.", noMeaning: "Retain the threshold.", updatedAt: capturedAt, sources: [source], freshness: { contentLastVerifiedAt: capturedAt, dataLastUpdatedAt: capturedAt, nextReviewAt: "2026-10-24T12:00:00.000Z", status: "incomplete", statusLabel: "Partial sourced explanation", statusNote: "" } });
	const draft = { schemaVersion: 1, type: "state-measure-draft", stateCode: "ND", electionDate: "2026-11-03", reviewedAt: capturedAt, publicationApproved: false, automaticImportApproved: false, measures: [measure], documents: { analysis: { url: documentUrl, sha256: hash(capture), capturedAt, publicationDate: null, reviewedPages: [1] } }, unresolvedFields: [{ field: "scope", status: "unresolved" }], unmappedQuestions: [{ type: "advisory-question", voteOptions: ["A", "B", "C"] }] };
	const documentPath = join(directory, "capture.pdf");
	const draftPath = join(directory, "draft.json");
	writeFileSync(documentPath, capture);
	const plan = { schemaVersion: 1, type: "state-measure-guide-preparation", baseSnapshot: null as null | { path: string; sha256: string }, inputs: [{ path: draftPath, sha256: "", stateCode: "ND", electionDate: "2026-11-03", summaryAsExplanation: true, documents: [{ key: "analysis", path: documentPath, url: documentUrl, sha256: hash(capture), capturedAt }] }], outputDirectory: join(directory, "prepared"), outputName: "measure-review" };
	const planPath = join(directory, "plan.json");
	function save() {
		const body = `${JSON.stringify(draft)}\n`;
		writeFileSync(draftPath, body);
		plan.inputs[0]!.sha256 = hash(body);
		writeFileSync(planPath, JSON.stringify(plan));
	}
	save();
	return { directory, draft, plan, planPath, draftPath, documentPath, save, read: (name: string) => JSON.parse(readFileSync(join(plan.outputDirectory, `measure-review-${name}.json`), "utf8")), dispose: () => rmSync(directory, { recursive: true, force: true }) };
}

function primaryFixture() {
	const workspace = fixture();
	const base = buildSeedCoverageSnapshot();
	assert.ok(base.election && base.jurisdiction && base.location);
	const jurisdiction = { jurisdictionType: "county", name: base.jurisdiction.name, slug: "ga-primary-fixture" };
	workspace.draft.stateCode = "GA";
	workspace.draft.measures[0]!.location = `${jurisdiction.name}, Georgia`;
	Object.assign(workspace.draft, { jurisdiction });
	Object.assign(workspace.plan.inputs[0]!, { stateCode: "GA", jurisdiction });
	const primaryAugmentation = { electionSlug: base.election.slug, jurisdictionSlug: base.jurisdiction.slug };
	Object.assign(workspace.plan, { primaryAugmentation });
	const basePath = join(workspace.directory, "base.json");
	function saveBase() {
		const body = `${JSON.stringify(base)}\n`;
		writeFileSync(basePath, body);
		workspace.plan.baseSnapshot = { path: basePath, sha256: hash(body) };
		workspace.save();
	}
	saveBase();
	return { ...workspace, base, basePath, primaryAugmentation, jurisdiction, saveBase };
}

test("explicit primary augmentation adds only reviewed measure content and preserves existing identities and clocks", async () => {
	const workspace = primaryFixture();
	try {
		const before = readFileSync(workspace.basePath, "utf8");
		const pinned = JSON.parse(before);
		const result = await prepareStateMeasureGuideFiles(workspace.planPath, now);
		assert.equal(result.mode, "augment-pinned-primary-review-only");
		assert.equal(result.measures, 1);
		const merged = workspace.read("coverage");
		assert.deepEqual(merged.jurisdiction, pinned.jurisdiction);
		assert.deepEqual(merged.location, pinned.location);
		assert.deepEqual(merged.candidates, pinned.candidates);
		assert.deepEqual(merged.dataSources, pinned.dataSources);
		assert.deepEqual(merged.additionalGuides, pinned.additionalGuides);
		assert.deepEqual({ ...merged.election, contests: [] }, { ...pinned.election, contests: [] });
		assert.deepEqual(merged.election.contests.slice(0, -1), pinned.election.contests);
		assert.deepEqual(merged.measures.slice(0, -1), pinned.measures);
		assert.deepEqual(merged.sources.slice(0, pinned.sources.length), pinned.sources);
		assert.equal(merged.updatedAt, pinned.updatedAt);
		assert.equal(merged.measures.at(-1).updatedAt, workspace.draft.measures[0]!.updatedAt);
		assert.equal(workspace.read("guides").guides[0].election.slug, workspace.primaryAugmentation.electionSlug);
		assert.deepEqual(workspace.read("guides").guides[0].coverageLimits, workspace.read("workflows")[0].coverageLimits);
		assert.equal(workspace.read("manifest").existingPrimaryPreserved, false);
		assert.equal(workspace.read("manifest").existingPrimaryMetadataPreserved, true);
		for (const key of ["publicationApproved", "automaticImportApproved", "primaryReplacementApproved"]) assert.equal(workspace.read("manifest")[key], false);
		assert.equal(workspace.read("workflows")[0].status, "draft");
		for (const key of ["publishedAt", "reviewedAt", "reviewer", "reviewRecommendation", "reviewNotes"]) assert.equal(workspace.read("workflows")[0][key], undefined);
		assert.equal(readCoverageSnapshotMetadata(join(workspace.plan.outputDirectory, "measure-review-coverage.json")).status, "unknown");
		assert.equal(readFileSync(workspace.basePath, "utf8"), before);
		assert.ok(readFileSync(join(workspace.plan.outputDirectory, "measure-review-provenance.csv"), "utf8").includes(workspace.primaryAugmentation.electionSlug));
	}
	finally { workspace.dispose(); }
});

test("primary augmentation requires the pinned primary target and matching state, date, kind and name", async () => {
	for (const mode of ["no-base", "no-election", "no-jurisdiction", "no-location", "two-inputs", "target", "jurisdiction", "approval", "state", "date", "kind", "name"]) {
		const workspace = primaryFixture();
		try {
			if (mode === "no-base") workspace.plan.baseSnapshot = null;
			if (mode === "no-election") {
				workspace.base.election = null;
				workspace.saveBase();
			}
			if (mode === "no-jurisdiction") {
				workspace.base.jurisdiction = null;
				workspace.saveBase();
			}
			if (mode === "no-location") {
				workspace.base.location = null;
				workspace.saveBase();
			}
			if (mode === "two-inputs") workspace.plan.inputs.push(structuredClone(workspace.plan.inputs[0]!));
			if (mode === "target") workspace.primaryAugmentation.electionSlug = "another-election";
			if (mode === "jurisdiction") workspace.primaryAugmentation.jurisdictionSlug = "another-jurisdiction";
			if (mode === "approval") Object.assign(workspace.primaryAugmentation, { approved: true });
			if (mode === "state") {
				workspace.draft.stateCode = "ND";
				workspace.plan.inputs[0]!.stateCode = "ND";
				workspace.jurisdiction.slug = "nd-primary-fixture";
				workspace.draft.measures[0]!.location = `${workspace.jurisdiction.name}, North Dakota`;
			}
			if (mode === "date") {
				workspace.draft.electionDate = "2028-11-07";
				workspace.plan.inputs[0]!.electionDate = "2028-11-07";
			}
			if (mode === "kind") workspace.jurisdiction.jurisdictionType = "city";
			if (mode === "name") {
				workspace.jurisdiction.name = "Another County";
				workspace.draft.measures[0]!.location = "Another County, Georgia";
			}
			workspace.save();
			await assert.rejects(prepareStateMeasureGuideFiles(workspace.planPath, now), /Primary augmentation/u, mode);
			assert.equal(existsSync(workspace.plan.outputDirectory), false, mode);
		}
		finally { workspace.dispose(); }
	}
});

test("primary augmentation refuses existing contest, measure and citation identities", async () => {
	for (const mode of ["contest", "measure", "source"]) {
		const workspace = primaryFixture();
		try {
			if (mode === "contest") workspace.draft.measures[0]!.contestSlug = workspace.base.election!.contests[0]!.slug;
			if (mode === "measure") workspace.draft.measures[0]!.slug = workspace.base.measures[0]!.slug;
			if (mode === "source") workspace.draft.measures[0]!.sources[0]!.id = workspace.base.sources[0]!.id;
			workspace.save();
			await assert.rejects(prepareStateMeasureGuideFiles(workspace.planPath, now), /Primary augmentation cannot/u, mode);
			assert.equal(existsSync(workspace.plan.outputDirectory), false);
		}
		finally { workspace.dispose(); }
	}
});

test("repeating primary augmentation cannot duplicate a measure or mutate the reviewed base", async () => {
	const workspace = primaryFixture();
	try {
		await prepareStateMeasureGuideFiles(workspace.planPath, now);
		const snapshotPath = join(workspace.plan.outputDirectory, "measure-review-coverage.json");
		const original = readFileSync(snapshotPath, "utf8");
		workspace.plan.baseSnapshot = { path: snapshotPath, sha256: hash(original) };
		workspace.plan.outputDirectory = join(workspace.directory, "repeat");
		workspace.save();
		await assert.rejects(prepareStateMeasureGuideFiles(workspace.planPath, now), /cannot replace an existing contest or measure/u);
		assert.equal(readFileSync(snapshotPath, "utf8"), original);
		assert.equal(existsSync(workspace.plan.outputDirectory), false);
	}
	finally { workspace.dispose(); }
});

test("primary augmentation refuses an ambiguous second guide with the primary scope", async () => {
	const workspace = primaryFixture();
	try {
		workspace.base.additionalGuides = [{ jurisdiction: { ...workspace.base.jurisdiction!, slug: "duplicate-county" }, election: { ...workspace.base.election!, slug: "duplicate-election", jurisdictionSlug: "duplicate-county", contests: [] }, location: { ...workspace.base.location!, slug: "duplicate-county" } }];
		workspace.saveBase();
		await assert.rejects(prepareStateMeasureGuideFiles(workspace.planPath, now), /one unambiguous primary/u);
		assert.equal(existsSync(workspace.plan.outputDirectory), false);
	}
	finally { workspace.dispose(); }
});

test("native preparation preserves explicit binary advisory status in guides and citation CSV", async () => {
	const workspace = fixture();
	try {
		workspace.draft.measures[0]!.decisionEffect = "advisory";
		workspace.draft.measures[0]!.ballotOptions = { yes: "Yes", no: "No" };
		workspace.save();
		await prepareStateMeasureGuideFiles(workspace.planPath, now);
		assert.equal(workspace.read("guides").guides[0].election.contests[0].measures[0].decisionEffect, "advisory");
		assert.equal(workspace.read("workflows")[0].status, "draft");
		const csv = readFileSync(join(workspace.plan.outputDirectory, "measure-review-provenance.csv"), "utf8");
		assert.match(csv.split("\n")[0]!, /"yesLabel","noLabel","decisionEffect"$/u);
		assert.match(csv.split("\n")[1]!, /"Yes","No","advisory"$/u);
		assert.deepEqual(workspace.read("review").holds[0].unmappedQuestions, workspace.draft.unmappedQuestions);
	}
	finally { workspace.dispose(); }
});

test("native advisory preparation refuses inferred labels and unsupported decision effects", async () => {
	for (const decisionEffect of ["advisory", "binding", null]) {
		const workspace = fixture();
		try {
			Object.assign(workspace.draft.measures[0]!, { decisionEffect });
			delete workspace.draft.measures[0]!.ballotOptions;
			workspace.save();
			await assert.rejects(prepareStateMeasureGuideFiles(workspace.planPath, now), /Advisory decisions require explicit/u);
		}
		finally { workspace.dispose(); }
	}
});

test("native preparation accepts a pinned large PDF without increasing JSON or combined input limits", async () => {
	const workspace = fixture();
	try {
		const capture = Buffer.alloc(31 * 1024 * 1024);
		capture.write("%PDF-1.7\nLarge official pamphlet fixture\n");
		writeFileSync(workspace.documentPath, capture);
		workspace.draft.documents.analysis.sha256 = hash(capture);
		workspace.plan.inputs[0]!.documents[0]!.sha256 = hash(capture);
		workspace.save();
		await prepareStateMeasureGuideFiles(workspace.planPath, now);
		assert.equal(workspace.read("manifest").documents[0].bytes, capture.byteLength);
	}
	finally { workspace.dispose(); }
});

test("large non-PDF captures, oversized PDFs and oversized JSON drafts stay rejected", async () => {
	for (const kind of ["non-pdf", "oversized-pdf", "oversized-draft"]) {
		const workspace = fixture();
		try {
			const body = Buffer.alloc((kind === "oversized-pdf" ? 33 : 13) * 1024 * 1024, " ");
			if (kind === "oversized-pdf") body.write("%PDF-1.7\n");
			if (kind === "oversized-draft") {
				workspace.save();
				writeFileSync(workspace.draftPath, body);
				workspace.plan.inputs[0]!.sha256 = hash(body);
				writeFileSync(workspace.planPath, JSON.stringify(workspace.plan));
			}
			else {
				writeFileSync(workspace.documentPath, body);
				workspace.draft.documents.analysis.sha256 = hash(body);
				workspace.plan.inputs[0]!.documents[0]!.sha256 = hash(body);
				workspace.save();
			}
			await assert.rejects(() => prepareStateMeasureGuideFiles(workspace.planPath, now), /size limit|pinned PDF/u);
			assert.equal(existsSync(workspace.plan.outputDirectory), false);
		}
		finally { workspace.dispose(); }
	}
});

test("large pinned PDFs cannot exceed the combined preparation bound", async () => {
	const workspace = fixture();
	try {
		const body = Buffer.alloc(32 * 1024 * 1024);
		body.write("%PDF-1.7\n");
		writeFileSync(workspace.documentPath, body);
		workspace.draft.documents.analysis.sha256 = hash(body);
		workspace.plan.inputs[0]!.documents[0]!.sha256 = hash(body);
		const supplement = { ...workspace.draft.documents.analysis, url: "https://www.eac.gov/supplement.pdf" };
		Object.assign(workspace.draft.documents, { supplement });
		workspace.plan.inputs[0]!.documents.push({ ...workspace.plan.inputs[0]!.documents[0]!, key: "supplement", url: supplement.url });
		workspace.save();
		await assert.rejects(() => prepareStateMeasureGuideFiles(workspace.planPath, now), /combined size limit/u);
		assert.equal(existsSync(workspace.plan.outputDirectory), false);
	}
	finally { workspace.dispose(); }
});

test("District of Columbia measure preparation uses districtwide scope without changing draft gates", async () => {
	const workspace = fixture();
	try {
		workspace.draft.stateCode = "DC";
		workspace.draft.measures[0]!.location = "District of Columbia";
		workspace.plan.inputs[0]!.stateCode = "DC";
		workspace.save();
		await prepareStateMeasureGuideFiles(workspace.planPath, now);
		const guide = workspace.read("guides").guides[0];
		assert.equal(guide.jurisdiction.name, "District of Columbia");
		assert.equal(guide.jurisdiction.jurisdictionType, "state");
		assert.equal(guide.jurisdiction.slug, "dc-districtwide-2026-11-03");
		assert.equal(guide.election.name, "District of Columbia districtwide measures");
		assert.equal(guide.election.contests[0].office, "Districtwide ballot measure");
		assert.equal(guide.location.coverageLabel, "Districtwide measures");
		assert.deepEqual(guide.coverageLimits, ["Districtwide measures only; candidate races are not included."]);
		assert.equal(workspace.read("workflows")[0].status, "draft");
		assert.equal(workspace.read("manifest").publicationApproved, false);
		assert.equal(workspace.read("manifest").automaticImportApproved, false);
	}
	finally { workspace.dispose(); }
});

test("local measure preparation preserves its exact area instead of assigning it statewide", async () => {
	const workspace = fixture();
	try {
		const jurisdiction = { jurisdictionType: "town", name: "Example", slug: "nd-example" };
		Object.assign(workspace.plan.inputs[0]!, { jurisdiction });
		Object.assign(workspace.draft, { jurisdiction });
		workspace.draft.measures[0]!.location = "Example, North Dakota";
		workspace.save();
		await prepareStateMeasureGuideFiles(workspace.planPath, now);
		const guide = workspace.read("guides").guides[0];
		assert.equal(guide.jurisdiction.jurisdictionType, "town");
		assert.equal(guide.jurisdiction.name, "Example");
		assert.equal(guide.location.displayName, "Example, North Dakota");
		assert.equal(guide.location.requiresOfficialConfirmation, true);
		assert.equal(guide.election.slug, "nd-example-measures-2026-11-03");
		assert.ok(guide.coverageLimits[0].includes("other races and ballot questions"));
	}
	finally { workspace.dispose(); }
});

test("native local and district guides retain exact jurisdiction kinds", async () => {
	for (const jurisdictionType of ["township", "village", "school-district", "intermediate-school-district", "special-district"]) {
		const workspace = fixture();
		try {
			const jurisdiction = { jurisdictionType, name: "Example", slug: `nd-example-${jurisdictionType}` };
			Object.assign(workspace.plan.inputs[0]!, { jurisdiction });
			Object.assign(workspace.draft, { jurisdiction });
			workspace.draft.measures[0]!.location = "Example, North Dakota";
			workspace.save();
			await prepareStateMeasureGuideFiles(workspace.planPath, now);
			const guide = workspace.read("guides").guides[0];
			assert.equal(guide.jurisdiction.jurisdictionType, jurisdictionType);
			assert.equal(guide.jurisdiction.name, "Example");
			assert.equal(guide.location.lookupMode, "coverage-selection");
			assert.equal(guide.location.requiresOfficialConfirmation, true);
		}
		finally { workspace.dispose(); }
	}
});

test("two local areas in the same state and election remain separate", async () => {
	const first = fixture();
	const second = fixture();
	try {
		for (const [workspace, name, slug] of [[first, "Example", "nd-example"], [second, "Another", "nd-another"]] as const) {
			const jurisdiction = { jurisdictionType: "county", name, slug };
			Object.assign(workspace.plan.inputs[0]!, { jurisdiction });
			Object.assign(workspace.draft, { jurisdiction });
			Object.assign(workspace.draft.measures[0]!, { slug: `${slug}-measure`, contestSlug: `${slug}-question`, location: `${name}, North Dakota` });
			workspace.save();
		}
		first.plan.inputs.push(second.plan.inputs[0]!);
		first.save();
		await prepareStateMeasureGuideFiles(first.planPath, now);
		assert.deepEqual(first.read("guides").guides.map((guide: { jurisdiction: { name: string } }) => guide.jurisdiction.name), ["Example", "Another"]);
		assert.ok(first.read("workflows").every((workflow: { status: string }) => workflow.status === "draft"));
	}
	finally {
		first.dispose();
		second.dispose();
	}
});

test("independent-city preparation preserves its county-equivalent identity and draft status", async () => {
	const workspace = fixture();
	try {
		const jurisdiction = { jurisdictionType: "independent-city", name: "Example City", slug: "nd-example-city" };
		Object.assign(workspace.plan.inputs[0]!, { jurisdiction });
		Object.assign(workspace.draft, { jurisdiction });
		workspace.draft.measures[0]!.location = "Example City, North Dakota";
		workspace.save();
		await prepareStateMeasureGuideFiles(workspace.planPath, now);
		const guide = workspace.read("guides").guides[0];
		assert.equal(guide.jurisdiction.jurisdictionType, "independent-city");
		assert.equal(guide.jurisdiction.name, "Example City");
		assert.equal(guide.location.requiresOfficialConfirmation, true);
		assert.ok(workspace.read("workflows").every((workflow: { status: string }) => workflow.status === "draft"));
	}
	finally { workspace.dispose(); }
});

test("local scope cannot be dropped, changed, malformed or silently promoted", async () => {
	for (const mutation of ["missing-plan-scope", "wrong-name", "wrong-type", "foreign-slug", "wrong-location"]) {
		const workspace = fixture();
		try {
			const jurisdiction = { jurisdictionType: "town", name: "Example", slug: "nd-example" };
			Object.assign(workspace.draft, { jurisdiction });
			Object.assign(workspace.plan.inputs[0]!, { jurisdiction: { ...jurisdiction } });
			workspace.draft.measures[0]!.location = "Example, North Dakota";
			if (mutation === "missing-plan-scope") Reflect.deleteProperty(workspace.plan.inputs[0]!, "jurisdiction");
			if (mutation === "wrong-name") Object.assign(workspace.plan.inputs[0]!, { jurisdiction: { ...jurisdiction, name: "Elsewhere" } });
			if (mutation === "wrong-type") Object.assign(workspace.plan.inputs[0]!, { jurisdiction: { ...jurisdiction, jurisdictionType: "state" } });
			if (mutation === "foreign-slug") Object.assign(workspace.plan.inputs[0]!, { jurisdiction: { ...jurisdiction, slug: "me-example" } });
			if (mutation === "wrong-location") workspace.draft.measures[0]!.location = "North Dakota";
			workspace.save();
			await assert.rejects(() => prepareStateMeasureGuideFiles(workspace.planPath, now));
			assert.equal(existsSync(workspace.plan.outputDirectory), false);
		}
		finally { workspace.dispose(); }
	}
});

test("an existing local scope cannot be appended under a different slug", async () => {
	const workspace = fixture();
	try {
		const jurisdiction = { jurisdictionType: "town", name: "Example", slug: "nd-example" };
		Object.assign(workspace.draft, { jurisdiction });
		Object.assign(workspace.plan.inputs[0]!, { jurisdiction });
		workspace.draft.measures[0]!.location = "Example, North Dakota";
		workspace.save();
		await prepareStateMeasureGuideFiles(workspace.planPath, now);
		const base = buildFultonOfficialLogisticsOnlySnapshot();
		base.additionalGuides = workspace.read("guides").guides;
		base.additionalGuides![0]!.jurisdiction.jurisdictionType = "Town";
		const body = JSON.stringify(base);
		const path = join(workspace.directory, "local-base.json");
		writeFileSync(path, body);
		workspace.plan.baseSnapshot = { path, sha256: hash(body) };
		workspace.plan.outputDirectory = join(workspace.directory, "duplicate");
		Object.assign(workspace.plan.inputs[0]!, { jurisdiction: { ...jurisdiction, slug: "nd-new-alias" } });
		Object.assign(workspace.draft, { jurisdiction: { ...jurisdiction, slug: "nd-new-alias" } });
		workspace.save();
		await assert.rejects(() => prepareStateMeasureGuideFiles(workspace.planPath, now), /replacement/u);
		assert.equal(existsSync(workspace.plan.outputDirectory), false);
	}
	finally { workspace.dispose(); }
});

test("document-center PDF citations must identify a reviewed page", async () => {
	for (const page of [1, 99]) {
		const workspace = fixture();
		try {
			const url = "https://www.eac.gov/DocumentCenter/View/123/Official-Ballot";
			workspace.draft.documents.analysis.url = url;
			workspace.plan.inputs[0]!.documents[0]!.url = url;
			workspace.draft.measures[0]!.sources[0]!.url = `${url}#page=${page}`;
			workspace.save();
			if (page === 1) {
				await prepareStateMeasureGuideFiles(workspace.planPath, now);
			}
			else {
				await assert.rejects(() => prepareStateMeasureGuideFiles(workspace.planPath, now), /reviewed document\/page identities/u);
				assert.equal(existsSync(workspace.plan.outputDirectory), false);
			}
		}
		finally { workspace.dispose(); }
	}
});

test("native binary labels survive preparation and CSV export", async () => {
	for (const ballotOptions of [{ yes: "For", no: "Against" }, { yes: "Approve", no: "Reject" }, { yes: "YES/FOR", no: "NO/AGAINST" }, { yes: "For the Measure", no: "Against the Measure" }, { yes: "Yes, to approve", no: "No, to reject" }]) {
		const workspace = fixture();
		try {
			workspace.draft.measures[0]!.ballotOptions = ballotOptions;
			workspace.save();
			await prepareStateMeasureGuideFiles(workspace.planPath, now);
			assert.deepEqual(workspace.read("guides").guides[0].election.contests[0].measures[0].ballotOptions, ballotOptions);
			const csv = readFileSync(join(workspace.plan.outputDirectory, "measure-review-provenance.csv"), "utf8");
			assert.match(csv.split("\n")[0]!, /"yesLabel","noLabel"$/u);
			assert.ok(csv.includes(`,"${ballotOptions.yes}","${ballotOptions.no}"\n`));
		}
		finally { workspace.dispose(); }
	}
});

test("native preparation holds unsupported choice mappings before writing output", async () => {
	const workspace = fixture();
	try {
		workspace.draft.measures[0]!.ballotOptions = { yes: "A", no: "B" };
		workspace.save();
		await assert.rejects(() => prepareStateMeasureGuideFiles(workspace.planPath, now), /supported binary ballot options/u);
		assert.equal(existsSync(workspace.plan.outputDirectory), false);
	}
	finally { workspace.dispose(); }
});

test("standalone preparation preserves evidence and never emits a primary-replacement snapshot", async () => {
	const workspace = fixture();
	const original = readFileSync(workspace.draftPath);
	try {
		const result = await prepareStateMeasureGuideFiles(workspace.planPath, now);
		assert.equal(result.mode, "standalone-review-only");
		assert.doesNotMatch(readFileSync(join(workspace.plan.outputDirectory, "measure-review-provenance.csv"), "utf8").split("\n")[0]!, /yesLabel|noLabel/u);
		assert.equal(result.files, 6);
		assert.equal(result.publisherRequests, 0);
		assert.equal(result.imported, false);
		assert.equal(result.publicationApproved, false);
		const bundle = workspace.read("guides");
		assert.equal(bundle.guides.length, 1);
		assert.equal(bundle.guides[0].election.contests[0].measures[0].plainLanguageExplanation, workspace.draft.measures[0]!.summary);
		assert.equal(bundle.guides[0].election.freshness.dataLastUpdatedAt, workspace.draft.measures[0]!.freshness.dataLastUpdatedAt);
		assert.equal(bundle.guides[0].jurisdiction.upcomingElections[0].contests, undefined);
		assert.throws(() => parseCoverageSnapshot(bundle));
		assert.ok(!readdirSync(workspace.plan.outputDirectory).some(name => name.includes("coverage")));
		assert.deepEqual(readFileSync(workspace.draftPath), original);
		const workflows = workspace.read("workflows");
		assert.equal(workflows[0].status, "draft");
		assert.equal(workflows[0].publishedAt, undefined);
		assert.ok(workflows[0].coverageLimits[0].includes("local candidates and measures are not included"));
		const review = workspace.read("review");
		assert.deepEqual(review.holds[0].unresolvedFields, workspace.draft.unresolvedFields);
		assert.deepEqual(review.holds[0].unmappedQuestions, workspace.draft.unmappedQuestions);
		assert.equal(review.guideDiagnostics[0].readyToPublish, false);
		assert.equal(review.mappings.length, 1);
	}
	finally { workspace.dispose(); }
});

test("a newly selected state retains access holds without granting retrieval or publication", async () => {
	const workspace = fixture();
	try {
		workspace.plan.inputs[0]!.stateCode = "TN";
		workspace.draft.stateCode = "TN";
		Object.assign(workspace.draft.measures[0]!, { location: "Tennessee", slug: "tn-fixture-measure", contestSlug: "tn-fixture-contest" });
		workspace.draft.unresolvedFields = [{ field: "publisherPolicy", status: "Linked policy redirect; automatic collection remains unapproved." }];
		workspace.save();
		const result = await prepareStateMeasureGuideFiles(workspace.planPath, now);
		assert.equal(result.publisherRequests, 0);
		assert.equal(result.imported, false);
		assert.equal(result.publicationApproved, false);
		assert.equal(result.automaticImportApproved, false);
		assert.equal(workspace.read("guides").guides[0].jurisdiction.state, "Tennessee");
		assert.equal(workspace.read("workflows")[0].status, "draft");
		assert.deepEqual(workspace.read("review").holds[0].unresolvedFields, workspace.draft.unresolvedFields);
		assert.equal(workspace.read("review").guideDiagnostics[0].readyToPublish, false);
	}
	finally { workspace.dispose(); }
});

test("pinned base preparation preserves primary fields without inheriting approval", async () => {
	const workspace = fixture();
	try {
		const base = buildFultonOfficialLogisticsOnlySnapshot();
		const body = `${JSON.stringify(base)}\n`;
		const path = join(workspace.directory, "base.json");
		writeFileSync(path, body);
		workspace.plan.baseSnapshot = { path, sha256: hash(body) };
		workspace.save();
		const result = await prepareStateMeasureGuideFiles(workspace.planPath, now);
		assert.equal(result.files, 8);
		const merged = workspace.read("coverage");
		for (const key of ["election", "jurisdiction", "location", "candidates", "measures", "sources", "dataSources"] as const) assert.deepEqual(merged[key], base[key]);
		assert.equal(merged.additionalGuides.length, 1);
		assert.deepEqual(readFileSync(path, "utf8"), body);
		assert.equal(readCoverageSnapshotMetadata(join(workspace.plan.outputDirectory, "measure-review-coverage.json")).status, "unknown");
		assert.equal(workspace.read("workflows").length, 1);
		assert.equal(workspace.read("workflows")[0].status, "draft");
	}
	finally { workspace.dispose(); }
});

test("explanation mapping is explicit and leaving it off does not invent missing text", async () => {
	const workspace = fixture();
	try {
		workspace.plan.inputs[0]!.summaryAsExplanation = false;
		workspace.save();
		await prepareStateMeasureGuideFiles(workspace.planPath, now);
		assert.equal(workspace.read("guides").guides[0].election.contests[0].measures[0].plainLanguageExplanation, "");
		assert.equal(workspace.read("review").mappings.length, 0);
		assert.equal(workspace.read("review").guideDiagnostics[0].readyToPublish, false);
	}
	finally { workspace.dispose(); }
});

test("changed, mis-scoped, approved, unsupported and falsely dated inputs fail before output", async () => {
	const mutations = [
		(workspace: ReturnType<typeof fixture>) => { writeFileSync(workspace.draftPath, "{}"); },
		(workspace: ReturnType<typeof fixture>) => { writeFileSync(workspace.documentPath, "changed"); },
		(workspace: ReturnType<typeof fixture>) => {
			workspace.draft.stateCode = "ID";
			workspace.save();
		},
		(workspace: ReturnType<typeof fixture>) => {
			workspace.draft.electionDate = "2024-11-05";
			workspace.save();
		},
		(workspace: ReturnType<typeof fixture>) => {
			workspace.draft.publicationApproved = true;
			workspace.save();
		},
		(workspace: ReturnType<typeof fixture>) => {
			workspace.draft.measures[0]!.sources[0]!.date = "2026-10-23";
			workspace.save();
		},
		(workspace: ReturnType<typeof fixture>) => {
			workspace.draft.measures[0]!.sources[0]!.url = "https://www.eac.gov/isolated-fixture.pdf#page=2";
			workspace.save();
		},
		(workspace: ReturnType<typeof fixture>) => {
			workspace.draft.measures[0]!.yesMeaning = "";
			workspace.save();
		},
		(workspace: ReturnType<typeof fixture>) => {
			workspace.plan.inputs[0]!.documents[0]!.capturedAt = "2026-10-22T12:01:00.000Z";
			workspace.save();
		},
		(workspace: ReturnType<typeof fixture>) => {
			workspace.plan.inputs.push(structuredClone(workspace.plan.inputs[0]!));
			workspace.save();
		},
	];
	for (const mutate of mutations) {
		const workspace = fixture();
		try {
			mutate(workspace);
			await assert.rejects(() => prepareStateMeasureGuideFiles(workspace.planPath, now));
			assert.equal(existsSync(workspace.plan.outputDirectory), false);
		}
		finally { workspace.dispose(); }
	}
});

test("preparation refuses application output, symlinked input and existing output", async () => {
	for (const mode of ["application", "input-link", "existing"] as const) {
		const workspace = fixture();
		try {
			if (mode === "application") workspace.plan.outputDirectory = fileURLToPath(new URL("../would-not-write-measure-output", import.meta.url));
			if (mode === "input-link") {
				const target = join(workspace.directory, "linked.json");
				symlinkSync(workspace.draftPath, target);
				workspace.plan.inputs[0]!.path = target;
			}
			workspace.save();
			if (mode === "existing") await prepareStateMeasureGuideFiles(workspace.planPath, now);
			await assert.rejects(() => prepareStateMeasureGuideFiles(workspace.planPath, now));
			if (mode === "existing") assert.equal(workspace.read("manifest").publicationApproved, false);
		}
		finally { workspace.dispose(); }
	}
});

test("state and future election configuration does not require a new assembler", async () => {
	const workspace = fixture();
	try {
		workspace.plan.inputs[0]!.stateCode = "ID";
		workspace.plan.inputs[0]!.electionDate = "2030-11-05";
		workspace.draft.stateCode = "ID";
		workspace.draft.electionDate = "2030-11-05";
		workspace.draft.measures[0]!.location = "Idaho";
		workspace.save();
		await prepareStateMeasureGuideFiles(workspace.planPath, now);
		const guide = workspace.read("guides").guides[0];
		assert.equal(guide.location.state, "Idaho");
		assert.equal(guide.election.date, "2030-11-05");
		assert.equal(guide.election.slug, "id-statewide-measures-2030-11-05");
		assert.equal(workspace.read("workflows")[0].status, "draft");
	}
	finally { workspace.dispose(); }
});

test("source CLI prepares an offline packet and rejects extra command arguments", () => {
	const workspace = fixture();
	try {
		const cli = fileURLToPath(new URL("../src/prepare-state-measure-guides.ts", import.meta.url));
		const result = spawnSync(process.execPath, ["--import", "tsx", cli, workspace.planPath], { cwd: resolve(fileURLToPath(new URL("../..", import.meta.url))), encoding: "utf8" });
		assert.equal(result.status, 0, result.stderr);
		assert.equal(JSON.parse(result.stdout).imported, false);
		assert.equal(JSON.parse(result.stdout).publicationApproved, false);
		assert.notEqual(spawnSync(process.execPath, ["--import", "tsx", cli, workspace.planPath, "publish"], { encoding: "utf8" }).status, 0);
	}
	finally { workspace.dispose(); }
});

test("freshness aggregation compares instants without rewriting original time zones", async () => {
	const workspace = fixture();
	try {
		const first = workspace.draft.measures[0]!;
		const second = structuredClone(first);
		second.slug = "second-fixture-measure";
		second.contestSlug = "second-fixture-contest";
		first.freshness.contentLastVerifiedAt = "2026-10-22T23:30:00-05:00";
		first.freshness.dataLastUpdatedAt = "2026-10-22T23:30:00-05:00";
		first.freshness.nextReviewAt = "2026-10-23T23:30:00-05:00";
		second.freshness.contentLastVerifiedAt = "2026-10-23T02:00:00Z";
		second.freshness.dataLastUpdatedAt = "2026-10-23T02:00:00Z";
		second.freshness.nextReviewAt = "2026-10-24T02:00:00Z";
		workspace.draft.measures.push(second);
		workspace.save();
		await prepareStateMeasureGuideFiles(workspace.planPath, now);
		const election = workspace.read("guides").guides[0].election;
		assert.equal(election.freshness.contentLastVerifiedAt, second.freshness.contentLastVerifiedAt);
		assert.equal(election.freshness.dataLastUpdatedAt, first.freshness.dataLastUpdatedAt);
		assert.equal(election.freshness.nextReviewAt, second.freshness.nextReviewAt);
		assert.equal(election.contests[0].measures[0].freshness.contentLastVerifiedAt, first.freshness.contentLastVerifiedAt);
	}
	finally { workspace.dispose(); }
});

test("spreadsheet-risk text is escaped only in CSV, not rewritten as a source claim", async () => {
	const workspace = fixture();
	try {
		workspace.draft.measures[0]!.summary = "  =SUM(1,2)";
		workspace.save();
		await prepareStateMeasureGuideFiles(workspace.planPath, now);
		assert.equal(workspace.read("guides").guides[0].election.contests[0].measures[0].summary, "  =SUM(1,2)");
		assert.match(readFileSync(join(workspace.plan.outputDirectory, "measure-review-provenance.csv"), "utf8"), /"' {2}=SUM\(1,2\)"/u);
	}
	finally { workspace.dispose(); }
});

test("unknown data-update dates remain unknown rather than becoming capture or preparation dates", async () => {
	const workspace = fixture();
	try {
		delete workspace.draft.measures[0]!.freshness.dataLastUpdatedAt;
		workspace.save();
		await prepareStateMeasureGuideFiles(workspace.planPath, now);
		const election = workspace.read("guides").guides[0].election;
		assert.equal(election.freshness.dataLastUpdatedAt, undefined);
		assert.equal(election.contests[0].measures[0].freshness.dataLastUpdatedAt, undefined);
		assert.equal(workspace.read("manifest").documents[0].capturedAt, workspace.draft.documents.analysis.capturedAt);
	}
	finally { workspace.dispose(); }
});
