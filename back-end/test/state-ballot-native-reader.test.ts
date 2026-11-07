import assert from "node:assert/strict";
import test from "node:test";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";

const sources = configuredStateBallotSources.filter(source => source.retrievalPolicy !== "manual-snapshot" && (source.format.endsWith("-pdf") || source.format.endsWith("-xlsx") || ["maine-house-html", "douglas-html", "hamilton-html", "iowa-johnson-html", "washoe-html", "boulder-html"].includes(source.format)));
const now = () => Date.parse("2026-10-28T12:00:00.000Z");

test("every configured bulk-publication reader avoids publisher work when no snapshot exists", async () => {
	assert.equal(new Set(sources.map(source => source.format)).size, 32);
	assert(sources.some(source => source.id === "ma-everett-2026" && source.format === "everett-pdf"));
	for (const source of sources) {
		let requests = 0;
		const repository = createStateBallotRepository({ sources: [source], dataDirectory: null, now, fetchText: async () => {
			requests++;
			throw new Error("A public reader must not collect native publications.");
		} });
		assert.equal(await repository.getSnapshot(source.stateCode, source.id), null, source.id);
		assert.equal(requests, 0, source.id);
	}
});

test("every configured bulk-publication direct collector retains its explicit collection boundary", async () => {
	for (const source of sources) {
		let requests = 0;
		const repository = createStateBallotRepository({ sources: [source], dataDirectory: null, now, refreshReviewedLegacy: true, fetchText: async () => {
			requests++;
			throw new Error("Controlled publisher outage.");
		} });
		assert.equal(await repository.getSnapshot(source.stateCode, source.id), null, source.id);
		assert.equal(requests, 1, source.id);
	}
});

test("explicit collection never bypasses an external source's manual-import policy", async () => {
	const manualSources = configuredStateBallotSources.filter(source => source.snapshotStorage === "external" && source.retrievalPolicy === "manual-snapshot");
	assert(manualSources.length > 0);
	for (const source of manualSources) {
		let requests = 0;
		const repository = createStateBallotRepository({ sources: [source], dataDirectory: null, now, refreshReviewedLegacy: true, fetchText: async () => {
			requests++;
			throw new Error("A manual source must stay offline.");
		} });
		assert.equal(await repository.getSnapshot(source.stateCode, source.id), null, source.id);
		assert.equal(requests, 0, source.id);
	}
});
