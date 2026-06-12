import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const publicSourceRoots = [
	new URL("../src/components", import.meta.url),
	new URL("../src/pages", import.meta.url)
];

const referenceArchiveFragments = [
	"Elena Torres",
	"Daniel Brooks",
	"Naomi Park",
	"Thomas Bell",
	"Alicia Greene",
	"Marcus Hill",
	"Sandra Patel",
	"elena-torres",
	"daniel-brooks",
	"naomi-park",
	"thomas-bell",
	"alicia-greene",
	"marcus-hill",
	"sandra-patel"
];

function collectPublicVueFiles(root: URL) {
	const rootPath = fileURLToPath(root);
	const files: string[] = [];
	const pending = [rootPath];

	while (pending.length) {
		const current = pending.pop();
		if (!current)
			continue;

		for (const entry of readdirSync(current)) {
			const path = join(current, entry);
			const stats = statSync(path);

			if (stats.isDirectory()) {
				if (entry !== "admin")
					pending.push(path);
				continue;
			}

			if (entry.endsWith(".vue"))
				files.push(path);
		}
	}

	return files;
}

test("public copy does not expose staged reference-archive candidate names", () => {
	const failures: string[] = [];

	for (const root of publicSourceRoots) {
		for (const file of collectPublicVueFiles(root)) {
			const body = readFileSync(file, "utf8");
			for (const fragment of referenceArchiveFragments) {
				if (body.includes(fragment))
					failures.push(`${relative(process.cwd(), file)} contains ${fragment}`);
			}
		}
	}

	assert.deepEqual(failures, []);
});
