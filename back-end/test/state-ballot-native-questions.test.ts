import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";
import { readFranklinIssueNotices, readFranklinNoticeMetadata } from "../src/franklin-election-notices.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { fetchTuscolaCandidateCapture, parseTuscolaCandidateCapture } from "../src/state-ballot-tuscola-collection.js";
import { registerStateRecordRoutes } from "../src/state-records.js";
import { readTuscolaBallotQuestions, readTuscolaQuestionMetadata } from "../src/tuscola-ballot-questions.js";
import { franklinIssuesFixture } from "./helpers/franklin-issues-fixture.js";
import { tuscolaDiscoveryFixture } from "./helpers/tuscola-fixture.js";

const tuscola = configuredStateBallotSources.find(source => source.id === "mi-tuscola-candidates-2026")!;
const franklin = configuredStateBallotSources.find(source => source.id === "oh-franklin-2026")!;
const publication = "https://www.vote.franklincountyohio.gov/getmedia/33333333-3333-3333-3333-333333333333/2026-General-Certified-Questions-and-Issues";
const proposal = "Proposal Section\nCounty\nTuscola County\nRoad Millage Renewal\nShall the county renew its road millage for five years?\nYes\nNo\nVOTE BOTH FRONT AND BACK OF BALLOT\n\f";
const clock = Date.parse("2026-10-20T01:00:00Z");
const sourceDocument = tuscolaDiscoveryFixture().documents[0]![1]!.url;

test("Tuscola's printed binary choices and repeated physical pages remain literal", () => {
	const questions = readTuscolaBallotQuestions(tuscola, proposal + proposal, sourceDocument);
	assert.equal(questions.length, 1);
	assert.deepEqual(questions[0]!.pages, [1, 2]);
	assert.deepEqual(questions[0]!.choices, ["Yes", "No"]);
	assert.equal(questions[0]!.audience, "Tuscola County");
	assert.equal(questions[0]!.voterApplicabilityVerified, false);
	assert.equal(questions[0]!.sourceUrl, sourceDocument);
});

test("Tuscola retains future statewide and local questions without a hard-coded cycle", () => {
	const source = { ...tuscola, id: "mi-tuscola-general-2028-11-07", electionDate: "2028-11-07" };
	const body = "Proposal Section\nState\nProposal 2028-1\nA Proposed Constitutional Amendment\nThe proposal would:\nChange a published provision.\nShould this proposal be adopted?\nYes\nNo\nVOTE BOTH FRONT AND BACK OF BALLOT\n\f";
	const [question] = readTuscolaBallotQuestions(source, body, sourceDocument.replaceAll("2026", "2028"));
	assert.equal(question!.audience, "Michigan");
	assert.match(question!.title, /^Proposal 2028-1/u);
	assert.throws(() => readTuscolaBallotQuestions(tuscola, body, sourceDocument), /cycle/u);
});

test("Tuscola requires complete wording, scope, choices and matching repetitions", () => {
	for (const body of [proposal.replace("No\n", ""), proposal.replace("Yes\n", ""), proposal.replace("Tuscola County\n", ""), proposal.replace("Proposal Section\n", ""), proposal.replace("VOTE BOTH", "Unexpected\nVOTE BOTH"), proposal + proposal.replace("five years", "six years")]) {
		assert.throws(() => readTuscolaBallotQuestions(tuscola, body, sourceDocument));
	}
	assert.deepEqual(readTuscolaBallotQuestions(tuscola, "Candidate-only sample\f", sourceDocument), []);
	const previous = readTuscolaBallotQuestions(tuscola, proposal, sourceDocument);
	assert.throws(() => readTuscolaBallotQuestions(tuscola, "Candidate-only sample\f", sourceDocument, previous), /disappeared/u);
	assert.throws(() => readTuscolaBallotQuestions(tuscola, proposal.replace("five years", "six years"), sourceDocument, previous), /changed/u);
});

