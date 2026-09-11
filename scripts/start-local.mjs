import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { applyProviderLocalOverrides, findEnvFiles, loadRootEnv } from "./local-env.mjs";

function parsePort(value, label) {
	if (!/^\d+$/u.test(String(value)) || Number(value) < 1 || Number(value) > 65535)
		throw new Error(`${label} must be a whole number from 1 to 65535.`);
	return Number(value);
}

export function buildLocalDevelopmentConfig(cwd, sourceEnv, options = {}) {
	const apiPort = parsePort(options.apiPort ?? sourceEnv.LOCAL_API_PORT ?? 3001, "API port");
	const webPort = parsePort(options.webPort ?? sourceEnv.LOCAL_WEB_PORT ?? 3333, "Website port");
	if (apiPort === webPort)
		throw new Error("The API and website need different ports.");
	const localEnv = applyProviderLocalOverrides({ ...sourceEnv, PORT: String(apiPort) }, cwd);
	const configuredCoverage = sourceEnv.LIVE_COVERAGE_FILE?.trim();
	const coverageFile = configuredCoverage
		? resolve(cwd, configuredCoverage)
		: existsSync(localEnv.LIVE_COVERAGE_FILE)
			? localEnv.LIVE_COVERAGE_FILE
			: resolve(cwd, "back-end/data/reviewed/fulton-county-2026-general.official-logistics-only.json");
	return {
		apiPort,
		cwd,
		webPort,
		webUrl: `http://127.0.0.1:${webPort}`,
		env: {
			...localEnv,
			ACTIVE_LOOKUP_COOKIE_SECRET: sourceEnv.ACTIVE_LOOKUP_COOKIE_SECRET || randomBytes(32).toString("hex"),
			ADMIN_BOOTSTRAP_PASSWORD: "",
			ADMIN_BOOTSTRAP_USERNAME: "",
			ADMIN_DB_PATH: resolve(cwd, "back-end/data/local-development.sqlite"),
			ADMIN_PASSWORD: "",
			ADMIN_USERNAME: "",
			HOST: "127.0.0.1",
			LIVE_COVERAGE_FILE: coverageFile,
			NITRO_HOST: "127.0.0.1",
			NITRO_PORT: String(webPort),
			NODE_ENV: "development",
			NUXT_PUBLIC_SITE_URL: `http://127.0.0.1:${webPort}`,
			ZIP_LOOKUP_LOG_ENABLED: "false",
		},
	};
}

export async function assertPortAvailable(port) {
	await new Promise((resolvePort, reject) => {
		const server = createServer();
		server.once("error", () => reject(new Error(`Local port ${port} is unavailable. Stop its current service or choose another port.`)));
		server.listen(port, "127.0.0.1", () => server.close(error => error ? reject(error) : resolvePort()));
	});
}

export function assertLocalFiles(config, nodeVersion = process.versions.node) {
	const minimum = readFileSync(resolve(config.cwd, ".nvmrc"), "utf8").trim().split(".").map(Number);
	const actual = nodeVersion.split(".").map(Number);
	if (actual[0] !== minimum[0] || actual[1] < minimum[1] || (actual[1] === minimum[1] && actual[2] < minimum[2]))
		throw new Error("Use the Node LTS version in .nvmrc before starting locally (nvm use). Then run npm ci.");
	for (const file of ["node_modules/@nuxt/cli/bin/nuxi.mjs", "node_modules/tsx/dist/cli.mjs"]) {
		if (!existsSync(resolve(config.cwd, file)))
			throw new Error("Local dependencies are missing. Run npm ci from the repository root first.");
	}
	if (!existsSync(config.env.LIVE_COVERAGE_FILE))
		throw new Error("LIVE_COVERAGE_FILE points to a missing snapshot. Correct that path or unset it to use the bundled local preview snapshot.");
}

