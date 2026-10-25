import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { prepareReviewedCandidateFiles } from "../src/reviewed-candidate-preparation.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";

const now = Date.parse("2026-10-24T02:00:00Z");
const hash = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const source = configuredStateBallotSources.find(source => source.id === "mi-tuscola-candidates-2026")!;
const columns = ["name", "office", "party", "district", "scope", "status", "jurisdiction", "ballotDesignation", "sourceStatus", "sourceDistrictLabel", "sourceAreaLabel", "documentUrl", "page"];
const csv = (rows: Record<string, string>[], header = columns) => `${[header, ...rows.map(row => header.map(column => row[column] ?? ""))].map(row => row.map(value => `"${value.replaceAll("\"", "\"\"")}"`).join(",")).join("\n")}\n`;
const sample = (overrides: Record<string, string> = {}) => ({ name: "Cassie Piché", office: "School board", party: "NP", district: "", scope: "local", status: "listed", jurisdiction: "Example School District", ballotDesignation: "4 Year Term - Vote for not more than 4", sourceStatus: "Official candidate list", sourceDistrictLabel: "Printed school board office", sourceAreaLabel: "Tuscola County", documentUrl: source.documentUrls![0]!, page: "1", ...overrides });

async function fixture(context: TestContext, rows = [sample()]) {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "reviewed-candidate-preparation-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const documents = [];
	for (const [index, url] of source.documentUrls!.entries()) {
		const body = Buffer.from(`%PDF-1.7\nLocal fixture ${index}\n%%EOF\n`);
		const path = join(directory, `source-${index}.pdf`);
		await writeFile(path, body);
		documents.push({ url, path, sha256: hash(body), capturedAt: index ? "2026-10-23T00:00:00Z" : "2026-10-23T00:00:10Z", pageCount: 3, reviewedPages: [1, 2] });
	}
	const inputPath = join(directory, "review.csv");
	const body = csv(rows);
	await writeFile(inputPath, body);
	const plan = { schemaVersion: 1, type: "reviewed-candidate-preparation", sourceId: source.id, sourceConfigurationSha256: hash(JSON.stringify(source)), input: { path: inputPath, sha256: hash(body) }, documents, outputDirectory: join(directory, "out"), outputName: "tuscola-reviewed" };
	const planPath = join(directory, "plan.json");
	await writeFile(planPath, JSON.stringify(plan));
	return {
		directory,
		rows,
		plan,
		planPath,
		async save() {
			await writeFile(planPath, JSON.stringify(plan));
		},
	};
}

test("reviewed candidate preparation retains Unicode, provenance and external-only draft outputs", async (context) => {
	const input = await fixture(context);
	const result = await prepareReviewedCandidateFiles(input.planPath, now);
	assert.equal(result.recordCount, 1);
	assert.equal(result.files.length, 6);
	assert.deepEqual([result.publisherRequests, result.imported, result.published, result.publicationApproved, result.automaticImportApproved], [0, false, false, false, false]);
	const body = await readFile(join(input.plan.outputDirectory, "tuscola-reviewed.snapshot.json"), "utf8");
	const snapshot = parseBundledStateSnapshot(source, body);
	assert.equal(snapshot.records[0]!.name, "Cassie Piché");
	assert.equal(snapshot.records[0]!.ballotDesignation, input.rows[0]!.ballotDesignation);
	assert.equal(snapshot.retrievedAt, "2026-10-23T00:00:00.000Z");
	assert.deepEqual(snapshot.documents!.map(document => document.includedRecordCount), [1, 0]);
	const provenance = parse(await readFile(join(input.plan.outputDirectory, "tuscola-reviewed.provenance.csv")), { columns: true }) as Record<string, string>[];
	assert.equal(provenance[0].capturedAt, input.plan.documents[0]!.capturedAt);
	assert.equal(provenance[0].pageUrl, `${source.documentUrls![0]}#page=1`);
	assert.equal(provenance[0].personalAssignmentVerified, "false");
	const review = JSON.parse(await readFile(join(input.plan.outputDirectory, "tuscola-reviewed.review.json"), "utf8"));
	assert.equal(review.publicationApproved, false);
	assert.ok(review.documents.every((document: Record<string, unknown>) => !Object.hasOwn(document, "path")));
	await assert.rejects(prepareReviewedCandidateFiles(input.planPath, now), /EEXIST/u);
	assert.equal(await readFile(join(input.plan.outputDirectory, "tuscola-reviewed.snapshot.json"), "utf8"), body);
});

test("contest terms keep same-name records distinct, while ordering and status updates retain IDs", async (context) => {
	const input = await fixture(context, [sample({ name: "Example Name", ballotDesignation: "Full term" }), sample({ name: "Example Name", ballotDesignation: "Partial term" })]);
	await prepareReviewedCandidateFiles(input.planPath, now);
	const first = parseBundledStateSnapshot(source, await readFile(join(input.plan.outputDirectory, "tuscola-reviewed.snapshot.json"), "utf8"));
	assert.notEqual(first.records[0]!.id, first.records[1]!.id);
	const rows = [...input.rows].reverse().map(row => ({ ...row, status: "withdrawn", sourceStatus: "Printed withdrawal" }));
	const body = csv(rows);
	await writeFile(input.plan.input.path, body);
	input.plan.input.sha256 = hash(body);
	input.plan.outputDirectory = join(input.directory, "changed-status");
	await input.save();
	await prepareReviewedCandidateFiles(input.planPath, now);
	const updated = parseBundledStateSnapshot(source, await readFile(join(input.plan.outputDirectory, "tuscola-reviewed.snapshot.json"), "utf8"));
	assert.deepEqual(updated.records.map(record => record.id).sort(), first.records.map(record => record.id).sort());
	assert.ok(updated.records.every(record => record.status === "withdrawn"));
});