test("Tuscola's stored metadata binds actual choices, citation, pages, scope and wording", () => {
	const questions = readTuscolaBallotQuestions(tuscola, proposal, sourceDocument);
	const data = { ballotQuestions: questions, documents: [{}, { url: sourceDocument }], retrievalPolicy: "automatic" };
	assert.deepEqual(readTuscolaQuestionMetadata(tuscola, data).ballotQuestions, questions);
	for (const change of [{ choices: [] }, { pages: [2, 1] }, { pages: [0] }, { audience: "Unknown" }, { officialText: "Changed wording" }, { sourceUrl: "https://example.org/" }, { voterApplicabilityVerified: true }, { explicitlyAdvisory: true }, { textKind: "notice" }]) {
		assert.throws(() => readTuscolaQuestionMetadata(tuscola, { ...data, ballotQuestions: [{ ...questions[0], ...change }] }));
	}
	assert.throws(() => readTuscolaQuestionMetadata(tuscola, { ...data, sourceAsOf: "2026-01-01" }));
});

test("Franklin preserves framed compound tax/bond notices and literal unnumbered rows", () => {
	const questions = readFranklinIssueNotices(franklin, JSON.stringify(franklinIssuesFixture()), publication);
	assert.equal(questions.length, 2);
	assert.match(questions[0]!.officialText, /Proposed Tax Levy\nCurrent Expenses 2 mills, 5 years\n\nProposed Bond Issue\nSchool Construction \$10,000,000; 20 years/u);
	assert.equal(questions[1]!.title, "Other Public Library Proposed Tax Levy");
	assert.equal(questions[1]!.audience, "Other Public Library");
	assert.ok(questions.every(question => question.textKind === "notice" && question.choices.length === 0 && !question.voterApplicabilityVerified));
	assert.deepEqual(questions.map(question => question.pages), [[1], [1]]);
});

test("Franklin notice identity follows the actual future election and native page furniture", () => {
	const source = { ...franklin, id: "oh-franklin-general-2028-11-07", electionDate: "2028-11-07" };
	assert.equal(readFranklinIssueNotices(source, JSON.stringify(franklinIssuesFixture(2028)), publication).length, 2);
	assert.throws(() => readFranklinIssueNotices(franklin, JSON.stringify(franklinIssuesFixture(2028)), publication), /identity/u);
	const fixture = franklinIssuesFixture();
	for (const change of [
		{ svg: [fixture.svg[0]!.replaceAll("viewBox=\"0 0 612 792\"", "viewBox=\"0 0 600 792\"")] },
		{ svg: ["<svg viewBox=\"0 0 612 792\"></svg>"] },
		{ svg: [fixture.svg[0]!.replace("<path", "<path transform=\"translate(1 0)\"")] },
		{ bbox: fixture.bbox.replace("Revised", "Updated") },
		{ bbox: fixture.bbox.replace("Page", "Unexpected") },
		{ bbox: fixture.bbox.replace("Current", "Changed") },
		{ layout: fixture.layout.replace("Current", "Changed") },
		{ svg: [] },
		{ extra: true }
	]) assert.throws(() => readFranklinIssueNotices(franklin, JSON.stringify({ ...fixture, ...change }), publication));
});

test("Franklin's notices never manufacture ballot choices or retain altered stored evidence", () => {
	const questions = readFranklinIssueNotices(franklin, JSON.stringify(franklinIssuesFixture()), publication);
	const data = { ballotQuestions: questions, documents: [{}, {}, { url: publication }], retrievalPolicy: "automatic" };
	assert.deepEqual(readFranklinNoticeMetadata(franklin, data).ballotQuestions, questions);
	for (const change of [{ choices: ["Yes", "No"] }, { textKind: undefined }, { pages: [1, 2] }, { officialText: "Changed" }, { audience: "Different" }, { sourceUrl: "https://example.org/" }, { voterApplicabilityVerified: true }]) {
		assert.throws(() => readFranklinNoticeMetadata(franklin, { ...data, ballotQuestions: [{ ...questions[0], ...change }] }));
	}
	const fixture = franklinIssuesFixture();
	const changed = { ...fixture, bbox: fixture.bbox.replaceAll("Current", "Changed"), layout: fixture.layout.replaceAll("Current", "Changed") };
	assert.throws(() => readFranklinIssueNotices(franklin, JSON.stringify(changed), publication, questions), /changed/u);
});

