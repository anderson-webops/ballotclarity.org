import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { Client } from "pg";
import { verifyRuntimeArtifact } from "./runtime-artifact.mjs";

const artifactRoot = process.argv[2] ? resolve(process.argv[2]) : "";

if (!artifactRoot)
	throw new Error("An unpacked runtime artifact is required.");

const manifest = verifyRuntimeArtifact(artifactRoot);
const runRoot = resolve(import.meta.dirname, "../.ai-work/runs");
mkdirSync(runRoot, { recursive: true });
const temporaryRoot = mkdtempSync(join(runRoot, "postgres-recovery-"));
const syntheticSecret = `synthetic-private-log-sentinel-${randomBytes(16).toString("hex")}`;
const containerId = process.env.POSTGRES_TEST_CONTAINER_ID?.trim();
const postgresBin = process.env.POSTGRES_TEST_BIN_DIR?.trim();
let databaseUrl;
let controller;
let databaseStopped = false;
let localDatabaseRunning = false;
let api;

function run(command, args) {
	return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function freePort() {
	return new Promise((resolvePort, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			server.close(error => error ? reject(error) : resolvePort(address.port));
		});
	});
}

async function waitFor(check, description, timeoutMs = 15_000) {
	const deadline = Date.now() + timeoutMs;
	let lastError;

	while (Date.now() < deadline) {
		if (api && (api.child.exitCode !== null || api.child.signalCode !== null))
			throw new Error(`Compiled API exited while waiting for ${description}.`);

		try {
			const result = await check();
			if (result)
				return result;
		}
		catch (error) {
			lastError = error;
		}

		await new Promise(resolveDelay => setTimeout(resolveDelay, 150));
	}

	throw new Error(`Timed out waiting for ${description}: ${lastError instanceof Error ? lastError.name : "unknown"}`);
}

function startApi(port) {
	const stateRoot = join(temporaryRoot, "state");
	mkdirSync(stateRoot, { recursive: true });
	const child = spawn(process.execPath, [resolve(artifactRoot, "back-end/dist/server.js")], {
		cwd: artifactRoot,
		env: {
			ACTIVE_LOOKUP_COOKIE_SECRET: syntheticSecret,
			ADDRESS_CACHE_ENCRYPTION_KEY: syntheticSecret,
			ADMIN_API_KEY: syntheticSecret,
			ADMIN_DATABASE_URL: databaseUrl,
			ADMIN_MFA_ENCRYPTION_KEY: syntheticSecret,
			ADMIN_SESSION_SECRET: syntheticSecret,
			ADMIN_STORE_DRIVER: "postgres",
			DATABASE_URL: databaseUrl,
			HOME: temporaryRoot,
			HOST: "127.0.0.1",
			LANG: "C.UTF-8",
			LIVE_COVERAGE_FILE: "",
			LIVE_COVERAGE_REQUIRED: "false",
			NODE_ENV: "production",
			PATH: dirname(process.execPath),
			PORT: String(port),
			STATE_BALLOT_DATA_DIR: stateRoot,
			STATE_BALLOT_LOOKUP_ENABLED: "false",
			TMPDIR: temporaryRoot,
		},
		stdio: ["ignore", "pipe", "pipe"],
	});
	let output = "";
	const capture = chunk => output = `${output}${chunk}`.slice(-32_000);
	child.stdout.on("data", capture);
	child.stderr.on("data", capture);
	return { child, getOutput: () => output };
}

async function stopApi() {
	if (!api)
		return;

	if (api.child.exitCode === null && api.child.signalCode === null) {
		api.child.kill("SIGTERM");
		await new Promise((resolveExit, reject) => {
			const timer = setTimeout(() => reject(new Error("Graceful API shutdown timed out.")), 8_000);
			api.child.once("exit", () => {
				clearTimeout(timer);
				resolveExit();
			});
		});
	}

	assert.equal(api.child.exitCode, 0, "Compiled API did not exit cleanly.");
	assert.doesNotMatch(api.getOutput(), /postgres:\/\/|synthetic-private-log-sentinel|password|private-connection-detail/u);
	api = undefined;
}

async function requestProbe(baseUrl, path, method, expectedStatus) {
	const response = await waitFor(async () => {
		const candidate = await fetch(`${baseUrl}${path}`, {
			method,
			signal: AbortSignal.timeout(8_000),
		});
		return candidate.status === expectedStatus ? candidate : null;
	}, `${method} ${path}=${expectedStatus}`);
	assert.equal(response.headers.get("cache-control"), "no-store");
	assert.equal(response.headers.get("set-cookie"), null);
	if (method === "HEAD")
		assert.equal(await response.text(), "");
	else if (path === "/healthz" || path === "/readyz")
		assert.deepEqual(await response.json(), { ok: expectedStatus === 200 });
	return response;
}

