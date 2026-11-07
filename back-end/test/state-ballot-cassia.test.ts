import type { StateBallotSource } from "../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildCassiaBallotQuestions } from "../src/cassia-ballot-questions.js";
import { cassiaDiscoveryUrl, cassiaPolicyFingerprint, cassiaPolicyReceipts, fetchCassiaCandidateCapture, fetchCassiaCycleDiscovery, parseCassiaCandidateCapture, readCassiaCandidateDocuments, readCassiaDiscovery } from "../src/state-ballot-cassia.js";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources, legacyReviewedStateBallotSource } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const source = configuredStateBallotSources.find(item => item.id === "id-cassia-2026")!;
const legacy = stateBallotSources.find(item => item.id === source.id)!;
const instant = "2026-10-26T06:00:00.000Z";
const now = Date.parse("2026-10-26T07:00:00.000Z");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const footer = `<footer>Cassia County Idaho County Courthouse 1459 Overland Ave. Burley ID 83318 County Judicial Center 1559 Overland Ave Burley ID 83318 Resources Directory Home Accessibility <a href="https://www.cassia.gov/accessibility-statement/">Accessibility Statement</a> Staff Website staff.cassia.gov CAI Employee Portal portal.cassia.gov</footer>`;
const xml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
type PrintedLine = [number, number, string];
function page(entries: PrintedLine[]) {
	return `<page width="612" height="1008">${entries.map(([left, top, value]) => {
		let position = left;
		return value.split(" ").map((word) => {
			const start = position;
			position += word.length * 4 + 3;
			return `<word xMin="${start}" yMin="${top}" xMax="${position - 3}" yMax="${top + 11}">${xml(word)}</word>`;
		}).join("");
	}).join("")}</page>`;
}
function header(date: string): PrintedLine[] {
	return [[90, 67, "CASSIA COUNTY"], [266, 67, "STATE OF IDAHO"], [430, 67, `NOVEMBER ${Number(date.slice(-2))}, ${date.slice(0, 4)}`], [254, 95, "SAMPLE BALLOT"]];
}
function candidateDocument(date = source.electionDate) {
	return `<doc>${page([
		...header(date),
		[79.2, 150, "CANDIDATES FOR"],
		[70, 165, "UNITED STATES OFFICES"],
		[44, 195, "United States Senator"],
		[44, 210, "(Vote for One)"],
		[44, 235, "Federal Example (IND)"],
		[79.2, 270, "CANDIDATES FOR"],
		[70, 285, "STATE OFFICES"],
		[44, 315, "Governor"],
		[44, 330, "(Vote for One)"],
		[44, 350, "Nominee Example (REP)"],
		[44, 380, "Example-Name (CON)"],
		[44, 395, "(a person, formerly known as Previous"],
		[44, 420, "Name)"],
		[44, 450, "Lieutenant Governor"],
		[44, 465, "(Vote for One)"],
		[44, 485, "Runningmate Example (DEM)"],
		[260.64, 150, "CANDIDATES FOR"],
		[250, 165, "STATE OFFICES"],
		[230, 195, "Secretary of State"],
		[230, 210, "(Vote for One)"],
		[230, 235, "Secretary Example (LIB)"],
		[260.64, 280, "CANDIDATES FOR"],
		[250, 295, "LEGISLATIVE OFFICES"],
		[230, 325, "State Senator"],
		[230, 340, "District 27"],
		[230, 355, "(Vote for One)"],
		[230, 380, "Senator Example (REP)"],
		[230, 420, "State Representative"],
		[230, 435, "District 27"],
		[230, 450, "Seat A"],
		[230, 465, "(Vote for One)"],
		[230, 490, "House Alpha (REP)"],
		[230, 530, "State Representative"],
		[230, 545, "District 27"],
		[230, 560, "Seat B"],
		[230, 575, "(Vote for One)"],
		[230, 600, "House Beta (DEM)"],
		[441.96, 150, "CANDIDATES FOR"],
		[430, 165, "COUNTY OFFICES"],
		[410, 190, "County Commissioner"],
		[410, 205, "District 1"],
		[410, 220, "4 Year Term"],
		[410, 235, "(Vote for One)"],
		[410, 260, "Commissioner Alpha (REP)"],
		[410, 300, "County Commissioner"],
		[410, 315, "District 2"],
		[410, 330, "2 Year Term"],
		[410, 345, "(Vote for One)"],
		[410, 370, "Commissioner Beta (REP)"],
		[410, 410, "County Sheriff"],
		[410, 425, "(Vote for One)"],
		[410, 450, "Sheriff Example (NWP)"],
		[410, 490, "NONPARTISAN BALLOT"],
		[410, 510, "MAGISTRATE JUDGE"],
		[410, 535, "Shall Magistrate Judge Example of Cassia"],
		[410, 548, "County of the Fifth Judicial District be retained"],
		[410, 561, "in office?"],
		[410, 585, "Yes"],
		[410, 610, "No"],
	])}${questionPage()}</doc>`;
}
function questionPage(fire = false, date = source.electionDate) {
	const entries: PrintedLine[] = [[45, 45, "BALLOT MEASURES"], [45, 105, "House Joint Resolution 4"], [45, 120, "Question: Example official question."], [45, 145, "Yes"], [45, 160, "No"], [45, 210, "House Joint Resolution 6"], [45, 230, "Question: Another official question."], [45, 250, "Yes"], [45, 265, "No"], [230, 55, "PROPOSITION 1"], [230, 80, "Question: Example proposition."], [230, 100, "Yes"], [230, 115, "No"], [410, 55, "IDAHO ADVISORY QUESTION"], [410, 90, "Which option should be selected?"], [410, 110, "choose only one answer"], ...["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"].map((option, index): PrintedLine => [410, 140 + index * 20, `Option ${option}`]), [410, 950, "Typ:01 Seq:0001 Spl:01"]];
	if (fire) entries.push([410, 300, "EXAMPLE RURAL FIRE"], [410, 312, "PROTECTION DISTRICT"], [410, 350, "TEMPORARY OVERRIDE LEVY"], [410, 390, `to be voted on November ${Number(date.slice(-2))}, ${date.slice(0, 4)}.`], [410, 450, "IN FAVOR OF authorizing the"], [410, 461, "temporary override levy"], [410, 500, "AGAINST authorizing the"], [410, 511, "temporary override levy"], [45, 950, "118 Example 66"]);
	return page(entries);
}
function schoolDocument(date = source.electionDate) {
	return `<doc>${page([...header(date), [45, 150, "EXAMPLE JOINT SCHOOL DISTRICT NO. 381"], [45, 180, "SUPPLEMENTAL LEVY ELECTION"], [45, 235, `November ${Number(date.slice(-2))}, ${date.slice(0, 4)}`], [45, 280, "The Board of Trustees of Example Joint School District seeks authorization."], [45, 320, "QUESTION: Shall the Board of Trustees levy a supplemental levy?"], [45, 480, "IN FAVOR OF AUTHORIZING A SUPPLEMENTAL LEVY EXAMPLE"], [45, 510, "AGAINST AUTHORIZING A SUPPLEMENTAL LEVY EXAMPLE"]])}</doc>`;
}
function documentUrls(date = source.electionDate) {
	return legacy.documentUrls!.map(url => url.replace("/2026/", `/${date.slice(0, 4)}/`));
}
function discovery(date = source.electionDate, pending = false, urls = documentUrls(date)) {
	const labels = ["Cassia County General Election Sample Ballot.pdf", "Example School Sample Ballot.pdf", "Example Fire Sample Ballot.pdf"];
	const body = `<main><div class="fr-view"><h2>November ${Number(date.slice(-2))}, ${date.slice(0, 4)} General Election Sample Ballots</h2>${pending ? "<p>Sample ballots will be posted.</p>" : `<ul>${urls.map((url, index) => `<li><a href="${url}">${labels[index]}</a></li>`).join("")}</ul>`}<p><a href="https://elections.sos.idaho.gov/ElectionLink/ElectionLink/VoterSearch.aspx">Check voter record</a></p></div></main>${footer}`;
	return { schemaVersion: 1, type: "cassia-discovery", policies: cassiaPolicyReceipts, index: { url: cassiaDiscoveryUrl, body, sha256: hash(body), retrievedAt: instant } };
}
function capture(date = source.electionDate) {
	const bodies = [candidateDocument(date), schoolDocument(date), `<doc>${questionPage(true, date)}</doc>`];
	return { schemaVersion: 1, type: "cassia-candidate-capture", discovery: discovery(date), documents: documentUrls(date).map((url, index) => ({ url, text: bodies[index]!, sha256: hash(bodies[index]!), retrievedAt: instant })) };
}
function selected(date = source.electionDate): StateBallotSource {
	if (date === source.electionDate) return source;
	return stateBallotCycleSources(discoverStateBallotElectionCycles(JSON.stringify(discovery(date)), source.id, now), now)[0]!;
}
function parsed(date = source.electionDate) {
	return parseCassiaCandidateCapture(selected(date), JSON.stringify(capture(date)), now);
}
test("Cassia candidate columns preserve literal parties, separate House seats, terms, former names and named retention", () => {
	const result = parsed();
	assert.equal(result.records.length, 12);
	assert.equal(result.officeCount, 11);
	assert.equal(result.records.find(item => item.name === "Example-Name")!.ballotDesignation, "a person, formerly known as Previous Name");
	assert.equal(result.records.find(item => item.name === "Sheriff Example")!.party, "NWP");
	assert.deepEqual(result.records.filter(item => item.office.startsWith("State Representative")).map(item => item.office), ["State Representative District 27 Seat A", "State Representative District 27 Seat B"]);
	const judge = result.records.find(item => item.name === "Judge Example")!;
	assert.equal(judge.district, "5");
	assert.equal(judge.scope, "local");
	assert.equal(judge.party, undefined);
	assert.equal(result.records.find(item => item.name === "Commissioner Alpha")!.ballotDesignation, "4 Year Term");
	assert.ok(result.records.every(item => item.status === "listed" && !item.incumbent && !item.termYears && !item.seats));
	assert.ok(!result.records.some(item => ["Yes", "No", "Previous Name"].includes(item.name)));
	assert.deepEqual(parseStateCandidateRecords(source, JSON.stringify(capture())), result.records);
});
test("Cassia retains every supporting document and repeated question without turning six advisory choices into candidates", () => {
	const result = parsed();
	assert.deepEqual(result.documents.map(item => item.includedRecordCount), [12, 0, 0]);
	assert.equal(result.questions.length, 10);
	assert.equal(result.questions.filter(item => item.scope === "local").length, 2);
	assert.deepEqual(result.questions.filter(item => item.title === "Idaho advisory question").map(item => item.choices.length), [6, 6]);
	assert.equal(result.ballotQuestions.length, 6);
	assert.equal(result.ballotQuestions.find(item => item.explicitlyAdvisory)!.choices.length, 6);
	assert.deepEqual(result.ballotQuestions.map(item => item.sourceUrl), [documentUrls()[0], documentUrls()[0], documentUrls()[0], documentUrls()[0], documentUrls()[1], documentUrls()[2]]);
	assert.ok(result.ballotQuestions.every(item => item.voterApplicabilityVerified === false));
	assert.deepEqual(parseBundledStateSnapshot(source, serializeStoredStateSnapshot({ source, ...result }), "automatic").records, JSON.parse(JSON.stringify(result.records)));
});
test("Cassia stored questions retain complete text, precise sources and actual choice counts across restart", () => {
	const result = parsed();
	const snapshot = JSON.parse(serializeStoredStateSnapshot({ source, ...result }));
	assert.deepEqual(parseBundledStateSnapshot(source, JSON.stringify(snapshot), "automatic").ballotQuestions, result.ballotQuestions);
	for (const mutate of [
		(value: typeof snapshot) => { value.ballotQuestions[0].officialText += " Changed"; },
		(value: typeof snapshot) => { value.ballotQuestions[0].sourceUrl = documentUrls()[1]; },
		(value: typeof snapshot) => { value.ballotQuestions[0].sourceUrl = "https://example.test/ballot.pdf"; },
		(value: typeof snapshot) => { value.ballotQuestions[0].audience = "Cassia County"; },
		(value: typeof snapshot) => { value.ballotQuestions[0].voterApplicabilityVerified = true; },
		(value: typeof snapshot) => { value.ballotQuestions[0].pages = [0]; },
		(value: typeof snapshot) => { value.ballotQuestions[3].choices.pop(); },
		(value: typeof snapshot) => { value.ballotQuestions.push(value.ballotQuestions[0]); },
	]) {
		const changed = structuredClone(snapshot);
		mutate(changed);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(changed), "automatic"), /question requires review/u);
	}
	delete snapshot.ballotQuestions;
	assert.equal(parseBundledStateSnapshot(source, JSON.stringify(snapshot), "automatic").ballotQuestions, undefined);
});
test("Cassia repeated wording, changed choices and disappeared accepted questions require review", () => {
	const result = parsed();
	assert.deepEqual(buildCassiaBallotQuestions(source, result.questions, result.documents, result.ballotQuestions), result.ballotQuestions);
	for (const questions of [result.questions.filter(item => item.scope === "statewide"), result.questions.map(item => ({ ...item, officialText: `${item.officialText} Changed` })), result.questions.map(item => ({ ...item, choices: item.title === "Idaho advisory question" ? [...item.choices].reverse() : item.choices }))])
		assert.throws(() => buildCassiaBallotQuestions(source, questions, result.documents, result.ballotQuestions), /accepted question changed or disappeared/u);
	const repeated = structuredClone(result.questions);
	repeated[5]!.officialText += " Changed";
	assert.throws(() => buildCassiaBallotQuestions(source, repeated, result.documents), /contradictory repeated wording/u);
});
test("Cassia future candidate-only ballots import without creating questions while prior questions remain protected", () => {
	const date = "2030-11-05";
	const future = selected(date);
	const value = capture(date);
	value.discovery = discovery(date, false, documentUrls(date).slice(0, 1));
	value.documents = value.documents.slice(0, 1);
	const candidatePage = /<page\b[^>]*>[\s\S]*?<\/page>/u.exec(value.documents[0]!.text)![0];
	value.documents[0]!.text = `<doc>${candidatePage}</doc>`;
	value.documents[0]!.sha256 = hash(value.documents[0]!.text);
	const result = parseCassiaCandidateCapture(future, JSON.stringify(value), now);
	assert.equal(result.records.length, 12);
	assert.deepEqual(result.ballotQuestions, []);
	assert.deepEqual(parseBundledStateSnapshot(future, serializeStoredStateSnapshot({ source: future, ...result }), "automatic").ballotQuestions, []);
	assert.throws(() => parseCassiaCandidateCapture(future, JSON.stringify(value), now, parsed(date).ballotQuestions), /accepted question changed or disappeared/u);
});
test("Cassia discovery binds actual offered dates and links, explicit pending states, legal inventory and complete document sets", () => {
	assert.equal(cassiaPolicyFingerprint(footer, "legal-inventory"), cassiaPolicyReceipts[2].sha256);
	assert.equal(readCassiaDiscovery(JSON.stringify(discovery()), now).elections[0]!.cassiaDocuments.length, 3);
	assert.equal(readCassiaDiscovery(JSON.stringify(discovery("2030-11-05", true)), now).elections[0]!.cassiaDocuments.length, 0);
	for (const mutate of [
		(value: ReturnType<typeof discovery>) => { value.index.body += "<a href=\"/terms\">Website terms</a>"; },
		(value: ReturnType<typeof discovery>) => { value.index.body = value.index.body.replace("November 3, 2026", "November 4, 2026"); },
		(value: ReturnType<typeof discovery>) => { value.index.body = value.index.body.replace(documentUrls()[0]!, "https://example.test/ballot.pdf"); },
		(value: ReturnType<typeof discovery>) => { value.index.body = value.index.body.replace("Cassia County General Election Sample Ballot.pdf", "Other County General Election Sample Ballot.pdf"); },
		(value: ReturnType<typeof discovery>) => { value.index.body = value.index.body.replace(documentUrls()[1]!, documentUrls()[0]!); },
	]) {
		const value = discovery();
		mutate(value);
		value.index.sha256 = hash(value.index.body);
		assert.throws(() => readCassiaDiscovery(JSON.stringify(value), now), /requires review|invalid|duplicated/u);
	}
	const altered = discovery();
	altered.index.body += " ";
	assert.throws(() => readCassiaDiscovery(JSON.stringify(altered), now), /provenance/u);
});
test("Cassia future elections use offered links and preserve typed district isolation without guessed annual URLs", () => {
	const date = "2030-11-05";
	const future = selected(date);
	assert.equal(future.id, "id-cassia-general-2030-11-05");
	assert.equal(getStateBallotCycleFamily(source.id).discoveryUrl, cassiaDiscoveryUrl);
	const catalog = discoverStateBallotElectionCycles(JSON.stringify(discovery(date)), source.id, now);
	assert.equal(parseStateBallotCycleCatalog(catalog, now).elections[0]!.cassiaDocuments![0]!.url, documentUrls(date)[0]);
	assert.equal(parsed(date).records.length, 12);
	assert.equal(parsed(date).ballotQuestions.length, 6);
	assert.notEqual(parsed(date).ballotQuestions[0]!.id, parsed().ballotQuestions[0]!.id);
	assert.ok(parsed(date).ballotQuestions.every(item => item.sourceUrl!.includes("/2030/")));
	const preview = buildStateBallotPreview({ source: future, ...parsed(date) }, { districtMatches: [{ id: "county-16031", label: "Cassia County", districtType: "county", districtCode: "5", sourceSystem: "test" }] })!;
	assert.equal(preview.contests.some(item => item.title.includes("Magistrate")), false);
});
test("Cassia malformed geometry, unknown offices, wrong dates, altered retention and contradictory repeated questions fail closed", () => {
	for (const altered of [candidateDocument().replace("width=\"612\"", "width=\"800\""), candidateDocument().replace("Secretary", "Unrecognized"), candidateDocument().replace("NOVEMBER", "DECEMBER"), candidateDocument().replace("retained", "elected"), candidateDocument().replace("xMin=\"79.2\"", "xMin=\"150\""), candidateDocument().replace("(REP)", "(REPUBLICAN)")]) assert.throws(() => readCassiaCandidateDocuments(source, [altered]), /requires? review|validated office|contains no candidate rows/u);
	const value = capture();
	value.documents[2]!.text = value.documents[2]!.text.replace("Another", "Conflicting");
	assert.throws(() => parseCassiaCandidateCapture(source, JSON.stringify(value), now), /disagrees/u);
	const oversized = candidateDocument().replace("</page>", "<word xMin=\"30\" yMin=\"100\" xMax=\"100\" yMax=\"200\">NOTICE</word></page>");
	assert.throws(() => readCassiaCandidateDocuments(source, [oversized]), /oversized/u);
});
test("Cassia captures and stored snapshots reject clock, source, document and collection-index substitutions", () => {
	const result = parsed();
	for (const mutate of [
		(value: ReturnType<typeof capture>) => { value.documents.pop(); },
		(value: ReturnType<typeof capture>) => { value.documents[0]!.sha256 = "invalid"; },
		(value: ReturnType<typeof capture>) => { value.documents[0]!.retrievedAt = "2099-01-01T00:00:00.000Z"; },
		(value: ReturnType<typeof capture>) => { value.documents.reverse(); },
	]) {
		const value = capture();
		mutate(value);
		assert.throws(() => parseCassiaCandidateCapture(source, JSON.stringify(value), now));
	}
	const stored = JSON.parse(serializeStoredStateSnapshot({ source, ...result }));
	stored.collectionIndexSha256 = hash("wrong");
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(stored), "automatic"), /index/u);
	stored.collectionIndexSha256 = result.collectionIndexSha256;
	stored.documents[1].includedRecordCount = 1;
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(stored), "automatic"), /index/u);
});
test("Cassia denied or changed robots stop discovery before any index or PDF request", async () => {
	for (const status of [200, 403, 404]) {
		let requests = 0;
		await assert.rejects(fetchCassiaCycleDiscovery({ requestDocument: async () => {
			requests++;
			return { status, body: Buffer.from("User-agent: *\nDisallow: /"), contentType: "text/plain", etag: undefined };
		}, requestText: async () => { throw new Error("Unexpected page request"); }, sleep: async () => {} }), /policy requires review/u);
		assert.equal(requests, 1);
	}
});
test("Cassia bounded acquisition fetches each offered PDF once and never follows the voter-record portal", async () => {
	const value = capture();
	const requested: string[] = [];
	let extracted = 0;
	const body = await fetchCassiaCandidateCapture(source, { discovery: JSON.stringify(value.discovery), now: () => now, sleep: async (milliseconds) => {
		assert.equal(milliseconds, 11000);
	}, requestDocument: async (url, options) => {
		requested.push(url);
		assert.deepEqual(options.allowedHosts, ["www.cassia.gov"]);
		return { status: 200, body: Buffer.from("%PDF-synthetic"), contentType: "application/pdf", etag: undefined };
	}, extractor: async () => value.documents[extracted++]!.text });
	assert.deepEqual(requested, documentUrls());
	assert.equal(parseCassiaCandidateCapture(source, body, now).records.length, 12);
});
test("Cassia future pending imports become durable, stay cached and preserve their original capture time", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-cassia-future-"));
	const date = "2030-11-05";
	const future = selected(date);
	let requests = 0;
	try {
		const options = { familyId: source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: directory, now: () => now };
		const pending = await fetchCassiaCandidateCapture(future, { discovery: JSON.stringify(discovery(date, true)), now: () => now });
		assert.throws(() => parseCassiaCandidateCapture(future, pending, now), StateBallotAwaitingRecordsError);
		const first = await syncStateBallotCycles({ ...options, fetchDiscovery: async () => JSON.stringify(discovery(date, true)), fetchCandidates: async () => pending });
		assert.equal(first.results[0]!.status, "awaiting-records");
		const available = await syncStateBallotCycles({ ...options, fetchDiscovery: async () => JSON.stringify(discovery(date)), fetchCandidates: async () => {
			requests++;
			return JSON.stringify(capture(date));
		} });
		assert.equal(available.results[0]!.status, "available");
		assert.equal(available.results[0]!.records, 12);
		assert.equal(available.results[0]!.imported, true);
		const cached = await syncStateBallotCycles({ ...options, fetchDiscovery: async () => JSON.stringify(discovery(date)), fetchCandidates: async () => {
			throw new Error("Unexpected converter/network request");
		} });
		assert.equal(cached.results[0]!.retrievedAt, instant);
		assert.equal(cached.results[0]!.imported, false);
		assert.equal(requests, 1);
		const stored = await createStateBallotStorage(directory).read(future);
		assert.deepEqual(stored!.records, JSON.parse(JSON.stringify(parsed(date).records)));
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => JSON.stringify(discovery(date, true)) }), /disappeared/u);
	}
	finally { await rm(directory, { recursive: true }); }
});
test("Cassia keeps reviewed legacy reads offline and preserves a recoverable original when an approved worker imports", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-cassia-legacy-"));
	try {
		assert.deepEqual(legacyReviewedStateBallotSource(source), legacy);
		const { collectionIndexSha256, ballotQuestions, ...facts } = parsed();
		assert.ok(collectionIndexSha256);
		assert.equal(ballotQuestions.length, 6);
		const storage = createStateBallotStorage(directory);
		await storage.write({ source: legacy, ...facts });
		const originalFiles = await readdir(directory);
		const original = await readFile(join(directory, originalFiles[0]!));
		const reader = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => now, fetchText: async () => {
			throw new Error("Legacy read must not collect");
		} });
		assert.equal((await reader.getSnapshot("ID"))!.source.retrievalPolicy, "manual-snapshot");
		const options = { familyId: source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: directory, now: () => now, fetchDiscovery: async () => JSON.stringify(discovery()), fetchCandidates: async () => JSON.stringify(capture()) };
		const blockedBackup = join(directory, `${originalFiles[0]}.legacy-${hash(original.toString("utf8"))}`);
		await mkdir(blockedBackup);
		const failed = await syncStateBallotCycles(options);
		assert.equal(failed.results[0]!.status, "persistence-failed");
		assert.ok((await readFile(join(directory, originalFiles[0]!))).equals(original));
		await rm(blockedBackup, { recursive: true });
		const imported = await syncStateBallotCycles(options);
		assert.equal(imported.results[0]!.status, "available");
		assert.equal((await storage.read(source))!.source.retrievalPolicy, undefined);
		const backup = (await readdir(directory)).find(name => name.includes(".legacy-"));
		assert.ok(backup);
		assert.ok((await readFile(join(directory, backup))).equals(original));
	}
	finally { await rm(directory, { recursive: true }); }
});
test("Cassia changed offered links invalidate imports without editing the source configuration", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-cassia-links-"));
	try {
		const options = { familyId: source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: directory, now: () => now };
		await syncStateBallotCycles({ ...options, fetchDiscovery: async () => JSON.stringify(discovery()), fetchCandidates: async () => JSON.stringify(capture()) });
		const urls = documentUrls();
		urls[0] = urls[0]!.replace("Sample%20Ballot.pdf", "Revised%20Sample%20Ballot.pdf");
		const changed = capture();
		changed.discovery = discovery(source.electionDate, false, urls);
		changed.documents[0]!.url = urls[0]!;
		let requests = 0;
		const result = await syncStateBallotCycles({ ...options, fetchDiscovery: async () => JSON.stringify(changed.discovery), fetchCandidates: async () => {
			requests++;
			return JSON.stringify(changed);
		} });
		assert.equal(requests, 1);
		assert.equal(result.results[0]!.status, "available");
		assert.equal(result.results[0]!.imported, true);
		assert.deepEqual((await createStateBallotStorage(directory).read(source))!.records, JSON.parse(JSON.stringify(parsed().records)));
	}
	finally { await rm(directory, { recursive: true }); }
});
test("Cassia refreshes changed PDF contents at the same URL after expiry instead of freezing the first import", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-cassia-refresh-"));
	try {
		const options = { familyId: source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: directory };
		await syncStateBallotCycles({ ...options, now: () => now, fetchDiscovery: async () => JSON.stringify(discovery()), fetchCandidates: async () => JSON.stringify(capture()) });
		const later = now + 2 * 86400000;
		const changed = capture();
		changed.documents[0]!.text = changed.documents[0]!.text.replace(">Federal</word>", ">Revised</word>");
		changed.documents[0]!.sha256 = hash(changed.documents[0]!.text);
		for (const document of changed.documents) document.retrievedAt = new Date(later).toISOString();
		const result = await syncStateBallotCycles({ ...options, now: () => later, fetchDiscovery: async () => JSON.stringify(discovery()), fetchCandidates: async () => JSON.stringify(changed) });
		assert.equal(result.results[0]!.status, "available");
		assert.equal(result.results[0]!.imported, true);
		assert.equal(result.results[0]!.retrievedAt, new Date(later).toISOString());
		assert.ok((await createStateBallotStorage(directory).read(source))!.records.some(item => item.name === "Revised Example"));
	}
	finally { await rm(directory, { recursive: true }); }
});
test("Cassia rejects changed or disappeared accepted question text while retaining exact restartable snapshots", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-cassia-question-retention-"));
	try {
		const options = { familyId: source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: directory, now: () => now, fetchDiscovery: async () => JSON.stringify(discovery()), fetchCandidates: async () => JSON.stringify(capture()) };
		await syncStateBallotCycles(options);
		const storage = createStateBallotStorage(directory);
		const before = serializeStoredStateSnapshot((await storage.read(source))!);
		const changed = capture();
		changed.documents[1]!.text = changed.documents[1]!.text.replace(">supplemental</word>", ">different</word>");
		changed.documents[1]!.sha256 = hash(changed.documents[1]!.text);
		const result = await syncStateBallotCycles({ ...options, now: () => now + 2 * 86400000, fetchCandidates: async () => JSON.stringify(changed) });
		assert.equal(result.results[0]!.status, "unavailable");
		assert.equal(serializeStoredStateSnapshot((await createStateBallotStorage(directory).read(source))!), before);
	}
	finally { await rm(directory, { recursive: true }); }
});
