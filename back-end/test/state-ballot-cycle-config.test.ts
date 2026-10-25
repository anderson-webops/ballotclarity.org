import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import express from "express";
import { discoverStateBallotElectionCycles, readConfiguredStateBallotCycleCatalogs, StateBallotCycleCatalogError, stateBallotCycleCatalogLocations, stateBallotCycleSources, writeStateBallotCycleCatalog } from "../src/state-ballot-cycles.js";
import { createStateBallotRepository, resolveStateBallotConfiguration } from "../src/state-ballot-repository.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { registerStateRecordRoutes } from "../src/state-records.js";

const now = Date.parse("2026-10-24T12:00:00.000Z");
const discovery = (montana: boolean) => `<form${montana ? " id=\"frmMain\"" : ""} method="post" action="./CandidateList.aspx"><select name="ctl00$ContentPlaceHolder1$ddlElection"><option value="${montana ? "450002987" : "899"}">${montana ? "FEDERAL " : ""}GENERAL 2026 (11/03/2026) (General)</option><option value="${montana ? "990000001" : "990"}">${montana ? "FEDERAL " : ""}GENERAL 2028 (11/07/2028) (General)</option></select></form>`;

test("catalog maps accept only distinct external paths for reviewed automatic families and preserve legacy configuration", () => {
	assert.deepEqual(stateBallotCycleCatalogLocations({}), []);
	assert.deepEqual(stateBallotCycleCatalogLocations({ STATE_BALLOT_CYCLE_CATALOG: "/tmp/washington.json" }), [{ familyId: "wa-general-2026", catalogPath: "/tmp/washington.json" }]);
	assert.deepEqual(stateBallotCycleCatalogLocations({ STATE_BALLOT_CYCLE_CATALOGS: JSON.stringify({ "wa-general-2026": "/tmp/washington.json", "mt-general-2026": "/tmp/montana.json" }) }).map(item => item.familyId), ["wa-general-2026", "mt-general-2026"]);
	for (const value of ["null", "[]", "{}", "not JSON", JSON.stringify({ "ut-qualified-general-2026": "/tmp/utah.json" }), JSON.stringify({ "mt-general-2026": "relative.json" }), JSON.stringify({ "mt-general-2026": "/tmp/bad\nname" }), JSON.stringify({ "mt-general-2026": "/tmp/same.json", "wa-general-2026": "/tmp/../tmp/same.json" }), JSON.stringify({ "mt-general-2026": "/".repeat(17000) })]) assert.throws(() => stateBallotCycleCatalogLocations({ STATE_BALLOT_CYCLE_CATALOGS: value }));
	assert.throws(() => stateBallotCycleCatalogLocations({ STATE_BALLOT_CYCLE_CATALOG: "/tmp/wa.json", STATE_BALLOT_CYCLE_CATALOGS: "{}" }));
	assert.throws(() => resolveStateBallotConfiguration({ STATE_BALLOT_ENABLED_FAMILIES: "mt-general-2026", STATE_BALLOT_ENABLED_STATES: "WA" }));
	assert.throws(() => resolveStateBallotConfiguration({ STATE_BALLOT_ENABLED_FAMILIES: "utah-2026" }));
});

