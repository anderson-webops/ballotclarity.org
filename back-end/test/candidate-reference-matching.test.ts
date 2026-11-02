import type { ElectionReferenceSnapshot } from "../src/election-references.js";
import type { StateCandidateRecord } from "../src/state-ballot-records.js";
import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { matchingCandidateReferences } from "../src/candidate-reference-matching.js";
import { electionReferenceSources } from "../src/election-reference-sources.js";
import { electionReferenceDocumentDigest } from "../src/election-references.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const capturedAt = "2026-11-01T12:00:00.000Z";
const record = (overrides: Partial<StateCandidateRecord> = {}): StateCandidateRecord => ({ id: hash("official").slice(0, 24), name: "Jane Example", office: "United States House of Representatives - District 5", district: "5", scope: "congressional", status: "listed", party: "Example", ...overrides });
const official = (records = [record()]): StateBallotSnapshot => ({ source: configuredStateBallotSources.find(source => source.id === "ga-fulton-2026")!, sha256: hash("original"), retrievedAt: capturedAt, records });
function references(overrides: Partial<ElectionReferenceSnapshot["records"][number]> = {}): ElectionReferenceSnapshot {
	const source = electionReferenceSources.find(source => source.id === "us-cdir-ga-2026")!;
	const documents = source.documents.map(document => ({ url: document.url, sha256: hash(document.url), capturedAt, includedRecordCount: 1 }));
	return { schemaVersion: 1, type: "election-references", stateCode: "GA", sourceId: source.id, electionDate: source.electionDate, retrievedAt: capturedAt, sourceSha256: electionReferenceDocumentDigest(documents), recordCount: 1, documents, records: [{ id: hash("reference").slice(0, 24), name: "Jane Example", office: "U.S. Representative", jurisdiction: "Congressional District 5", scope: "congressional", facts: ["Professional background: teacher."], sourceDocumentIndex: 0, ...overrides }] };
}

test("stored reference facts join only the exact official person and office context", () => {
	const snapshot = official();
	const preceding = JSON.stringify(snapshot);
	const source = references();
	const result = matchingCandidateReferences(snapshot, snapshot.records[0]!, [source]);
	assert.equal(result.length, 1);
	assert.deepEqual(result[0]!.facts, ["Professional background: teacher."]);
	assert.equal(result[0]!.source.collectionId, source.sourceId);
	assert.equal(result[0]!.source.capturedAt, capturedAt);
	assert.equal(JSON.stringify(snapshot), preceding);
	assert.equal("incumbent" in result[0]!, false);
});

test("different names, initials, office scopes and districts do not cross-attach", () => {
	for (const reference of [references({ name: "J. Example" }), references({ name: "Jane Other" }), references({ scope: "state-senate" }), references({ jurisdiction: "Congressional District 6" }), references({ office: "State House District 6", jurisdiction: "District 5" })]) assert.equal(matchingCandidateReferences(official(), record(), [reference]).length, 0);
	assert.equal(matchingCandidateReferences(official([record({ district: "6" })]), record({ district: "6" }), [references()]).length, 0);
});

test("party collisions and repeated reference identities require separate review", () => {
	const candidates = official([record(), record({ id: hash("second").slice(0, 24), party: "Other" })]);
	assert.equal(matchingCandidateReferences(candidates, candidates.records[0]!, [references()]).length, 0);
	const duplicate = references();
	duplicate.records.push({ ...duplicate.records[0]!, id: hash("another reference").slice(0, 24) });
	duplicate.recordCount = 2;
	duplicate.documents[0]!.includedRecordCount = 2;
	assert.equal(matchingCandidateReferences(official(), record(), [duplicate]).length, 0);
});

test("older elections are omitted and foreign or unconfigured provenance is rejected", () => {
	assert.equal(matchingCandidateReferences(official(), record(), [{ ...references(), electionDate: "2024-11-05" }]).length, 0);
	assert.throws(() => matchingCandidateReferences(official(), record(), [{ ...references(), stateCode: "FL" }]), /state/u);
	assert.throws(() => matchingCandidateReferences(official(), record(), [{ ...references(), sourceId: "not-configured" }]), /configured/u);
	assert.throws(() => matchingCandidateReferences(official(), record(), [{ ...references(), sourceSha256: hash("tampered") }]), /provenance/u);
});

test("a Senate biography is not assigned to a governor or a House race", () => {
	const senate = record({ office: "United States Senate", district: "", scope: "statewide" });
	const reference = references({ office: "U.S. Senator", scope: "statewide", jurisdiction: "Georgia" });
	assert.equal(matchingCandidateReferences(official([senate]), senate, [reference]).length, 1);
	const governor = record({ office: "Governor", district: "", scope: "statewide" });
	assert.equal(matchingCandidateReferences(official([governor]), governor, [reference]).length, 0);
});

test("local facts require matching office and explicit jurisdiction, not just a name", () => {
	const candidate = record({ scope: "local", district: "", office: "Town Council", jurisdiction: "Example Town" });
	const reference = references({ scope: "local", office: "Town Council", jurisdiction: "Example Town" });
	assert.equal(matchingCandidateReferences(official([candidate]), candidate, [reference]).length, 1);
	assert.equal(matchingCandidateReferences(official([candidate]), candidate, [references({ ...reference.records[0], jurisdiction: "Another Town" })]).length, 0);
	assert.equal(matchingCandidateReferences(official([candidate]), candidate, [references({ ...reference.records[0], jurisdiction: undefined })]).length, 0);
});
