import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
// @ts-expect-error Plain ESM helper is exercised directly in this runtime test.
import { applyProviderLocalOverrides, findEnvFiles, loadRootEnv, resolveSharedRepoRoot } from "../../scripts/local-env.mjs";

function createTempWorkspace() {
	const root = mkdtempSync(join(tmpdir(), "ballot-clarity-local-env-"));

	return {
		dispose() {
			rmSync(root, { force: true, recursive: true });
		},
		root,
	};
}

test("loadRootEnv falls back to the shared repo env when running from a git worktree", () => {
	const workspace = createTempWorkspace();

	try {
		const sharedRepoRoot = join(workspace.root, "shared-repo");
		const worktreeRoot = join(workspace.root, "active-worktree");
		const gitdir = join(sharedRepoRoot, ".git", "worktrees", "active-worktree");

		mkdirSync(gitdir, { recursive: true });
		mkdirSync(worktreeRoot, { recursive: true });
		writeFileSync(join(sharedRepoRoot, ".env"), "SHARED_VALUE=shared\nOVERRIDE_ME=shared\n", "utf8");
		writeFileSync(join(worktreeRoot, ".env"), "LOCAL_VALUE=local\nOVERRIDE_ME=local\n", "utf8");
		writeFileSync(join(worktreeRoot, ".git"), `gitdir: ${gitdir}\n`, "utf8");

		assert.equal(resolveSharedRepoRoot(worktreeRoot), sharedRepoRoot);
		assert.deepEqual(findEnvFiles(worktreeRoot), [
			join(sharedRepoRoot, ".env"),
			join(worktreeRoot, ".env"),
		]);
		assert.deepEqual(loadRootEnv(worktreeRoot), {
			LOCAL_VALUE: "local",
			OVERRIDE_ME: "local",
			SHARED_VALUE: "shared",
		});
	}
	finally {
		workspace.dispose();
	}
});

test("applyProviderLocalOverrides forces provider-local API bases and local snapshot paths", () => {
	const cwd = "/tmp/ballot-clarity";
	const overrides = applyProviderLocalOverrides({
		LAUNCH_DIRECTORY_FILE: "./data/custom-launch-directory.json",
		LIVE_COVERAGE_FILE: "./data/custom-coverage.json",
		PORT: "4123",
	}, cwd);

	assert.equal(overrides.ADMIN_API_BASE, "http://127.0.0.1:4123/api");
	assert.equal(overrides.NUXT_PUBLIC_API_BASE, "http://127.0.0.1:4123/api");
	assert.equal(overrides.NUXT_PUBLIC_SITE_URL, "http://127.0.0.1:3333");
	assert.equal(overrides.ADMIN_DB_PATH, resolve(cwd, "back-end", "data", "ballot-clarity.sqlite"));
	assert.equal(overrides.GOOGLE_CIVIC_FORCE_IPV4, "");
	assert.equal(overrides.LIVE_COVERAGE_FILE, resolve(cwd, "data", "custom-coverage.json"));
	assert.equal(overrides.LAUNCH_DIRECTORY_FILE, resolve(cwd, "data", "custom-launch-directory.json"));
	assert.equal(overrides.ADMIN_STORE_DRIVER, "sqlite");
	assert.equal(overrides.ADMIN_DATABASE_URL, "");
	assert.equal(overrides.DATABASE_URL, "");
});

test("applyProviderLocalOverrides enables IPv4 for Google Civic in provider-local mode when a key is present", () => {
	const overrides = applyProviderLocalOverrides({
		GOOGLE_CIVIC_API_KEY: "test-key",
	}, "/tmp/ballot-clarity");

	assert.equal(overrides.GOOGLE_CIVIC_FORCE_IPV4, "true");
});
