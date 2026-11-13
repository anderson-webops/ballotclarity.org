import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { acquireStateBallotAutomationLock } from "../src/state-ballot-automation-lock.js";
import { parseFultonBallotQuestions } from "../src/state-ballot-fulton-questions.js";
import { importNativeStateBallotSnapshot } from "../src/state-ballot-native-import.js";
import { configuredStateBallotSources, legacyReviewedStateBallotSource } from "../src/state-ballot-registry.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const epoch = Date.parse("2026-10-27T23:00:00Z");
const source = configuredStateBallotSources.find(source => source.id === "nc-sbe-2026")!;
const snapshot: StateBallotSnapshot = { source, retrievedAt: new Date(epoch).toISOString(), sha256: "a".repeat(64), records: [{ id: "a".repeat(24), name: "Example Candidate", office: "US Senate", district: "", scope: "statewide", status: "listed" }] };

test("native imports retain exact data and capture clocks across repeated imports and cold reads", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-native-import-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const body = serializeStoredStateSnapshot(snapshot);
	assert.deepEqual(await importNativeStateBallotSnapshot(source, body, directory, epoch), snapshot);
	const before = await readFile(join(directory, `${source.id}.json`));
	await importNativeStateBallotSnapshot(source, body, directory, epoch + 1);
	assert.ok((await readFile(join(directory, `${source.id}.json`))).equals(before));
	assert.deepEqual(await createStateBallotStorage(directory).read(source), snapshot);
});

test("native import rejects manual holds, wrong source data and future clocks without replacing accepted bytes", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-native-reject-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	await importNativeStateBallotSnapshot(source, serializeStoredStateSnapshot(snapshot), directory, epoch);
	const before = await readFile(join(directory, `${source.id}.json`));
	await assert.rejects(importNativeStateBallotSnapshot({ ...source, retrievalPolicy: "manual-snapshot" }, serializeStoredStateSnapshot(snapshot), directory, epoch), /automatic source/u);
	await assert.rejects(importNativeStateBallotSnapshot(source, serializeStoredStateSnapshot({ ...snapshot, retrievedAt: new Date(epoch + 1).toISOString() }), directory, epoch), /future capture/u);
	await assert.rejects(importNativeStateBallotSnapshot(source, JSON.stringify({ ...JSON.parse(serializeStoredStateSnapshot(snapshot)), sourceId: "different-source" }), directory, epoch));
	assert.ok((await readFile(join(directory, `${source.id}.json`))).equals(before));
});

test("native import preserves newer captures and missing accepted candidates for review", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-native-continuity-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	await importNativeStateBallotSnapshot(source, serializeStoredStateSnapshot(snapshot), directory, epoch);
	const before = await readFile(join(directory, `${source.id}.json`));
	await assert.rejects(importNativeStateBallotSnapshot(source, serializeStoredStateSnapshot({ ...snapshot, retrievedAt: new Date(epoch - 1).toISOString() }), directory, epoch), /older native capture/u);
	await assert.rejects(importNativeStateBallotSnapshot(source, serializeStoredStateSnapshot({ ...snapshot, records: [{ ...snapshot.records[0]!, id: "b".repeat(24), name: "Other Candidate" }] }), directory, epoch), /candidate disappeared/u);
	assert.ok((await readFile(join(directory, `${source.id}.json`))).equals(before));
});

test("native import excludes an active recurring worker and preserves its current data", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-native-lock-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	await importNativeStateBallotSnapshot(source, serializeStoredStateSnapshot(snapshot), directory, epoch);
	const before = await readFile(join(directory, `${source.id}.json`));
	const lock = await acquireStateBallotAutomationLock(directory);
	try {
		await assert.rejects(importNativeStateBallotSnapshot(source, serializeStoredStateSnapshot(snapshot), directory, epoch), /already running/u);
	}
	finally { await lock.release(); }
	assert.ok((await readFile(join(directory, `${source.id}.json`))).equals(before));
});

test("Fulton native upgrade retains its exact reviewed envelope and holds changed or missing questions", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-native-fulton-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const currentSource = configuredStateBallotSources.find(source => source.id === "ga-fulton-2026")!;
	const previous: StateBallotSnapshot = { ...snapshot, source: legacyReviewedStateBallotSource(currentSource)!, documents: currentSource.documentUrls!.map((url, index) => ({ url, sha256: "b".repeat(64), retrievedAt: snapshot.retrievedAt, includedRecordCount: index === 0 ? 1 : 0 })) };
	previous.sha256 = createHash("sha256").update(JSON.stringify(previous.documents!.map(({ url, sha256 }) => ({ url, sha256 })))).digest("hex");
	const storage = createStateBallotStorage(directory);
	await storage.write(previous);
	const before = await readFile(join(directory, `${currentSource.id}.json`));
	const questions = parseFultonBallotQuestions(currentSource, `Synthetic question heading\nYes or No\n${" ".repeat(60)}Shall this proposed question be adopted?\f`);
	const current = { ...previous, source: currentSource, ballotQuestions: questions };
	await importNativeStateBallotSnapshot(currentSource, serializeStoredStateSnapshot(current), directory, epoch);
	assert.ok((await readFile(join(directory, `${currentSource.id}.json.legacy-${createHash("sha256").update(before).digest("hex")}`))).equals(before));
	const accepted = await readFile(join(directory, `${currentSource.id}.json`));
	for (const ballotQuestions of [undefined, parseFultonBallotQuestions(currentSource, `Different question heading\nYes or No\n${" ".repeat(60)}Shall this proposed question be adopted?\f`)])
		await assert.rejects(importNativeStateBallotSnapshot(currentSource, serializeStoredStateSnapshot({ ...current, ballotQuestions }), directory, epoch), /question changed or disappeared/u);
	assert.ok((await readFile(join(directory, `${currentSource.id}.json`))).equals(accepted));
});

test("native management imports only an explicitly selected enabled automatic source", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-native-cli-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const file = join(directory, "native.json");
	const manager = fileURLToPath(new URL("../src/manage-state-ballot-data.ts", import.meta.url));
	await writeFile(file, serializeStoredStateSnapshot(snapshot));
	const env = { ...process.env, STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "NC", STATE_BALLOT_ENABLED_SOURCES: source.id };
	const success = spawnSync(process.execPath, ["--import", "tsx", manager, "import-native", source.id, file], { env, encoding: "utf8" });
	assert.equal(success.status, 0, success.stderr);
	assert.equal(JSON.parse(success.stdout).records, 1);
	for (const arguments_ of [["other-source", file], [source.id], [source.id, file, "extra"]]) {
		const refused = spawnSync(process.execPath, ["--import", "tsx", manager, "import-native", ...arguments_], { env, encoding: "utf8" });
		assert.equal(refused.status, 1);
		assert.match(refused.stderr, /ENABLED_AUTOMATIC_SOURCE/u);
	}
});
