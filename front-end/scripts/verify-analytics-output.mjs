import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extname, join } from "node:path";

const outputDir = fileURLToPath(new URL("../.output", import.meta.url));
const expectedTrackers = [
	{
		label: "dedicated",
		src: "https://analytics.ballotclarity.org/script.js",
		websiteId: "98d97870-5812-4931-9e2d-4ae2f55484cb"
	},
	{
		label: "central",
		src: "https://analytics.jacobdanderson.net/script.js",
		websiteId: "98d97870-5812-4931-9e2d-4ae2f55484cb"
	}
];
const readableExtensions = new Set([".html", ".js", ".json", ".mjs"]);

function collectFiles(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = join(directory, entry.name);

		if (entry.isDirectory())
			return collectFiles(entryPath);

		return readableExtensions.has(extname(entry.name)) ? [entryPath] : [];
	});
}

if (!existsSync(outputDir)) {
	console.error(`Missing Nuxt build output at ${outputDir}. Run npm run build first.`);
	process.exit(1);
}

const buildText = collectFiles(outputDir).map(file => readFileSync(file, "utf8")).join("\n");
const renderedTrackers = expectedTrackers.map(tracker => ({
	...tracker,
	hasSrc: buildText.includes(tracker.src),
	hasWebsiteId: buildText.includes(tracker.websiteId)
}));
const missingTrackers = renderedTrackers.filter(tracker => !tracker.hasSrc || !tracker.hasWebsiteId);

console.log("Ballot Clarity analytics trackers rendered in build output:");
for (const tracker of renderedTrackers)
	console.log(`- ${tracker.label}: ${tracker.src} (${tracker.websiteId})`);

if (missingTrackers.length > 0) {
	console.error("Missing analytics tracker data:");
	for (const tracker of missingTrackers)
		console.error(`- ${tracker.label}: src=${tracker.hasSrc} websiteId=${tracker.hasWebsiteId}`);
	process.exit(1);
}