test("Franklin's public directory and question API identify notices and cite their own publication", async (context) => {
	const value = tuscolaDiscoveryFixture();
	const parsed = parseTuscolaCandidateCapture(tuscola, await fetchTuscolaCandidateCapture(tuscola, { discovery: JSON.stringify(value), now: () => clock }), clock);
	const questions = readFranklinIssueNotices(franklin, JSON.stringify(franklinIssuesFixture()), publication);
	const documents = [...parsed.documents.map(document => ({ ...document, url: publication.replace("33333333", document.includedRecordCount ? "11111111" : "22222222") })), { ...parsed.documents[1]!, url: publication }];
	const snapshot = { ...parsed, source: franklin, documents, ballotQuestions: questions };
	const app = express();
	registerStateRecordRoutes(app, { sources: [franklin], getSnapshot: async () => snapshot });
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	context.after(() => new Promise<void>(resolve => server.close(() => resolve())));
	const address = server.address();
	assert.ok(address && typeof address === "object");
	const origin = `http://127.0.0.1:${address.port}`;
	const directory = await (await fetch(`${origin}/api/state-records/OH?source=${franklin.id}`)).json();
	assert.equal(directory.questionCount, 2);
	assert.equal(directory.source.questionKind, "notice");
	const detail = await (await fetch(`${origin}/api/state-records/OH/questions?source=${franklin.id}&id=${questions[1]!.id}`)).json();
	assert.equal(detail.source.questionKind, "notice");
	assert.deepEqual(detail.questions, [questions[1]]);
	assert.deepEqual(detail.questions[0].choices, []);
	assert.equal(detail.source.documentLinks[2].url, publication);
	assert.equal(detail.source.documentLinks[2].label, "Certified issues");
});

test("Tuscola recurring refresh, snapshot reload and question routes preserve accepted questions after publisher changes", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "tuscola-questions-"));
	context.after(() => rm(directory, { recursive: true }));
	const value = tuscolaDiscoveryFixture();
	value.documents[0]![1]!.text = value.documents[0]![1]!.text.replace("Proposal text\nVOTE BOTH FRONT AND BACK OF BALLOT\n\f", proposal);
	let body = await fetchTuscolaCandidateCapture(tuscola, { discovery: JSON.stringify(value), now: () => clock });
	const parsed = parseTuscolaCandidateCapture(tuscola, body, clock);
	assert.equal(parsed.ballotQuestions.length, 1);
	const storage = createStateBallotStorage(directory);
	await storage.write({ source: tuscola, ...parsed });
	const filename = (await readdir(directory))[0]!;
	const accepted = await readFile(join(directory, filename));
	const snapshot = (await storage.read(tuscola))!;
	assert.deepEqual(parseBundledStateSnapshot(tuscola, serializeStoredStateSnapshot(snapshot), "automatic").ballotQuestions, parsed.ballotQuestions);
	let currentClock = clock;
	const repository = createStateBallotRepository({ sources: [tuscola], dataDirectory: directory, ttlMs: 1, now: () => currentClock, fetchText: async () => body });
	const app = express();
	registerStateRecordRoutes(app, repository);
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	context.after(() => new Promise<void>(resolve => server.close(() => resolve())));
	const address = server.address();
	assert.ok(address && typeof address === "object");
	const origin = `http://127.0.0.1:${address.port}`;
	const response = await fetch(`${origin}/api/state-records/MI/questions?source=${tuscola.id}`);
	assert.equal(response.status, 200);
	const payload = await response.json();
	assert.deepEqual(payload.questions, parsed.ballotQuestions);
	assert.equal(payload.source.documentLinks[1].label, "Sample ballot");
	assert.equal(payload.source.documentLinks[1].url, sourceDocument);
	const recordPage = await (await fetch(`${origin}/api/state-records/MI?source=${tuscola.id}`)).json();
	assert.equal(recordPage.questionCount, 1);
	assert.equal(recordPage.source.questionKind, undefined);
	value.documents[0]![1]!.text = value.documents[0]![1]!.text.replace(proposal, "Candidate-only reverse\nVOTE BOTH FRONT AND BACK OF BALLOT\n\f");
	value.documents[0]![1]!.sha256 = createHash("sha256").update("changed sample").digest("hex");
	body = await fetchTuscolaCandidateCapture(tuscola, { discovery: JSON.stringify(value), now: () => clock });
	currentClock++;
	assert.deepEqual((await repository.getSnapshot("MI", tuscola.id))!.ballotQuestions, parsed.ballotQuestions);
	assert.ok((await readFile(join(directory, filename))).equals(accepted));
});
