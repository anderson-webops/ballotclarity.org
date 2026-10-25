import type { TestContext } from "node:test";
import type { JudicialEvaluationSnapshot } from "../src/judicial-evaluations.js";
import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";
import { registerJudicialEvaluationRoutes } from "../src/judicial-evaluation-routes.js";
import { createJudicialEvaluationRepository, judicialEvaluationContentSha256, judicialEvaluationSources, parseJudicialEvaluationSnapshot } from "../src/judicial-evaluations.js";
import { createPublicRequestThrottle } from "../src/public-request-throttle.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";

const epoch = Date.parse("2026-10-23T12:00:00Z");
const capturedAt = "2026-10-22T16:00:00.000Z";
const source = judicialEvaluationSources[0];
function fixture() {
	const statuses = ["retain", "do-not-retain", "not-made"] as const;
	const records = statuses.map((recommendation, index) => ({ officialRecordId: index.toString(16).padStart(24, "0"), officialName: `Synthetic Judge ${index}`, officialOffice: "Synthetic court, Judicial retention", officialScope: "local" as const, officialSourceDistrictLabel: `Court ${index}`, councilDisplayName: `Synthetic ${index}`, courtLabel: `Synthetic court ${index}`, recommendation, performanceFinding: ({ "retain": "met-standards", "do-not-retain": "did-not-meet-standards", "not-made": "not-made" } as const)[recommendation], criteriaCited: recommendation === "do-not-retain" ? ["integrity"] : [], sourcePage: index + 2, councilVote: recommendation === "not-made" ? { yes: 2, no: 3, abstain: 2, unanimous: false } : { yes: null, no: null, abstain: null, unanimous: true } }));
	const roster: StateBallotSnapshot = { source: stateBallotSources.find(source => source.id === "ak-doe-2026")!, retrievedAt: capturedAt, sha256: "a".repeat(64), records: records.map(record => ({ id: record.officialRecordId, name: record.officialName, office: record.officialOffice, scope: record.officialScope, district: "", status: "qualified", sourceDistrictLabel: record.officialSourceDistrictLabel })) };
	const snapshot: JudicialEvaluationSnapshot = { schemaVersion: 1, type: "official-judicial-evaluations", sourceId: source.id, stateCode: source.stateCode, electionDate: source.electionDate, issuer: source.issuer, publicationDate: source.publicationDate, researchSha256: "b".repeat(64), roster: { sourceId: source.rosterSourceId, sha256: roster.sha256, retrievedAt: capturedAt, recordCount: records.length }, documents: source.documentUrls.map(url => ({ url, sha256: "c".repeat(64), capturedAt })), records, publicationReview: { status: "unreviewed", reviewer: null, reviewedAt: null, contentSha256: "" } };
	snapshot.publicationReview.contentSha256 = judicialEvaluationContentSha256(snapshot);
	return { snapshot, roster };
}
function approve(snapshot: JudicialEvaluationSnapshot) {
	snapshot.publicationReview = { status: "approved", reviewer: "Isolated test review", reviewedAt: new Date(epoch - 1000).toISOString(), contentSha256: judicialEvaluationContentSha256(snapshot) };
	return snapshot;
}
async function storage(context: TestContext, snapshot: JudicialEvaluationSnapshot) {
	const directory = await mkdtemp(join(tmpdir(), "judicial-evaluation-test-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const file = join(directory, `${source.id}.judicial-evaluations.json`);
	await writeFile(file, JSON.stringify(snapshot));
	return { directory, file, repository: createJudicialEvaluationRepository({ dataDirectory: directory, now: () => epoch }) };
}

test("judicial evaluations preserve three institutional states without inferring member-vote outcomes", () => {
	const { snapshot } = fixture();
	const parsed = parseJudicialEvaluationSnapshot(JSON.stringify(snapshot), epoch);
	assert.deepEqual(parsed.records.map(record => record.recommendation), ["retain", "do-not-retain", "not-made"]);
	assert.equal(parsed.records[2]!.councilVote.no, 3);
	assert.equal(parsed.records[2]!.performanceFinding, "not-made");
	assert.equal(parsed.records[0]!.councilVote.yes, null);
});

test("unreviewed, disabled, missing and expired evaluations never become public", async (context) => {
	const { snapshot, roster } = fixture();
	const input = await storage(context, snapshot);
	const recordId = roster.records[0]!.id;
	assert.equal(await input.repository.getEvaluation(roster, recordId), null);
	assert.equal(await createJudicialEvaluationRepository({ dataDirectory: null }).getEvaluation(roster, recordId), null);
	await rm(input.file);
	assert.equal(await input.repository.getEvaluation(roster, recordId), null);
	await writeFile(input.file, JSON.stringify(approve(snapshot)));
	assert.equal(await createJudicialEvaluationRepository({ dataDirectory: input.directory, now: () => Date.parse("2026-11-05T00:00:00Z") }).getEvaluation(roster, recordId), null);
});

test("approved detail joins require exact official IDs, roster bytes, clock, office and court", async (context) => {
	const { snapshot, roster } = fixture();
	const input = await storage(context, approve(snapshot));
	const record = roster.records[1]!;
	const result = await input.repository.getEvaluation(roster, record.id);
	assert.equal(result?.recommendation, "do-not-retain");
	assert.equal(result?.issuer, "Alaska Judicial Council");
	assert.equal(result?.source.url, `${source.documentUrls[1]}#page=3`);
	assert.equal(result?.source.capturedAt, capturedAt);
	assert.equal(result?.publicationDate, "2026-09-04");
	assert.equal("councilVote" in result!, false);
	assert.equal(await input.repository.getEvaluation(roster, "f".repeat(24)), null);
	for (const change of ["hash", "clock", "name", "office", "court", "scope", "count"] as const) {
		const changed = structuredClone(roster);
		if (change === "hash") changed.sha256 = "d".repeat(64);
		if (change === "clock") changed.retrievedAt = new Date(epoch - 1000).toISOString();
		if (change === "name") changed.records[0]!.name += " Changed";
		if (change === "office") changed.records[0]!.office += " Changed";
		if (change === "court") changed.records[0]!.sourceDistrictLabel += " Changed";
		if (change === "scope") changed.records[0]!.scope = "statewide";
		if (change === "count") changed.records.pop();
		await assert.rejects(input.repository.getEvaluation(changed, record.id), /official.*(?:roster|record)/iu, change);
	}
});

test("statewide judicial records use the existing canonical statewide scope", async (context) => {
	const { snapshot, roster } = fixture();
	snapshot.records[0]!.officialScope = "statewide";
	roster.records[0]!.scope = "statewide";
	const input = await storage(context, approve(snapshot));
	assert.equal((await input.repository.getEvaluation(roster, roster.records[0]!.id))?.recommendation, "retain");
});

test("source, document, identity, findings and review drift fail closed", () => {
	const { snapshot } = fixture();
	for (const change of ["source", "election", "issuer", "publication", "url", "capture", "duplicate", "finding", "page", "vote", "reviewer", "future-review", "stale-review", "unknown-field"] as const) {
		const changed = approve(structuredClone(snapshot));
		if (change === "source") changed.sourceId = "unknown";
		if (change === "election") changed.electionDate = "2028-11-07";
		if (change === "issuer") changed.issuer = "Candidate campaign";
		if (change === "publication") changed.publicationDate = "2026-09-05";
		if (change === "url") changed.documents[1]!.url = "https://example.org/not-reviewed.pdf";
		if (change === "capture") changed.documents[0]!.capturedAt = new Date(epoch + 1).toISOString();
		if (change === "duplicate") changed.records[1]!.officialRecordId = changed.records[0]!.officialRecordId;
		if (change === "finding") changed.records[2]!.performanceFinding = "did-not-meet-standards";
		if (change === "page") changed.records[0]!.sourcePage = 5;
		if (change === "vote") changed.records[0]!.councilVote.yes = -1;
		if (change === "reviewer") changed.publicationReview.reviewer = "";
		if (change === "future-review") changed.publicationReview.reviewedAt = new Date(epoch + 1).toISOString();
		if (change === "stale-review") changed.publicationReview.reviewedAt = "2026-09-01T00:00:00Z";
		if (change === "unknown-field") Object.assign(changed, { eligibilityVerified: true });
		changed.publicationReview.contentSha256 = judicialEvaluationContentSha256(changed);
		assert.throws(() => parseJudicialEvaluationSnapshot(JSON.stringify(changed), epoch), Error, change);
	}
	const modified = approve(structuredClone(snapshot));
	modified.records[0]!.courtLabel = "Changed after review";
	assert.throws(() => parseJudicialEvaluationSnapshot(JSON.stringify(modified), epoch), /exact content/u);
	assert.throws(() => parseJudicialEvaluationSnapshot(" ".repeat(1024 * 1024 + 1), epoch), /size limit/u);
});

test("evaluation storage rejects linked files and linked application directories", async (context) => {
	const { snapshot, roster } = fixture();
	const input = await storage(context, approve(snapshot));
	await rm(input.file);
	await writeFile(join(input.directory, "target.json"), JSON.stringify(snapshot));
	await symlink(join(input.directory, "target.json"), input.file);
	await assert.rejects(input.repository.getEvaluation(roster, roster.records[0]!.id));
	assert.throws(() => createJudicialEvaluationRepository({ dataDirectory: new URL("../data", import.meta.url).pathname }), /outside/u);
	const alias = join(input.directory, "application-alias");
	await symlink(new URL("../data", import.meta.url).pathname, alias);
	await assert.rejects(createJudicialEvaluationRepository({ dataDirectory: alias, now: () => epoch }).getEvaluation(roster, roster.records[0]!.id), /outside/u);
});

test("evaluation routes validate identities, preserve failures and enforce public throttling", async (context) => {
	const { snapshot, roster } = fixture();
	const input = await storage(context, approve(snapshot));
	const app = express();
	registerJudicialEvaluationRoutes(app, input.repository, {
		async getSnapshot() {
			return roster;
		}
	});
	const listener = app.listen(0, "127.0.0.1");
	await once(listener, "listening");
	context.after(async () => {
		listener.closeAllConnections();
		await new Promise<void>(accept => listener.close(() => accept()));
	});
	const address = listener.address();
	assert.ok(address && typeof address !== "string");
	const base = `http://127.0.0.1:${address.port}/api/judicial-evaluations/AK/${roster.records[2]!.id}`;
	const response = await fetch(`${base}?source=ak-doe-2026`);
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("cache-control"), "no-store");
	assert.equal((await response.json()).recommendation, "not-made");
	for (const query of ["", "?source[]=ak-doe-2026", "?source=../private", "?source=ak-doe-2026&extra=true"]) assert.equal((await fetch(base + query)).status, 400);
	assert.equal((await fetch(`${base}?source=another-source`)).status, 404);
	await writeFile(input.file, "{}");
	assert.equal((await fetch(`${base}?source=ak-doe-2026`)).status, 503);
	const throttled = express();
	registerJudicialEvaluationRoutes(throttled, null, null, createPublicRequestThrottle({ windowMs: 60_000, maxRequests: 1, maxBuckets: 10 }));
	const throttledListener = throttled.listen(0, "127.0.0.1");
	await once(throttledListener, "listening");
	context.after(async () => {
		throttledListener.closeAllConnections();
		await new Promise<void>(accept => throttledListener.close(() => accept()));
	});
	const throttledAddress = throttledListener.address();
	assert.ok(throttledAddress && typeof throttledAddress !== "string");
	const limited = `http://127.0.0.1:${throttledAddress.port}/api/judicial-evaluations/AK/${roster.records[0]!.id}?source=ak-doe-2026`;
	assert.equal((await fetch(limited)).status, 404);
	assert.equal((await fetch(limited)).status, 429);
});
