import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { withCourtDirectoryLock } from "../src/court-directory-storage.js";
import { withFultonCountyOfficeholderLock } from "../src/fulton-county-officeholder-storage.js";
import { withFultonOfficeholderLock } from "../src/fulton-officeholder-storage.js";
import { withMagistrateCourtLock } from "../src/magistrate-court-storage.js";

const feeds = [
	{ module: "fulton-officeholder-storage", method: "withFultonOfficeholderLock", filename: ".fulton-board.lock", lock: withFultonOfficeholderLock },
	{ module: "fulton-county-officeholder-storage", method: "withFultonCountyOfficeholderLock", filename: ".fulton-county-offices.lock", lock: withFultonCountyOfficeholderLock },
	{ module: "court-directory-storage", method: "withCourtDirectoryLock", filename: ".court-directory.lock", lock: withCourtDirectoryLock },
	{ module: "magistrate-court-storage", method: "withMagistrateCourtLock", filename: ".magistrate-court.lock", lock: withMagistrateCourtLock },
] as const;

for (const feed of feeds) {
	test(`${feed.module} recovers ownership after forced termination without changing retained data`, async (context) => {
		const directory = await realpath(await mkdtemp(join(tmpdir(), "ballot-feed-kill-")));
		context.after(() => rm(directory, { recursive: true, force: true }));
		const snapshot = join(directory, "retained-snapshot.json");
		await writeFile(snapshot, "Original capture and import clocks\n", { mode: 0o600 });
		const url = new URL(`../src/${feed.module}.ts`, import.meta.url).href;
		const code = `import { ${feed.method} } from ${JSON.stringify(url)}; await ${feed.method}(${JSON.stringify(directory)}, async () => { process.send('held'); setInterval(() => {}, 1000); await new Promise(() => {}); });`;
		const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
		let errors = "";
		child.stderr!.on("data", value => errors += String(value));
		context.after(async () => {
			if (child.exitCode === null && child.signalCode === null) {
				const stopped = once(child, "exit");
				child.kill("SIGKILL");
				await stopped;
			}
		});
		assert.equal((await once(child, "message", { signal: AbortSignal.timeout(10000) }))[0], "held", errors);
		const marker = await readFile(join(directory, feed.filename));
		await assert.rejects(feed.lock(directory, async () => assert.fail("A competing owner must remain excluded.")));
		const stopped = once(child, "exit");
		child.kill("SIGKILL");
		assert.equal((await stopped)[1], "SIGKILL");
		assert.equal(await feed.lock(directory, async canonical => canonical), directory);
		assert.ok((await readFile(join(directory, feed.filename))).equals(marker));
		assert.equal(await readFile(snapshot, "utf8"), "Original capture and import clocks\n");
	});

	test(`${feed.module} releases ownership after callback failure and excludes same-process contenders`, async (context) => {
		const directory = await realpath(await mkdtemp(join(tmpdir(), "ballot-feed-error-")));
		context.after(() => rm(directory, { recursive: true, force: true }));
		await assert.rejects(feed.lock(directory, async () => {
			await assert.rejects(feed.lock(directory, async () => assert.fail("The existing owner must remain held.")));
			throw new Error("Fixture persistence failure");
		}), /Fixture persistence failure/u);
		assert.equal(await feed.lock(directory, async () => "recovered"), "recovered");
	});

	test(`${feed.module} preserves legacy coordination for operator review`, async (context) => {
		const directory = await realpath(await mkdtemp(join(tmpdir(), "ballot-feed-legacy-")));
		context.after(() => rm(directory, { recursive: true, force: true }));
		await writeFile(join(directory, feed.filename), "retained-legacy-owner", { mode: 0o600 });
		await assert.rejects(feed.lock(directory, async () => assert.fail("Legacy coordination requires review.")));
		assert.equal(await readFile(join(directory, feed.filename), "utf8"), "retained-legacy-owner");
	});
}

test("independent Fulton feeds can share external storage without releasing another feed's ownership", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "ballot-feed-independent-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	async function hold(index: number): Promise<void> {
		if (index === feeds.length) {
			for (const feed of feeds) await assert.rejects(feed.lock(directory, async () => assert.fail("Every owner must remain held.")));
			return;
		}
		await feeds[index]!.lock(directory, async () => hold(index + 1));
	}
	await hold(0);
	for (const feed of feeds) await feed.lock(directory, async canonical => assert.equal(canonical, directory));
});
