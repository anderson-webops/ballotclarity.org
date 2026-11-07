import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readFairbanksBallotCandidates } from "../src/fairbanks-ballot-candidates.js";
import { readFairbanksBallotQuestions, readFairbanksQuestionMetadata } from "../src/fairbanks-ballot-questions.js";
import { fairbanksSource, fetchFairbanksCandidateCapture, parseFairbanksCandidateCapture, readFairbanksCandidateCapture } from "../src/state-ballot-fairbanks.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { fairbanksSyntheticCandidateCapture } from "./fixtures/fairbanks-candidate-synthetic.js";

function fixture(year = 2026, redline = false) {
	const data = fairbanksSyntheticCandidateCapture(year);
	const line = (text: string, top: number) => `<line xmin="60" ymin="${top}" xmax="550" ymax="${top + 8}">${text}</line>`;
	const lines = (north = false, top = 100) => [north ? "CITY OF NORTH POLE" : "FAIRBANKS NORTH STAR BOROUGH", `PROPOSITION ${north ? "A" : "1"}`, "A CITIZENS’ INITIATIVE PROPOSITION ESTABLISHING LOCAL RULES", `Shall the ${north ? "City" : "Borough"} adopt the proposed ordinance for this municipal election?`, "A “YES” vote approves the proposed local ordinance.", "A “NO” vote retains the current local ordinance.", "YES", "NO"].map((text, index) => ({ text, top: top + index * 12 }));
	const borough = lines();
	let north = lines(true, 400);
	if (redline) {
		const text = north.map(item => item.text);
		text.splice(3, 0, "*UNDERLINED AND BOLD WORDS ARE ADDITIONS TO THE CHARTER", "*STRIKETHROUGHS ARE DELETIONS FROM THE CHARTER", "North Pole City Charter Section 10.1 REGULAR CITY ELECTIONS:", "The regular City elections shall follow the proposed charter changes.");
		north = text.map((text, index) => ({ text, top: 400 + index * 12 }));
	}
	const page = (items: ReturnType<typeof lines>, width: number, height: number) => `<page width="${width}" height="${height}">${items.map(item => line(item.text, item.top)).join("")}${line("END OF BALLOT", 700)}</page>`;
	data.documents[0]!.bbox = data.documents[0]!.bbox.replace("</doc>", `${page(borough, 612, 1008)}</doc>`);
	data.documents[0]!.geometry.pages.push({ ...data.documents[0]!.geometry.pages[0]!, page: 2 });
	data.documents[1]!.bbox = data.documents[1]!.bbox.replace("</doc>", `${page(borough, 792, 792)}</doc>`);
	const pages = data.documents[1]!.bbox.split("</page>");
	pages[3] = pages[3]!.replace(/<line xmin="350" ymin="700"[^>]*>END OF BALLOT<\/line>/u, north.map(item => line(item.text, item.top)).join("") + line("END OF BALLOT", 700));
	data.documents[1]!.bbox = pages.join("</page>");
	data.documents[1]!.geometry.pages.push({ ...data.documents[1]!.geometry.pages[0]!, page: 5 });
	data.capture.documents[0]!.text = `${data.capture.documents[0]!.text.split("\f")[0]}\f${borough.map(item => item.text).join("\n")}\nEND OF BALLOT\f`;
	data.capture.documents[1]!.text = `${data.capture.documents[1]!.text.split("\f").slice(0, 3).join("\f")}\f${north.map(item => item.text).join("\n")}\nEND OF BALLOT\f${borough.map(item => item.text).join("\n")}\nEND OF BALLOT\f`;
	data.native.documents = data.documents;
	data.native.prepared = readFairbanksBallotCandidates(data.capture, data.documents, data.now);
	data.body = JSON.stringify({ schemaVersion: 1, type: "fairbanks-candidate-capture", capture: data.capture, native: data.native });
	return data;
}

