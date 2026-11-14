import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chmod, lstat, mkdtemp, readFile, realpath, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import { coordinateFultonPublisherRequest } from "../src/fulton-publisher-request.js";

const start = Date.parse("2026-11-14T00:00:00Z");
const temporary = async () => realpath(await mkdtemp(join(tmpdir(), "fulton-publisher-test-")));

test("independent callers share durable starts while retaining no source URL or body", async (context) => {
	const directory = await temporary();
	context.after(() => rm(directory, { recursive: true, force: true }));
	let clock = start;
	const starts: number[] = [];
	const pauses: number[] = [];
	const options = { directory, now: () => clock, pause: async (milliseconds: number) => {
		pauses.push(milliseconds);
		clock += milliseconds;
	} };
	assert.equal(await coordinateFultonPublisherRequest(async () => {
		starts.push(clock);
		return "first";
	}, options), "first");
	assert.equal(await coordinateFultonPublisherRequest(async () => {
		starts.push(clock);
		return "second";
	}, options), "second");
	assert.deepEqual(starts, [start, start + 11000]);
	assert.deepEqual(pauses, [11000]);
	assert.deepEqual(JSON.parse(await readFile(join(directory, "last-request.json"), "utf8")), { schemaVersion: 1, publisher: "fultoncountyga.gov", lastStartedAt: new Date(clock).toISOString(), finishedAt: new Date(clock).toISOString(), attempts: 2 });
	for (const filename of ["automation.lock", "initialized", "last-request.json"]) assert.equal((await lstat(join(directory, filename))).mode & 0o777, 0o600);
});

test("slow DNS and response delivery cannot shorten the interval between actual request starts", async (context) => {
	const directory = await temporary();
	context.after(() => rm(directory, { recursive: true, force: true }));
	let clock = start;
	const options = { directory, now: () => clock, pause: async (milliseconds: number) => {
		clock += milliseconds;
	} };
	await coordinateFultonPublisherRequest(async () => {
		clock += 5000;
	}, options);
	await coordinateFultonPublisherRequest(async () => assert.equal(clock, start + 16000), options);
});

test("failed work consumes its reserved interval and releases process ownership", async (context) => {
	const directory = await temporary();
	context.after(() => rm(directory, { recursive: true, force: true }));
	let clock = start;
	const options = { directory, now: () => clock, pause: async (milliseconds: number) => {
		clock += milliseconds;
	} };
	await assert.rejects(coordinateFultonPublisherRequest(async () => {
		throw new Error("Controlled publisher failure");
	}, options), /Controlled publisher failure/u);
	await coordinateFultonPublisherRequest(async () => "recovered", options);
	assert.equal(clock, start + 11000);
	assert.equal(JSON.parse(await readFile(join(directory, "last-request.json"), "utf8")).attempts, 2);
});

test("ownership covers in-flight work, bounded contenders fail safely and later callers recover", async (context) => {
	const directory = await temporary();
	const independent = await temporary();
	context.after(() => Promise.all([directory, independent].map(folder => rm(folder, { recursive: true, force: true }))));
	const entered = Promise.withResolvers<void>();
	const release = Promise.withResolvers<void>();
	const first = coordinateFultonPublisherRequest(async () => {
		entered.resolve();
		await release.promise;
	}, { directory, now: () => start });
	await entered.promise;
	try {
		await assert.rejects(coordinateFultonPublisherRequest(async () => assert.fail("A second owner must wait"), { directory, maximumWaitMs: 20 }), /already running|locked/u);
		assert.equal(await coordinateFultonPublisherRequest(async () => "independent", { directory: independent }), "independent");
	}
	finally {
		release.resolve();
		await first;
	}
	await coordinateFultonPublisherRequest(async () => "later", { directory, now: () => start + 11000 });
});