test("multiple catalogs preserve exact source allowlists and widen only an explicitly approved family", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-cycle-config-"));
	try {
		const washingtonPath = join(directory, "washington.json");
		const montanaPath = join(directory, "montana.json");
		await writeStateBallotCycleCatalog(washingtonPath, discoverStateBallotElectionCycles(discovery(false), "wa-general-2026", now), now);
		await writeStateBallotCycleCatalog(montanaPath, discoverStateBallotElectionCycles(discovery(true), "mt-general-2026", now), now);
		const environment = { STATE_BALLOT_CYCLE_CATALOGS: JSON.stringify({ "wa-general-2026": washingtonPath, "mt-general-2026": montanaPath }), STATE_BALLOT_ENABLED_STATES: "WA,MT", STATE_BALLOT_ENABLED_SOURCES: "wa-general-2026,mt-general-2026" };
		assert.deepEqual(resolveStateBallotConfiguration(environment).sources.map(source => source.id), ["wa-general-2026", "mt-general-2026"]);
		for (const familyId of ["wa-general-2026", "mt-general-2026"]) {
			const selected = resolveStateBallotConfiguration({ ...environment, STATE_BALLOT_ENABLED_FAMILIES: familyId }).sources;
			assert.equal(selected.length, 3);
			assert.equal(selected.at(-1)!.id, `${familyId.slice(0, -4)}2028-11-07`);
		}
		const both = resolveStateBallotConfiguration({ ...environment, STATE_BALLOT_ENABLED_FAMILIES: "wa-general-2026,mt-general-2026" });
		assert.equal(both.sources.length, 4);
		assert.equal(new Set(both.sources.map(source => source.id)).size, 4);
		const bytes = await readFile(washingtonPath);
		await writeFile(montanaPath, bytes);
		assert.throws(() => readConfiguredStateBallotCycleCatalogs(environment, now), error => error instanceof StateBallotCycleCatalogError && error.familyId === "mt-general-2026");
		await writeFile(montanaPath, "{}");
		assert.throws(() => readConfiguredStateBallotCycleCatalogs(environment, now), error => error instanceof StateBallotCycleCatalogError && error.familyId === "mt-general-2026");
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("running APIs hot-load both families, retain last-good descriptors on a corrupt Montana catalog, and select the current cycle after expiry", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-cycle-config-api-"));
	const environment = { ...process.env };
	let close: (() => Promise<void>) | undefined;
	try {
		const washingtonPath = join(directory, "washington.json");
		const montanaPath = join(directory, "montana.json");
		const dataDirectory = join(directory, "data");
		delete process.env.STATE_BALLOT_CYCLE_CATALOG;
		process.env.STATE_BALLOT_CYCLE_CATALOGS = JSON.stringify({ "wa-general-2026": washingtonPath, "mt-general-2026": montanaPath });
		process.env.STATE_BALLOT_ENABLED_STATES = "WA,MT";
		process.env.STATE_BALLOT_ENABLED_SOURCES = "wa-general-2026,mt-general-2026";
		process.env.STATE_BALLOT_ENABLED_FAMILIES = "wa-general-2026,mt-general-2026";
		process.env.STATE_BALLOT_DATA_DIR = dataDirectory;
		const failures: string[] = [];
		const clock = Date.parse("2028-10-24T00:00:00Z");
		const repository = createStateBallotRepository({ now: () => clock, fetchText: async () => {
			throw new Error("Live publisher requests are disabled");
		}, onUnavailable: state => failures.push(state) });
		assert.equal(repository.sources!.length, 2);
		const storage = createStateBallotStorage(dataDirectory);
		for (const [familyId, catalogPath, montana] of [["wa-general-2026", washingtonPath, false], ["mt-general-2026", montanaPath, true]] as const) {
			const catalog = discoverStateBallotElectionCycles(discovery(montana), familyId, now);
			await writeStateBallotCycleCatalog(catalogPath, catalog, now);
			const source = stateBallotCycleSources(catalog)[0]!;
			await storage.write({ source, retrievedAt: new Date(clock).toISOString(), sha256: "a".repeat(64), records: [{ id: createHash("sha256").update(source.id).digest("hex").slice(0, 24), name: "Synthetic Cycle Candidate", office: "United States Senator", district: "", jurisdiction: source.stateCode, scope: "statewide", party: "Democratic", status: "filed" }] });
		}
		const app = express();
		registerStateRecordRoutes(app, repository, undefined, () => clock);
		const server = app.listen(0, "127.0.0.1");
		await once(server, "listening");
		close = () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
		const address = server.address();
		assert.ok(address && typeof address === "object");
		const origin = `http://127.0.0.1:${address.port}`;
		for (const state of ["WA", "MT"]) {
			const response = await fetch(`${origin}/api/state-records/${state}`);
			assert.equal(response.status, 200);
			const payload = await response.json();
			assert.equal(payload.available, true);
			assert.equal(payload.source.electionDate, "2028-11-07");
			assert.equal(payload.records[0].name, "Synthetic Cycle Candidate");
			assert.equal((await (await fetch(`${origin}/api/state-records/${state}?source=${state.toLowerCase()}-general-2026`)).json()).available, false);
		}
		await writeFile(montanaPath, "{}");
		assert.equal((await (await fetch(`${origin}/api/state-records/MT`)).json()).available, true);
		assert.ok(failures.includes("MT"));
		assert.ok(!failures.includes("WA"));
		const index = await (await fetch(`${origin}/api/state-records`)).json();
		assert.ok(index.states.filter((state: { stateCode: string }) => ["MT", "WA"].includes(state.stateCode)).every((state: { sources: unknown[] }) => state.sources.length === 2));
	}
	finally {
		await close?.();
		process.env = environment;
		await rm(directory, { recursive: true, force: true });
	}
});
