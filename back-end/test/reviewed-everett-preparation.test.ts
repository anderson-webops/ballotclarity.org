import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { access, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareReviewedCandidateFiles } from "../src/reviewed-candidate-preparation.js";
import { everettSource } from "../src/state-ballot-everett.js";

test("Everett preparation rejects unreviewed or mismatched local plans before writing outputs", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "everett-native-preparation-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const source = everettSource("2026-11-03");
	const bytes = Buffer.from("%PDF-1.7\nSynthetic unavailable extraction fixture\n%%EOF\n");
	const hash = (body: string | Buffer) => createHash("sha256").update(body).digest("hex");
	const path = join(directory, "source.pdf");
	await writeFile(path, bytes);
	for (const kind of ["hash", "documents", "source", "review", "extraction"]) {
		const plan = { schemaVersion: 1, type: "reviewed-candidate-preparation", sourceId: source.id, sourceConfigurationSha256: hash(JSON.stringify(source)), input: { path, sha256: hash(bytes), format: "everett-ballots-pdf" }, documents: source.documentUrls!.map(url => ({ url, path, sha256: hash(bytes), capturedAt: "2026-11-06T15:40:33.215Z", pageCount: 6, reviewedPages: [1] })), outputDirectory: join(directory, kind), outputName: "everett-reviewed" };
		if (kind === "hash") plan.input.sha256 = "a".repeat(64);
		if (kind === "documents") plan.documents.reverse();
		if (kind === "source") plan.sourceConfigurationSha256 = "b".repeat(64);
		if (kind === "review") plan.documents[0]!.reviewedPages = [];
		const planPath = join(directory, `${kind}.json`);
		await writeFile(planPath, JSON.stringify(plan));
		await assert.rejects(prepareReviewedCandidateFiles(planPath, Date.parse("2026-11-07T00:00:00Z"), {
			extractEverettPdf: async () => {
				throw new Error("Unconfigured synthetic native extractor");
			},
		}));
		await assert.rejects(access(plan.outputDirectory), /ENOENT/u);
	}
});
