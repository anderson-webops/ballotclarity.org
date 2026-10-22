import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import {
	attachPostgresPoolErrorHandler,
	createPostgresPoolConfig,
	resolveBoundedPositiveInteger,
	safePostgresErrorCode,
} from "../src/postgres-pool-config.js";

test("idle PostgreSQL pool failures are handled without logging private error details", async () => {
	const pool = new Pool({ connectionString: "postgres://private:secret@example.invalid/ballotclarity" });
	const lines: string[] = [];
	const originalWarn = console.warn;
	console.warn = (line: string) => lines.push(line);

	try {
		attachPostgresPoolErrorHandler(pool, "admin");
		pool.emit("error", Object.assign(new Error("private-connection-detail"), { code: "57P01" }));
		assert.equal(lines.length, 1);
		assert.deepEqual(JSON.parse(lines[0]), {
			code: "57P01",
			component: "admin",
			level: "warn",
			message: "postgres.idle_client_failed",
			service: "ballot-clarity-api",
			timestamp: JSON.parse(lines[0]).timestamp,
		});
		assert.doesNotMatch(lines[0], /private|secret|example\.invalid/u);
		assert.equal(safePostgresErrorCode({ code: "57P01 private" }), "UNKNOWN");
	}
	finally {
		console.warn = originalWarn;
		await pool.end();
	}
});

test("database pool settings stay bounded and default to small production pools", () => {
	assert.equal(resolveBoundedPositiveInteger("4", 2, 100), 4);
	assert.equal(resolveBoundedPositiveInteger("0", 2, 100), 2);
	assert.equal(resolveBoundedPositiveInteger("101", 2, 100), 2);
	assert.equal(resolveBoundedPositiveInteger("unbounded", 2, 100), 2);

	assert.deepEqual(createPostgresPoolConfig({
		connectionString: "postgres://example.invalid/ballotclarity",
		defaultMax: 4,
		maxEnvName: "ADMIN_DATABASE_POOL_MAX",
	}, {}), {
		allowExitOnIdle: true,
		connectionString: "postgres://example.invalid/ballotclarity",
		connectionTimeoutMillis: 5_000,
		idleTimeoutMillis: 10_000,
		max: 4,
	});
});

test("database pool settings accept reviewed bounded overrides", () => {
	const config = createPostgresPoolConfig({
		connectionString: "postgres://example.invalid/ballotclarity",
		defaultMax: 2,
		maxEnvName: "ADDRESS_CACHE_DATABASE_POOL_MAX",
	}, {
		ADDRESS_CACHE_DATABASE_POOL_MAX: "3",
		DATABASE_POOL_CONNECTION_TIMEOUT_MS: "7000",
		DATABASE_POOL_IDLE_TIMEOUT_MS: "12000",
	});

	assert.equal(config.max, 3);
	assert.equal(config.connectionTimeoutMillis, 7_000);
	assert.equal(config.idleTimeoutMillis, 12_000);
});
