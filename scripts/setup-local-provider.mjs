import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";
import { applyProviderLocalOverrides, loadRootEnv } from "./local-env.mjs";

const cwd = process.cwd();
const env = applyProviderLocalOverrides({
	...process.env,
	...loadRootEnv(cwd),
}, cwd);

const sqlitePath = env.ADMIN_DB_PATH;

function runStep(label, command, args) {
	return new Promise((resolve, reject) => {
		console.log(`\n== ${label} ==`);
		const child = spawn(command, args, {
			cwd,
			env,
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

async function main() {
	await runStep("Seed local coverage snapshot", "npm", ["run", "-w", "back-end", "export-seed-coverage:src"]);

	if (!sqlitePath || !existsSync(sqlitePath)) {
		await runStep("Bootstrap local sqlite admin", "npm", ["run", "-w", "back-end", "bootstrap-admin:src"]);
	}
	else {
		console.log(`\n== Bootstrap local sqlite admin ==\nSkipping bootstrap because ${sqlitePath} already exists.`);
	}

	await runStep("Verify configured providers", "npm", ["run", "-w", "back-end", "providers:test:src"]);
	await runStep("Sync provider-backed launch directory", "npm", ["run", "-w", "back-end", "sync:launch-directory:src"]);

	console.log("\nLocal provider setup completed.");
	console.log("Next steps:");
	console.log("- Run `npm run server:local:watch` for the API.");
	console.log("- Run `npm run dev` for the Nuxt front-end.");
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : "Local provider setup failed.");
	process.exit(1);
});