export function superviseLocalProcesses(specifications, env, { signal, stdio = "inherit" } = {}) {
	return new Promise((resolveRun, reject) => {
		const children = [];
		let stopping = false;
		let result = 0;
		let spawnError;
		let killTimer;
		const signalChild = (child, childSignal) => {
			if (!child.pid)
				return;
			try {
				if (process.platform === "win32") child.kill(childSignal);
				else process.kill(-child.pid, childSignal);
			}
			catch (error) {
				if (error.code !== "ESRCH") throw error;
			}
		};
		const finish = () => {
			if (!stopping || children.some(entry => !entry.closed)) return;
			clearTimeout(killTimer);
			signal?.removeEventListener("abort", stopFromSignal);
			if (spawnError) reject(spawnError);
			else resolveRun(result);
		};
		const stop = (code) => {
			if (stopping) return;
			stopping = true;
			result = code;
			for (const { child } of children) signalChild(child, "SIGTERM");
			killTimer = setTimeout(() => {
				for (const { child, closed } of children) {
					if (!closed) signalChild(child, "SIGKILL");
				}
			}, 3000);
			killTimer.unref();
			finish();
		};
		function stopFromSignal() {
			stop(0);
		}
		if (signal?.aborted) {
			resolveRun(0);
			return;
		}
		for (const specification of specifications) {
			const child = spawn(specification.command, specification.args, {
				cwd: specification.cwd,
				env,
				stdio,
				detached: process.platform !== "win32",
			});
			const entry = { child, closed: false };
			children.push(entry);
			child.once("error", () => {
				spawnError = new Error(`Could not start ${specification.label}. Check the local installation.`);
				stop(1);
			});
			child.once("close", (code) => {
				entry.closed = true;
				stop(code || 1);
				finish();
			});
		}
		signal?.addEventListener("abort", stopFromSignal, { once: true });
	});
}

async function main() {
	const { values } = parseArgs({ options: {
		"api-port": { type: "string" },
		"web-port": { type: "string" },
		"check": { type: "boolean" },
		"help": { type: "boolean" },
	} });
	if (values.help) {
		console.log("npm run start:local -- [--api-port 3001] [--web-port 3333]\nUse npm run doctor:local to check configuration without starting services.");
		return;
	}
	const cwd = process.cwd();
	const config = buildLocalDevelopmentConfig(cwd, { ...loadRootEnv(cwd), ...process.env }, {
		apiPort: values["api-port"],
		webPort: values["web-port"],
	});
	assertLocalFiles(config);
	await Promise.all([assertPortAvailable(config.apiPort), assertPortAvailable(config.webPort)]);
	console.log(`Local setup ready. Node ${process.versions.node}; ${findEnvFiles(cwd).length} environment file(s) loaded.`);
	console.log(`Website: ${config.webUrl}\nAPI: http://127.0.0.1:${config.apiPort}`);
	console.log("Local SQLite store is isolated from the configured admin database. Existing coverage files are preserved.");
	console.log("Provider credentials are optional for preview; real lookup coverage depends on the configured sources.");
	if (values.check) return;
	const controller = new AbortController();
	const stop = () => controller.abort();
	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);
	const readyNotice = async () => {
		while (!controller.signal.aborted) {
			try {
				const response = await fetch(`${config.webUrl}/`, { signal: AbortSignal.timeout(2000) });
				if (response.ok) {
					console.log(`\nOpen ${config.webUrl} to use Ballot Clarity. Ctrl+C stops both services.\n`);
					return;
				}
			}
			catch {}
			await delay(1000, undefined, { signal: controller.signal }).catch(() => {});
		}
	};
	void readyNotice();
	try {
		process.exitCode = await superviseLocalProcesses([
			{ label: "API", command: process.execPath, args: ["--watch", "--import", "tsx", "src/server.ts"], cwd: resolve(cwd, "back-end") },
			{ label: "website", command: process.execPath, args: [resolve(cwd, "node_modules/@nuxt/cli/bin/nuxi.mjs"), "dev", "--host", "127.0.0.1", "--port", String(config.webPort)], cwd: resolve(cwd, "front-end") },
		], config.env, { signal: controller.signal });
	}
	finally {
		controller.abort();
		process.removeListener("SIGINT", stop);
		process.removeListener("SIGTERM", stop);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : "Local startup failed.");
		process.exitCode = 1;
	});
}