test("Fairbanks questions preserve paired native wording, official effects and distinct municipal audiences", () => {
	const data = fixture();
	const source = fairbanksSource();
	const questions = readFairbanksBallotQuestions(source, data.capture, data.documents);
	assert.equal(questions.length, 2);
	assert.equal(questions[0]!.audience, "City of North Pole");
	assert.deepEqual(questions[0]!.pages, [4]);
	assert.equal(questions[1]!.audience, "Fairbanks North Star Borough");
	assert.deepEqual(questions[1]!.pages, [5]);
	for (const question of questions) {
		assert.deepEqual(question.choices, ["Yes", "No"]);
		assert.equal(question.voterApplicabilityVerified, false);
		assert.equal(question.officialText.split("\n\n").length, 3);
		assert.ok(question.officialText.includes("A “YES” vote") && question.officialText.includes("A “NO” vote"));
	}
	const parsed = parseFairbanksCandidateCapture(source, data.body, createStateCandidateRecord, data.now);
	assert.deepEqual(parsed.ballotQuestions, questions);
	assert.equal(parsed.records.length, 5);
	assert.equal(buildStateBallotPreview({ source, ...parsed }, { districtMatches: [] }), null);
});

test("Fairbanks future questions use offered election identities without inferring results or dates", () => {
	const first = fixture();
	const next = fixture(2027);
	const source = fairbanksSource(next.electionDate);
	const current = readFairbanksBallotQuestions(source, next.capture, next.documents);
	const prior = readFairbanksBallotQuestions(fairbanksSource(), first.capture, first.documents);
	assert.equal(current.length, 2);
	assert.ok(current.every(question => !prior.some(old => old.id === question.id)));
	assert.equal(parseFairbanksCandidateCapture(source, next.body, createStateCandidateRecord, next.now).ballotQuestions?.length, 2);
});

test("Fairbanks marked-up charter context stays in the original document while the operative question and effects remain complete", () => {
	const data = fixture(2026, true);
	const question = readFairbanksBallotQuestions(fairbanksSource(), data.capture, data.documents)[0]!;
	assert.equal(question.audience, "City of North Pole");
	assert.ok(question.officialText.startsWith("Shall the City"));
	assert.ok(!question.officialText.includes("STRIKETHROUGHS") && !question.officialText.includes("proposed charter changes"));
	assert.ok(question.officialText.includes("A “YES” vote") && question.officialText.includes("A “NO” vote"));
	data.documents[1]!.bbox = data.documents[1]!.bbox.replace("*STRIKETHROUGHS ARE DELETIONS FROM THE CHARTER", "*UNKNOWN MARKUP");
	assert.throws(() => readFairbanksBallotQuestions(fairbanksSource(), data.capture, data.documents), /marked-up charter context/u);
});

test("Fairbanks future City of Fairbanks questions use their own printed municipal audience", () => {
	const data = fixture(2027);
	const lines = ["CITY OF FAIRBANKS", "PROPOSITION B", "A CITIZENS’ INITIATIVE PROPOSITION ESTABLISHING LOCAL RULES", "Shall the City of Fairbanks adopt the proposed municipal ordinance?", "A YES VOTE APPROVES THE PROPOSED CITY ORDINANCE.", "A NO VOTE RETAINS THE CURRENT CITY ORDINANCE.", "YES", "NO", "END OF BALLOT"];
	const xml = lines.map((text, index) => `<line xmin="60" ymin="${100 + index * 12}" xmax="550" ymax="${108 + index * 12}">${text}</line>`).join("");
	data.documents[1]!.bbox = data.documents[1]!.bbox.replace("</doc>", `<page width="792" height="792">${xml}</page></doc>`);
	data.capture.documents[1]!.text += `${lines.join("\n")}\f`;
	const questions = readFairbanksBallotQuestions(fairbanksSource(data.electionDate), data.capture, data.documents);
	assert.equal(questions.length, 3);
	assert.equal(questions[2]!.audience, "City of Fairbanks");
	assert.deepEqual(questions[2]!.pages, [6]);
});

test("Fairbanks questions hold contradictory ballot-page and question jurisdictions", () => {
	const data = fixture();
	data.documents[1]!.bbox = data.documents[1]!.bbox.replace("ymin=\"400\" xmax=\"550\" ymax=\"408\">CITY OF NORTH POLE", "ymin=\"400\" xmax=\"550\" ymax=\"408\">CITY OF FAIRBANKS");
	data.capture.documents[1]!.text = data.capture.documents[1]!.text.replace("CITY OF NORTH POLE\nPROPOSITION", "CITY OF FAIRBANKS\nPROPOSITION");
	assert.throws(() => readFairbanksBallotQuestions(fairbanksSource(), data.capture, data.documents), /consistent page and question jurisdiction/u);
});