async function databaseFingerprint() {
	const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3_000 });
	await client.connect();

	try {
		const version = Number((await client.query("SHOW server_version_num")).rows[0].server_version_num);
		assert.ok(version >= 170000 && version < 180000, "The recovery fixture must be PostgreSQL 17.");
		const tables = (await client.query(`
			SELECT table_name FROM information_schema.tables
			WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
			ORDER BY table_name
		`)).rows.map(row => row.table_name);
		const rows = [];

		for (const table of tables) {
			const quoted = `"${table.replaceAll('"', '""')}"`;
			const values = (await client.query(`SELECT row_to_json(item)::text AS value FROM public.${quoted} AS item`))
				.rows.map(row => row.value).sort();
			rows.push([table, values]);
		}

		const columns = (await client.query(`
			SELECT table_name, column_name, data_type, is_nullable, column_default
			FROM information_schema.columns WHERE table_schema = 'public'
			ORDER BY table_name, ordinal_position
		`)).rows;
		const indexes = (await client.query(`
			SELECT tablename, indexname, indexdef FROM pg_indexes
			WHERE schemaname = 'public' ORDER BY tablename, indexname
		`)).rows;
		return createHash("sha256").update(JSON.stringify({ columns, indexes, rows })).digest("hex");
	}
	finally {
		await client.end();
	}
}

async function checkHealthy(baseUrl) {
	for (const method of ["GET", "HEAD"]) {
		await requestProbe(baseUrl, "/healthz", method, 200);
		await requestProbe(baseUrl, "/readyz", method, 200);
	}
	const release = await requestProbe(baseUrl, "/api/release", "GET", 200);
	assert.equal((await release.json()).commit, manifest.source.commit);
	const privateRoute = await fetch(`${baseUrl}/api/admin/overview`, { signal: AbortSignal.timeout(1_000) });
	assert.ok(privateRoute.status === 401 || privateRoute.status === 403);
}

try {
	if (containerId) {
		assert.match(containerId, /^[a-f0-9]{12,64}$/u);
		assert.ok(process.env.TEST_ADMIN_DATABASE_URL);
		databaseUrl = process.env.TEST_ADMIN_DATABASE_URL;
		controller = {
			start: () => run("docker", ["start", containerId]),
			stop: () => run("docker", ["stop", "--time", "10", containerId]),
		};
	}
	else {
		assert.ok(postgresBin, "Set POSTGRES_TEST_BIN_DIR to PostgreSQL 17 binaries.");
		const databasePort = await freePort();
		const dataRoot = join(temporaryRoot, "pgdata");
		const passwordPath = join(temporaryRoot, "synthetic-password");
		writeFileSync(passwordPath, syntheticSecret, { mode: 0o600 });
		run(resolve(postgresBin, "initdb"), ["-D", dataRoot, "-U", "ballot_test", "--auth-local=trust", "--auth-host=scram-sha-256", "--pwfile", passwordPath, "--no-instructions"]);
		controller = {
			start: () => {
				run(resolve(postgresBin, "pg_ctl"), ["-D", dataRoot, "-l", join(temporaryRoot, "postgres.log"), "-o", `-h 127.0.0.1 -p ${databasePort} -k /tmp`, "-w", "start"]);
				localDatabaseRunning = true;
			},
			stop: () => {
				if (localDatabaseRunning) {
					run(resolve(postgresBin, "pg_ctl"), ["-D", dataRoot, "-m", "fast", "-w", "stop"]);
					localDatabaseRunning = false;
				}
			},
		};
		controller.start();
		databaseUrl = `postgres://ballot_test:${encodeURIComponent(syntheticSecret)}@127.0.0.1:${databasePort}/postgres`;
	}

	const apiPort = await freePort();
	const baseUrl = `http://127.0.0.1:${apiPort}`;
	api = startApi(apiPort);
	await checkHealthy(baseUrl);
	const originalFingerprint = await databaseFingerprint();
	controller.stop();
	databaseStopped = true;
	for (const method of ["GET", "HEAD"]) {
		await requestProbe(baseUrl, "/healthz", method, 200);
		await requestProbe(baseUrl, "/readyz", method, 503);
	}
	controller.start();
	databaseStopped = false;
	await checkHealthy(baseUrl);
	assert.equal(await databaseFingerprint(), originalFingerprint);
	await stopApi();
	verifyRuntimeArtifact(artifactRoot);
	api = startApi(apiPort);
	await checkHealthy(baseUrl);
	assert.equal(await databaseFingerprint(), originalFingerprint);
	await stopApi();
	verifyRuntimeArtifact(artifactRoot);
	console.log("Compiled PostgreSQL 17 stop/recovery and retained-artifact restart passed with unchanged schema/data fingerprint.");
}
finally {
	if (api?.child && api.child.exitCode === null && api.child.signalCode === null)
		api.child.kill("SIGKILL");
	if (databaseStopped && containerId)
		controller?.start();
	if (!containerId && controller)
		controller.stop();
	rmSync(temporaryRoot, { recursive: true, force: true });
}
