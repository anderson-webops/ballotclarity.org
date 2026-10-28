import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { verifyRuntimeArtifact } from "../scripts/runtime-artifact.mjs";

function write(root: string, path: string, value: string) {
	mkdirSync(dirname(join(root, path)), { recursive: true });
	writeFileSync(join(root, path), value);
}

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "ballot-runtime-external-data-"));
	for (const script of ["copy-runtime-assets.mjs", "verify-runtime-build.mjs"]) {
		mkdirSync(join(root, "scripts"), { recursive: true });
		copyFileSync(new URL(`../back-end/scripts/${script}`, import.meta.url), join(root, "scripts", script));
	}
	for (const name of ["admin-schema.sql", "admin-schema.postgres.sql", "live-data-schema.sql"]) write(root, name, "SELECT 1;\n");
	for (const name of ["server.js", "manage-election-references.js", "manage-election-documents.js", "manage-state-ballot-cycles.js", "manage-state-ballot-automation.js", "admin-operations.js", "prepare-state-measure-guides.js", "state-measure-guides.js", "election-document-collection.js", "election-document-sources.js", "congressional-biographies.js", "prepare-congressional-biographies.js", "washington-statements.js", "washington-statement-sources.js", "prepare-washington-statements.js", "manage-state-ballot-data.js", "export-state-ballot-sources.js", "check-state-ballot-sources.js"]) write(root, `dist/${name}`, "export {};\n");
	for (const name of ["manage-court-directory.js", "court-directories.js", "court-directory-storage.js", "collect-court-directory.js", "private-handoff-protocol.js", "private-handoff-storage.js", "private-handoff-client.js", "private-handoff-receiver.js", "private-handoff-verification.js", "manage-private-handoff.js"]) write(root, `dist/${name}`, "export {};\n");
	write(root, "dist/release-identity.json", '{"version":"development","commit":"0000000000000000000000000000000000000000"}\n');
	return root;
}

test("runtime copying removes stale generated election datasets and refuses new source bundles", () => {
	const root = fixture();
	try {
		write(root, "dist/data/state-ballots/stale.json", "{}");
		const copied = spawnSync(process.execPath, [join(root, "scripts/copy-runtime-assets.mjs")], { encoding: "utf8" });
		assert.equal(copied.status, 0, copied.stderr);
		assert.equal(existsSync(join(root, "dist/data/state-ballots")), false);
		write(root, "src/data/state-ballots/not-reviewed.json", "{}");
		const refused = spawnSync(process.execPath, [join(root, "scripts/copy-runtime-assets.mjs")], { encoding: "utf8" });
		assert.notEqual(refused.status, 0);
		assert.match(refused.stderr, /outside source and runtime releases/u);
	}
	finally { rmSync(root, { recursive: true, force: true }); }
});

