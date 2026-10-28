import type { StateBallotSource } from "../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";
import { fultonQuestionId, parseFultonBallotQuestions, readFultonSnapshotMetadata } from "../src/state-ballot-fulton-questions.js";
import { fultonPolicyReceipts, fultonScopeUrl, parseFultonCandidateCapture } from "../src/state-ballot-fulton.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { registerStateRecordRoutes } from "../src/state-records.js";

const source = configuredStateBallotSources.find(item => item.id === "ga-fulton-2026")!;
const timestamp = "2026-10-27T12:00:00.000Z";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const column = (value: string) => `${" ".repeat(66)}${value}`;
const local = (title: string, text: string) => `${title}\nYes or No\n${column(text)}\n`;
const constitutional = (number: number, resolution: number) => `Yes or No${" ".repeat(57)}${number}. Synthetic constitutional question.\n${column(`House Resolution ${resolution}`)}\n\n${column("Ga. L. 2026, p. 1234")}\n${column("“Shall the Constitution of Georgia be amended in the stated way?\"")}\n`;
const questionsText = `${local("City of Synthetic Town Tax Question", "Shall a limited local tax be renewed?")}\n${local("County Transportation Question", "Shall a transportation tax outside the named excluded city be imposed?")}\f${local("Educational Special Purpose Local Option Sales and Use Tax", "Shall the current 1 percent tax be renewed for twenty quarters, with up to $100 in associated debt?")}\fProposed Constitutional Amendments\n${constitutional(1, 12)}\n${constitutional(2, 24)}\f`;

function capture(text = questionsText, selected: StateBallotSource = source) {
	const label = `November ${Number(selected.electionDate.slice(-2))}, ${selected.electionDate.slice(0, 4)}`;
	const scope = "<main>five members of the commission are determined by statewide election</main><footer><a href=\"/privacysecurity\">Privacy/Security</a></footer>";
	const index = `<main><h1>Sample Ballots</h1><a href="${selected.documentUrls![0]}">Click here for the ${label} General / Special Election Consolidated Sample Ballot.</a><a href="${selected.documentUrls![1]}">Click here to view the ${label} Notice of Qualified Write-In Candidates for Fulton County Commission District 5.</a></main><footer><a href="/Privacy-Statement">Privacy Statement</a></footer>`;
	const header = `FULTON COUNTY ELECTIONS\n${label} General Special Election\nCONSOLIDATED SAMPLE BALLOT\n\n`;
	const questionPages = text ? text.split("\f").filter(page => page.trim()) : [""];
	const ballot = questionPages.map((page, index) => `${header}${index ? "" : `${"For Governor".padEnd(66, " ")}Synthetic Governor – Democrat\n\n`}${page}`).join("\f");
	const writeins = `NOTICE OF QUALIFIED WRITE-IN CANDIDATES\nPursuant to Election Code 21-2-133 and 21-2-401(d), the following Write-In Candidates have qualified for the ${label}, General Election:\nFor Fulton County Commission District 5\nSynthetic Qualified Person\nWrite-in votes will be counted only for the candidates on this list pursuant to O.C.G.A 21-2-494\f`;
	const discovery = JSON.stringify({ schemaVersion: 1, type: "fulton-discovery", index, policies: fultonPolicyReceipts, scope });
	const documents = selected.documentUrls!.map((url, index) => ({ url, text: [ballot, writeins, scope][index]!, sha256: hash([ballot, writeins, scope][index]!), retrievedAt: timestamp }));
	assert.equal(documents.at(-1)!.url, fultonScopeUrl);
	return JSON.stringify({ schemaVersion: 1, type: "fulton-candidate-export", discovery, documents });
}

test("Fulton captures every local and constitutional question without assigning voter eligibility", () => {
	const questions = parseFultonBallotQuestions(source, questionsText);
	assert.equal(questions.length, 5);
	assert.deepEqual(questions.map(question => question.pages), [[1], [1], [2], [3], [3]]);
	assert.ok(questions.every(question => question.voterApplicabilityVerified === false && question.audience === "Fulton County consolidated sample ballot"));
	assert.ok(questions.every(question => JSON.stringify(question.choices) === "[\"Yes\",\"No\"]"));
	assert.match(questions[1]!.officialText, /outside the named excluded city/u);
	assert.match(questions[2]!.officialText, /twenty quarters.*\$100/u);
	assert.match(questions[3]!.title, /House Resolution 12/u);
	assert.equal(questions[3]!.officialText, "“Shall the Constitution of Georgia be amended in the stated way?\"");
	assert.equal(new Set(questions.map(question => question.id)).size, 5);
});