test("candidate CSV rejects contact fields and duplicate headers before creating outputs", async (context) => {
	for (const header of [[...columns, "address"], [...columns, "phone"], [...columns, "email"], [...columns.slice(0, -1), "name"]]) {
		const input = await fixture(context);
		const body = csv(input.rows, header);
		await writeFile(input.plan.input.path, body);
		input.plan.input.sha256 = hash(body);
		await input.save();
		await assert.rejects(prepareReviewedCandidateFiles(input.planPath, now), /exact public-data/u);
		await assert.rejects(access(input.plan.outputDirectory));
	}
});

test("candidate preparation rejects changed source configuration and document or CSV bytes", async (context) => {
	for (const mutation of ["configuration", "document", "csv", "automatic-source", "foreign-document"] as const) {
		const input = await fixture(context);
		if (mutation === "configuration") input.plan.sourceConfigurationSha256 = "0".repeat(64);
		if (mutation === "document") await writeFile(input.plan.documents[0]!.path, "%PDF-changed");
		if (mutation === "csv") await writeFile(input.plan.input.path, csv([sample({ name: "Changed Name" })]));
		if (mutation === "automatic-source") input.plan.sourceId = "mi-dos-2026";
		if (mutation === "foreign-document") input.plan.documents[0]!.url = "https://example.invalid/elsewhere.pdf";
		await input.save();
		await assert.rejects(prepareReviewedCandidateFiles(input.planPath, now), /configured manual PDF|bytes do not match/u);
		await assert.rejects(access(input.plan.outputDirectory));
	}
});

test("future captures and unreviewed or impossible source pages remain rejected", async (context) => {
	for (const mutation of ["future", "reviewed-pages", "page-count", "row-page", "scope", "status", "statewide-district"] as const) {
		const input = await fixture(context);
		if (mutation === "future") input.plan.documents[0]!.capturedAt = "2027-01-01T00:00:00Z";
		if (mutation === "reviewed-pages") input.plan.documents[0]!.reviewedPages = [1, 1];
		if (mutation === "page-count") input.plan.documents[0]!.pageCount = 0;
		if (["row-page", "scope", "status", "statewide-district"].includes(mutation)) {
			const overrides: Record<string, string> = mutation === "row-page" ? { page: "3" } : mutation === "scope" ? { scope: "personal-ballot" } : mutation === "status" ? { status: "probably-nominated" } : { scope: "statewide", district: "1" };
			const body = csv([sample(overrides)]);
			await writeFile(input.plan.input.path, body);
			input.plan.input.sha256 = hash(body);
		}
		await input.save();
		await assert.rejects(prepareReviewedCandidateFiles(input.planPath, now), /provenance|reviewed source page|explicit bounded/u);
		await assert.rejects(access(input.plan.outputDirectory));
	}
});

test("duplicate contest identities are rejected rather than merged across pages", async (context) => {
	const input = await fixture(context, [sample(), sample({ page: "2" })]);
	await assert.rejects(prepareReviewedCandidateFiles(input.planPath, now), /duplicate contest identities/u);
	await assert.rejects(access(input.plan.outputDirectory));
});

test("generated CSV neutralizes spreadsheet formulas without changing the stored identity", async (context) => {
	const input = await fixture(context, [sample({ name: "=HYPERLINK(\"https://example.invalid\")" })]);
	await prepareReviewedCandidateFiles(input.planPath, now);
	const provenance = parse(await readFile(join(input.plan.outputDirectory, "tuscola-reviewed.provenance.csv")), { columns: true }) as Record<string, string>[];
	assert.equal(provenance[0].name, `'${input.rows[0]!.name}`);
	const snapshot = parseBundledStateSnapshot(source, await readFile(join(input.plan.outputDirectory, "tuscola-reviewed.snapshot.json"), "utf8"));
	assert.equal(snapshot.records[0]!.name, input.rows[0]!.name);
});

test("candidate outputs stay outside the application and linked parents", async (context) => {
	const input = await fixture(context);
	input.plan.outputDirectory = resolve(fileURLToPath(new URL("../../", import.meta.url)), ".ai-work/must-not-create-candidate-output");
	await input.save();
	await assert.rejects(prepareReviewedCandidateFiles(input.planPath, now), /outside the application/u);
	await assert.rejects(access(input.plan.outputDirectory));
	const linked = join(input.directory, "linked-parent");
	await symlink(input.directory, linked, "dir");
	input.plan.outputDirectory = join(linked, "must-not-create");
	await input.save();
	await assert.rejects(prepareReviewedCandidateFiles(input.planPath, now), /canonical external directory/u);
	await assert.rejects(access(join(input.directory, "must-not-create")));
});
