import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fetchAlabamaCycleDiscovery, readAlabamaDiscovery } from "../src/state-ballot-alabama-collection.js";
import { alabamaDiscoveryUrl, alabamaGeneralElection, prepareAlabamaReferences } from "../src/state-ballot-alabama-discovery.js";
import { alabamaHash } from "../src/state-ballot-alabama-types.js";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { alabamaCaptureFixture } from "./helpers/alabama-collection-fixture.js";

const now = Date.parse("2026-11-02T12:00:00.000Z");
function pendingCapture(resources = false) {
	const capture = alabamaCaptureFixture(2028, 7);
	capture.documents = capture.documents.filter(item => !item.url.includes("general-election-sample-ballots"));
	const annual = capture.documents.find(item => item.url.endsWith("/2028"))!;
	annual.body = `<main><h1>2028 Election Information</h1>${resources ? "<h2>General Election – November 7, 2028</h2>" : "<h2>Primary Election</h2>"}</main>`;
	annual.sha256 = alabamaHash(annual.body);
	return capture;
}

test("Alabama offered annual pages can wait without inferred dates, candidates or sample URLs", () => {
	const capture = pendingCapture();
	const prepared = prepareAlabamaReferences(capture, now);
	assert.deepEqual(prepared.elections, []);
	assert.deepEqual(prepared.pendingPublications, [{ status: "pending", year: "2028", pageUrl: `${alabamaDiscoveryUrl}/2028`, reason: "general-election-not-published" }]);
	assert.equal(prepared.candidateQualificationInferred, false);
	const catalog = discoverStateBallotElectionCycles(JSON.stringify(capture), "al-sos-2026", now);
	assert.deepEqual(catalog.elections, []);
	assert.deepEqual(stateBallotCycleSources(catalog, now), []);
});

test("Alabama an explicit future date can wait for ballot publications", () => {
	const capture = pendingCapture(true);
	const prepared = prepareAlabamaReferences(capture, now);
	assert.deepEqual(prepared.elections, []);
	assert.equal(prepared.pendingPublications?.[0].reason, "ballot-resources-not-published");
	assert.throws(() => alabamaGeneralElection(capture.documents[2].body, "2028"), /sample-ballot/u);
});

test("Alabama incomplete publication controls remain pending until their full inventory is offered", () => {
	const body = `<main><h2>General Election – November 7, 2028</h2><a href="/alabama-votes/2028-general-election-sample-ballots">Sample Ballots</a><a href="/sites/default/files/election-2028/dem.pdf">State Certification of Democratic Party Candidates</a></main>`;
	assert.equal("status" in alabamaGeneralElection(body, "2028", now), true);
	assert.throws(() => alabamaGeneralElection(body, "2028"), /inventory/u);
});

test("Alabama malformed, duplicate or cross-year links never become pending", () => {
	const body = `<main><h2>General Election – November 7, 2028</h2><a href="/alabama-votes/2028-general-election-sample-ballots">Sample Ballots</a><a href="/sites/default/files/election-2028/dem.pdf">State Certification of Democratic Party Candidates</a></main>`;
	for (const changed of [body.replace("/alabama-votes/2028-", "/alabama-votes/2030-"), body.replace("election-2028", "election-2030"), body.replace("Democratic Party Candidates", "Unreviewed Candidates"), body.replace("</main>", "<a href=\"/sites/default/files/election-2028/other.pdf\">State Certification of Democratic Party Candidates</a></main>"), body.replace("November 7", "November 6")]) assert.throws(() => alabamaGeneralElection(changed, "2028", now));
});

test("Alabama missing content is not a pending state for an unknown or ambiguous annual page", () => {
	for (const body of ["<main>Unavailable</main>", "<main><h1>2028 Election Information</h1><p>General Election November 7, 2028</p></main>", "<main><h1>2030 Election Information</h1></main>", "<main><h1>2028 Election Information</h1><h1>2028 Election Information</h1></main>", "<main><h1>2028 Election Information</h1><h2>General Election November 7, 2028</h2></main>"]) assert.throws(() => alabamaGeneralElection(body, "2028", now));
});

