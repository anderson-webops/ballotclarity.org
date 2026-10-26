import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { serializeStateBallotSnapshots } from "../src/state-ballot-export.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { loadBundledStateSnapshot, parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { buildStateRecordPage, parseStateRecordFilters } from "../src/state-records.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const now = Date.parse("2026-10-22T12:00:01Z");
const sourceFor = (stateCode: string) => stateBallotSources.find(source => source.stateCode === stateCode)!;
const typed = (districtType: string, districtCode: string) => ({ id: `${districtType}:${districtCode}`, districtType, districtCode, label: districtCode, sourceSystem: "Controlled typed geography fixture" });

function payload(stateCode: "WI" | "AZ") {
	const source = sourceFor(stateCode);
	const retrievedAt = "2026-10-21T19:14:04.711Z";
	const records = stateCode === "WI"
		? [
				{ name: "Governor Example / Deputy Example", office: "Governor / Lieutenant Governor", scope: "statewide", district: "", party: "Democratic", status: "listed" },
				{ name: "State Officer Example", office: "Secretary of State", scope: "statewide", district: "", party: "Wisconsin Green", status: "listed" },
				{ name: "Congress Example", office: "Representative in Congress", scope: "congressional", district: "2", status: "listed" },
				{ name: "Senator Example", office: "State Senator", scope: "state-senate", district: "27", status: "listed" },
				{ name: "House Example", office: "Representative to the Assembly", scope: "state-house", district: "81", status: "listed" },
				{ name: "County Example", office: "Sheriff", scope: "local", district: "", jurisdiction: "Dane County", status: "listed" },
			]
		: [
				{ name: "Governor Example / Deputy Example", office: "Governor & Lieutenant Governor", scope: "statewide", district: "", party: "DEM / PND", status: "listed" },
				{ name: "Justice Example", office: "Supreme Court - RETENTION: Justice Example", scope: "statewide", district: "", status: "listed", sourceStatus: "Judicial retention election" },
				{ name: "School Officer Example", office: "Superintendent of Public Instruction", scope: "statewide", district: "", party: "NOL", status: "write-in", sourceStatus: "Official write-in candidate" },
				{ name: "Congress Example", office: "U.S. Representative in Congress", scope: "congressional", district: "6", status: "listed" },
				{ name: "House Example", office: "State Representative", scope: "state-house", district: "19", status: "write-in" },
				{ name: "Regional Justice Example", office: "Appeals Division II - RETENTION: Regional Justice Example", scope: "local", district: "II", jurisdiction: "Arizona Court of Appeals Division II", status: "listed", sourceStatus: "Judicial retention election" },
				{ name: "Ordinary Judge Example", office: "Superior Court Division 1", scope: "local", district: "1", jurisdiction: "Yavapai County", status: "listed" },
				{ name: "Withdrawn Board Example", office: "Governing Board (4-year term)", scope: "local", district: "", jurisdiction: "Water District", status: "withdrawn", sourceStatus: "Officially withdrawn" },
			];
	const named = records.map(record => ({ ...record, id: hash(JSON.stringify([source.id, record])).slice(0, 24) }));
	const documents = source.documentUrls!.map((url, index) => ({ url, sha256: hash(`${stateCode}:${index}`), retrievedAt, includedRecordCount: stateCode === "WI" ? (index === 0 ? records.length : 0) : [3, 1, 2, 1, 1, 0][index] }));
	return { schemaVersion: 1, stateCode, sourceId: source.id, electionDate: source.electionDate, sourceUrl: source.pageUrl, retrievalPolicy: "manual-snapshot", retrievedAt, sourceSha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: named.length, records: named, documents };
}

