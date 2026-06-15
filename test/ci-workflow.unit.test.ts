import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

function readText(path: string) {
	return readFileSync(join(repoRoot, path), "utf8");
}

test("CI runs the repository security audit policy", () => {
	const workflow = readText(".github/workflows/ci.yml");

	assert.match(workflow, /^\s{2}security-audit:/m);
	assert.match(workflow, /run: npm ci/);
	assert.match(workflow, /name: Security audit policy\s+run: npm run audit/);
});
