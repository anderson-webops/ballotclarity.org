import { isAbsolute, resolve } from "node:path";
import process from "node:process";
import { initializeHandoffClient } from "./private-handoff-client.js";
import { HandoffError, privateHandoffContract } from "./private-handoff-protocol.js";
import { verifyStoredHandoffWithConfig } from "./private-handoff-verification.js";

const [command, directory, audience, ...extra] = process.argv.slice(2);
if (
	command === "verify"
	&& directory
	&& audience
	&& isAbsolute(directory)
	&& isAbsolute(audience)
	&& extra.length === 3
) {
	verifyStoredHandoffWithConfig(directory, audience, { tag: extra[0]!, commit: extra[1]!, archiveSha256: extra[2]! })
		.then(value => console.log(JSON.stringify(value)))
		.catch((error: unknown) => {
			const legacy = error instanceof HandoffError && error.code === "legacy-signature-unavailable";
			console.error(JSON.stringify({ status: legacy ? "legacy-custody-unverifiable" : "verification-failed" }));
			process.exitCode = legacy ? 76 : 1;
		});
}
else if (command === "contract" && !directory && !audience && !extra.length) {
	console.log(JSON.stringify(privateHandoffContract, null, 2));
}
else if (command !== "init" || !directory || !isAbsolute(directory) || !audience || extra.length) {
	console.error(
		"Use init ABSOLUTE_PRIVATE_DIRECTORY AUDIENCE, or verify PACKET_DIRECTORY TRUST_CONFIG TAG COMMIT ARCHIVE_SHA256. Existing keys are never replaced."
	);
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
