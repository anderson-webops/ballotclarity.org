import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import test, { after, before } from "node:test";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

const repoRoot = process.cwd();

let apiProcess: ChildProcessWithoutNullStreams | null = null;
let appProcess: ChildProcessWithoutNullStreams | null = null;
let apiBaseUrl = "";
let appBaseUrl = "";

async function getFreePort() {
	return await new Promise<number>((resolve, reject) => {
		const server = createServer();

		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();

			if (!address || typeof address === "string") {
				server.close();
				reject(new Error("Unable to resolve a free port."));
				return;
			}

			server.close(error => error ? reject(error) : resolve(address.port));
		});
	});
}

function startProcess(command: string, args: string[], env: NodeJS.ProcessEnv) {
	const child = spawn(command, args, {
		cwd: repoRoot,
		env,
		stdio: ["ignore", "pipe", "pipe"]
	});

	const output: string[] = [];
	const collect = (chunk: Buffer) => output.push(chunk.toString());

	child.stdout.on("data", collect);
	child.stderr.on("data", collect);

	return {
		child,
		getOutput: () => output.join("")
	};
}

async function waitForUrl(url: string, label: string) {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		try {
			const response = await fetch(url);

			if (response.ok)
				return;
		}
		catch {
			// Keep polling until the process is ready.
		}

		await delay(500);
	}

	throw new Error(`Timed out waiting for ${label} at ${url}`);
}

async function stopProcess(processHandle: ChildProcessWithoutNullStreams | null) {
	if (!processHandle || processHandle.exitCode !== null)
		return;

	processHandle.kill("SIGTERM");
	await once(processHandle, "exit");
}

before(async () => {
	const apiPort = await getFreePort();
	const appPort = await getFreePort();

	apiBaseUrl = `http://127.0.0.1:${apiPort}`;
	appBaseUrl = `http://127.0.0.1:${appPort}`;

	const api = startProcess(process.execPath, ["back-end/dist/server.js"], {
		...process.env,
		PORT: String(apiPort)
	});
	apiProcess = api.child;

	await waitForUrl(`${apiBaseUrl}/health`, "demo API");

	const app = startProcess(process.execPath, ["front-end/.output/server/index.mjs"], {
		...process.env,
		PORT: String(appPort),
		NUXT_PUBLIC_API_BASE: `${apiBaseUrl}/api`
	});
	appProcess = app.child;

	try {
		await waitForUrl(`${appBaseUrl}/`, "Nuxt application");
	}
	catch (error) {
		throw new Error(`${String(error)}\n\nAPI output:\n${api.getOutput()}\n\nApp output:\n${app.getOutput()}`);
	}
});

after(async () => {
	await Promise.all([
		stopProcess(appProcess),
		stopProcess(apiProcess)
	]);
});

test("built app renders the key ballot guide pages against the built API", async () => {
	const ballotResponse = await fetch(`${apiBaseUrl}/api/ballot?election=2026-metro-county-general`);
	const ballot = await ballotResponse.json();
	const homePage = await fetch(`${appBaseUrl}/`);
	const homeHtml = await homePage.text();
	const ballotPage = await fetch(`${appBaseUrl}/ballot/2026-metro-county-general`);
	const ballotHtml = await ballotPage.text();
	const candidatePage = await fetch(`${appBaseUrl}/candidate/elena-torres`);
	const candidateHtml = await candidatePage.text();
	const measurePage = await fetch(`${appBaseUrl}/measure/charter-amendment-a`);
	const measureHtml = await measurePage.text();
	const comparePage = await fetch(`${appBaseUrl}/compare?slugs=elena-torres,daniel-brooks`);
	const compareHtml = await comparePage.text();

	assert.equal(ballotResponse.status, 200);
	assert.equal(ballot.demo, true);
	assert.equal(homePage.status, 200);
	assert.match(homeHtml, /Understand your ballot without the overload/);
	assert.match(homeHtml, /Demo ballot preview/);
	assert.match(ballotHtml, /Questions to ask before you vote/);
	assert.match(ballotHtml, /Metro County, Franklin/);
	assert.match(ballotHtml, /Demo data/i);
	assert.match(candidateHtml, /Elena Torres/);
	assert.match(candidateHtml, /What we know/);
	assert.match(candidateHtml, /Campaign funding overview/);
	assert.match(measureHtml, /What a YES vote means/);
	assert.match(measureHtml, /What a NO vote means/);
	assert.match(compareHtml, /Compare candidates side by side/);
	assert.match(compareHtml, /No scores or rankings/);
});