test("Fulton future election questions use literal new titles and dates rather than a hardcoded question list", () => {
	const future = { ...source, id: "ga-fulton-general-2030-11-05", electionDate: "2030-11-05" };
	const text = local("City of Future Town Bond Referendum", "Shall the stated bonds be issued?");
	const currentQuestion = parseFultonBallotQuestions(source, text)[0]!;
	const futureQuestion = parseFultonBallotQuestions(future, text)[0]!;
	assert.equal(futureQuestion.title, "City of Future Town Bond Referendum");
	assert.notEqual(futureQuestion.id, currentQuestion.id);
	assert.equal(futureQuestion.id, fultonQuestionId(future, futureQuestion));
	assert.deepEqual(parseFultonBallotQuestions(future, "Synthetic candidate-only sample"), []);
});

test("Fulton multiline headings and paragraph wrapping preserve the printed wording", () => {
	const text = `City of Synthetic Town\nRedevelopment Powers\nYes or No\n${column("Shall the city exercise the specified powers,")}\n\n${column("as amended from time to time?")}\f`;
	const question = parseFultonBallotQuestions(source, text)[0]!;
	assert.equal(question.title, "City of Synthetic Town Redevelopment Powers");
	assert.equal(question.officialText, "Shall the city exercise the specified powers,\n\nas amended from time to time?");
});

test("Fulton preserves source sections without changing existing flattened question identities", () => {
	const text = `Synthetic school tax\nYes or No\n${column("Shall the school tax be renewed:")}\n\n${column("For the Synthetic School District:")}\n${column("fund the specified capital projects?")}\f`;
	const question = parseFultonBallotQuestions(source, text)[0]!;
	const flattened = { ...question, officialText: question.officialText.replace(/\n\n/gu, " ") };
	const previousId = hash(JSON.stringify([source.id, source.electionDate, question.audience, question.title, flattened.officialText, question.pages])).slice(0, 24);
	assert.equal(question.id, previousId);
	assert.equal(question.id, fultonQuestionId(source, flattened));
	assert.equal(question.officialText.split("\n\n").length, 2);
	assert.deepEqual(readFultonSnapshotMetadata(source, { retrievalPolicy: "automatic", ballotQuestions: [question] }), { ballotQuestions: [question] });
	assert.deepEqual(readFultonSnapshotMetadata(source, { retrievalPolicy: "automatic", ballotQuestions: [flattened] }), { ballotQuestions: [flattened] });
	for (const officialText of [question.officialText.replace("\n\n", "\n"), question.officialText.replace("\n\n", "\n\n\n"), question.officialText.replace("\n\n", "\t")])
		assert.throws(() => readFultonSnapshotMetadata(source, { retrievalPolicy: "automatic", ballotQuestions: [{ ...question, officialText }] }));
});

test("Fulton question layout changes, partial text, unknown choices and cross-page continuations fail closed", () => {
	const valid = local("Synthetic Question Heading", "Shall this question be decided?");
	for (const invalid of [valid.replace("Yes or No", "Yes / No"), valid.replace("decided?", "decided"), valid.replace("Shall", "Could"), valid.replace("Synthetic Question Heading\n", ""), valid.replace("Synthetic Question Heading", "For Unknown Office"), `${valid}\fUnvalidated continued wording.`, valid.replace("decided?", "decided?\nUnexpected left-column wording."), valid.replace("decided?", "decided?\u0000"), valid.replace("decided?", "decided?\uFFFD"), `Shall an unmarked question be decided?`])
		assert.throws(() => parseFultonBallotQuestions(source, invalid));
	assert.throws(() => parseFultonBallotQuestions(source, questionsText.replace("Proposed Constitutional Amendments\n", "")));
	assert.throws(() => parseFultonBallotQuestions(source, questionsText.replace("House Resolution 12", "Unreviewed Resolution 12")));
	assert.throws(() => parseFultonBallotQuestions(source, valid.repeat(101)));
	assert.throws(() => parseFultonBallotQuestions({ ...source, stateCode: "WA" }, valid));
});

test("Fulton stored questions enforce exact fields, content identities, scope and choices", () => {
	const ballotQuestions = parseFultonBallotQuestions(source, questionsText);
	const data = { retrievalPolicy: "automatic", ballotQuestions };
	assert.deepEqual(readFultonSnapshotMetadata(source, data), { ballotQuestions });
	assert.deepEqual(readFultonSnapshotMetadata(source, {}), {});
	for (const change of [{ voterApplicabilityVerified: true }, { audience: "All Fulton voters" }, { choices: ["For", "Against"] }, { officialText: "Different meaningful ballot question?" }, { title: "Different title" }, { pages: [101] }, { pages: [1, 2] }, { privateNote: "Excluded" }, { id: "a".repeat(24) }, { explicitlyAdvisory: true }])
		assert.throws(() => readFultonSnapshotMetadata(source, { ...data, ballotQuestions: [{ ...ballotQuestions[0], ...change }] }));
	assert.throws(() => readFultonSnapshotMetadata(source, { ...data, ballotQuestions: [ballotQuestions[0], ballotQuestions[0]] }));
	assert.throws(() => readFultonSnapshotMetadata(source, { ...data, sourceAsOfDate: "2026-10-27" }));
	assert.throws(() => readFultonSnapshotMetadata(source, { ...data, retrievalPolicy: "manual-snapshot" }));
});

