import type { StateCandidateRecord } from "../src/state-ballot-records.js";
import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { electionReferenceSources } from "../src/election-reference-sources.js";
import { parseElectionReferenceSnapshot } from "../src/election-references.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { prepareVoteGaCandidateLeadFiles, prepareVoteGaCandidateLeads } from "../src/votega-candidate-leads.js";

const capturedAt = "2026-11-01T12:00:00.000Z";
const now = Date.parse("2026-11-02T12:00:00.000Z");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const columns = "raceId,level,chamber,district,cycle,phase,electionDate,party,name,type,isIncumbent,candidateId,memberId,memberSource,candidateKey";
const candidate = (overrides: Partial<StateCandidateRecord> = {}): StateCandidateRecord => ({ id: hash("candidate").slice(0, 24), name: "Jane Example", office: "United States House of Representatives - District 5", district: "5", scope: "congressional", status: "listed", party: "Democratic", ...overrides });
function snapshot(records = [candidate()], year = 2026): StateBallotSnapshot {
	const source = { ...configuredStateBallotSources.find(source => source.id === "ga-fulton-2026")!, electionDate: `${year}-11-03` };
	const documents = source.documentUrls!.map((url, index) => ({ url, sha256: hash(url), retrievedAt: capturedAt, includedRecordCount: index ? 0 : records.length }));
	return { source, retrievedAt: capturedAt, sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), records, documents };
}
function publication(options: { year?: number; phase?: string; name?: string; party?: string; district?: number; website?: string; duplicates?: boolean } = {}) {
	const year = options.year ?? 2026;
	const phase = options.phase ?? "general";
	const name = options.name ?? "Jane Example";
	const affiliation = options.party ?? "Democrat";
	const district = options.district ?? 5;
	const entry = { id: "candidate-example", name, party: affiliation, website: options.website ?? "https://example.org/", occupation: "Teacher", county: "Fulton", bio: "Copyrighted biography excluded from the output.", imageUrl: "https://example.org/photo.jpg", incumbent: true };
	const race = { id: "ga-05", level: "federal", chamber: "U.S. House", district, cycle: year, activePhase: "primary", phases: { [phase]: { electionDate: `${year}-11-03`, ballots: { [affiliation]: [entry] } } } };
	const row = `${race.id},federal,U.S. House,${district},${year},${phase},${year}-11-03,${affiliation},${name},challenger,False,${entry.id},,,${entry.id}`;
	return { commit: "a".repeat(40), capturedAt, races: JSON.stringify({ updatedAt: capturedAt, races: options.duplicates ? [race, { ...race, id: "ga-05-second" }] : [race] }), candidates: `${columns}\n${row}\n${options.duplicates ? `${row.replace("ga-05,", "ga-05-second,")}\n` : ""}`, license: "Creative Commons Attribution-ShareAlike 4.0 International Public License", notice: "VoteGA.org: CC-BY-SA-4.0. Original source: Georgia Secretary of State." };
}

test("candidate leads retain exact official identity and separate context from publishable data", () => {
	const result = prepareVoteGaCandidateLeads(publication(), [snapshot()], "general", now);
	assert.equal(result.counts.reviewRequired, 1);
	assert.equal(result.records[0]!.status, "review-required");
	assert.equal(result.records[0]!.recordId, candidate().id);
	assert.deepEqual(result.records[0]!.context, { key: "ga-05/general/candidate-example", sourceName: "Jane Example", website: "https://example.org/", occupation: "Teacher", residenceCounty: "Fulton" });
	assert.equal(result.publication.license, "CC-BY-SA-4.0");
	assert.equal(result.policy.publicImport, false);
	const normalizedWebsite = prepareVoteGaCandidateLeads(publication({ website: "https://example.org" }), [snapshot()], "general", now).records[0]!;
	assert(normalizedWebsite.status === "review-required");
	assert.equal(normalizedWebsite.context.website, "https://example.org/");
	assert.doesNotMatch(JSON.stringify(result), /Copyrighted biography|photo\.jpg|"incumbent":true/u);
	assert.throws(() => parseElectionReferenceSnapshot(electionReferenceSources[0]!, JSON.stringify(result)), /match/u);
});

