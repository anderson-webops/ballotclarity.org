import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { collectMagistrateCourt } from "../src/collect-magistrate-court.js";
import { magistrateCourtPublication, magistrateProfileRedirect, magistrateProfileUrl, parseMagistrateChief, parseMagistrateCourtRoster, prepareMagistrateCourtDirectory, validateMagistrateCourtSnapshot, verifyMagistrateCourtPolicy, verifyMagistrateCourtProfile } from "../src/magistrate-court-directory.js";
import { createMagistrateCourtRepository, importMagistrateCourt, readMagistrateCourtEnvelope, withMagistrateCourtLock } from "../src/magistrate-court-storage.js";
import { magistrateContent, magistrateDigest, magistrateFixture, magistrateTestTime } from "./helpers/magistrate-court.js";

async function directory(context: TestContext) {
	const folder = await mkdtemp(join(tmpdir(), "ballot-magistrate-"));
	context.after(() => rm(folder, { recursive: true, force: true }));
	return folder;
}

test("Magistrate Court captures source identities without divisions, election candidacy or private contact details", () => {
	const { capture, snapshot } = magistrateFixture();
	assert.equal(snapshot.judges.length, 3);
	assert.equal(snapshot.judges[0]!.role, "Chief Magistrate Judge");
	assert.deepEqual(Object.keys(snapshot.judges[1]!).sort(), ["name", "profileUrl", "role"]);
	assert.equal(snapshot.retrievedAt, new Date(magistrateTestTime).toISOString());
	assert.equal(snapshot.documents.length, 9);
	assert.equal(prepareMagistrateCourtDirectory(capture, magistrateTestTime).sourceSha256, snapshot.sourceSha256);
	assert(!JSON.stringify(snapshot).includes("serves on the court"));
	validateMagistrateCourtSnapshot(snapshot, magistrateTestTime);
});

test("Magistrate source cards and profile identity evidence remain exact, visible and publisher-linked", () => {
	const { roster, people } = magistrateFixture();
	assert.equal(parseMagistrateCourtRoster(roster).length, 2);
	for (const changed of [roster.replace("data-headertext=", "hidden data-headertext="), roster.replace("Judge Morgan Current</h3>", "Judge Different Person</h3>"), roster.replace("EID=32", "EID=31"), roster.replace("<h1>Judges</h1>", "<h1>Staff</h1>"), roster.replace("<h1>Judges</h1>", "<h1>Judges</h1><h3 data-headertext=\"Judge Extra Person\">Judge Extra Person</h3>")]) assert.throws(() => parseMagistrateCourtRoster(changed));
	const judge = { name: "Jordan Example, II", role: "Judge" as const, profileUrl: people[0]!.url };
	verifyMagistrateCourtProfile(magistrateContent("<h2>Jordan Example</h2><h3>Judges</h3><p>Judge Jordan Example II serves on the court.</p>"), judge);
	assert.throws(() => verifyMagistrateCourtProfile(magistrateContent("<h2>Jordan Example</h2><h3>Judges</h3><p>Judge Jordan Example III serves on the court.</p>"), judge));
	assert.throws(() => verifyMagistrateCourtProfile(magistrateContent("<h2>Another Person</h2><h3>Judges</h3>"), judge));
	assert.throws(() => verifyMagistrateCourtProfile(magistrateContent("<h2>Jordan Example II</h2><h3>Clerk staff</h3>"), judge));
});

test("Magistrate policies preserve the named-AI robots boundary and every substantive copyright condition", () => {
	const fixture = magistrateFixture();
	verifyMagistrateCourtPolicy(fixture.capture.documents[0]!.body, 0);
	verifyMagistrateCourtPolicy(fixture.capture.documents[1]!.body, 1);
	assert.throws(() => verifyMagistrateCourtPolicy(fixture.capture.documents[0]!.body.replace("Disallow: /admin", "Disallow: /"), 0));
	assert.throws(() => verifyMagistrateCourtPolicy(fixture.capture.documents[1]!.body.replace("All rights reserved.", "Automated access is prohibited."), 1));
	assert.throws(() => verifyMagistrateCourtPolicy(fixture.capture.documents[1]!.body.replace("</footer>", "<a href=\"/terms\">Terms of use</a></footer>"), 1));
	assert.throws(() => verifyMagistrateCourtPolicy(fixture.capture.documents[1]!.body.replaceAll("2026", "2030"), 1, magistrateTestTime));
});

