import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { startServer } from "../src/server.js";

test("production server bounds connections and closes runtime resources cleanly", async (context) => {
	const tempDirectory = mkdtempSync(join(tmpdir(), "ballot-clarity-lifecycle-"));
	const priorEnvironment = {
		ADMIN_DATABASE_URL: process.env.ADMIN_DATABASE_URL,
		ADMIN_DB_PATH: process.env.ADMIN_DB_PATH,
		ADMIN_STORE_DRIVER: process.env.ADMIN_STORE_DRIVER,
		DATABASE_URL: process.env.DATABASE_URL,
		LIVE_COVERAGE_FILE: process.env.LIVE_COVERAGE_FILE,
	};
	process.env.ADMIN_DATABASE_URL = "";
	process.env.ADMIN_DB_PATH = join(tempDirectory, "admin.sqlite");
	process.env.ADMIN_STORE_DRIVER = "sqlite";
	process.env.DATABASE_URL = "";
	delete process.env.LIVE_COVERAGE_FILE;

	let started: Awaited<ReturnType<typeof startServer>> | null = null;
	context.after(async () => {
		await started?.shutdown();

		for (const [name, value] of Object.entries(priorEnvironment)) {
			if (value === undefined)
				delete process.env[name];
			else
				process.env[name] = value;
		}

		rmSync(tempDirectory, { force: true, recursive: true });
	});

	started = await startServer(0, "127.0.0.1", { shutdownGraceMs: 250 });
	assert.equal(started.server.maxConnections, 128);
	assert.equal(started.server.maxRequestsPerSocket, 1_000);
	assert.equal(started.server.requestTimeout, 30_000);
	assert.equal(started.server.headersTimeout, 10_000);
	assert.equal(started.server.keepAliveTimeout, 5_000);

	const baseUrl = `http://127.0.0.1:${started.port}`;
	const health = await fetch(`${baseUrl}/healthz`);
	assert.equal(health.status, 200);
	assert.equal(health.headers.get("cache-control"), "no-store");
	assert.deepEqual(await health.json(), { ok: true });

	const readiness = await fetch(`${baseUrl}/readyz`, { method: "HEAD" });
	assert.equal(readiness.status, 200);
	assert.equal(readiness.headers.get("cache-control"), "no-store");
	assert.equal(await readiness.text(), "");

	await started.shutdown();
	assert.equal(started.server.listening, false);
	await assert.doesNotReject(started.shutdown());
});
