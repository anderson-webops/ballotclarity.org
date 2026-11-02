import assert from "node:assert/strict";
import test from "node:test";
import { parseGeorgiaWriteInCertificate, prepareGeorgiaWriteInSnapshot } from "../src/state-ballot-georgia-writeins.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";

const source = configuredStateBallotSources.find(source => source.recordRole === "certified-writeins")!;
const certificate = `Office of the Secretary of State
Elections Division
FINAL LIST OF CERTIFIED WRITE-IN CANDIDATES
Listed below are the qualified Write-In Candidates for the November 3, 2026, General Election
U.S. Senate
Alex Example
Governor
Jordan Sample, II
U.S. House of Representatives, District 10
Casey Example-Green
State Representative, District 39
Taylor Sample
Pursuant to O.C.G.A. § 21-2-494, Write-In votes will be counted only for the candidates whose names appear on this list.
Published this 15th day of September 2026 pursuant to O.C.G.A § 21-2-133(e)(1) Page 1 of 1
\f`;

test("Georgia certificates preserve exact names, printed dates and office-specific scope", () => {
	const parsed = parseGeorgiaWriteInCertificate(certificate);
	assert.equal(parsed.electionDate, "2026-11-03");
	assert.equal(parsed.publishedOn, "2026-09-15");
	assert.deepEqual(parsed.candidates.map(candidate => [candidate.name, candidate.scope, candidate.district]), [["Alex Example", "statewide", ""], ["Jordan Sample, II", "statewide", ""], ["Casey Example-Green", "congressional", "10"], ["Taylor Sample", "state-house", "39"]]);
	const { body } = prepareGeorgiaWriteInSnapshot(source, certificate, "a".repeat(64), "2026-11-01T12:00:00.000Z");
	const snapshot = JSON.parse(body);
	assert.equal(snapshot.recordCount, 4);
	assert.ok(snapshot.records.every((record: Record<string, unknown>) => record.status === "write-in" && record.sourceStatus === "Certified write-in" && record.party === undefined && record.incumbent === undefined && record.jurisdiction === undefined));
	assert.equal(snapshot.documents[0].sha256, "a".repeat(64));
	assert.equal(snapshot.documents[0].includedRecordCount, 4);
});

test("a later certificate discovers dates and candidates without hardcoded current names or totals", () => {
	const future = certificate.replaceAll("2026", "2028").replace("November 3", "November 7").replace("Jordan Sample, II", "Jordan Sample, II\nMorgan Future");
	assert.equal(parseGeorgiaWriteInCertificate(future).candidates.length, 5);
	assert.equal(parseGeorgiaWriteInCertificate(future).electionDate, "2028-11-07");
	assert.throws(() => prepareGeorgiaWriteInSnapshot(source, future, "a".repeat(64), "2028-10-01T12:00:00.000Z"));
	assert.equal(JSON.parse(prepareGeorgiaWriteInSnapshot({ ...source, id: "ga-certified-writeins-2028-11-07", electionDate: "2028-11-07" }, future, "b".repeat(64), "2028-10-01T12:00:00.000Z").body).recordCount, 5);
});

test("partial, ambiguous, repeated, unsupported and malformed Georgia certificates fail closed", () => {
	for (const invalid of [certificate.replace("FINAL LIST", "DRAFT LIST"), certificate.replace("Alex Example", ""), certificate.replace("Alex Example", "Alex Example\nAlex Example"), certificate.replace("U.S. Senate", "Attorney General"), certificate.replace("District 10", "District 0"), certificate.replace("November 3", "February 30"), certificate.replace("Page 1 of 1", "Page 1 of 2"), certificate.replace("State Representative, District 39", "U.S. Senate"), certificate.replace("Taylor Sample", "Taylor Sample\nUnknown District"), `${certificate}\nAnother page\f`, certificate.slice(0, certificate.indexOf("Pursuant to O.C.G.A."))]) assert.throws(() => parseGeorgiaWriteInCertificate(invalid));
	for (const changed of [{ ...source, stateCode: "FL" }, { ...source, electionDate: "2028-11-07" }, { ...source, recordRole: undefined }, { ...source, retrievalPolicy: undefined }]) assert.throws(() => prepareGeorgiaWriteInSnapshot(changed, certificate, "a".repeat(64), "2026-11-01T12:00:00.000Z"));
	assert.throws(() => prepareGeorgiaWriteInSnapshot(source, certificate, "a".repeat(64), "2026-09-01T00:00:00.000Z"));
});
