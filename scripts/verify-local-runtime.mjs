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

		if (lookupBody.availability?.financeInfluence?.status !== "available")
			throw new Error("Lookup probe did not expose finance/influence availability even though a matched representative module crosswalk should exist.");

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

		if (!representativeDirectoryBody.representatives.some(item => item.fundingAvailable || item.influenceAvailable))
			throw new Error("Representative directory probe did not surface any live funding or influence module availability.");

		const { payload: representativeProfileBody, response: representativeProfileResponse } = await fetchJson(
			`${baseUrl}`,
			`/api/representatives/${firstRepresentativeSlug}?lookup=84604`
		);

		if (representativeProfileResponse.status !== 200)
			throw new Error(`Representative profile probe failed with ${representativeProfileResponse.status}.`);

		if (/published local guide attached to this person record/i.test(String(representativeProfileBody.person?.whatWeDoNotKnow?.[0]?.text || "")))
			throw new Error("Representative profile probe still exposed stale guide-only finance/influence fallback copy.");

		if (!representativeProfileBody.person?.funding)
			throw new Error("Representative profile probe did not attach a finance summary from the provider-backed federal crosswalk.");

		if (!Array.isArray(representativeProfileBody.person?.lobbyingContext) || representativeProfileBody.person.lobbyingContext.length === 0)
			throw new Error("Representative profile probe did not attach lobbying or influence context from the provider-backed federal crosswalk.");

		const firstDistrictSlug = representativeDirectoryBody.representatives[0]?.districtSlug || "congressional-3";
		const { payload: directDistrictBody, response: directDistrictResponse } = await fetchJson(
			`${baseUrl}`,
			`/api/districts/${firstDistrictSlug}`
		);

		if (directDistrictResponse.status !== 200)
			throw new Error(`Direct district route probe failed with ${directDistrictResponse.status}.`);

		if (/Lookup context required/i.test(String(directDistrictBody.districtOriginLabel || "")))
			throw new Error("Direct district route probe still fell back to lookup-required district copy.");

		const { payload: directRepresentativeBody, response: directRepresentativeResponse } = await fetchJson(
			`${baseUrl}`,
			`/api/representatives/${firstRepresentativeSlug}`
		);

		if (directRepresentativeResponse.status !== 200)
			throw new Error(`Direct representative route probe failed with ${directRepresentativeResponse.status}.`);

		if (String(directRepresentativeBody.person?.name || "").trim() !== String(representativeDirectoryBody.representatives[0]?.name || "").trim())
			throw new Error("Direct representative route probe did not preserve the expected person identity.");

		if (/pending lookup context/i.test(String(directRepresentativeBody.person?.officeholderLabel || "")))
			throw new Error("Direct representative route probe still exposed lookup-context placeholder copy.");

		if (!directRepresentativeBody.person?.funding)
			throw new Error("Direct representative route probe did not preserve finance data on the public route-backed person record.");

		if (!Array.isArray(directRepresentativeBody.person?.lobbyingContext) || directRepresentativeBody.person.lobbyingContext.length === 0)
			throw new Error("Direct representative route probe did not preserve influence data on the public route-backed person record.");

		const { payload: richRepresentativeBody, response: richRepresentativeResponse } = await fetchJson(
			`${baseUrl}`,
			"/api/representatives/rich-mccormick"
		);

		if (richRepresentativeResponse.status !== 200)
			throw new Error(`Crosswalked representative route probe failed with ${richRepresentativeResponse.status}.`);

		if (!richRepresentativeBody.person?.funding)
			throw new Error("Crosswalked representative route probe did not attach funding data for a nickname-vs-formal-name federal match.");

		if (!Array.isArray(richRepresentativeBody.person?.lobbyingContext) || richRepresentativeBody.person.lobbyingContext.length === 0)
			throw new Error("Crosswalked representative route probe did not attach influence data for a nickname-vs-formal-name federal match.");

		const { payload: jonRepresentativeBody, response: jonRepresentativeResponse } = await fetchJson(
			`${baseUrl}`,
			"/api/representatives/jon-ossoff"
		);

		if (jonRepresentativeResponse.status !== 200)
			throw new Error(`Jon Ossoff representative probe failed with ${jonRepresentativeResponse.status}.`);

		if (!jonRepresentativeBody.person?.funding)
			throw new Error("Direct senator route probe did not attach OpenFEC funding data for Jon Ossoff.");

		if (!Array.isArray(jonRepresentativeBody.person?.lobbyingContext) || jonRepresentativeBody.person.lobbyingContext.length === 0)
			throw new Error("Direct senator route probe did not attach LDA influence data for Jon Ossoff.");

		if (jonRepresentativeBody.person?.enrichmentStatus?.legislativeContext?.status !== "available")
			throw new Error("Direct senator route probe did not attach Congress.gov legislative context for Jon Ossoff.");

		const { payload: tylerRepresentativeBody, response: tylerRepresentativeResponse } = await fetchJson(
			`${baseUrl}`,
			"/api/representatives/tyler-clancy"
		);

		if (tylerRepresentativeResponse.status !== 200)
			throw new Error(`Tyler Clancy representative probe failed with ${tylerRepresentativeResponse.status}.`);

		if (tylerRepresentativeBody.person?.enrichmentStatus?.funding?.reasonCode !== "federal_only_provider")
			throw new Error("State legislator route probe did not expose the precise federal-only funding reason.");

		if (tylerRepresentativeBody.person?.enrichmentStatus?.influence?.reasonCode !== "federal_only_provider")
			throw new Error("State legislator route probe did not expose the precise federal-only influence reason.");

		console.log("\n== Local runtime verification passed ==");
		console.log(`Resolved ${lookupBody.location?.displayName || "unknown location"} with ${lookupBody.districtMatches.length} district matches and ${lookupBody.representativeMatches.length} representative matches.`);
		console.log(`Verified representative directory/profile backing for ${representativeDirectoryBody.representatives[0].name}, including live finance and influence modules.`);
		console.log(`Verified direct district route backing for ${directDistrictBody.district?.title || firstDistrictSlug}, direct representative route backing for ${directRepresentativeBody.person?.name || firstRepresentativeSlug}, plus federal enrichment attachment for ${richRepresentativeBody.person?.name || "rich-mccormick"} and ${jonRepresentativeBody.person?.name || "jon-ossoff"}.`);
	}
	finally {
		await stopProcess(server);
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : "Local runtime verification failed.");
	process.exit(1);
});