test("Fulton candidate captures retain question evidence and hold changed or missing accepted questions", () => {
	const parsed = parseFultonCandidateCapture(source, capture());
	assert.equal(parsed.records.length, 2);
	assert.equal(parsed.ballotQuestions.length, 5);
	assert.deepEqual(parseFultonCandidateCapture(source, capture(), parsed.ballotQuestions), parsed);
	assert.throws(() => parseFultonCandidateCapture(source, capture(questionsText.replace("limited local tax", "changed local tax")), parsed.ballotQuestions), /changed or disappeared/u);
	assert.throws(() => parseFultonCandidateCapture(source, capture(""), parsed.ballotQuestions), /changed or disappeared/u);
	const exported = serializeStoredStateSnapshot({ source, ...parsed });
	assert.deepEqual(parseBundledStateSnapshot(source, exported, "automatic").ballotQuestions, parsed.ballotQuestions);
	const old = JSON.parse(exported);
	delete old.ballotQuestions;
	assert.equal(parseBundledStateSnapshot(source, JSON.stringify(old), "automatic").ballotQuestions, undefined);
});

test("Fulton accepted question imports survive cold restart and failed changes preserve exact cached bytes", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-fulton-questions-"));
	context.after(() => rm(directory, { recursive: true }));
	const now = Date.parse(timestamp) + 1000;
	const repository = createStateBallotRepository({ sources: [source], dataDirectory: directory, refreshReviewedLegacy: true, now: () => now, fetchText: async () => capture() });
	const imported = await repository.getSnapshot("GA");
	assert.equal(imported!.ballotQuestions!.length, 5);
	const path = join(directory, `${source.id}.json`);
	const before = await readFile(path, "utf8");
	assert.equal((await createStateBallotStorage(directory).read(source))!.ballotQuestions!.length, 5);
	let requests = 0;
	const cold = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => now, fetchText: async () => {
		requests++;
		throw new Error("No network for cached reads");
	} });
	assert.deepEqual((await cold.getSnapshot("GA"))!.ballotQuestions, imported!.ballotQuestions);
	assert.equal(requests, 0);
	const changed = createStateBallotRepository({ sources: [source], dataDirectory: directory, refreshReviewedLegacy: true, now: () => now + 86400000, fetchText: async () => capture(questionsText.replace("limited local tax", "changed local tax")) });
	assert.deepEqual((await changed.getSnapshot("GA"))!.ballotQuestions, imported!.ballotQuestions);
	assert.equal((await changed.inspectSources!())[0]!.status, "error");
	assert.equal(await readFile(path, "utf8"), before);
});

test("Fulton question records remain browsable independently of reviewed measure dossiers", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-fulton-question-routes-"));
	context.after(() => rm(directory, { recursive: true }));
	const parsed = parseFultonCandidateCapture(source, capture());
	await createStateBallotStorage(directory).write({ source, ...parsed });
	let requests = 0;
	const now = Date.parse(timestamp) + 1000;
	const repository = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => now, fetchText: async () => {
		requests++;
		throw new Error("Question browsing uses retained records.");
	} });
	const app = express();
	registerStateRecordRoutes(app, repository, undefined, () => now);
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	context.after(() => new Promise<void>((resolve) => {
		server.closeAllConnections();
		server.close(() => resolve());
	}));
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	const origin = `http://127.0.0.1:${address.port}`;
	const records = await (await fetch(`${origin}/api/state-records/GA?source=${source.id}`)).json();
	assert.equal(records.total, 2);
	assert.equal(records.questionCount, 5);
	const response = await fetch(`${origin}/api/state-records/GA/questions?source=${source.id}`);
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("cache-control"), "no-store");
	const payload = await response.json();
	assert.deepEqual(payload.questions, parsed.ballotQuestions);
	assert.equal(payload.source.documentLinks[0].url, source.documentUrls![0]);
	for (const question of parsed.ballotQuestions) {
		const detail = await (await fetch(`${origin}/api/state-records/GA/questions?source=${source.id}&id=${question.id}`)).json();
		assert.deepEqual(detail.questions, [question]);
		assert.equal(detail.questions[0].voterApplicabilityVerified, false);
		assert.equal(detail.measures, undefined);
	}
	assert.equal((await fetch(`${origin}/api/state-records/WA/questions?source=${source.id}`)).status, 400);
	assert.equal((await fetch(`${origin}/api/state-records/GA/questions?source=${source.id}&id=invalid`)).status, 400);
	assert.equal(requests, 0);
});
