import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
// Collapsible content is reserved for FAQs; list a file here only if it renders FAQ questions.
const faqFiles = new Set<string>();

function vueFiles(directory: string): string[] {
	return readdirSync(directory).flatMap((name) => {
		const path = join(directory, name);
		return statSync(path).isDirectory() ? vueFiles(path) : name.endsWith(".vue") ? [path] : [];
	});
}

test("pages and components show content instead of hiding it in dropdowns", () => {
	const offenders = vueFiles(sourceRoot)
		.filter(path => /<details\b|<summary\b/u.test(readFileSync(path, "utf8")))
		.map(path => relative(sourceRoot, path))
		.filter(path => !faqFiles.has(path));
	assert.deepEqual(offenders, []);
});

test("page sections are always open", () => {
	const section = readFileSync(join(sourceRoot, "components/ExpandableSection.vue"), "utf8");
	assert.doesNotMatch(section, /collapsible|<details/u);
	assert.match(section, /<section/u);
});
