import assert from "node:assert/strict";
import test from "node:test";
import {
	createPostgresPoolConfig,
	resolveBoundedPositiveInteger,
} from "../src/postgres-pool-config.js";

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
