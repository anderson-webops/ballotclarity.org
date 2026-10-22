import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const distRoot = resolve(projectRoot, "dist");
const requiredRuntimeFiles = [
	"admin-schema.postgres.sql",
	"admin-schema.sql",
	"live-data-schema.sql",
	"server.js",
	"manage-election-references.js",
	"manage-state-ballot-data.js",
	"export-state-ballot-sources.js",
	"check-state-ballot-sources.js",
];
const importPatterns = [
	/\b(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?["'](\.[^"']+)["']/gu,
	/\bimport\s*\(\s*["'](\.[^"']+)["']\s*\)/gu,
];

if (!existsSync(distRoot))
	throw new Error(`Missing compiled backend directory: ${distRoot}`);

if (existsSync(resolve(distRoot, "data", "state-ballots")))
	throw new Error("Election datasets must remain outside the compiled runtime.");

const missingFiles = [];

for (const relativePath of requiredRuntimeFiles) {
	const targetPath = resolve(distRoot, relativePath);

	if (!existsSync(targetPath) || !statSync(targetPath).isFile())
		missingFiles.push(relativePath);
}

const compiledJavaScriptFiles = readdirSync(distRoot, {
	recursive: true,
	withFileTypes: true,
})
	.filter(entry => entry.isFile() && extname(entry.name) === ".js")
	.map(entry => resolve(entry.parentPath, entry.name));

for (const sourcePath of compiledJavaScriptFiles) {
	const source = readFileSync(sourcePath, "utf8");

	for (const pattern of importPatterns) {
		for (const match of source.matchAll(pattern)) {
			const importedPath = resolve(dirname(sourcePath), match[1]);

			if (!existsSync(importedPath))
				missingFiles.push(`${sourcePath.slice(distRoot.length + 1)} -> ${match[1]}`);
		}
	}
}

if (missingFiles.length) {
	throw new Error([
		"The backend build is missing required runtime files:",
		...Array.from(new Set(missingFiles)).sort().map(value => `- ${value}`),
	].join("\n"));
}

console.log(`Verified ${compiledJavaScriptFiles.length} compiled backend modules and required runtime assets.`);