test("Alabama pending publications expire rather than hiding missing election-day resources", () => {
	const annual = "<main><h1>2028 Election Information</h1></main>";
	const resources = "<main><h2>General Election – November 7, 2028</h2></main>";
	for (const date of ["2028-11-07T00:00:00Z", "2028-11-08T00:00:00Z", "2030-01-01T00:00:00Z"]) {
		for (const body of [annual, resources]) assert.throws(() => alabamaGeneralElection(body, "2028", Date.parse(date)));
	}
	assert.throws(() => alabamaGeneralElection(annual, "2028", Number.NaN));
});

test("Alabama a pending future cycle does not block ready current county sources", () => {
	const current = alabamaCaptureFixture();
	const future = pendingCapture();
	const index = current.documents.find(item => item.url === alabamaDiscoveryUrl)!;
	index.body = index.body.replace("</main>", `<a href="${alabamaDiscoveryUrl}/2028">2028</a></main>`);
	index.sha256 = alabamaHash(index.body);
	current.documents.push(future.documents[2]);
	const prepared = prepareAlabamaReferences(current, now);
	assert.equal(prepared.elections.length, 1);
	assert.equal(prepared.elections[0].countyBallots.length, 3);
	assert.equal(prepared.pendingPublications?.length, 1);
	assert.equal(stateBallotCycleSources(discoverStateBallotElectionCycles(JSON.stringify(current), "al-sos-2026", now), now).length, 3);
});

test("Alabama unpublished cycles are discovered without speculative sample requests", async () => {
	const capture = pendingCapture();
	const urls: string[] = [];
	let instant = now;
	const body = await fetchAlabamaCycleDiscovery({ now: () => instant, sleep: async (milliseconds) => {
		instant += milliseconds;
	}, request: async (url) => {
		urls.push(url);
		const item = capture.documents.find(item => item.url === url);
		assert(item);
		return { status: 200, contentType: "text/html", body: Buffer.from(item.body), etag: undefined };
	} });
	assert.equal(urls.length, 3);
	assert.equal(readAlabamaDiscovery(body, instant).pendingPublications?.length, 1);
});

test("Alabama pending synchronization reports an explicit wait and later admits offered publications", async () => {
	const directory = await mkdtemp(join(tmpdir(), "alabama-pending-"));
	try {
		let body = JSON.stringify(pendingCapture());
		const options = { familyId: "al-sos-2026", catalogPath: join(directory, "catalog.json"), dataDirectory: directory, now: () => now, enabledSourceIds: [] as string[], fetchDiscovery: async () => body, fetchCandidates: async () => {
			throw new Error("No selected source should be fetched.");
		} };
		const pending = await syncStateBallotCycles(options);
		assert.equal(pending.pendingPublications?.length, 1);
		assert.deepEqual(pending.results, []);
		assert.deepEqual(pending.deferredSources, []);
		body = JSON.stringify(alabamaCaptureFixture(2028, 7));
		const ready = await syncStateBallotCycles(options);
		assert.deepEqual(ready.pendingPublications, []);
		const accepted = await readFile(options.catalogPath, "utf8");
		assert.equal(JSON.parse(accepted).elections.length, 1);
		body = JSON.stringify(pendingCapture());
		await assert.rejects(syncStateBallotCycles(options), /disappeared/u);
		assert.equal(await readFile(options.catalogPath, "utf8"), accepted);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Alabama unpublished annual pages retain policy and extra-document review gates", () => {
	const capture = pendingCapture();
	const annual = capture.documents[2];
	annual.body = annual.body.replace("</main>", "<a href=\"/terms\">Terms of use</a></main>");
	annual.sha256 = alabamaHash(annual.body);
	assert.throws(() => prepareAlabamaReferences(capture, now), /policy/u);
	const extra = pendingCapture();
	extra.documents.push(alabamaCaptureFixture(2028, 7).documents[3]);
	assert.throws(() => prepareAlabamaReferences(extra, now), /extra or prohibited/u);
});

test("Alabama future-page access failures are not relabeled as unpublished", async () => {
	const capture = pendingCapture();
	for (const status of [403, 404, 503]) {
		let instant = now;
		await assert.rejects(fetchAlabamaCycleDiscovery({ now: () => instant, sleep: async (milliseconds) => {
			instant += milliseconds;
		}, request: async (url) => {
			const item = capture.documents.find(item => item.url === url);
			assert(item);
			return { status: url.endsWith("/2028") ? status : 200, contentType: "text/html", body: Buffer.from(item.body), etag: undefined };
		} }), /requires review/u);
	}
});
