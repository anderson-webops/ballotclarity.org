import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { applyProviderLocalOverrides, findEnvFiles, loadRootEnv } from "./local-env.mjs";

function runStep(label, command, args, options = {}) {
	return new Promise((resolve, reject) => {
		console.log(`\n== ${label} ==`);

		const child = spawn(command, args, {
			cwd: options.cwd || process.cwd(),
			env: options.env || process.env,
			stdio: "inherit",
		});

		child.on("exit", (code, signal) => {
			if (signal) {
				reject(new Error(`${label} terminated by signal ${signal}.`));
				return;
			}

			if (code !== 0) {
				reject(new Error(`${label} failed with exit code ${code ?? 1}.`));
				return;
			}

			resolve();
		});
	});
}

async function findAvailablePort(preferredPort) {
	async function tryPort(port) {
		return await new Promise((resolve) => {
			const probe = createServer();

			probe.once("error", () => {
				resolve(null);
			});

			probe.once("listening", () => {
				const address = probe.address();

				probe.close(() => {
					resolve(typeof address === "object" && address ? address.port : null);
				});
			});

			probe.listen(port, "127.0.0.1");
		});
	}

	const preferred = Number.parseInt(String(preferredPort || "3001"), 10);
	const safePreferred = Number.isFinite(preferred) && preferred > 0 ? preferred : 3001;
	return await tryPort(safePreferred) || await tryPort(0) || safePreferred;
}

async function waitForHealth(baseUrl, timeoutMs = 30000) {
	const startedAt = Date.now();
	let lastError = "Server did not respond.";

	while ((Date.now() - startedAt) < timeoutMs) {
		try {
			const response = await fetch(`${baseUrl}/health`);

			if (response.ok)
				return await response.json();

			lastError = `Health probe returned ${response.status}.`;
		}
		catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
		}

		await delay(500);
	}

	throw new Error(`Local API health check did not succeed within ${timeoutMs}ms. Last error: ${lastError}`);
}

async function stopProcess(child) {
	if (child.exitCode !== null)
		return;

	child.kill("SIGTERM");
	await once(child, "exit");
}

async function fetchJson(baseUrl, path, options = {}) {
	const response = await fetch(`${baseUrl}${path}`, options);
	const payload = await response.json();

	return {
		payload,
		response,
	};
}

async function main() {
	const cwd = process.cwd();
	const envFiles = findEnvFiles(cwd);

	if (!envFiles.length)
		throw new Error("No .env file was found in this worktree or the shared repo root. Set BALLOT_CLARITY_ENV_PATH or add a local env file before running local verification.");

	console.log("Using env files:");
	for (const envPath of envFiles)
		console.log(`- ${envPath}`);

	const preferredPort = loadRootEnv(cwd).PORT;
	const port = await findAvailablePort(preferredPort);
	const env = applyProviderLocalOverrides({
		...process.env,
		...loadRootEnv(cwd),
		PORT: String(port),
	}, cwd);
	const baseUrl = `http://127.0.0.1:${port}`;

	console.log(`Local API base: ${env.NUXT_PUBLIC_API_BASE}`);
	await runStep("Seed local coverage snapshot", "npm", ["run", "-w", "back-end", "export-seed-coverage:src"], { cwd, env });
	await runStep("Verify configured providers", "npm", ["run", "-w", "back-end", "providers:test:src"], { cwd, env });

	console.log("\n== Start local API ==");
	const server = spawn(resolve(cwd, "node_modules", ".bin", "tsx"), ["-r", "dotenv/config", "src/server.ts"], {
		cwd: resolve(cwd, "back-end"),
		env,
		stdio: ["ignore", "pipe", "pipe"],
	});

	server.stdout.on("data", chunk => process.stdout.write(chunk));
	server.stderr.on("data", chunk => process.stderr.write(chunk));

	try {
		const health = await waitForHealth(baseUrl);

		if (!health?.ok)
			throw new Error("Health response did not report ok=true.");

		const { payload: lookupBody, response: lookupResponse } = await fetchJson(`${baseUrl}`, "/api/location", {
			body: JSON.stringify({ q: "84604" }),
			headers: {
				"Content-Type": "application/json",
			},
			method: "POST",
		});

		if (lookupResponse.status !== 200)
			throw new Error(`Lookup probe failed with ${lookupResponse.status}.`);

		if (lookupBody.result !== "resolved")
			throw new Error(`Lookup probe returned result=${String(lookupBody.result)} instead of resolved.`);

		if (!Array.isArray(lookupBody.districtMatches) || lookupBody.districtMatches.length === 0)
			throw new Error("Lookup probe returned no district matches for ZIP 84604.");

		if (!Array.isArray(lookupBody.representativeMatches) || lookupBody.representativeMatches.length === 0)
			throw new Error("Lookup probe returned no representative matches for ZIP 84604.");

		if (/source-backed local candidate records/i.test(String(lookupBody.availability?.financeInfluence?.detail || "")))
			throw new Error("Lookup probe still exposed stale candidate-only finance/influence copy.");

		const { payload: representativeDirectoryBody, response: representativeDirectoryResponse } = await fetchJson(
			`${baseUrl}`,
			"/api/representatives?lookup=84604"
		);

		if (representativeDirectoryResponse.status !== 200)
			throw new Error(`Representative directory probe failed with ${representativeDirectoryResponse.status}.`);

		if (!Array.isArray(representativeDirectoryBody.representatives) || representativeDirectoryBody.representatives.length !== lookupBody.representativeMatches.length)
			throw new Error("Representative directory probe did not preserve the active lookup representative count.");

		const firstRepresentativeSlug = representativeDirectoryBody.representatives[0]?.slug;

		if (!firstRepresentativeSlug)
			throw new Error("Representative directory probe returned no representative slug to verify.");

		const { payload: representativeProfileBody, response: representativeProfileResponse } = await fetchJson(
			`${baseUrl}`,
			`/api/representatives/${firstRepresentativeSlug}?lookup=84604`
		);

		if (representativeProfileResponse.status !== 200)
			throw new Error(`Representative profile probe failed with ${representativeProfileResponse.status}.`);

		if (/published local guide attached to this person record/i.test(String(representativeProfileBody.person?.whatWeDoNotKnow?.[0]?.text || "")))
			throw new Error("Representative profile probe still exposed stale guide-only finance/influence fallback copy.");

		console.log("\n== Local runtime verification passed ==");
		console.log(`Resolved ${lookupBody.location?.displayName || "unknown location"} with ${lookupBody.districtMatches.length} district matches and ${lookupBody.representativeMatches.length} representative matches.`);
		console.log(`Verified representative directory/profile backing for ${representativeDirectoryBody.representatives[0].name}.`);
	}
	finally {
		await stopProcess(server);
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : "Local runtime verification failed.");
	process.exit(1);
});
