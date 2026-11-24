import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { createElectionReferenceRepository, createElectionReferenceStorage, parseElectionReferenceSnapshot } from "../src/election-references.js";
import { addReviewedReferenceSources, parseReviewedReferenceCatalog } from "../src/reviewed-reference-catalog.js";

const document = {
	url: "https://example.org/filings",
	title: "Council filing list",
	kind: "public-dataset",
	publisher: "Example clerk"
};
const source = {
	id: "il-council-filings-2030",
	stateCode: "IL",
	electionDate: "2030-04-02",
	optional: true,
	candidateMatching: false,
	documents: [document]
};
const catalog = {
	schemaVersion: 1,
	type: "reviewed-election-references",
	stateCode: "IL",
	sources: [source]
};

test("Reviewed catalogs admit bounded reference citations without enabling candidate matching or collection", () => {
	assert.deepEqual(parseReviewedReferenceCatalog(catalog, "IL"), [source]);
	for (const changed of [
		{ ...source, candidateMatching: true },
		{ ...source, optional: false },
		{ ...source, electionDate: "2030-02-30" },
		{ ...source, id: "ma-another-state" },
		{ ...source, allowOfficialCandidateBindings: true },
		{
			...source,
			documents: [document, document]
		},
		{
			...source,
			documents: [
				{ ...document, url: "http://example.org/document" }
			]
		},
		{
			...source,
			documents: [
				{ ...document, isCampaignWebsite: true }
			]
		},
		{
			...source,
			documents: [
				{ ...document, publishedDate: "2030-13-01" }
			]
		},
		{
			...source,
			documents: [
				{ ...document, pdfMaximumPages: 2 }
			]
		}
	]) {
		assert.throws(() => parseReviewedReferenceCatalog({
			...catalog,
			sources: [changed]
		}, "IL"));
	}
	assert.throws(() => parseReviewedReferenceCatalog({
		...catalog,
		sources: [source, source]
	}, "IL"));
	assert.throws(() => parseReviewedReferenceCatalog({
		...catalog,
		sources: Array.from({ length: 65 }, (_, index) => ({ ...source, id: `il-district-${index}` }))
	}, "IL"));
	assert.throws(() => parseReviewedReferenceCatalog(catalog, "MA"));
	assert.throws(() => parseReviewedReferenceCatalog({
		...catalog,
		stateCode: "LA",
		sources: [
			{ ...source, id: "la-parish-caddo-2030", stateCode: "LA" }
		]
	}, "LA"));
});

test("Isolated state enrollment is optional and fails closed on identity or custody conflicts", async () => {
	const directory = await mkdtemp(join(tmpdir(), "reviewed-references-"));
	const path = join(directory, "IL.json");
	try {
		await writeFile(path, JSON.stringify(catalog), { mode: 0o600 });
		const enrolled = parseReviewedReferenceCatalog(catalog, "IL");
		assert.deepEqual(await addReviewedReferenceSources([], undefined, "IL"), []);
		assert.deepEqual(await addReviewedReferenceSources([], directory, "IL"), enrolled);
		assert.deepEqual(await addReviewedReferenceSources([], directory), enrolled);
		assert.deepEqual(await addReviewedReferenceSources([], directory, "MA"), []);
		await assert.rejects(addReviewedReferenceSources(enrolled, directory, "IL"), /conflicts/u);
		await writeFile(join(directory, "MA.json"), "{", { mode: 0o600 });
		assert.deepEqual(await addReviewedReferenceSources([], directory, "IL"), enrolled);
		await assert.rejects(addReviewedReferenceSources([], directory, "MA"));
		await chmod(path, 0o644);
		await assert.rejects(addReviewedReferenceSources([], directory, "IL"), /owner-private/u);
		await symlink(path, join(directory, "IA.json"));
		await assert.rejects(addReviewedReferenceSources([], directory, "IA"), /regular files/u);
		await chmod(directory, 0o755);
		await assert.rejects(addReviewedReferenceSources([], directory, "IL"), /owner-private directory/u);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("The normal repository discovers enrolled snapshots, preserves history and excludes official bindings", async () => {
	const directory = await mkdtemp(join(tmpdir(), "reviewed-reference-reader-"));
	const saved = process.env.ELECTION_REFERENCE_CATALOG_DIR;
	try {
		process.env.ELECTION_REFERENCE_CATALOG_DIR = directory;
		const path = join(directory, "IL.json");
		const statement = {
			...source,
			documents: [
				{ ...document, kind: "candidate-statement" }
			]
		};
		await writeFile(path, JSON.stringify({
			...catalog,
			sources: [statement]
		}), { mode: 0o600 });
		let clock = Date.parse("2030-04-02T12:00:00Z");
		const repository = createElectionReferenceRepository({
			dataDirectory: directory,
			now: () => clock,
			catalogPath: null
		});
		const selected = (await repository.getSources!("IL")).find(item => item.id === statement.id)!;
		assert.deepEqual(selected, statement);
		assert.equal(await repository.getSnapshot("IL", { sourceId: selected.id }), null);
		const capturedAt = "2026-01-01T00:00:00.000Z";
		const identity = {
			url: document.url,
			sha256: "a".repeat(64)
		};
		const digest = createHash("sha256").update(JSON.stringify([identity])).digest("hex");
		const row = {
			id: "1".repeat(24),
			name: "Example Person",
			office: "Council",
			scope: "local",
			jurisdiction: "Example",
			sourceDocumentIndex: 0,
			facts: ["Nomination filed."]
		};
		const snapshot = {
			schemaVersion: 1,
			type: "election-references",
			stateCode: "IL",
			electionDate: statement.electionDate,
			sourceId: statement.id,
			sourceSha256: digest,
			retrievedAt: capturedAt,
			documents: [
				{ ...identity, capturedAt, includedRecordCount: 1 }
			],
			recordCount: 1,
			records: [row]
		};
		const parsed = parseElectionReferenceSnapshot(selected, JSON.stringify(snapshot));
		assert.throws(() => parseElectionReferenceSnapshot(selected, JSON.stringify({
			...snapshot,
			records: [
				{
					...row,
					officialCandidate: { recordId: row.id, sourceId: "il-test" }
				}
			]
		})), /binding/u);
		await createElectionReferenceStorage(directory).write(selected, parsed);
		assert.deepEqual(await repository.getSnapshot("IL"), parsed);
		clock = Date.parse("2030-04-04T00:00:00Z");
		assert.equal(await repository.getSnapshot("IL"), null);
		assert.deepEqual(await repository.getSnapshot("IL", { sourceId: selected.id }), parsed);
		await rm(path);
		assert.equal(await repository.getSnapshot("IL", { sourceId: selected.id }), null);
	}
	finally {
		if (saved === undefined) delete process.env.ELECTION_REFERENCE_CATALOG_DIR;
		else process.env.ELECTION_REFERENCE_CATALOG_DIR = saved;
		await rm(directory, { recursive: true, force: true });
	}
});
