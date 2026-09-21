import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { buildRuntimeArtifact, verifyRuntimeArtifact } from "./runtime-artifact.mjs";

const maximumCapturedOutput = 32_000;

function getFreePort() {
	return new Promise((resolvePort, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			const port = typeof address === "object" && address ? address.port : 0;
			server.close(error => error ? reject(error) : resolvePort(port));
		});
	});
}

function startProcess(entrypoint, cwd, env) {
	const child = spawn(process.execPath, [entrypoint], {
		cwd,
		env,
		stdio: ["ignore", "pipe", "pipe"],
	});
	let output = "";
	const capture = (chunk) => {
		output = `${output}${chunk}`.slice(-maximumCapturedOutput);
	};
	child.stdout.on("data", capture);
	child.stderr.on("data", capture);
	return { child, getOutput: () => output };
}

async function waitForResponse(url, options = {}) {
	let lastError;

	for (let attempt = 0; attempt < 80; attempt += 1) {
		try {
			return await fetch(url, {
				...options,
				signal: AbortSignal.timeout(1_000),
			});
		}
		catch (error) {
			lastError = error;
			await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
		}
	}

	throw lastError ?? new Error(`Timed out waiting for ${url}.`);
}

function waitForExit(child, timeoutMs) {
	if (child.exitCode !== null || child.signalCode !== null)
		return Promise.resolve(true);

	return new Promise((resolveExit) => {
		const handleExit = () => {
			clearTimeout(timeout);
			resolveExit(true);
		};
		const timeout = setTimeout(() => {
			child.off("exit", handleExit);
			resolveExit(false);
		}, timeoutMs);
		timeout.unref();
		child.once("exit", handleExit);
	});
}

async function stopProcess(processHandle, label) {
	if (!processHandle || processHandle.child.exitCode !== null || processHandle.child.signalCode !== null)
		return;

	processHandle.child.kill("SIGTERM");

	if (!await waitForExit(processHandle.child, 5_000)) {
		processHandle.child.kill("SIGKILL");
		throw new Error(`${label} did not exit cleanly after SIGTERM.\n${processHandle.getOutput()}`);
	}
}

const temporaryRoot = mkdtempSync(join(tmpdir(), "ballot-clarity-runtime-acceptance-"));
const artifactRoot = join(temporaryRoot, "ballot-clarity-runtime");
const unpackedRoot = join(temporaryRoot, "unpacked", "ballot-clarity-runtime");
const stateRoot = join(temporaryRoot, "state");
let apiProcess;
let frontendProcess;

try {
	buildRuntimeArtifact(artifactRoot);
	mkdirSync(dirname(unpackedRoot), { recursive: true });
	cpSync(artifactRoot, unpackedRoot, { recursive: true });
	const manifest = verifyRuntimeArtifact(unpackedRoot);
	assert.equal(manifest.source.commit.length, 40);
	assert.ok(manifest.files.length > 0);

	const requiredModule = resolve(unpackedRoot, "back-end/dist/live-data-schema.sql");
	const requiredModuleBytes = readFileSync(requiredModule);
	rmSync(requiredModule);
	assert.throws(
		() => verifyRuntimeArtifact(unpackedRoot),
		/missing required path|file inventory does not match/u,
	);
	writeFileSync(requiredModule, requiredModuleBytes, { mode: 0o644 });
	verifyRuntimeArtifact(unpackedRoot);

	mkdirSync(stateRoot, { recursive: true });
	const apiPort = await getFreePort();
	const frontendPort = await getFreePort();
	const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
	const frontendBaseUrl = `http://127.0.0.1:${frontendPort}`;
	const syntheticSecret = "runtime-acceptance-secret-value-with-adequate-length";
	const baseEnvironment = {
		HOME: temporaryRoot,
		LANG: "C.UTF-8",
		NODE_ENV: "production",
		PATH: dirname(process.execPath),
		TMPDIR: temporaryRoot,
	};
	apiProcess = startProcess("back-end/dist/server.js", unpackedRoot, {
		...baseEnvironment,
		ACTIVE_LOOKUP_COOKIE_SECRET: syntheticSecret,
		ADDRESS_CACHE_ENCRYPTION_KEY: "",
		ADMIN_API_KEY: syntheticSecret,
		ADMIN_DATABASE_URL: "",
		ADMIN_DB_PATH: join(stateRoot, "admin.sqlite"),
		ADMIN_MFA_ENCRYPTION_KEY: syntheticSecret,
		ADMIN_SESSION_SECRET: syntheticSecret,
		ADMIN_STORE_DRIVER: "sqlite",
		DATABASE_URL: "",
		HOST: "127.0.0.1",
		LIVE_COVERAGE_FILE: "",
		LIVE_COVERAGE_REQUIRED: "false",
		PORT: String(apiPort),
	});

	const health = await waitForResponse(`${apiBaseUrl}/healthz`);
	assert.equal(health.status, 200, apiProcess.getOutput());
	assert.equal(health.headers.get("cache-control"), "no-store");
	assert.equal(health.headers.get("set-cookie"), null);
	assert.deepEqual(await health.json(), { ok: true });
	const healthHead = await waitForResponse(`${apiBaseUrl}/healthz`, { method: "HEAD" });
	assert.equal(healthHead.status, 200);
	assert.equal(await healthHead.text(), "");
	const readiness = await waitForResponse(`${apiBaseUrl}/readyz`);
	assert.equal(readiness.status, 200, apiProcess.getOutput());
	assert.equal(readiness.headers.get("cache-control"), "no-store");
	assert.equal(readiness.headers.get("set-cookie"), null);
	assert.deepEqual(await readiness.json(), { ok: true });
	const readinessHead = await waitForResponse(`${apiBaseUrl}/readyz`, { method: "HEAD" });
	assert.equal(readinessHead.status, 200);
	assert.equal(await readinessHead.text(), "");

	frontendProcess = startProcess("front-end/.output/server/index.mjs", unpackedRoot, {
		...baseEnvironment,
		ADMIN_API_BASE: `${apiBaseUrl}/api`,
		ADMIN_API_KEY: syntheticSecret,
		ADMIN_SESSION_SECRET: syntheticSecret,
		HOST: "127.0.0.1",
		NUXT_PUBLIC_API_BASE: `${apiBaseUrl}/api`,
		NUXT_PUBLIC_SITE_URL: frontendBaseUrl,
		PORT: String(frontendPort),
	});
	const homepage = await waitForResponse(`${frontendBaseUrl}/`);
	assert.equal(homepage.status, 200, frontendProcess.getOutput());
	assert.match(await homepage.text(), /Ballot Clarity/u);

	await stopProcess(frontendProcess, "Compiled frontend");
	frontendProcess = undefined;
	await stopProcess(apiProcess, "Compiled backend");
	apiProcess = undefined;
	verifyRuntimeArtifact(unpackedRoot);
	console.log(`Runtime artifact acceptance passed for ${manifest.files.length} hashed files.`);
}
finally {
	await stopProcess(frontendProcess, "Compiled frontend cleanup");
	await stopProcess(apiProcess, "Compiled backend cleanup");
	rmSync(temporaryRoot, { force: true, recursive: true });
}
