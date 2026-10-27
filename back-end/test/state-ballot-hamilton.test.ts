import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchHamiltonCandidateCapture, fetchHamiltonCandidateDiscovery, hamiltonDiscoveryUrl, hamiltonDocumentDigest, hamiltonNoticeFingerprint, hamiltonNotices, hamiltonPolicyFingerprint, hamiltonPolicySha256, hamiltonSource, parseHamiltonCandidateCapture, readHamiltonCandidateDiscovery, readHamiltonOfferedPublication, validateHamiltonDocumentUrl, validateHamiltonElection, validateHamiltonSource } from "../src/state-ballot-hamilton-collection.js";
import { hamiltonGeneralDate, readHamiltonBallotDocument, readHamiltonBallotFields, readHamiltonPublicationDate } from "../src/state-ballot-hamilton.js";
import { parseStateHtml, stateHtmlDescendants } from "../src/state-ballot-html.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const source = hamiltonSource("2026-11-03");
const clock = Date.parse("2026-10-27T06:00:00.000Z");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const footer = "<a href=\"/VoterInfo/OpenRecordsPolicyandRequestForm.aspx\">Open Records Policy and Request Form</a><a href=\"/VoterInfo/PublicCommentPolicy.aspx\">Public Comment Policy</a><footer>Hamilton County Election Commission | <a href=\"/login.aspx?ReturnUrl=%2F\">Login</a></footer>";
const publicationUrl = "https://elect.hamiltontn.gov/Portals/12/HTML/GenSample.html";
const header = (title: string, word = "One", number = 1) => `<div class="contest-header"><div class="contest-title">${title}</div><div class="vote-for">Vote for ${word} (${number})</div></div>`;
const oval = "<div class=\"voting-oval\" aria-hidden=\"true\"></div>";
const blank = `<div role="listitem" class="write-in-row"><div class="write-in-label">Write-in</div>${oval}</div>`;
const candidate = (name: string, party?: string) => `<div role="listitem" class="candidate-row">${party ? "<div class=\"candidate-info\">" : ""}<div class="candidate-name">${name}</div>${party ? `<div class="party-name">${party}</div></div>` : ""}${oval}</div>`;
const choices = (labels = ["For", "Against"]) => `<div class="choices-list" role="list">${labels.map(label => `<div class="measure-choice-row" role="listitem"><div class="measure-choice-text">${label}</div>${oval}</div>`).join("")}</div>`;
function fieldsFixture() {
	return `<section class="ballot-page" id="page-1" aria-label="Ballot Page 1 of 1">
	<div class="ballot-column">${header("United States House of Representatives, District 3")}<div class="choices-list" role="list">${candidate("Ada Example", "Democratic Party Nominee")}${candidate("Bob Example", "Republican Party Nominee")}${blank}</div>
	${header("Constitutional Amendment #1")}<div class="amendment-block dense"><div class="amendment-section-label">Summary:</div><div class="amendment-p">A synthetic analytical summary which is not republished.</div><div class="amendment-section-label">Question:</div><div class="amendment-p">Shall this synthetic constitutional provision be amended</div></div></div>
	<div class="ballot-column"><div class="amendment-block dense split-continuation"><div class="amendment-p">as stated in the official question?</div><div class="amendment-p">A second paragraph retains its separation.</div></div>${choices(["Yes", "No"])}
	<div class="municipality-box">City of Example Municipal</div>${header("City Council", "Two", 2)}<div class="choices-list" role="list">${candidate("Casey Example")}${candidate("Dana Example")}${blank}${blank}</div></div>
	<div class="ballot-column">${header("Charter Referendum")}<div class="amendment-block"><div class="amendment-p">Shall this synthetic municipal charter amendment take effect after approval?</div></div>${choices()}<div class="column-footer">SAMPLE PAGE 1 OF 1 END OF BALLOT</div></div></section>`;
}
function parseFields(body = fieldsFixture(), configured = source) {
	return readHamiltonBallotFields(configured, stateHtmlDescendants(parseStateHtml(body), node => node.nodeName === "section"));
}
function dateFixture(date = source.electionDate) {
	const display = `November ${Number(date.slice(8))}, ${date.slice(0, 4)}`;
	return `<title>Official Sample Ballot - State &amp; Federal General Election - ${display}</title><main role="main"><h1 class="sr-only">Official Sample Ballot – State &amp; Federal General Election – ${display}</h1><div class="p1-title-col center">OFFICIAL BALLOT State of Tennessee, Hamilton County State and Federal General Election ${display}</div></main>`;
}
function snapshot() {
	const parsed = parseFields();
	const documents = [{ url: publicationUrl, sha256: "a".repeat(64), retrievedAt: "2026-10-27T05:00:00.000Z", includedRecordCount: parsed.records.length }];
	const sha256 = hamiltonDocumentDigest(documents);
	return { source, records: parsed.records, ballotQuestions: parsed.ballotQuestions, documents, sha256, collectionIndexSha256: sha256, retrievedAt: documents[0]!.retrievedAt };
}
async function pendingDiscovery() {
	const robots = await readFile(new URL("fixtures/hamilton-robots.txt", import.meta.url), "utf8");
	const policies: Record<string, string> = JSON.parse(await readFile(new URL("fixtures/hamilton-policy.json", import.meta.url), "utf8"));
	const calls: string[] = [];
	const body = await fetchHamiltonCandidateDiscovery({ now: () => clock, sleep: async () => {}, requestDocument: async (url, options) => {
		calls.push(url);
		assert.deepEqual(options.allowedHosts, ["elect.hamiltontn.gov"]);
		return { status: 200, contentType: url.endsWith("robots.txt") ? "text/plain" : "text/html", body: Buffer.from(url.endsWith("robots.txt") ? robots : url.endsWith("OpenRecordsPolicyandRequestForm.aspx") ? policies.openRecords! : url.endsWith("PublicCommentPolicy.aspx") ? policies.publicComment! : footer), etag: undefined };
	} });
	assert.deepEqual(calls, ["https://elect.hamiltontn.gov/robots.txt", "https://elect.hamiltontn.gov/", hamiltonDiscoveryUrl, ...hamiltonNotices.map(notice => notice.url)]);
	return body;
}

