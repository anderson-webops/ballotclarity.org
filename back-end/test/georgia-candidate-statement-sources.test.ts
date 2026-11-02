import assert from "node:assert/strict";
import test from "node:test";
import { electionDocumentSources } from "../src/election-document-sources.js";
import { electionReferenceSources } from "../src/election-reference-sources.js";
import { georgiaCandidateStatementDocuments, georgiaCandidateStatementReferences } from "../src/georgia-candidate-statement-sources.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";

test("reviewed Georgia biographies remain independent opt-in campaign collections", () => {
	assert.equal(georgiaCandidateStatementReferences.length, 11);
	assert.equal(georgiaCandidateStatementDocuments.length, 11);
	const hosts = new Set<string>();
	for (const [index, reference] of georgiaCandidateStatementReferences.entries()) {
		const source = georgiaCandidateStatementDocuments[index]!;
		assert.equal(reference.optional, true);
		assert.equal(reference.stateCode, "GA");
		assert.equal(reference.electionDate, "2026-11-03");
		assert.equal(reference.documents.length, 1);
		const document = reference.documents[0]!;
		assert.equal(document.kind, "candidate-statement");
		assert.equal(document.isCampaignWebsite, true);
		assert.equal(new URL(document.url).hostname, source.host);
		assert.equal(source.minimumDocuments, 1);
		assert.equal(source.maximumDocuments, 1);
		assert.equal(source.documentFormat, "html");
		assert(new RegExp(source.documentPatterns[0]!, "u").test(new URL(document.url).pathname));
		assert(electionDocumentSources.includes(source));
		assert(electionReferenceSources.includes(reference));
		assert(!configuredStateBallotSources.some(official => official.id === source.id || official.id === reference.id));
		hosts.add(source.host);
	}
	assert.equal(hosts.size, 11);
	assert.equal(georgiaCandidateStatementDocuments.filter(source => source.robotsLayout).length, 3);
	for (const held of ["tylerharperga.com", "katherineforgeorgia.com", "stricklandforgeorgia.com"]) assert(!hosts.has(held));
});