test("Fairbanks first collection holds an unclassified primary sample page even when both extracts omit proposition markers", () => {
	const data = fairbanksSyntheticCandidateCapture();
	data.documents[0]!.bbox = data.documents[0]!.bbox.replace("</doc>", "<page width=\"612\" height=\"1008\"><line xmin=\"60\" ymin=\"100\" xmax=\"550\" ymax=\"108\">Unknown ballot layout</line></page></doc>");
	data.capture.documents[0]!.text += "Unknown ballot layout\f";
	assert.throws(() => readFairbanksBallotQuestions(fairbanksSource(), data.capture, data.documents), /unclassified primary sample page/u);
});

for (const kind of ["missing-marker", "unknown-marker", "duplicate-marker", "scope", "wording", "effect", "choice", "paired-title", "native-bounds", "unassigned-text"]) {
	test(`Fairbanks question capture holds ${kind} changes`, () => {
		const data = fixture();
		const document = data.documents[0]!;
		if (kind === "missing-marker") document.bbox = document.bbox.replace("PROPOSITION 1", "PROPOSITION");
		if (kind === "unknown-marker") document.bbox = document.bbox.replace("PROPOSITION 1", "PROPOSITION 0");
		if (kind === "duplicate-marker") document.bbox = document.bbox.replace("PROPOSITION 1", "PROPOSITION 1</line><line xmin=\"60\" ymin=\"113\" xmax=\"550\" ymax=\"121\">PROPOSITION 1");
		if (kind === "scope") document.bbox = document.bbox.replace("FAIRBANKS NORTH STAR BOROUGH</line><line xmin=\"60\"", "CITY OF NORTH POLE</line><line xmin=\"60\"");
		if (kind === "wording") document.bbox = document.bbox.replace("adopt the proposed ordinance", "reject the proposed ordinance");
		if (kind === "effect") document.bbox = document.bbox.replace("A “NO” vote retains", "A “YES” vote retains");
		if (kind === "choice") document.bbox = document.bbox.replace(">NO</line>", ">MAYBE</line>");
		if (kind === "paired-title") {
			document.bbox = document.bbox.replace("ESTABLISHING LOCAL RULES", "REPEALING LOCAL RULES");
			data.capture.documents[0]!.text = data.capture.documents[0]!.text.replace("ESTABLISHING LOCAL RULES", "REPEALING LOCAL RULES");
		}
		if (kind === "native-bounds") document.bbox = document.bbox.replace("xmin=\"60\"", "xmin=\"-1\"");
		if (kind === "unassigned-text") document.bbox = document.bbox.replace("A “NO” vote retains the current local ordinance.", "A “NO” vote retains the current local ordinance. SAMPLE BALLOT");
		assert.throws(() => readFairbanksBallotQuestions(fairbanksSource(), data.capture, data.documents), /review/u);
	});
}

test("Fairbanks stored questions preserve legacy snapshots and reject tampered identities and applicability", () => {
	const data = fixture();
	const source = fairbanksSource();
	const parsed = parseFairbanksCandidateCapture(source, data.body, createStateCandidateRecord, data.now);
	const stored = serializeStoredStateSnapshot({ source, ...parsed });
	assert.deepEqual(parseBundledStateSnapshot(source, stored, "automatic").ballotQuestions, parsed.ballotQuestions);
	const legacy = JSON.parse(stored);
	delete legacy.ballotQuestions;
	assert.equal(parseBundledStateSnapshot(source, JSON.stringify(legacy), "automatic").ballotQuestions, undefined);
	for (const kind of ["id", "audience", "text", "page", "choices", "duplicate", "applicability", "extra", "clock"]) {
		const value = JSON.parse(stored);
		const question = value.ballotQuestions[0];
		if (kind === "id") question.id = "a".repeat(24);
		if (kind === "audience") question.audience = "Alaska";
		if (kind === "text") question.officialText += " Changed";
		if (kind === "page") question.pages = [0];
		if (kind === "choices") question.choices.reverse();
		if (kind === "duplicate") value.ballotQuestions.push(question);
		if (kind === "applicability") question.voterApplicabilityVerified = true;
		if (kind === "extra") question.result = "passed";
		if (kind === "clock") value.sourceAsOfDate = "2026-11-07";
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(value), "automatic"), /review/u);
	}
	assert.throws(() => readFairbanksQuestionMetadata({ ...source, stateCode: "GA" }, JSON.parse(stored)), /review/u);
});