test("office, party and district are independent matching requirements", () => {
	for (const record of [candidate({ district: "6" }), candidate({ party: "Republican" }), candidate({ office: "State Senate District 5", scope: "state-senate" }), candidate({ name: "Janet Example" })]) {
		const result = prepareVoteGaCandidateLeads(publication(), [snapshot([record])], "general", now);
		assert.equal(result.counts.reviewRequired, 0);
		assert.equal("context" in result.records[0]!, false);
	}
});

test("unsupported local offices, missing parties and inactive candidates remain explicit holds", () => {
	const result = prepareVoteGaCandidateLeads(publication(), [snapshot([candidate({ scope: "local" }), candidate({ party: undefined }), candidate({ status: "withdrawn" })])], "general", now);
	assert.deepEqual(result.records.map(record => record.status), ["unsupported-office", "missing-party", "inactive-official-record"]);
	assert.equal(result.counts.reviewRequired, 0);
});

test("ambiguous context does not choose a candidate by order", () => {
	const result = prepareVoteGaCandidateLeads(publication({ duplicates: true }), [snapshot()], "general", now);
	assert.equal(result.records[0]!.status, "ambiguous");
	assert.equal("context" in result.records[0]!, false);
});

test("reviewed Georgia office aliases preserve state, federal and statewide seat distinctions", () => {
	for (const [level, chamber, office, scope, district] of [
		["state", "Georgia State Senate", "State Senate District 5", "state-senate", "5"],
		["state", "Georgia House of Representatives", "State House of Representatives - District 5", "state-house", "5"],
		["state-executive", "Public Service Commissioner", "Public Service Commissioner District 3", "statewide", "3"],
		["state-executive", "Governor", "Governor", "statewide", ""],
		["state-executive", "Insurance & Fire Safety Commissioner", "Commissioner of Insurance", "statewide", ""],
		["state-executive", "Labor Commissioner", "Labor Commissioner", "statewide", ""],
	] as const) {
		const bodies = publication();
		const data = JSON.parse(bodies.races);
		Object.assign(data.races[0], { level, chamber, district: district ? Number(district) : undefined });
		bodies.races = JSON.stringify(data);
		bodies.candidates = bodies.candidates.replace("federal,U.S. House,5,", `${level},${chamber},${district},`);
		assert.equal(prepareVoteGaCandidateLeads(bodies, [snapshot([candidate({ office, scope, district })])], "general", now).counts.reviewRequired, 1, chamber);
	}
});

test("a primary, another election date or activePhase never establishes a general-election match", () => {
	for (const bodies of [publication({ phase: "primary" }), { ...publication(), races: publication().races.replaceAll("2026-11-03", "2026-11-04") }]) assert.equal(prepareVoteGaCandidateLeads(bodies, [snapshot()], "general", now).counts.reviewRequired, 0);
	assert.equal(prepareVoteGaCandidateLeads(publication(), [snapshot()], "general", now).counts.reviewRequired, 1);
});

test("future-cycle preparation uses the offered phase date, not a hardcoded election", () => {
	const result = prepareVoteGaCandidateLeads(publication({ year: 2030 }), [snapshot([candidate()], 2030)], "general", now);
	assert.equal(result.electionDate, "2030-11-03");
	assert.match(result.publication.url, /\/races\/2030\/races\.json$/u);
	assert.equal(result.counts.reviewRequired, 1);
});

test("JSON and CSV must agree on their unique explicit join and names", () => {
	for (const candidates of [publication().candidates.replaceAll("candidate-example", "other-key"), `${publication().candidates + publication().candidates.split("\n")[1]}\n`, publication().candidates.replace("Jane Example", "Someone Else"), publication().candidates.replace("2026-11-03", "2026-11-04")]) assert.throws(() => prepareVoteGaCandidateLeads({ ...publication(), candidates }, [snapshot()], "general", now), /join|disagree/u);
});

