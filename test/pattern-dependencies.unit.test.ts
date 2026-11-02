import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { Linter } from "eslint";
import { glob } from "glob";
import { minimatch, Minimatch } from "minimatch";

test("patched matching preserves the object API and patterns used by lint, tracing and archives", () => {
	assert.equal(new Minimatch("**/*.{ts,vue}").match("src/pages/example.vue"), true);
	assert.equal(minimatch("src/.private.ts", "**/*.ts"), false);
	assert.equal(minimatch("src/.private.ts", "**/*.ts", { dot: true }), true);
	assert.equal(minimatch("source/élection.ts", "source/*.ts"), true);
	assert.equal(minimatch("src/example.test.ts", "**/!(*.test).ts"), false);
	assert.equal(minimatch("src/example.ts", "**/!(*.test).ts"), true);
	assert.equal(new Minimatch("src/**/*.ts").match("src/nested/example.ts"), true);
});

test("patched import-x keeps allow and forbid rules active in both module formats", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-import-rule-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	await mkdir(join(directory, "nested"));
	await writeFile(join(directory, "nested", "worker.js"), "export {};\n");
	const imported = await import("eslint-plugin-import-x");
	const required = createRequire(import.meta.url)("eslint-plugin-import-x");
	for (const loaded of [imported, required]) {
		const plugin = loaded.default ?? loaded.importX ?? loaded;
		const linter = new Linter({ cwd: directory });
		const check = (options: Record<string, string[]>) => linter.verify("import './nested/worker.js';", [{ plugins: { imports: plugin }, rules: { "imports/no-internal-modules": ["error", options] } }], { filename: join(directory, "index.js") });
		assert.equal(check({ forbid: ["nested/**"] }).length, 1);
		assert.equal(check({ forbid: ["other/**"] }).length, 0);
		assert.equal(check({ allow: ["nested/**"] }).length, 0);
	}
});

test("patched file tracing preserves glob results, ignores and pre-aborted cancellation", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-patterns-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	await mkdir(join(directory, "nested"));
	for (const name of ["index.js", "nested/worker.js", "nested/ignore.js", "nested/.private.js"]) await writeFile(join(directory, name), "export {};\n");
	assert.deepEqual((await glob("**/*.js", { cwd: directory, ignore: "**/ignore.js" })).sort(), ["index.js", "nested/worker.js"]);
	assert.deepEqual((await glob("nested/.*.js", { cwd: directory })).sort(), ["nested/.private.js"]);
	const cancellation = new AbortController();
	cancellation.abort();
	await assert.rejects(glob("**/*", { cwd: directory, signal: cancellation.signal }), { name: "AbortError" });
});
