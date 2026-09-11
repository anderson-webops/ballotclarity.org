import assert from "node:assert/strict";
import { createServer } from "node:net";
import process from "node:process";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { assertLocalFiles, assertPortAvailable, buildLocalDevelopmentConfig, superviseLocalProcesses } from "../scripts/start-local.mjs";

test("local startup aligns custom ports and isolates production services", () => {
	const config = buildLocalDevelopmentConfig(process.cwd(), {
		ADMIN_BOOTSTRAP_USERNAME: "configured-admin",
		ADMIN_BOOTSTRAP_PASSWORD: "test-bootstrap-password",
		ADMIN_USERNAME: "legacy-admin",
		ADMIN_PASSWORD: "test-legacy-password",
		ADMIN_DATABASE_URL: "postgres://example.invalid/live",
		ADMIN_DB_PATH: "/operator/live.sqlite",
		DATABASE_URL: "postgres://example.invalid/cache",
		HOST: "0.0.0.0",
		NITRO_HOST: "0.0.0.0",
		NITRO_PORT: "443",
		NODE_ENV: "production",
		NUXT_PUBLIC_API_BASE: "https://example.invalid/api",
		NUXT_PUBLIC_SITE_URL: "https://example.invalid",
		SOURCE_ASSET_BASE_URL: "https://example.invalid/files",
		OPENSTATES_API_KEY: "test-provider-key",
	}, { apiPort: "3401", webPort: "3433" });
	assert.equal(config.env.NUXT_PUBLIC_API_BASE, "http://127.0.0.1:3401/api");
	assert.equal(config.env.ADMIN_API_BASE, config.env.NUXT_PUBLIC_API_BASE);
	assert.equal(config.env.NUXT_PUBLIC_SITE_URL, "http://127.0.0.1:3433");
	assert.equal(config.env.PORT, "3401");
	assert.equal(config.env.HOST, "127.0.0.1");
	assert.equal(config.env.NITRO_HOST, "127.0.0.1");
	assert.equal(config.env.NITRO_PORT, "3433");
	assert.equal(config.env.NODE_ENV, "development");
	assert.equal(config.env.ADMIN_DATABASE_URL, "");
	assert.equal(config.env.ADMIN_BOOTSTRAP_USERNAME, "");
	assert.equal(config.env.ADMIN_BOOTSTRAP_PASSWORD, "");
	assert.equal(config.env.ADMIN_USERNAME, "");
	assert.equal(config.env.ADMIN_PASSWORD, "");
	assert.equal(config.env.DATABASE_URL, "");
	assert.equal(config.env.ADMIN_STORE_DRIVER, "sqlite");
	assert.equal(config.env.SOURCE_ASSET_BASE_URL, "");
	assert.match(config.env.ADMIN_DB_PATH, /back-end\/data\/local-development\.sqlite$/u);
	assert.equal(config.env.OPENSTATES_API_KEY, "test-provider-key");
});

test("startup rejects malformed ports and preserves an explicitly configured coverage path", () => {
	for (const apiPort of ["123abc", "0", "65536", "-1", "1.2"])
		assert.throws(() => buildLocalDevelopmentConfig(process.cwd(), {}, { apiPort }), /whole number/u);
	assert.throws(() => buildLocalDevelopmentConfig(process.cwd(), {}, { apiPort: "3333" }), /different ports/u);
	const config = buildLocalDevelopmentConfig(process.cwd(), { LIVE_COVERAGE_FILE: "data/intentional-missing.json" });
	assert.match(config.env.LIVE_COVERAGE_FILE, /intentional-missing\.json$/u);
	assert.throws(() => assertLocalFiles(config, "24.18.1"), /missing snapshot/u);
	assert.throws(() => assertLocalFiles(config, "26.0.0"), /Node LTS/u);
});

test("port preflight reports a conflict without taking over the listener", async () => {
	const server = createServer();
	await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	assert.ok(address && typeof address === "object");
	try {
		await assert.rejects(assertPortAvailable(address.port), /unavailable/u);
		assert.equal(server.listening, true);
	}
	finally {
		await new Promise<void>(resolve => server.close(() => resolve()));
	}
});

test("local supervisor stops its sibling when a service fails", { timeout: 10000 }, async () => {
	const result = await superviseLocalProcesses([
		{ label: "long-running service", command: process.execPath, args: ["-e", "setInterval(() => {}, 1000)"], cwd: process.cwd() },
		{ label: "failing service", command: process.execPath, args: ["-e", "setTimeout(() => process.exit(7), 100)"], cwd: process.cwd() },
	], process.env, { stdio: "ignore" });
	assert.equal(result, 7);
});

test("local supervisor stops all services when interrupted", { timeout: 10000 }, async () => {
	const controller = new AbortController();
	const running = superviseLocalProcesses([
		{ label: "service", command: process.execPath, args: ["-e", "setInterval(() => {}, 1000)"], cwd: process.cwd() },
	], process.env, { signal: controller.signal, stdio: "ignore" });
	await delay(100);
	controller.abort();
	assert.equal(await running, 0);
});

test("local supervisor reports a missing executable and cleans up", { timeout: 10000 }, async () => {
	await assert.rejects(superviseLocalProcesses([
		{ label: "missing service", command: "/ballot-test-no-such-executable", args: [], cwd: process.cwd() },
	], process.env, { stdio: "ignore" }), /Could not start missing service/u);
});