for (const stateCode of ["WI", "AZ"] as const) {
	test(`${stateCode} reviewed recovery is external-only and refuses publisher requests or a bundled fallback`, async () => {
		const source = sourceFor(stateCode);
		assert.equal(source.retrievalPolicy, "manual-snapshot");
		assert.equal(source.snapshotStorage, "external");
		assert.equal(source.format, "reviewed-pdf");
		assert.equal(source.documentUrls?.length, stateCode === "WI" ? 4 : 6);
		assert.deepEqual(source.documentLinks?.map(link => link.url), source.documentUrls);
		await assert.rejects(loadBundledStateSnapshot(source), /No bundled/u);
		let requests = 0;
		const fetchText = async () => {
			requests += 1;
			throw new Error("No live source request permitted.");
		};
		assert.equal(await createStateBallotRepository({ sources: [source], dataDirectory: null, now: () => now, fetchText }).getSnapshot(stateCode), null);
		await assert.rejects(fetchStateBallotSourceText(source, fetchText), /manually supplied/u);
		assert.equal(requests, 0);
	});

	test(`${stateCode} preserves tickets, party labels, status and capture time across storage and restart`, async (context) => {
		const directory = await mkdtemp(join(tmpdir(), `ballot-${stateCode.toLowerCase()}-review-`));
		context.after(() => rm(directory, { recursive: true, force: true }));
		const snapshot = parseBundledStateSnapshot(sourceFor(stateCode), JSON.stringify(payload(stateCode)));
		await createStateBallotStorage(directory).write(snapshot);
		const restarted = await createStateBallotRepository({ dataDirectory: directory, now: () => now }).getSnapshot(stateCode);
		assert.deepEqual(restarted, snapshot);
		assert.equal(restarted!.records[0].name, "Governor Example / Deputy Example");
		assert.equal(restarted!.records[0].party, stateCode === "WI" ? "Democratic" : "DEM / PND");
		const exported = serializeStateBallotSnapshots([restarted!]).trim().split("\n").map(line => JSON.parse(line));
		assert.deepEqual(exported.slice(1).map(record => record.name), snapshot.records.map(record => record.name));
		assert.equal(exported[0].states[0].retrievedAt, snapshot.retrievedAt);
	});

	test(`${stateCode} keeps local and regional records out of personal previews without deleting their browsable facts`, () => {
		const snapshot = parseBundledStateSnapshot(sourceFor(stateCode), JSON.stringify(payload(stateCode)));
		const base = buildStateBallotPreview(snapshot, { districtMatches: [] })!;
		assert.equal(base.candidateCount, stateCode === "WI" ? 2 : 3);
		assert.ok(base.disclaimer.includes(snapshot.source.scopeNotice!));
		const matched = buildStateBallotPreview(snapshot, { districtMatches: stateCode === "WI" ? [typed("congressional", "2"), typed("state-senate", "27"), typed("state-house", "81")] : [typed("congressional", "6"), typed("state-house", "19"), typed("county", "1"), typed("state-house", "II")] })!;
		assert.equal(matched.candidateCount, 5);
		assert.ok(!matched.contests.some(contest => contest.candidates.some(candidate => /County Example|Regional Justice|Ordinary Judge|Withdrawn Board/u.test(candidate.name))));
		const local = buildStateRecordPage(snapshot, parseStateRecordFilters({ scope: "local", status: "all" }));
		assert.equal(local.matched, stateCode === "WI" ? 1 : 3);
		const activeLocal = buildStateRecordPage(snapshot, parseStateRecordFilters({ scope: "local" }));
		assert.equal(activeLocal.matched, stateCode === "WI" ? 1 : 2);
		if (stateCode === "AZ") {
			assert.equal(local.inactive, 1);
			assert.equal(base.contests.find(contest => contest.title.includes("RETENTION"))!.candidates.length, 1);
			assert.equal(snapshot.records.find(record => record.name === "Ordinary Judge Example")!.sourceStatus, undefined);
		}
	});

	test(`${stateCode} requires every ordered supporting document even when it contributes zero new records`, () => {
		const source = sourceFor(stateCode);
		const body = payload(stateCode);
		assert.equal(body.documents.at(-1)!.includedRecordCount, 0);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...body, documents: body.documents.slice(0, -1) })), /invalid document set/u);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...body, documents: body.documents.toReversed() })), /invalid provenance/u);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...body, electionDate: "2028-11-07" })), /does not match/u);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...body, sourceSha256: hash("Wrong source set") })), /captured provenance/u);
	});

	test(`${stateCode} rejects mismatched record counts, duplicate identities and private unexpected fields`, () => {
		const source = sourceFor(stateCode);
		const body = payload(stateCode);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...body, recordCount: body.recordCount - 1 })), /record count/u);
		const duplicated = { ...body, records: body.records.map((record, index) => index === 1 ? { ...record, id: body.records[0].id } : record) };
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(duplicated)), /duplicate identities/u);
		const privateField = { ...body, records: body.records.map((record, index) => index === 0 ? { ...record, homeAddress: "Synthetic field must not be accepted" } : record) };
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(privateField)), /invalid layout/u);
	});
}
