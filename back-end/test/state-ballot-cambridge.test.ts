import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { readCambridgeCandidateDocument } from "../src/state-ballot-cambridge.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { cambridgeFixture } from "./helpers/cambridge-fixture.js";

const source = configuredStateBallotSources.find(source => source.id === "ma-cambridge-2026")!;
const read = (body = cambridgeFixture()) => readCambridgeCandidateDocument(source, body, createStateCandidateRecord);

test("Cambridge's native reader keeps literal party, ticket, named-district and page evidence", () => {
	const result = read();
	assert.equal(result.records.length, 8);
	assert.equal(result.pageCount, 3);
	assert.deepEqual(result.claims.map(claim => claim.page), [1, 1, 1, 1, 2, 2, 2, 2]);
	assert.deepEqual(result.records.filter(row => row.scope === "state-senate").map(row => row.district), ["MIDDLESEX & SUFFOLK", "SUFFOLK & MIDDLESEX"]);
	assert.equal(result.records[2]!.district, "5");
	assert.equal(result.records[3]!.jurisdiction, "Massachusetts, Third District");
	assert.equal(result.records[5]!.party, "Unenrolled");
	assert.equal(result.records[1]!.name, "SAMPLE AND PARTNER");
	assert.equal(result.records[7]!.party, "Justice for All");
	assert(!JSON.stringify(result).includes("Example Rd."));
	assert.equal(result.records[0]!.id, createHash("sha256").update(JSON.stringify(["MA", "2026-11-03", "senator in congress", "", "sample senator", "democratic"])).digest("hex").slice(0, 24));
	assert.equal(source.retrievalPolicy, "manual-snapshot");
});

test("Cambridge's native reader keeps Unicode and rejects ambiguity, broken dates and partial documents", () => {
	assert.equal(read(cambridgeFixture().replace("SAMPLE SENATOR", "SAMPLE PICHÉ")).records[0]!.name, "SAMPLE PICHÉ");
	for (const body of [
		cambridgeFixture().replace("November 3, 2026", "November 4, 2026"),
		cambridgeFixture().replace("Candidates in Cambridge Districts", "Other publication"),
		cambridgeFixture().replace("Representative in Congress", "Unknown Office"),
		cambridgeFixture().replace("Fifth District", "Other Region"),
		cambridgeFixture().replace("Justice for All", "Unreviewed Party"),
		cambridgeFixture().replace("1 Example Rd.", "No address evidence"),
		cambridgeFixture().replace("SAMPLE AND PARTNER", "SAMPLE PERSON"),
		cambridgeFixture().replace("SAMPLE SENATOR, 1 Example Rd., Example, Democratic", "SAMPLE SENATOR, 1 Example Rd., Example, Democratic\n        SAMPLE SENATOR, 1 Example Rd., Example, Democratic"),
		cambridgeFixture().split("\f").slice(0, 2).join("\f"),
		cambridgeFixture().replace("SAMPLE CLERK, 7 Example Rd., Example, Justice for All", ""),
		cambridgeFixture().replace("Register of Probate", "Senator in Congress"),
		`${cambridgeFixture()}\u0000`
	]) assert.throws(() => read(body), /Cambridge/u);
});

test("Cambridge's native reader does not invent current records for another election", () => {
	assert.throws(() => read(cambridgeFixture(2028)), /election heading/u);
	const future = { ...source, id: "ma-cambridge-2028", electionDate: "2028-11-07" };
	assert.equal(readCambridgeCandidateDocument(future, cambridgeFixture(2028), createStateCandidateRecord).records.length, 8);
});
