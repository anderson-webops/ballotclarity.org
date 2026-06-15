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

test("CI runs the production configuration policy", () => {
	const workflow = readText(".github/workflows/ci.yml");

	assert.match(workflow, /^\s{2}production-config:/m);
	assert.match(workflow, /name: Production configuration policy\s+run: npm run verify:production:fixture/);
});

test("CI verifies production analytics after the Nuxt build", () => {
	const workflow = readText(".github/workflows/ci.yml");
	const buildJob = workflow.slice(workflow.indexOf("  build:"));

	assert.match(buildJob, /name: Build\s+run: npm run build/);
	assert.match(buildJob, /name: Analytics bundle verification\s+run: npm run verify:analytics/);
	assert.ok(
		buildJob.indexOf("run: npm run build") < buildJob.indexOf("run: npm run verify:analytics"),
		"analytics verification must run after the build output exists",
	);
});
