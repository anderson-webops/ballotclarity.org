import type { ParishCandidateReference } from "../src/prepare-louisiana-parish-references.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";
import { matchingCandidateReferences } from "../src/candidate-reference-matching.js";
import { registerElectionReferenceRoutes } from "../src/election-reference-routes.js";
import { buildElectionReferencePages, createElectionReferenceRepository, createElectionReferenceStorage } from "../src/election-references.js";
import { configuredElectionReferenceSources, parishReferenceSource, parseParishReferenceCatalog } from "../src/louisiana-parish-reference-catalog.js";
import { parishSampleHash as hash } from "../src/louisiana-parish-samples.js";
import { buildParishReferenceCollection } from "../src/prepare-louisiana-parish-references.js";
import { searchRetainedRecords } from "../src/public-record-search.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";

const electionDate = "2030-12-14";
const publication = { parish: "Caddo", url: "https://powercoalition.org/wp-content/uploads/2030/11/Caddo-SampleBallot-Printable-DEC-2030.pdf", pages: [1, 2] };
function reference(name: string, office: string, sourcePage: number): ParishCandidateReference {
	return { parish: publication.parish, electionDate, id: hash(`${publication.parish}\n${electionDate}\n${office}\n${name}\nNo Party`).slice(0, 24), name, office, statedParty: "No Party", sourcePage, sourceStatus: "unofficial-reference", sourceUrl: publication.url, sourceSha256: hash("original PDF"), capturedAt: "2026-11-14T08:00:00.000Z" };
}
function fixture() {
	return buildParishReferenceCollection(electionDate, publication, [reference("Example Person", "U.S.Representative, 5th Congressional District", 1), { ...reference("Another Person", "Council Members at Large, City of Example", 2), voteFor: 2 }]);
}
function catalog() {
	return { schemaVersion: 1, type: "louisiana-parish-reference-catalog", editions: [{ electionDate, publications: [publication] }] };
}

test("parish references retain literal offices, parties, seat counts and exact original page provenance", () => {
	const { source, snapshot } = fixture();
	assert.equal(source.candidateMatching, false);
	assert.equal(source.optional, true);
	assert.equal(snapshot.retrievedAt, "2026-11-14T08:00:00.000Z");
	assert.deepEqual(snapshot.records[0]!.facts, ["Party: No Party"]);
	assert.deepEqual(snapshot.records[1]!.facts, ["Party: No Party", "Seats to fill: 2"]);
	assert.equal(snapshot.documents[1]!.url, `${publication.url}#page=2`);
	assert.equal(snapshot.records[0]!.scope, "congressional");
	assert(snapshot.records.every(record => !record.jurisdiction && !record.officialCandidate));
	const page = buildElectionReferencePages([{ source, snapshot }], { search: "caddo", scope: "all", limit: 50, offset: 0 });
	assert.equal(page.matched, 2);
	assert.equal(page.records[0]!.source.kind, "public-dataset");
	assert.match(page.records[0]!.source.title, /unofficial/u);
});

test("parish reference preparation holds changed identities, mixed evidence and unsupported page assignments", () => {
	const records = [reference("Example", "Mayor, City of Example", 1)];
	const sourcePublication = { ...publication, pages: [1] };
	for (const changed of [{ name: "Different" }, { electionDate: "2030-12-15" }, { parish: "Winn" }, { sourceStatus: "official" }, { sourceUrl: "https://example.com/a.pdf" }, { statedParty: "Guessed party" }, { sourcePage: 3 }, { voteFor: 0 }, { sourceSha256: "bad" }, { capturedAt: "2031-01-01T00:00:00.000Z" }]) assert.throws(() => buildParishReferenceCollection(electionDate, sourcePublication, [{ ...records[0]!, ...changed }]));
	assert.throws(() => buildParishReferenceCollection(electionDate, sourcePublication, [records[0]!, records[0]!]));
	assert.throws(() => buildParishReferenceCollection(electionDate, publication, records), /contribute/u);
});

