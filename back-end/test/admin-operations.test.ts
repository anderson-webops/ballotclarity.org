import type { AdminAutomationRun } from "../src/types/civic.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { Pool } from "pg";
import {
	automationRunPath,
	buildAdminOperations,
	parseAutomationRun,
	readAutomationRun,
	writeAutomationRun
} from "../src/admin-operations.js";
import { createSqliteAdminRepository, defaultContentSeed } from "../src/admin-store.js";
import { demoAdminSourceMonitor } from "../src/coverage-data.js";
import { createPostgresAdminRepository } from "../src/postgres-admin-store.js";
import { refreshApprovedCandidateData } from "../src/state-ballot-automation.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";

const now = Date.parse("2026-10-24T12:00:00.000Z");
const timestamp = new Date(now).toISOString();
function completed(): AdminAutomationRun {
	return {
		schemaVersion: 1,
		type: "ballot-automation-run",
		status: "succeeded",
		startedAt: timestamp,
		finishedAt: timestamp,
		lastSuccessAt: timestamp,
		lastImportAt: timestamp,
		nextRunAt: null,
		results: [{ sourceId: "nc-sbe-2026", status: "imported", records: 1, reason: null }]
	};
}

test("review lists only unpublished work and a source-note edit does not fabricate a source check", async () => {
	const repository = createSqliteAdminRepository({
		dbPath: ":memory:",
		contentSeed: defaultContentSeed(),
		sourceMonitorSeed: demoAdminSourceMonitor.sources
	});
	try {
		const published = (await repository.listContent()).items.filter(
			item => item.status === "published" && item.published
		);
		assert.ok(published.length > 0);
		assert.ok(
			(await repository.listReview()).items.every(item => !published.some(record => record.id === item.id))
		);
		const source = (await repository.listSourceMonitor()).sources[0]!;
		await repository.updateSource(source.id, { note: "Editorial note only" });
		assert.equal(
			(await repository.listSourceMonitor()).sources.find(item => item.id === source.id)!.lastCheckedAt,
			source.lastCheckedAt
		);
	}
	finally {
		await repository.close?.();
	}
});

test("an unconfigured manual source monitor is not reported as healthy", async () => {
	const repository = createSqliteAdminRepository({ dbPath: ":memory:", sourceMonitorSeed: [] });
	try {
		assert.notEqual(
			(await repository.getOverview()).metrics.find(item => item.id === "healthy-sources")!.tone,
			"healthy"
		);
	}
	finally {
		await repository.close?.();
	}
});