test("compiled runtime verification independently refuses bundled election data and still requires SQL assets", () => {
	const root = fixture();
	try {
		assert.equal(spawnSync(process.execPath, [join(root, "scripts/copy-runtime-assets.mjs")]).status, 0);
		assert.equal(spawnSync(process.execPath, [join(root, "scripts/verify-runtime-build.mjs")]).status, 0);
		write(root, "dist/data/state-ballots/unexpected.json", "{}");
		const refused = spawnSync(process.execPath, [join(root, "scripts/verify-runtime-build.mjs")], { encoding: "utf8" });
		assert.notEqual(refused.status, 0);
		assert.match(refused.stderr, /outside the compiled runtime/u);
		rmSync(join(root, "dist/data/state-ballots"), { recursive: true });
		for (const name of ["manage-court-directory.js", "court-directories.js", "court-directory-storage.js", "collect-court-directory.js", "private-handoff-protocol.js", "private-handoff-storage.js", "private-handoff-client.js", "private-handoff-receiver.js", "private-handoff-verification.js", "manage-private-handoff.js"]) {
			rmSync(join(root, `dist/${name}`));
			assert.match(spawnSync(process.execPath, [join(root, "scripts/verify-runtime-build.mjs")], { encoding: "utf8" }).stderr, /missing required runtime files/u);
			write(root, `dist/${name}`, "export {};\n");
		}
		for (const name of ["manage-election-documents.js", "manage-state-ballot-cycles.js", "manage-state-ballot-automation.js", "admin-operations.js", "prepare-state-measure-guides.js", "state-measure-guides.js", "election-document-collection.js", "election-document-sources.js", "congressional-biographies.js", "prepare-congressional-biographies.js", "washington-statements.js", "washington-statement-sources.js", "prepare-washington-statements.js"]) {
			rmSync(join(root, `dist/${name}`));
			assert.match(spawnSync(process.execPath, [join(root, "scripts/verify-runtime-build.mjs")], { encoding: "utf8" }).stderr, /missing required runtime files/u);
			write(root, `dist/${name}`, "export {};\n");
		}
		rmSync(join(root, "dist/admin-schema.sql"));
		assert.match(spawnSync(process.execPath, [join(root, "scripts/verify-runtime-build.mjs")], { encoding: "utf8" }).stderr, /missing required runtime files/u);
	}
	finally { rmSync(root, { recursive: true, force: true }); }
});

test("artifact inspection rejects external election paths even before checking a claimed inventory", () => {
	const root = mkdtempSync(join(tmpdir(), "ballot-artifact-data-negative-"));
	try {
		write(root, "runtime-artifact-contract.json", JSON.stringify({ services: [] }));
		write(root, "runtime-manifest.json", JSON.stringify({ files: [] }));
		for (const directory of ["back-end/src/data/state-ballots", "back-end/dist/data/state-ballots", "back-end/data/state-ballots", "docs/data"]) {
			write(root, `${directory}/forbidden.json`, "{}");
			assert.throws(() => verifyRuntimeArtifact(root), /contains external election data/u);
			rmSync(join(root, directory), { recursive: true });
		}
	}
	finally { rmSync(root, { recursive: true, force: true }); }
});

test("production artifact installation omits package CLI links without relaxing symlink rejection", () => {
	const builder = readFileSync(new URL("../scripts/runtime-artifact.mjs", import.meta.url), "utf8");
	assert.match(builder, /"--bin-links=false"/u);
	const root = mkdtempSync(join(tmpdir(), "ballot-artifact-links-"));
	try {
		write(root, "runtime-artifact-contract.json", JSON.stringify({ services: [] }));
		write(root, "runtime-manifest.json", JSON.stringify({ files: [] }));
		write(root, "back-end/node_modules/yaml/bin.mjs", "export {};\n");
		mkdirSync(join(root, "back-end/node_modules/.bin"));
		symlinkSync("../yaml/bin.mjs", join(root, "back-end/node_modules/.bin/yaml"));
		assert.throws(() => verifyRuntimeArtifact(root), /cannot contain symbolic links/u);
	}
	finally { rmSync(root, { recursive: true, force: true }); }
});

test("copied artifacts require private handoff tools independently of their claimed inventory", () => {
	const root = mkdtempSync(join(tmpdir(), "ballot-handoff-artifact-negative-"));
	const modules = ["private-handoff-protocol.js", "private-handoff-storage.js", "private-handoff-client.js", "private-handoff-receiver.js", "private-handoff-verification.js", "manage-private-handoff.js"];
	try {
		write(root, "runtime-artifact-contract.json", JSON.stringify({ services: [] }));
		write(root, "runtime-manifest.json", JSON.stringify({ files: [] }));
		for (const name of modules) write(root, `back-end/dist/${name}`, "export {};\n");
		for (const name of modules) {
			rmSync(join(root, "back-end/dist", name));
			assert.throws(() => verifyRuntimeArtifact(root), /missing required private handoff module/u);
			write(root, `back-end/dist/${name}`, "export {};\n");
		}
	}
	finally { rmSync(root, { recursive: true, force: true }); }
});