test("parish catalogs support dated future editions while holding duplicates and publisher changes", () => {
	assert.equal(parseParishReferenceCatalog(catalog()).length, 1);
	for (const changed of [{ parish: "Unknown" }, { url: publication.url.replace("https:", "http:") }, { url: publication.url.replace("powercoalition.org", "sos.la.gov") }, { pages: [2, 1] }, { pages: [1, 1] }, { pages: [] }, { pages: [51] }]) assert.throws(() => parishReferenceSource(electionDate, { ...publication, ...changed }));
	assert.throws(() => parishReferenceSource("2030-02-30", publication));
	const duplicated = catalog();
	duplicated.editions[0]!.publications.push(publication);
	assert.throws(() => parseParishReferenceCatalog(duplicated), /inconsistent/u);
});

test("external parish catalogs are explicit, owner-private and additive to existing references", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "parish-reference-catalog-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const path = join(directory, "catalog.json");
	const defaults = await configuredElectionReferenceSources(null);
	await writeFile(path, JSON.stringify(catalog()), { mode: 0o600 });
	const sources = await configuredElectionReferenceSources(path);
	assert.deepEqual(sources.slice(0, defaults.length), defaults);
	assert.equal(sources.length, defaults.length + 1);
	await chmod(path, 0o644);
	await assert.rejects(configuredElectionReferenceSources(path), /owner-private/u);
	await chmod(path, 0o600);
	await symlink(path, join(directory, "alias.json"));
	await assert.rejects(configuredElectionReferenceSources(join(directory, "alias.json")), /owner-private/u);
	await assert.rejects(configuredElectionReferenceSources("relative.json"), /absolute/u);
});

test("unofficial parish references cannot implicitly bind to a matching official candidate", () => {
	const { source, snapshot } = fixture();
	const officialSource = { ...configuredStateBallotSources.find(source => source.id === "la-st-charles-sample-2026")!, electionDate };
	const candidate = createStateCandidateRecord(officialSource, { name: snapshot.records[0]!.name, office: snapshot.records[0]!.office, party: "", status: "listed", scope: "congressional", district: "5" })!;
	assert.deepEqual(matchingCandidateReferences({ source: officialSource, records: [candidate], retrievedAt: snapshot.retrievedAt, sha256: "0".repeat(64) }, candidate, [snapshot], [source]), []);
});

test("the actual parish reference route, detail data and search honor current-election expiry", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "parish-reference-route-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const catalogPath = join(directory, "catalog.json");
	await writeFile(catalogPath, JSON.stringify(catalog()), { mode: 0o600 });
	const { source, snapshot } = fixture();
	await createElectionReferenceStorage(directory).write(source, snapshot);
	let clock = Date.parse(`${electionDate}T12:00:00Z`);
	context.mock.method(Date, "now", () => clock);
	const repository = createElectionReferenceRepository({ dataDirectory: directory, catalogPath, now: () => clock });
	const app = express();
	registerElectionReferenceRoutes(app, repository);
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	context.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
	const address = server.address();
	assert(address && typeof address !== "string");
	const url = `http://127.0.0.1:${address.port}/api/election-references/LA?q=Caddo&scope=all`;
	const cutoff = Date.parse(`${electionDate}T00:00:00Z`) + 2 * 86400000;
	for (const instant of [cutoff - 1, cutoff, cutoff + 1]) {
		clock = instant;
		const response = await fetch(url);
		assert.equal(response.status, 200);
		const body = await response.json();
		assert.equal(body.available, instant < cutoff);
		assert.equal(body.records.length, instant < cutoff ? 2 : 0);
	}
	clock = cutoff - 1;
	const search = await searchRetainedRecords({ query: "Caddo", stateCode: "LA", candidates: null, references: repository });
	assert.equal(search.incomplete, false);
	assert.equal(search.items.length, 2);
	assert.match(search.items[0]!.href, /kind=reference/u);
	assert.equal((await createElectionReferenceStorage(directory).read(source))!.recordCount, 2);
	await writeFile(catalogPath, "{}");
	assert.equal((await fetch(url)).status, 503);
	assert.equal((await fetch(url.replace("/LA?", "/ME?"))).status, 200);
	assert.equal((await readFile(join(directory, `references-${source.id}.json`), "utf8")).includes(snapshot.sourceSha256), true);
});
