import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("Fulton workers load independently in fresh processes without import-order initialization failures", () => {
	for (const name of ["fulton-election-calendar", "fulton-election-calendar-storage", "fulton-election-calendar-operations", "collect-fulton-election-calendar", "state-ballot-fulton", "election-document-collection", "fulton-education-notice", "prepare-fulton-education-notice", "collect-fulton-education-notice"]) {
		const address = new URL(`../src/${name}.ts`, import.meta.url).href;
		const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", `await import(${JSON.stringify(address)}); process.stdout.write("ready");`], { encoding: "utf8", timeout: 15000 });
		assert.equal(result.status, 0, `${name}: ${result.stderr}`);
		assert.equal(result.stdout, "ready", name);
	}
});