test("Magistrate profile transport admits only exact offered identities and a single same-ID canonical redirect", () => {
	assert.equal(magistrateProfileRedirect("https://www.magistratefulton.org/directory.aspx?EID=52"), "/m/directory/employee?eid=52");
	for (const url of ["https://example.com/Directory.aspx?EID=52", "http://www.magistratefulton.org/Directory.aspx?EID=52", "https://www.magistratefulton.org/Directory.aspx?EID=52&other=1", "https://www.magistratefulton.org/Directory.aspx?EID=%35%32", "https://www.magistratefulton.org/Directory.aspx?EID=52#profile"]) assert.throws(() => magistrateProfileUrl(url));
	const changed = structuredClone(magistrateFixture().capture);
	changed.documents[5]!.location = "/m/directory/employee?eid=99";
	assert.throws(() => prepareMagistrateCourtDirectory(changed, magistrateTestTime));
	const second = structuredClone(magistrateFixture().capture);
	second.documents[6]!.status = 302;
	second.documents[6]!.location = "/m/directory/employee?eid=31";
	assert.throws(() => prepareMagistrateCourtDirectory(second, magistrateTestTime));
});

test("Magistrate future fixtures change people and notice year, not hardcoded officeholders or election dates", () => {
	const future = magistrateFixture("Jordan Successor", Date.parse("2028-09-01T00:00:00.000Z"));
	assert.equal(future.snapshot.judges[1]!.name, "Jordan Successor");
	assert.equal(future.snapshot.judges[1]!.role, "Judge");
	assert.equal(future.snapshot.judges[1]!.profileUrl, "https://www.magistratefulton.org/Directory.aspx?EID=31");
	assert(!("electionDate" in future.snapshot));
	assert.throws(() => parseMagistrateChief(future.capture.documents[2]!.body, future.capture.documents[4]!.body.replaceAll("Avery Future", "Other Person")));
});

test("Magistrate snapshot validation rejects missing evidence, altered identities, future clocks and fabricated fields", () => {
	for (const change of [
		(value: ReturnType<typeof magistrateFixture>["snapshot"]) => value.documents.pop(),
		(value: ReturnType<typeof magistrateFixture>["snapshot"]) => value.judges.push(value.judges[1]!),
		(value: ReturnType<typeof magistrateFixture>["snapshot"]) => {
			value.countyFips = "13001";
		},
		(value: ReturnType<typeof magistrateFixture>["snapshot"]) => {
			value.documents[0]!.capturedAt = "2030-01-01T00:00:00.000Z";
		}
	]) {
		const value = structuredClone(magistrateFixture().snapshot);
		change(value);
		assert.throws(() => validateMagistrateCourtSnapshot(value, magistrateTestTime));
	}
	const altered = structuredClone(magistrateFixture().capture);
	altered.documents[3]!.body += "changed";
	assert.throws(() => prepareMagistrateCourtDirectory(altered, magistrateTestTime));
	assert.throws(() => validateMagistrateCourtSnapshot({ ...magistrateFixture().snapshot, electionDate: "2026-11-03" }, magistrateTestTime));
});

test("Magistrate imports preserve source clocks, exact predecessor and cold-restart records independently of State Court", async (context) => {
	const folder = await directory(context);
	const fixture = magistrateFixture();
	await importMagistrateCourt(folder, fixture.snapshot, magistrateTestTime);
	const first = await readFile(join(folder, "ga-fulton-magistrate-court.json"));
	assert.deepEqual(await createMagistrateCourtRepository(folder)!.getSnapshot(), fixture.snapshot);
	const newer = magistrateFixture("Jordan Successor", magistrateTestTime + 7 * 3600000);
	await importMagistrateCourt(folder, newer.snapshot, magistrateTestTime + 7 * 3600000);
	assert.deepEqual(await readFile(join(folder, "ga-fulton-magistrate-court.previous.json")), first);
	await assert.rejects(() => importMagistrateCourt(folder, fixture.snapshot, magistrateTestTime + 8 * 3600000));
	assert.equal((await readMagistrateCourtEnvelope(folder, magistrateTestTime + 8 * 3600000)).envelope.snapshot.judges[1]!.name, "Jordan Successor");
	assert.equal(createMagistrateCourtRepository(""), null);
	assert.throws(() => createMagistrateCourtRepository("relative"));
	await withMagistrateCourtLock(folder, () => assert.rejects(() => importMagistrateCourt(folder, newer.snapshot, magistrateTestTime + 8 * 3600000)));
});