test("a waiting caller proceeds after the active owner exits", async (context) => {
	const directory = await temporary();
	context.after(() => rm(directory, { recursive: true, force: true }));
	const entered = Promise.withResolvers<void>();
	const release = Promise.withResolvers<void>();
	const first = coordinateFultonPublisherRequest(async () => {
		entered.resolve();
		await release.promise;
	}, { directory, now: () => start });
	await entered.promise;
	const second = coordinateFultonPublisherRequest(async () => "waited", { directory, now: () => start + 11000, maximumWaitMs: 2000 });
	await setTimeout(20);
	release.resolve();
	await first;
	assert.equal(await second, "waited");
});

test("clock rollback, short sleeps and missing retained journals hold new requests", async (context) => {
	const directory = await temporary();
	context.after(() => rm(directory, { recursive: true, force: true }));
	await coordinateFultonPublisherRequest(async () => undefined, { directory, now: () => start });
	const bytes = await readFile(join(directory, "last-request.json"));
	await assert.rejects(coordinateFultonPublisherRequest(async () => assert.fail(), { directory, now: () => start - 1 }), /journal requires review/u);
	await assert.rejects(coordinateFultonPublisherRequest(async () => assert.fail(), { directory, now: () => start, pause: async () => undefined }), /interval has not elapsed/u);
	assert.ok((await readFile(join(directory, "last-request.json"))).equals(bytes));
	await unlink(join(directory, "last-request.json"));
	await assert.rejects(coordinateFultonPublisherRequest(async () => assert.fail(), { directory }), /journal is missing/u);
});

test("invalid completion clocks preserve an interrupted reservation for conservative recovery", async (context) => {
	const directory = await temporary();
	context.after(() => rm(directory, { recursive: true, force: true }));
	let clock = start;
	const options = { directory, now: () => clock, pause: async (milliseconds: number) => {
		clock += milliseconds;
	} };
	await assert.rejects(coordinateFultonPublisherRequest(async () => {
		clock--;
	}, options), /completion clock/u);
	assert.equal(JSON.parse(await readFile(join(directory, "last-request.json"), "utf8")).finishedAt, null);
	clock = start;
	await coordinateFultonPublisherRequest(async () => undefined, options);
	assert.equal(clock, start + 11000);
});

test("malformed and unprivate journals remain unchanged and prevent publisher work", async (context) => {
	const parent = await temporary();
	context.after(() => rm(parent, { recursive: true, force: true }));
	const valid = { schemaVersion: 1, publisher: "fultoncountyga.gov", lastStartedAt: new Date(start).toISOString(), finishedAt: new Date(start).toISOString(), attempts: 1 };
	for (const body of ["{", "null", "[]", JSON.stringify({ ...valid, attempts: 0 }), JSON.stringify({ ...valid, publisher: "other.example" }), JSON.stringify({ ...valid, extra: true }), JSON.stringify({ ...valid, lastStartedAt: "2026-11-15T00:00:00.000Z" }), "x".repeat(1025)]) {
		const directory = await realpath(await mkdtemp(join(parent, "case-")));
		await writeFile(join(directory, "last-request.json"), body, { mode: 0o600 });
		await assert.rejects(coordinateFultonPublisherRequest(async () => assert.fail(), { directory, now: () => start }), /review|JSON|limit|Unexpected/u);
		assert.equal(await readFile(join(directory, "last-request.json"), "utf8"), body);
	}
	const directory = await realpath(await mkdtemp(join(parent, "unprivate-")));
	await writeFile(join(directory, "last-request.json"), JSON.stringify(valid), { mode: 0o644 });
	await assert.rejects(coordinateFultonPublisherRequest(async () => assert.fail(), { directory }), /metadata requires review/u);
	assert.equal((await lstat(join(directory, "last-request.json"))).mode & 0o777, 0o644);
});