test("operations inspect real persisted data without collecting, changing clocks or inventing import times", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-admin-data-"));
	try {
		const source = configuredStateBallotSources.find(source => source.id === "nc-sbe-2026")!;
		await createStateBallotStorage(directory).write({
			source,
			retrievedAt: timestamp,
			sha256: "a".repeat(64),
			records: [
				{
					id: "b".repeat(24),
					name: "Synthetic Candidate",
					office: "U.S. Senate",
					district: "",
					scope: "statewide",
					status: "listed"
				}
			]
		});
		let requests = 0;
		const repository = createStateBallotRepository({
			sources: [source],
			dataDirectory: directory,
			now: () => now + 60000,
			fetchText: async () => {
				requests++;
				throw new Error("Offline");
			}
		});
		const result = await buildAdminOperations({
			candidates: repository,
			references: null,
			dataDirectory: directory,
			now: now + 60000
		});
		assert.equal(result.datasets[0]!.records, 1);
		assert.equal(result.datasets[0]!.retrievedAt, timestamp);
		assert.equal(result.datasets[0]!.lastImportAt, null);
		assert.equal(result.automation.status, "unreported");
		assert.equal(requests, 0);
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("durable automation receipts distinguish successful imports, actual scheduling, overdue work and invalid evidence", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-admin-run-"));
	try {
		const run = completed();
		run.nextRunAt = new Date(now + 60000).toISOString();
		await writeAutomationRun(directory, run, now);
		assert.deepEqual(await readAutomationRun(directory, now), run);
		const options = { candidates: null, references: null, dataDirectory: directory };
		assert.equal((await buildAdminOperations({ ...options, now })).automation.status, "scheduled");
		assert.equal((await buildAdminOperations({ ...options, now: now + 120000 })).automation.status, "overdue");
		await writeAutomationRun(directory, { ...run, status: "failed", results: [{ sourceId: "nc-sbe-2026", status: "failed", records: 0, reason: "source-unavailable" }] }, now);
		assert.equal((await buildAdminOperations({ ...options, now })).automation.status, "failed");
		await writeFile(automationRunPath(directory), "{}");
		assert.equal((await buildAdminOperations({ ...options, now })).automation.status, "invalid");
		await rm(automationRunPath(directory));
		await writeFile(join(directory, "other.json"), JSON.stringify(run));
		await symlink(join(directory, "other.json"), automationRunPath(directory));
		await assert.rejects(readAutomationRun(directory, now));
		for (const value of [
			{ ...completed(), lastSuccessAt: new Date(now + 1).toISOString() },
			{ ...completed(), results: [...completed().results, ...completed().results] },
			{ ...completed(), results: [{ sourceId: "nc-sbe-2026", status: "failed", records: 1, reason: null }] }
		])
			assert.throws(() => parseAutomationRun(value, now));
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("approved routine collection imports automatically, caches idempotently and retains durable data after a failed refresh", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-admin-worker-"));
	try {
		const environment = {
			STATE_BALLOT_DATA_DIR: directory,
			STATE_BALLOT_ENABLED_STATES: "NC",
			STATE_BALLOT_ENABLED_SOURCES: "nc-sbe-2026"
		};
		let clock = now;
		let requests = 0;
		const fetchText = async () => {
			requests++;
			return "election_dt,name_on_ballot,contest_name,party_candidate,county_name\n11/03/2026,Synthetic Candidate,US SENATE,DEM,\n";
		};
		const options = { environment, now: () => clock, fetchText };
		const first = await refreshApprovedCandidateData(options);
		assert.equal(first.status, "succeeded");
		assert.equal(first.results[0]!.status, "imported");
		assert.equal(first.lastImportAt, timestamp);
		clock += 60000;
		assert.equal((await refreshApprovedCandidateData(options)).results[0]!.status, "cached");
		assert.equal(requests, 1);
		const source = configuredStateBallotSources.find(source => source.id === "nc-sbe-2026")!;
		const before = await createStateBallotStorage(directory).read(source);
		clock += 5 * 3600000;
		const failed = await refreshApprovedCandidateData({
			...options,
			fetchText: async () => {
				throw new Error("403");
			}
		});
		assert.equal(failed.status, "failed");
		assert.equal(failed.lastImportAt, timestamp);
		assert.deepEqual(await createStateBallotStorage(directory).read(source), before);
		assert.ok((await readFile(automationRunPath(directory), "utf8")).includes("\"status\":\"failed\""));
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("reviewed sources remain outside routine automatic imports", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-admin-held-"));
	try {
		let requests = 0;
		const run = await refreshApprovedCandidateData({
			environment: { STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "HI" },
			now: () => now,
			fetchText: async () => {
				requests++;
				throw new Error("Held");
			}
		});
		assert.equal(requests, 0);
		assert.deepEqual(run.results, []);
		assert.equal(run.lastImportAt, null);
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("Postgres review filtering and editorial note timestamps match SQLite", { skip: !process.env.TEST_ADMIN_DATABASE_URL }, async () => {
	const databaseUrl = process.env.TEST_ADMIN_DATABASE_URL!;
	const admin = new Pool({ connectionString: databaseUrl });
	const schema = `ballot_operations_${randomUUID().replaceAll("-", "")}`;
	const scoped = new URL(databaseUrl);
	scoped.searchParams.set("options", `-c search_path=${schema}`);
	let repository: Awaited<ReturnType<typeof createPostgresAdminRepository>> | null = null;
	try {
		await admin.query(`CREATE SCHEMA ${schema}`);
		repository = await createPostgresAdminRepository({ databaseUrl: scoped.toString(), contentSeed: defaultContentSeed(), sourceMonitorSeed: demoAdminSourceMonitor.sources });
		const published = (await repository.listContent()).items.filter(item => item.status === "published" && item.published);
		assert.ok(published.length);
		assert.ok((await repository.listReview()).items.every(item => !published.some(record => record.id === item.id)));
		const source = (await repository.listSourceMonitor()).sources[0]!;
		await repository.updateSource(source.id, { note: "An editorial note, not a network check" });
		assert.equal((await repository.listSourceMonitor()).sources.find(item => item.id === source.id)!.lastCheckedAt, source.lastCheckedAt);
	}
	finally {
		await repository?.close?.();
		await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
		await admin.end();
	}
});