test("Hamilton preserves printed candidates, parties, municipal context and blank write-in inventory", () => {
	const parsed = parseFields();
	assert.equal(parsed.records.length, 4);
	assert.equal(parsed.writeInRows, 3);
	assert.equal(parsed.claims.length, 4);
	assert.deepEqual(parsed.records.slice(0, 2).map(record => [record.name, record.party, record.scope, record.district]), [["Ada Example", "Democratic", "congressional", "3"], ["Bob Example", "Republican", "congressional", "3"]]);
	assert(parsed.records.slice(2).every(record => record.party === undefined && record.jurisdiction === "City of Example" && record.voteLimit === 2));
	assert(parsed.records.every(record => record.status === "listed" && record.seats === undefined));
	assert.deepEqual(parsed.claims.slice(0, 2).map(claim => claim.partyLabel), ["Democratic Party Nominee", "Republican Party Nominee"]);
});
test("question wording retains paragraphs and original choice labels, excluding analytical summaries", () => {
	const parsed = parseFields();
	assert.equal(parsed.ballotQuestions.length, 2);
	assert.equal(parsed.summaryEvidence.length, 1);
	assert.equal(parsed.ballotQuestions[0]!.officialText, "Shall this synthetic constitutional provision be amended as stated in the official question?\n\nA second paragraph retains its separation.");
	assert(!parsed.ballotQuestions[0]!.officialText.includes("analytical summary"));
	assert.deepEqual(parsed.ballotQuestions[1]!.choices, ["For", "Against"]);
	assert(parsed.ballotQuestions.every(question => !question.voterApplicabilityVerified && !question.explicitlyAdvisory));
	const amended = parseFields(fieldsFixture().replaceAll(">For<", ">For the amendment<").replaceAll(">Against<", ">Against the amendment<"));
	assert.deepEqual(amended.ballotQuestions[1]!.choices, ["For the amendment", "Against the amendment"]);
	assert.notEqual(amended.ballotQuestions[1]!.id, parsed.ballotQuestions[1]!.id);
});
test("future independently printed publication dates and rosters require no annual edit", () => {
	for (const date of ["2028-11-07", "2032-11-02"]) {
		const future = hamiltonSource(date);
		assert.equal(readHamiltonPublicationDate(dateFixture(date)), date);
		const parsed = parseFields(fieldsFixture().replaceAll("Ada Example", "Robin Example"), future);
		assert.equal(parsed.records[0]!.name, "Robin Example");
		assert.notEqual(parsed.records[0]!.id, parseFields().records[0]!.id);
		assert.notEqual(parsed.ballotQuestions[0]!.id, parseFields().ballotQuestions[0]!.id);
	}
	for (const date of ["2026-11-04", "2027-11-02", "2024-11-05"])
		assert.throws(() => hamiltonGeneralDate(date.slice(8), date.slice(0, 4)), /review/u);
	assert.throws(() => readHamiltonPublicationDate(dateFixture().replace("November 3, 2026</h1>", "November 7, 2028</h1>")), /review/u);
});
test("unknown office, party, vote limits, choice labels and missing context hold for review", () => {
	for (const changed of [
		fieldsFixture().replace("Democratic Party Nominee", "Unknown Party"),
		fieldsFixture().replace("<div class=\"party-name\">Democratic Party Nominee</div>", ""),
		fieldsFixture().replace("Vote for Two (2)", "Vote for One (2)"),
		fieldsFixture().replace("District 3", "District unknown"),
		fieldsFixture().replace("City Council", "Unknown board"),
		fieldsFixture().replace("<div class=\"municipality-box\">City of Example Municipal</div>", ""),
		fieldsFixture().replace(">Against<", ">Abstain<"),
		fieldsFixture().replace("Question:", "Summary:"),
		fieldsFixture().replace("SAMPLE PAGE 1 OF 1 END OF BALLOT", "SAMPLE PAGE 2 OF 2 END OF BALLOT"),
		fieldsFixture().replace("aria-label=\"Ballot Page 1 of 1\"", "aria-label=\"Ballot Page 1 of 2\""),
		fieldsFixture().replace(blank, ""),
		fieldsFixture().replace("Ada Example", "Write-in 123")
	]) assert.throws(() => parseFields(changed), /review/u);
});
test("full-document validation never accepts an unreviewed stylesheet or embedded content", () => {
	for (const suffix of ["", "<style>.candidate-name{display:none}</style>", "<script>alert(1)</script>", "<iframe src=\"https://example.org\"/>"])
		assert.throws(() => readHamiltonBallotDocument(source, dateFixture() + suffix), /review/u);
	assert.throws(() => readHamiltonPublicationDate(" ".repeat(2 * 1024 * 1024 + 1)), /review/u);
	assert.throws(() => readHamiltonPublicationDate("<div>".repeat(70)), /review/u);
});
test("offered publication and legal fingerprints use exact public links", () => {
	assert.equal(hamiltonPolicyFingerprint(footer, hamiltonDiscoveryUrl), hamiltonPolicySha256);
	assert.equal(readHamiltonOfferedPublication(footer), null);
	assert.equal(readHamiltonOfferedPublication(`${footer}<a href="${publicationUrl}">📄 GENERIC GENERAL ELECTION SAMPLE BALLOT</a>`), publicationUrl);
	assert.notEqual(hamiltonPolicyFingerprint(footer.replace("Login", "New terms"), hamiltonDiscoveryUrl), hamiltonPolicySha256);
	for (const url of [`${publicationUrl}?preview=1`, publicationUrl.replace("https:", "http:"), publicationUrl.replace("elect.hamiltontn.gov", "other.example"), publicationUrl.replace("GenSample", "%47enSample"), `${publicationUrl}#page-1`])
		assert.throws(() => validateHamiltonDocumentUrl(url), /review/u);
	assert.throws(() => readHamiltonOfferedPublication(`${footer}<a href="/privacy">Privacy</a>`), /review/u);
	assert.throws(() => readHamiltonOfferedPublication(`${footer}<a href="${publicationUrl}">REVISED GENERAL ELECTION SAMPLE BALLOT</a>`), /review/u);
});
test("policy or access failures stop collection without following a challenge", async () => {
	for (const status of [301, 302, 403, 429, 503, 200]) {
		let calls = 0;
		await assert.rejects(fetchHamiltonCandidateDiscovery({ requestDocument: async () => {
			calls++;
			return { status, contentType: "text/plain", body: Buffer.from("User-agent: *\nDisallow: /\n"), location: "https://other.example/challenge", etag: undefined };
		} }), /review/u);
		assert.equal(calls, 1);
	}
});
test("an unpublished election stays empty and accepted content cannot be replaced by that state", async () => {
	const body = await pendingDiscovery();
	assert.deepEqual(readHamiltonCandidateDiscovery(body, clock).elections, []);
	const capture = await fetchHamiltonCandidateCapture(source, { discovery: body, now: () => clock });
	assert.throws(() => parseHamiltonCandidateCapture(source, capture, clock), /no records yet/u);
	assert.throws(() => parseHamiltonCandidateCapture(source, capture, clock, snapshot().records), /review/u);
	assert.throws(() => parseHamiltonCandidateCapture(source, capture, clock, [], snapshot().ballotQuestions), /review/u);
	const altered = JSON.parse(body);
	altered.policies[0].body = altered.policies[0].body.replace("No provisions", "Changed provisions");
	altered.policies[0].sha256 = hash(altered.policies[0].body);
	assert.notEqual(hamiltonNoticeFingerprint(altered.policies[0].body, altered.policies[0].url), hamiltonNotices[0].sha256);
	assert.throws(() => readHamiltonCandidateDiscovery(JSON.stringify(altered), clock), /review/u);
	altered.index.retrievedAt = "2032-01-01T00:00:00.000Z";
	assert.throws(() => readHamiltonCandidateDiscovery(JSON.stringify(altered), clock), /review/u);
	const catalog = discoverStateBallotElectionCycles(body, source.id, clock);
	assert.deepEqual(stateBallotCycleSources(catalog, clock), []);
});
test("source and future cycle contracts are additive and preserve Williamson County", () => {
	assert.deepEqual(configuredStateBallotSources.find(item => item.id === source.id), source);
	assert.equal(configuredStateBallotSources.length, 69);
	assert(configuredStateBallotSources.some(item => item.stateCode === "TN" && item.id !== source.id));
	validateHamiltonSource(source);
	for (const change of [{ countyName: "Other County" }, { retrievalPolicy: "manual-snapshot" }, { url: "https://other.example" }, { electionDate: "2026-11-04" }])
		assert.throws(() => validateHamiltonSource({ ...source, ...change } as typeof source), /review/u);
	const future = hamiltonSource("2032-11-02");
	const election = { electionId: null, electionDate: future.electionDate, pageUrl: future.pageUrl, hamiltonDocuments: [{ url: publicationUrl.replace("GenSample", "PublicGeneral2032"), sha256: "a".repeat(64) }] };
	validateHamiltonElection(election);
	assert.throws(() => validateHamiltonElection({ ...election, hamiltonDocuments: [] }), /review/u);
	const family = getStateBallotCycleFamily(source.id);
	const catalog = parseStateBallotCycleCatalog({ schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId: source.id, sourceConfigurationSha256: hash(JSON.stringify(family.source)), discovery: { url: hamiltonDiscoveryUrl, sha256: "a".repeat(64), retrievedAt: "2026-10-27T05:00:00.000Z" }, elections: [election] }, clock);
	assert.equal(stateBallotCycleSources(catalog, clock)[0]!.id, future.id);
});
test("stored questions, parties, document fingerprints and source fragments survive a fresh repository", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-hamilton-"));
	try {
		const stored = snapshot();
		const body = serializeStoredStateSnapshot(stored);
		assert.deepEqual(parseBundledStateSnapshot(source, body, "automatic").ballotQuestions, stored.ballotQuestions);
		await createStateBallotStorage(directory).write(stored);
		let requests = 0;
		const repository = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => clock, fetchText: async () => {
			requests++;
			throw new Error("offline");
		} });
		assert.deepEqual((await repository.getSnapshot("TN", source.id))!.records, stored.records);
		assert.equal(requests, 0);
		for (const change of [{ sourceAsOfDate: source.electionDate }, { collectionIndexSha256: "b".repeat(64) }, { ballotQuestions: [...stored.ballotQuestions, stored.ballotQuestions[0]] }])
			assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...JSON.parse(body), ...change }), "automatic"), /review|duplicated/u);
		for (const mutate of [(question: Record<string, unknown>) => question.choices = ["Yes", "Against"], (question: Record<string, unknown>) => question.officialText = "Changed wording", (question: Record<string, unknown>) => question.officialText = "Bad\tcontrol", (question: Record<string, unknown>) => question.pages = [2, 1], (question: Record<string, unknown>) => question.voterApplicabilityVerified = true]) {
			const changed = JSON.parse(body);
			mutate(changed.ballotQuestions[0]);
			assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(changed), "automatic"), /review/u);
		}
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
});
test("an accepted forthcoming publication disappearing preserves both catalog and durable data", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-hamilton-sync-"));
	try {
		const body = await pendingDiscovery();
		const catalog = discoverStateBallotElectionCycles(body, source.id, clock);
		catalog.elections = [{ electionId: null, electionDate: source.electionDate, pageUrl: hamiltonDiscoveryUrl, hamiltonDocuments: [{ url: publicationUrl, sha256: "a".repeat(64) }] }];
		const storage = createStateBallotStorage(directory);
		await storage.write(snapshot());
		await writeFile(join(directory, "cycles.json"), JSON.stringify(catalog));
		const prior = await readFile(join(directory, `${source.id}.json`), "utf8");
		const priorCatalog = await readFile(join(directory, "cycles.json"), "utf8");
		await assert.rejects(syncStateBallotCycles({ familyId: source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: directory, now: () => clock, fetchDiscovery: async () => body }), /disappeared|review/u);
		assert.equal(await readFile(join(directory, `${source.id}.json`), "utf8"), prior);
		assert.equal(await readFile(join(directory, "cycles.json"), "utf8"), priorCatalog);
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
});
