import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { NuxtConfigSchema } from "@nuxt/schema";
import { applyDefaults } from "untyped";

test("Nuxt workspace discovery keeps unrelated parent lockfiles and settings outside its file boundary", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-nuxt-workspace-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const rootDir = join(directory, "project");
	await mkdir(rootDir);
	await writeFile(join(directory, "package-lock.json"), "{}\n");
	await writeFile(join(directory, "pnpm-workspace.yaml"), "onlyBuiltDependencies: []\n");
	await writeFile(join(directory, "deno.json"), "{\"compilerOptions\":{}}\n");
	const config = await applyDefaults(NuxtConfigSchema, { rootDir });
	assert.equal(config.workspaceDir, rootDir);
});

test("Nuxt workspace discovery preserves declared monorepos and explicit workspace configuration", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-nuxt-monorepo-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const rootDir = join(directory, "front-end");
	await mkdir(rootDir);
	await writeFile(join(directory, "package.json"), "{\"workspaces\":[\"front-end\"]}\n");
	assert.equal((await applyDefaults(NuxtConfigSchema, { rootDir })).workspaceDir, directory);
	assert.equal((await applyDefaults(NuxtConfigSchema, { rootDir, workspaceDir: "." })).workspaceDir, rootDir);
});
