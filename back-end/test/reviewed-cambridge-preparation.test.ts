import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareReviewedCandidateFiles } from "../src/reviewed-candidate-preparation.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { cambridgeFixture } from "./helpers/cambridge-fixture.js";

const now = Date.parse("2026-10-26T00:00:00Z");
const source = configuredStateBallotSources.find(source => source.id === "ma-cambridge-2026")!;
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
async function fixture(context: TestContext) {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "cambridge-native-preparation-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const path = join(directory, "reviewed.pdf");
	const body = Buffer.from("%PDF-1.7\nSynthetic reviewed source bytes\n%%EOF\n");
	await writeFile(path, body);
	const plan = { schemaVersion: 1, type: "reviewed-candidate-preparation", sourceId: source.id, sourceConfigurationSha256: hash(JSON.stringify(source)), input: { path, sha256: hash(body), format: "cambridge-candidates-pdf" }, documents: [{ url: source.url, path, sha256: hash(body), capturedAt: "2026-10-21T11:49:39.783Z", pageCount: 3, reviewedPages: [1, 2] }], outputDirectory: join(directory, "out"), outputName: "cambridge-native" };
	const planPath = join(directory, "plan.json");
	const save = () => writeFile(planPath, JSON.stringify(plan));
	await save();
	return { directory, plan, planPath, save };
}

test("Cambridge native preparation uses only pinned local bytes and keeps outputs unapproved", async (context) => {
	const input = await fixture(context);
	let extracted = 0;
	const result = await prepareReviewedCandidateFiles(input.planPath, now, { extractCambridgePdf: async (body) => {
		assert.equal(hash(body), input.plan.input.sha256);
		extracted++;
		return cambridgeFixture();
	} });
	assert.equal(extracted, 1);
	assert.equal(result.recordCount, 8);
	assert.equal(result.publisherRequests, 0);
	assert.equal(result.publicationApproved, false);
	assert.equal(result.automaticImportApproved, false);
	assert.equal(result.published, false);
	const body = await readFile(join(input.plan.outputDirectory, "cambridge-native.snapshot.json"), "utf8");
	const snapshot = parseBundledStateSnapshot(source, body);
	assert.equal(snapshot.records.length, 8);
	assert.equal(snapshot.retrievedAt, "2026-10-21T11:49:39.783Z");
	assert.equal(snapshot.documents![0]!.includedRecordCount, 8);
	for (const filename of result.files) assert(!(await readFile(join(input.plan.outputDirectory, filename), "utf8")).includes("Example Rd."));
});

test("Cambridge native preparation rejects wrong identity, bytes, page review or extraction before output", async (context) => {
	for (const kind of ["format", "source", "path", "hash", "count", "review", "text"]) {
		const input = await fixture(context);
		if (kind === "format") input.plan.input.format = "unreviewed-native-format";
		if (kind === "source") {
			input.plan.sourceId = "al-sos-2026";
			input.plan.sourceConfigurationSha256 = hash(JSON.stringify(configuredStateBallotSources.find(source => source.id === "al-sos-2026")));
		}
		if (kind === "path") input.plan.input.path = join(input.directory, "unrelated.pdf");
		if (kind === "hash") input.plan.input.sha256 = "a".repeat(64);
		if (kind === "count") input.plan.documents[0]!.pageCount = 4;
		if (kind === "review") input.plan.documents[0]!.reviewedPages = [1];
		await input.save();
		await assert.rejects(prepareReviewedCandidateFiles(input.planPath, now, { extractCambridgePdf: async () => kind === "text" ? "Broken publication" : cambridgeFixture() }));
		await assert.rejects(access(input.plan.outputDirectory), /ENOENT/u);
	}
});