test("surname-first names are resolved only from the published candidate join", () => {
	const bodies = publication();
	bodies.candidates = bodies.candidates.replace("Jane Example", "\"Example, Jane\"");
	assert.equal(prepareVoteGaCandidateLeads(bodies, [snapshot()], "general", now).counts.reviewRequired, 1);
	assert.equal(prepareVoteGaCandidateLeads(bodies, [snapshot([candidate({ name: "J. Example" })])], "general", now).counts.reviewRequired, 0);
});

test("unsafe websites remain held without removing other context; schema and text errors stop preparation", () => {
	for (const website of ["http://example.org/", "https://127.0.0.1/", "https://[::1]/", "https://localhost/", "https://user:password@example.org/", "javascript:alert(1)"]) {
		const result = prepareVoteGaCandidateLeads(publication({ website }), [snapshot()], "general", now);
		const record = result.records[0]!;
		assert(record.status === "review-required");
		assert.equal(record.context.website, undefined);
		assert.equal(record.context.websiteHold, "unsafe-or-noncanonical-url");
		assert.equal(record.context.occupation, "Teacher");
		assert.equal(result.policy.publicImport, false);
	}
	assert.throws(() => prepareVoteGaCandidateLeads({ ...publication(), candidates: publication().candidates.replace("candidateKey", "otherColumn") }, [snapshot()], "general", now), /schema/u);
	assert.throws(() => prepareVoteGaCandidateLeads({ ...publication(), races: publication().races.replace("Teacher", "Teacher\\u0000") }, [snapshot()], "general", now), /text/u);
});

test("capture identity, time, rights and official state/election boundaries are required", () => {
	for (const override of [{ commit: "main" }, { capturedAt: "2030-01-01" }, { license: "MIT" }, { notice: "No attribution" }]) assert.throws(() => prepareVoteGaCandidateLeads({ ...publication(), ...override }, [snapshot()], "general", now));
	assert.throws(() => prepareVoteGaCandidateLeads(publication(), [snapshot(), snapshot()], "general", now), /distinct/u);
	const differentState = snapshot();
	differentState.source.stateCode = "FL";
	assert.throws(() => prepareVoteGaCandidateLeads(publication(), [differentState], "general", now), /Georgia/u);
});

test("file preparation verifies captures, preserves rights and never overwrites prior output", async () => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "ballot-candidate-leads-")));
	try {
		const bodies = publication();
		const files: Record<string, { path: string; sha256: string }> = {};
		for (const field of ["races", "candidates", "license", "notice"] as const) {
			files[field] = { path: join(directory, `${field}.txt`), sha256: hash(bodies[field]) };
			await writeFile(files[field]!.path, bodies[field]);
		}
		const candidateFile = join(directory, "official.json");
		const original = serializeStoredStateSnapshot(snapshot());
		await writeFile(candidateFile, original);
		const outputDirectory = join(directory, "output");
		const plan = { schemaVersion: 1, type: "votega-candidate-lead-preparation", candidateFiles: [candidateFile], phase: "general", publication: { commit: bodies.commit, capturedAt, ...files }, outputDirectory };
		const planFile = join(directory, "plan.json");
		await writeFile(planFile, JSON.stringify(plan));
		const result = await prepareVoteGaCandidateLeadFiles(planFile, now);
		assert.equal(result.imported, false);
		assert.equal(result.publisherRequests, 0);
		assert.equal(result.reviewRequired, 1);
		assert.deepEqual((await readdir(outputDirectory)).sort(), ["LICENSE", "NOTICE.md", "candidate-context-leads.json"]);
		assert.equal(await readFile(join(outputDirectory, "LICENSE"), "utf8"), bodies.license);
		assert.equal(await readFile(candidateFile, "utf8"), original);
		await assert.rejects(prepareVoteGaCandidateLeadFiles(planFile, now), /EEXIST/u);
		await writeFile(files.races!.path, "{}");
		await assert.rejects(prepareVoteGaCandidateLeadFiles(planFile, now), /fingerprint/u);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
