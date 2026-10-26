import assert from "node:assert/strict";
import test from "node:test";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { readTuscolaCandidateDocuments } from "../src/state-ballot-tuscola.js";
import { tuscolaFixture, tuscolaWord } from "./helpers/tuscola-fixture.js";

const source = configuredStateBallotSources.find(source => source.id === "mi-tuscola-candidates-2026")!;

test("Tuscola reconciles native person rows, joint tickets, literal markers and separate proposals", () => {
	const { listing, ballot } = tuscolaFixture();
	const result = readTuscolaCandidateDocuments(source, listing, ballot);
	assert.equal(result.records.length, 4);
	assert.equal(result.printedNames, 6);
	assert.equal(result.tickets, 2);
	assert.deepEqual([result.listingPages, result.samplePages, result.populatedContests, result.emptyContests.length], [2, 2, 3, 1]);
	assert.equal(result.records[0]!.name, "Sample Lead / Sample Mate");
	assert.equal(result.records[2]!.name, "Cassie Piché");
	assert.equal(result.records[3]!.ballotDesignation, "Partial Term Ending 12/01/2028 - Vote for not more than 1; (I)");
	assert.equal(result.records[3]!.jurisdiction, "EXAMPLE TOWNSHIP");
	assert.equal(result.records[3]!.scope, "local");
	assert.equal(result.records[3]!.incumbent, undefined);
	assert.ok(result.records.every(record => record.status === "listed"));
});

test("Tuscola derives future printed dates and changed names without an election-year roster allowlist", () => {
	const fixture = tuscolaFixture(2028);
	const result = readTuscolaCandidateDocuments({ ...source, id: "mi-tuscola-general-2028-11-07", electionDate: "2028-11-07" }, fixture.listing.replaceAll("Cassie Piché", "New Name"), fixture.ballot.replaceAll("Cassie Piché", "New Name"));
	assert.equal(result.records[2]!.name, "New Name");
	assert.throws(() => readTuscolaCandidateDocuments(source, fixture.listing, fixture.ballot), /date/u);
});

test("Tuscola rejects incomplete geometry, sequence, name/party inventory and sample mismatches", () => {
	const fixture = tuscolaFixture();
	for (const listing of [
		fixture.listing.replace("width=\"792\"", "width=\"612\""),
		fixture.listing.replace("Page 2", "Page 3"),
		fixture.listing.replace("TUSCOLA (79)", "OTHER COUNTY"),
		fixture.listing.replace("PROPOSAL</word>", "OTHER</word>"),
		fixture.listing.replace("Cassie Piché", "Different Name"),
		fixture.listing.replace(">LIB<", ">OTHER<"),
		fixture.listing.replace("CLERK (EXAMPLE TOWNSHIP)", "UNKNOWN OFFICE"),
		fixture.listing.replace("</html>", ""),
		fixture.listing.replace("No candidates on ballot", "Name not supplied"),
	]) assert.throws(() => readTuscolaCandidateDocuments(source, listing, fixture.ballot), /Tuscola/u);
	for (const ballot of [fixture.ballot.replace("Piché", "Piche"), fixture.ballot.replace("Sample Mate", "Other Mate"), fixture.ballot.replace("November 3", "November 4"), fixture.ballot.split("\f")[0]!]) assert.throws(() => readTuscolaCandidateDocuments(source, fixture.listing, ballot), /Tuscola/u);
});

test("Tuscola explicit withdrawals remain inactive evidence rather than disappearing names", () => {
	const fixture = tuscolaFixture();
	const listing = fixture.listing.replace("</page>", `${tuscolaWord(70, 265, "10/20/2026", 7.503, 50)}</page>`);
	const result = readTuscolaCandidateDocuments(source, listing, fixture.ballot);
	assert.equal(result.records[2]!.status, "withdrawn");
	assert.equal(result.records[2]!.sourceStatus, "Withdrawal date: 10/20/2026");
	assert.equal(result.records[2]!.id, readTuscolaCandidateDocuments(source, fixture.listing, fixture.ballot).records[2]!.id);
});
