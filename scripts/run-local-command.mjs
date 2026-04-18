import { spawn } from "node:child_process";
import process from "node:process";
import { applyProviderLocalOverrides, loadRootEnv } from "./local-env.mjs";

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

if (providerLocal)
	env = applyProviderLocalOverrides(env);

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
