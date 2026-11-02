import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL("../node_modules/eslint-plugin-import-x/", import.meta.url));
assert.equal(await realpath(directory), directory.slice(0, -1));
assert.equal(JSON.parse(await readFile(`${directory}package.json`, "utf8")).version, "4.17.1");
const patches = [
	{
		path: "lib/rules/no-internal-modules.js",
		original: "e8e65c1449e1ade45229001595b08f33fc879c4673e0c9be9013dd1df87acd21",
		patched: "a0f35bb70c0a659ab10e6ee1080678b780b079abe0378130e7fe62385654c480",
		replacements: [["import { makeRe } from 'minimatch';", "import { Minimatch } from 'minimatch';"], [".map(p => makeRe(p))", ".map(p => new Minimatch(p))"], [".some(re => re.test(importPath))", ".some(matcher => matcher.match(importPath))"]]
	},
	{
		path: "lib/index.cjs",
		original: "0d09a1c49ba7f3ec5030e246f81075ee5630cf216429e1db1ea7829bf4c52357",
		patched: "b5ddd7ffa3dc2a01b638f772c01195cf0f11db8485fa7fce1c107608bad2998b",
		replacements: [[".map((p) => (0, minimatch.makeRe)(p))", ".map((p) => new minimatch.Minimatch(p))"], [".some((re) => re.test(importPath))", ".some((matcher) => matcher.match(importPath))"]]
	}
];
const digest = value => createHash("sha256").update(value).digest("hex");
const updates = [];
for (const patch of patches) {
	const body = await readFile(directory + patch.path, "utf8");
	if (digest(body) === patch.patched) continue;
	assert.equal(digest(body), patch.original, "The reviewed import matcher dependency changed; review its compatibility patch.");
	const replacement = patch.replacements.reduce((value, [before, after]) => value.replaceAll(before, after), body);
	assert.equal(digest(replacement), patch.patched);
	updates.push({ path: directory + patch.path, body: replacement });
}
for (const update of updates) await writeFile(update.path, update.body);
console.log("Verified import-x matcher compatibility patch.");