test("unsafe storage, symlinks and excess inventory preserve existing files", async (context) => {
	const parent = await temporary();
	context.after(() => rm(parent, { recursive: true, force: true }));
	const outside = join(parent, "original");
	await writeFile(outside, "Saved owner data", { mode: 0o600 });
	const linked = await realpath(await mkdtemp(join(parent, "linked-")));
	await symlink(outside, join(linked, "last-request.json"));
	await assert.rejects(coordinateFultonPublisherRequest(async () => assert.fail(), { directory: linked }), /metadata requires review/u);
	assert.equal(await readFile(outside, "utf8"), "Saved owner data");
	const unprivate = await realpath(await mkdtemp(join(parent, "unprivate-")));
	await chmod(unprivate, 0o755);
	await assert.rejects(coordinateFultonPublisherRequest(async () => assert.fail(), { directory: unprivate }), /private owner-controlled/u);
	assert.equal((await lstat(unprivate)).mode & 0o777, 0o755);
	const overflow = await realpath(await mkdtemp(join(parent, "overflow-")));
	for (let index = 0; index < 17; index++) await writeFile(join(overflow, `.request-${String(index).padStart(36, "0")}.tmp`), "", { mode: 0o600 });
	await assert.rejects(coordinateFultonPublisherRequest(async () => assert.fail(), { directory: overflow }), /inventory requires review/u);
	await assert.rejects(coordinateFultonPublisherRequest(async () => assert.fail(), { directory: parent, maximumWaitMs: 30001 }), /wait exceeds/u);
	await assert.rejects(coordinateFultonPublisherRequest(async () => assert.fail(), { directory: "relative" }), /absolute directory/u);
});

test("concurrent private initialization files finish before inventory review while abandoned files stay held", async (context) => {
	const directory = await temporary();
	context.after(() => rm(directory, { recursive: true, force: true }));
	const filename = join(directory, ".automation-lock-00000000-0000-0000-0000-000000000001.sqlite");
	await writeFile(filename, "Controlled initialization fixture", { mode: 0o600 });
	const pending = coordinateFultonPublisherRequest(async () => "initialized", { directory });
	await setTimeout(30);
	await unlink(filename);
	assert.equal(await pending, "initialized");
	await writeFile(filename, "Retained interrupted initialization", { mode: 0o600 });
	await assert.rejects(coordinateFultonPublisherRequest(async () => assert.fail(), { directory }), /initialization is incomplete/u);
	assert.equal(await readFile(filename, "utf8"), "Retained interrupted initialization");
});

test("independent process death releases ownership while retaining its reserved start", { timeout: 20000 }, async (context) => {
	const directory = await temporary();
	context.after(() => rm(directory, { recursive: true, force: true }));
	const script = `const {coordinateFultonPublisherRequest}=await import(process.argv[1]);await coordinateFultonPublisherRequest(async()=>{process.stdout.write('held\\n');await new Promise(()=>setInterval(()=>{},1000));},{directory:process.argv[2],now:()=>Number(process.argv[3])});`;
	const child = spawn(process.execPath, [...process.execArgv, "--input-type=module", "-e", script, new URL("../src/fulton-publisher-request.ts", import.meta.url).href, directory, String(start)], { stdio: ["ignore", "pipe", "pipe"] });
	let stderr = "";
	child.stderr.on("data", body => stderr += body);
	const entered = new Promise<void>((resolve, reject) => {
		child.stdout.on("data", (body) => {
			if (String(body).includes("held")) resolve();
		});
		child.once("exit", () => reject(new Error(stderr || "The child exited before acquiring its request slot.")));
	});
	try {
		await Promise.race([entered, setTimeout(10000, undefined, { ref: false }).then(() => {
			throw new Error("Timed out waiting for the fixture owner");
		})]);
		await assert.rejects(coordinateFultonPublisherRequest(async () => assert.fail(), { directory, maximumWaitMs: 20 }), /locked/u);
	}
	finally {
		if (child.exitCode === null && child.signalCode === null) {
			const stopped = once(child, "exit");
			child.kill("SIGKILL");
			await stopped;
		}
	}
	let clock = start + 500;
	const delays: number[] = [];
	await coordinateFultonPublisherRequest(async () => undefined, { directory, now: () => clock, pause: async (milliseconds) => {
		delays.push(milliseconds);
		clock += milliseconds;
	} });
	assert.deepEqual(delays, [11000]);
	assert.equal(JSON.parse(await readFile(join(directory, "last-request.json"), "utf8")).attempts, 2);
});