test("Magistrate storage refuses symlinks and configuration tampering rather than returning healthy empty records", async (context) => {
	const folder = await directory(context);
	const fixture = magistrateFixture();
	await importMagistrateCourt(folder, fixture.snapshot, magistrateTestTime);
	const path = join(folder, "ga-fulton-magistrate-court.json");
	const envelope = JSON.parse(await readFile(path, "utf8"));
	envelope.sourceConfigurationSha256 = magistrateDigest("different");
	await writeFile(path, JSON.stringify(envelope));
	await assert.rejects(() => createMagistrateCourtRepository(folder)!.getSnapshot(), /temporarily unavailable/u);
	await rm(path);
	await writeFile(join(folder, "target.json"), JSON.stringify(envelope));
	await symlink(join(folder, "target.json"), path);
	await assert.rejects(() => readMagistrateCourtEnvelope(folder, magistrateTestTime));
});

test("Magistrate recurring collection spaces requests, repeats without traffic and retains last-good data on source failure", async (context) => {
	const folder = await directory(context);
	let now = magistrateTestTime;
	const fixture = magistrateFixture();
	const requests: string[] = [];
	const pauses: number[] = [];
	const request = async (url: string) => {
		requests.push(url);
		const entry = fixture.capture.documents.find(entry => entry.url === url)!;
		assert(entry);
		return { status: entry.status, body: Buffer.from(entry.body), contentType: entry.status === 302 ? "" : url.endsWith("robots.txt") ? "text/plain" : "text/html", etag: undefined, ...(entry.location ? { location: entry.location } : {}) };
	};
	const options = { directory: folder, now: () => now, request, pause: async (milliseconds: number) => {
		pauses.push(milliseconds);
	} };
	const first = await collectMagistrateCourt(options);
	assert.equal(first.collected, true);
	assert.equal(first.publisherRequests, 9);
	assert.equal(pauses.length, 8);
	assert(pauses.every(value => value === 20000));
	const before = await readFile(join(folder, "ga-fulton-magistrate-court.json"));
	assert.equal((await collectMagistrateCourt(options)).publisherRequests, 0);
	assert.equal(requests.length, 9);
	assert.deepEqual(await readFile(join(folder, "ga-fulton-magistrate-court.json")), before);
	now += 7 * 3600000;
	await assert.rejects(() => collectMagistrateCourt({ ...options, request: async () => {
		throw new Error("Publisher outage.");
	} }));
	assert.deepEqual(await readFile(join(folder, "ga-fulton-magistrate-court.json")), before);
	await assert.rejects(() => collectMagistrateCourt(options), /next permitted retry/u);
	const inspection = await createMagistrateCourtRepository(folder)!.inspectSources();
	assert.equal(inspection[0]!.status, "error");
	assert.equal(inspection[0]!.records, 3);
});

test("Magistrate changed policy and cross-identity redirects stop collection before new source data is adopted", async (context) => {
	const folder = await directory(context);
	const fixture = magistrateFixture();
	const calls: string[] = [];
	await assert.rejects(() => collectMagistrateCourt({ directory: folder, now: () => magistrateTestTime, pause: async () => {}, request: async (url) => {
		calls.push(url);
		const entry = fixture.capture.documents.find(entry => entry.url === url)!;
		return { status: 200, body: Buffer.from(entry.body.replace("Disallow: /admin", "Disallow: /")), contentType: "text/plain", etag: undefined };
	} }));
	assert.deepEqual(calls, [magistrateCourtPublication.policies[0].url]);
});
