import { isAbsolute, resolve } from "node:path";
import process from "node:process";
import { initializeHandoffClient } from "./private-handoff-client.js";
import { privateHandoffContract } from "./private-handoff-protocol.js";

const [command, directory, audience, ...extra] = process.argv.slice(2);
if (command === "contract" && !directory && !audience && !extra.length) {
	console.log(JSON.stringify(privateHandoffContract, null, 2));
}
else if (command !== "init" || !directory || !isAbsolute(directory) || !audience || extra.length) {
	console.error("Use init ABSOLUTE_PRIVATE_DIRECTORY AUDIENCE. Existing keys are never replaced.");
	process.exitCode = 1;
}
else {
	initializeHandoffClient(resolve(directory), audience)
		.then(value => console.log(JSON.stringify(value, null, 2)))
		.catch(() => {
			console.error(
				"Private handoff setup failed. Use an empty, owner-only directory outside repositories and AI working folders."
			);
			process.exitCode = 1;
		});
}
