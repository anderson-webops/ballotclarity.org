import { spawn } from "node:child_process";
import process from "node:process";
import { applyProviderLocalOverrides, findEnvFiles, loadRootEnv } from "./local-env.mjs";

const args = process.argv.slice(2);
const separatorIndex = args.indexOf("--");
const providerLocal = args.includes("--provider-local");
const commandArgs = separatorIndex === -1 ? [] : args.slice(separatorIndex + 1);

if (!commandArgs.length) {
	console.error("Usage: node ./scripts/run-local-command.mjs [--provider-local] -- <command> [args...]");
	process.exit(1);
}

let env = {
	...process.env,
	...loadRootEnv(),
};
const envFiles = findEnvFiles();

if (providerLocal)
	env = applyProviderLocalOverrides(env);

if (!envFiles.length)
	console.warn("Ballot Clarity could not find a local .env file in this worktree or the shared repo root. Provider-backed local commands may run without configured API credentials.");

const child = spawn(commandArgs[0], commandArgs.slice(1), {
	cwd: process.cwd(),
	env,
	stdio: "inherit",
});

child.on("exit", (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}

	process.exit(code ?? 1);
});
