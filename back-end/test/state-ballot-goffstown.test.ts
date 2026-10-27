import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchGoffstownCandidateCapture, fetchGoffstownCandidateDiscovery, goffstownDocumentDigest, goffstownSource, parseGoffstownCandidateCapture, readGoffstownCandidateDiscovery } from "../src/state-ballot-goffstown-collection.js";
import { goffstownNativePages, inspectGoffstownVisual, validateGoffstownVisual } from "../src/state-ballot-goffstown-native.js";
import { readGoffstownBallotFields } from "../src/state-ballot-goffstown.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { goffstownFieldsFixture, goffstownFixtureClock, goffstownPendingDiscovery, goffstownVisualFixture } from "./helpers/goffstown-fixture.js";

const source = goffstownSource("2026-11-03");
function parse(fixture = goffstownFieldsFixture()) {
	return readGoffstownBallotFields(source, fixture.pages, fixture.geometry, createStateCandidateRecord);
}
test("printed columns, other-party labels, fusion entries and multi-seat House offices remain factual", () => {
	const parsed = parse();
	assert.equal(parsed.records.length, 27);
	assert.equal(parsed.claims.length, 28);
	assert.equal(parsed.records.find(record => record.name === "Dana Civic")!.party, "Republican / Democratic");
	assert.deepEqual(parsed.records.filter(record => record.scope === "state-house").map(record => [record.district, record.seats]), [["HILLSBOROUGH-29", 4], ["HILLSBOROUGH-29", 4], ["HILLSBOROUGH-44", 2], ["HILLSBOROUGH-44", 2]]);
	assert(parsed.records.filter(record => ["congressional", "state-senate"].includes(record.scope)).every(record => record.district === ""));
	assert(parsed.records.every(record => record.status === "listed" && record.sourceAreaLabel === "Goffstown sample ballot"));
});
test("questions retain printed choices and verified quote correction without claiming personal eligibility", () => {
	const parsed = parse();
	assert.equal(parsed.ballotQuestions.length, 2);
	for (const question of parsed.ballotQuestions) {
		assert.deepEqual(question.choices, ["Yes", "No"]);
		assert.equal(question.voterApplicabilityVerified, false);
		assert.equal(question.officialText, "“Should this synthetic test question be approved by the voters for this fixture?”");
		assert.deepEqual(question.pages, [2]);
	}
});
test("unrecognized offices, inconsistent seats, missing marks, changed choice order and undisclosed status text hold", () => {
	for (const mutate of [(fixture: ReturnType<typeof goffstownFieldsFixture>) => {
		fixture.pages[0]!.find(field => field.text === "Governor")!.text = "Unknown office";
	}, (fixture: ReturnType<typeof goffstownFieldsFixture>) => {
		fixture.pages[0]!.find(field => field.text.includes("Four will"))!.text = "Vote for up to 4; Three will be elected";
	}, (fixture: ReturnType<typeof goffstownFieldsFixture>) => {
		fixture.geometry[0]!.marks.shift();
	}, (fixture: ReturnType<typeof goffstownFieldsFixture>) => {
		fixture.pages[1]!.find(field => field.text === "Yes")!.text = "No";
	}, (fixture: ReturnType<typeof goffstownFieldsFixture>) => {
		fixture.pages[0]!.push({ ...fixture.pages[0]!.find(field => field.text === "Ada Able")!, family: "Helvetica-Condensed", text: "WITHDRAWN", top: 283 });
	}]) {
		const fixture = goffstownFieldsFixture();
		mutate(fixture);
		assert.throws(() => parse(fixture), /review/u);
	}
});
test("native/visible matching conserves glyphs and refuses hidden text, outline transforms and opaque overlays", () => {
	const { xml, svg } = goffstownVisualFixture();
	assert.equal(goffstownNativePages(xml)[0]!.length, 10);
	assert.equal(inspectGoffstownVisual(xml, svg, 1).visibleGlyphs, 10);
	assert.throws(() => validateGoffstownVisual(xml, svg, 1), /review/u);
	for (const body of [svg.replace(/<use[^>]+\/>/u, ""), svg.replace("<g id=\"glyph-0-0\">", "<g id=\"glyph-0-0\" transform=\"scale(2)\">"), svg.replace("</svg>", "<g display=\"none\"><use xlink:href=\"#glyph-0-0\" x=\"10\" y=\"10\"/></g></svg>"), svg.replace("</svg>", "<path fill=\"rgb(0%, 0%, 0%)\" d=\"M 30 30 L 200 30 L 200 45 L 30 45 Z\"/></svg>"), svg.replace("</svg>", "<image href=\"foreign.png\"/></svg>")]) assert.throws(() => inspectGoffstownVisual(xml, body, 1), /review/u);
	assert.throws(() => goffstownNativePages(xml.replace("height=\"1512\"", "height=\"1513\"")), /review/u);
});
test("pending current and future published headings discover isolated automatic sources without fabricated records", async () => {
	for (const year of [2026, 2032]) {
		const now = year === 2026 ? goffstownFixtureClock : Date.parse("2032-10-01T00:00:00.000Z");
		const discovery = await fetchGoffstownCandidateDiscovery({ discovery: await goffstownPendingDiscovery(year), now: () => now });
		const parsed = readGoffstownCandidateDiscovery(discovery, now);
		assert.deepEqual(parsed.elections[0]!.goffstownDocuments, []);
		const catalog = discoverStateBallotElectionCycles(discovery, source.id, now);
		const selected = year === 2026 ? source : stateBallotCycleSources(catalog, now)[0]!;
		assert.equal(selected.id, year === 2026 ? "nh-goffstown-2026" : "nh-goffstown-general-2032-11-02");
		const capture = await fetchGoffstownCandidateCapture(selected, { discovery, now: () => now });
		assert.throws(() => parseGoffstownCandidateCapture(selected, capture, now), StateBallotAwaitingRecordsError);
	}
});
test("stored source-specific questions, district limits and original document provenance survive cold public reads", async () => {
	const fixture = parse();
	const document = { url: "https://www.goffstownnh.gov/DocumentCenter/View/6157/Goffstown-SAMPLE-BALLOT---State-General-Election-110326-PDF", sha256: "a".repeat(64), retrievedAt: new Date(goffstownFixtureClock).toISOString(), includedRecordCount: fixture.records.length };
	const digest = goffstownDocumentDigest([{ url: document.url, sha256: document.sha256 }]);
	const snapshot = { source, records: fixture.records, ballotQuestions: fixture.ballotQuestions, documents: [document], sha256: digest, collectionIndexSha256: digest, retrievedAt: document.retrievedAt };
	const serialized = serializeStoredStateSnapshot(snapshot);
	assert.deepEqual(JSON.parse(JSON.stringify(parseBundledStateSnapshot(source, serialized, "automatic"))), JSON.parse(JSON.stringify(snapshot)));
	for (const mutate of [(value: Record<string, unknown>) => {
		value.sourceAsOfDate = "2026-09-01";
	}, (value: Record<string, unknown>) => {
		value.collectionIndexSha256 = "b".repeat(64);
	}, (value: Record<string, unknown>) => {
		(value.ballotQuestions as { voterApplicabilityVerified: boolean }[])[0]!.voterApplicabilityVerified = true;
	}]) {
		const value = JSON.parse(serialized);
		mutate(value);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(value), "automatic"), /review/u);
	}
	const directory = await mkdtemp(join(tmpdir(), "ballot-goffstown-"));
	try {
		const storage = createStateBallotStorage(join(directory, "data"));
		await storage.write(snapshot);
		let requests = 0;
		const repository = createStateBallotRepository({ sources: [source], dataDirectory: join(directory, "data"), now: () => goffstownFixtureClock, fetchText: async () => {
			requests++;
			throw new Error("Publisher fetching is disabled for public reads");
		} });
		assert.deepEqual(JSON.parse(JSON.stringify(await repository.getSnapshot("NH", source.id))), JSON.parse(JSON.stringify(snapshot)));
		assert.equal(requests, 0);
		const pending = await fetchGoffstownCandidateDiscovery({ discovery: await goffstownPendingDiscovery(), now: () => goffstownFixtureClock });
		const result = await syncStateBallotCycles({ familyId: source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: join(directory, "empty"), now: () => goffstownFixtureClock, fetchDiscovery: async () => pending });
		assert.equal(result.results[0]!.status, "awaiting-records");
		assert.equal(result.results[0]!.imported, false);
		assert.equal((await storage.read(source))!.records.length, 27);
		assert.ok(await readFile(join(directory, "cycles.json")));
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
});
test("a failed PDF request stops before native extraction without identity or transport workarounds", async () => {
	const pending = JSON.parse(await goffstownPendingDiscovery());
	pending.index.body = pending.index.body.replace("</h3>", "</h3><a href=\"/DocumentCenter/View/6157/Goffstown-SAMPLE-BALLOT---State-General-Election-110326-PDF\">Goffstown SAMPLE BALLOT - State General Election 11/03/26 (PDF)</a>");
	const { createHash } = await import("node:crypto");
	pending.index.sha256 = createHash("sha256").update(pending.index.body).digest("hex");
	let requests = 0;
	let extractions = 0;
	await assert.rejects(fetchGoffstownCandidateDiscovery({ discovery: JSON.stringify(pending), now: () => goffstownFixtureClock, sleep: async () => {}, requestDocument: async () => {
		requests++;
		return { status: 403, contentType: "text/html", body: Buffer.alloc(0), etag: undefined };
	}, extract: async () => {
		extractions++;
		return { xml: "", svgPages: [] };
	} }), /review/u);
	assert.equal(requests, 1);
	assert.equal(extractions, 0);
});