test("Fairbanks changed or disappearing questions retain the accepted snapshot and capture across restart", async () => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "ballot-fairbanks-questions-")));
	try {
		const data = fixture(2027);
		const source = fairbanksSource(data.electionDate);
		const parsed = parseFairbanksCandidateCapture(source, data.body, createStateCandidateRecord, data.now);
		await createStateBallotStorage(directory).write({ source, ...parsed });
		const scratch = join(directory, "evidence");
		await mkdir(scratch);
		const body = await fetchFairbanksCandidateCapture(source, { scratchDirectory: scratch, discovery: JSON.stringify(data.capture), now: () => data.now, prepare: async () => data.native });
		const changed = structuredClone(data);
		for (const document of changed.documents) document.bbox = document.bbox.replaceAll("ESTABLISHING LOCAL RULES", "REPEALING LOCAL RULES");
		for (const [index, document] of changed.capture.documents.entries()) {
			document.text = document.text.replaceAll("ESTABLISHING LOCAL RULES", "REPEALING LOCAL RULES");
			const bytes = Buffer.concat([Buffer.from(document.body, "base64"), Buffer.from("\nSynthetic revised question publication")]);
			document.body = bytes.toString("base64");
			document.sha256 = createHash("sha256").update(bytes).digest("hex");
			changed.documents[index]!.sourceSha256 = document.sha256;
		}
		changed.native.prepared = readFairbanksBallotCandidates(changed.capture, changed.documents, changed.now);
		changed.body = JSON.stringify({ schemaVersion: 1, type: "fairbanks-candidate-capture", capture: changed.capture, native: { ...changed.native, documents: changed.documents } });
		assert.equal(readFairbanksCandidateCapture(changed.body, data.now).ballotQuestions.length, 2);
		assert.throws(() => parseFairbanksCandidateCapture(source, changed.body, createStateCandidateRecord, data.now, { records: parsed.records, ballotQuestions: parsed.ballotQuestions }), /question changed or disappeared/u);
		await assert.rejects(fetchFairbanksCandidateCapture(source, { scratchDirectory: scratch, discovery: JSON.stringify(changed.capture), now: () => data.now, prepare: async () => ({ ...changed.native, documents: changed.documents }) }), /question changed or disappeared/u);
		assert.equal(await readFile(join(scratch, "fairbanks-last-capture.json"), "utf8"), body);
		const restarted = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => data.now + 5000, ttlMs: 1, refreshReviewedLegacy: true, fetchText: async () => changed.body });
		assert.deepEqual((await restarted.getSnapshot("AK", source.id))?.ballotQuestions, parsed.ballotQuestions);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Fairbanks explicit refresh adds native questions to a legacy snapshot without changing original capture clocks", async () => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "ballot-fairbanks-upgrade-")));
	try {
		const data = fixture(2027);
		const source = fairbanksSource(data.electionDate);
		const parsed = parseFairbanksCandidateCapture(source, data.body, createStateCandidateRecord, data.now);
		const legacy = { source, ...parsed, ballotQuestions: undefined };
		await createStateBallotStorage(directory).write(legacy);
		let requests = 0;
		const repository = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => data.now + 5000, ttlMs: 1, refreshReviewedLegacy: true, fetchText: async () => {
			requests++;
			return data.body;
		} });
		const upgraded = await repository.getSnapshot("AK", source.id);
		assert.equal(upgraded?.ballotQuestions?.length, 2);
		assert.equal(upgraded?.retrievedAt, legacy.retrievedAt);
		assert.equal(upgraded?.sha256, legacy.sha256);
		assert.equal(requests, 1);
		const restarted = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => data.now + 10000, fetchText: async () => {
			throw new Error("Stored public read must remain offline");
		} });
		assert.deepEqual((await restarted.getSnapshot("AK", source.id))?.ballotQuestions, parsed.ballotQuestions);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
