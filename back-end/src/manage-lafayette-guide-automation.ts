import process from "node:process";
import { inspectLafayetteGuideAutomation, runLafayetteGuideAutomation } from "./lafayette-guide-automation.js";

const [command, profile, policy, ...extra] = process.argv.slice(2);
if (!profile || extra.length || !["run", "inspect"].includes(command ?? "") || (command === "run"
	? !policy
	: Boolean(policy))) {
	console.error("Use manage-lafayette-guide-automation run PROFILE.json POLICY.json or inspect PROFILE.json.");
	process.exitCode = 1;
}
else {
	(command === "run"
		? runLafayetteGuideAutomation(profile, policy!)
		: inspectLafayetteGuideAutomation(profile)).then(result => console.log(JSON.stringify(result))).catch((error: unknown) => {
		console.error(error instanceof Error
			? error.message
			: "Lafayette guide automation failed.");
		process.exitCode = 1;
	});
}
