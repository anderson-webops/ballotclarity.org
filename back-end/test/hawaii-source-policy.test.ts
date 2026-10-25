import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

test("Hawaii's publisher hold prevents retrieval and does not reapprove an old automatic cache", async (context) => {
	const held = stateBallotSources.find(source => source.id === "hi-elections-2026")!;
	assert.equal(held.retrievalPolicy, "manual-snapshot");
	assert.equal(held.snapshotStorage, "external");
	let requests = 0;
	await assert.rejects(() => fetchStateBallotSourceText(held, async () => {
		requests++;
		throw new Error("Publisher access must remain held.");
	}), /manually supplied candidate snapshot/u);
	const directory = await mkdtemp(join(tmpdir(), "ballot-hawaii-hold-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const previous = { ...held };
	delete previous.retrievalPolicy;
	delete previous.snapshotStorage;
	const body = JSON.stringify({ page: "<select name=\"ctl00$cphFooter$ddlElection\"><option selected value=\"94\">2026 Candidate Report</option></select><input type=\"submit\" name=\"ctl00$cphFooter$rdgSearch$ctl00$ctl02$ctl00$ExportToCsvButton\"><p>1 items in 1 pages</p>", records: "Contests,Party,BallotName,Status,Website\n\"U.S. REPRESENTATIVE, DIST I\",Example,Example Candidate,In General," });
	const snapshot = { source: previous, retrievedAt: "2026-10-22T12:00:00.000Z", sha256: createHash("sha256").update(body).digest("hex"), records: parseStateCandidateRecords(previous, body) };
	const storage = createStateBallotStorage(directory);
	const repository = createStateBallotRepository({ sources: [held], dataDirectory: directory, fetchText: async () => {
		requests++;
		throw new Error("No automatic fallback.");
	} });
	assert.equal(await repository.getSnapshot("HI", held.id), null);
	await storage.write(snapshot);
	const filename = join(directory, `${held.id}.json`);
	const originalBytes = await readFile(filename);
	await assert.rejects(() => storage.read(held), /configured source/u);
	assert.throws(() => parseBundledStateSnapshot(held, serializeStoredStateSnapshot(snapshot), "automatic"), /configured source/u);
	assert.equal(await repository.getSnapshot("HI", held.id), null);
	assert.deepEqual(await readFile(filename), originalBytes);
	assert.equal(requests, 0);
});
