import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import { collectFultonElectionCalendar } from "../src/collect-fulton-election-calendar.js";
import { fultonCalendarConfigurationSha256, prepareFultonCalendarCapture, readFultonCalendarEnvelope, readFultonCalendarRun, writeFultonCalendarFile } from "../src/fulton-election-calendar-storage.js";
import { withStateBallotAutomationLock } from "../src/state-ballot-automation-lock.js";

const now = Date.parse("2026-11-13T19:00:00.000Z");
const robots = "\r\n\r\nUser-agent: *\r\nDisallow: /springboard-page*\r\nSitemap: sitemap.xml\r\n";

test("calendar policy refusal retains source custody and bounds repeated attempts", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-calendar-refusal-"));
	try {
		let requests = 0;
		const options = { directory, now: () => now, request: async () => {
			requests++;
			return "Changed policy";
		} };
		await assert.rejects(collectFultonElectionCalendar(options), /policy changed/u);
		assert.equal(requests, 1);
		const run = await readFultonCalendarRun(directory, now);
		assert.equal(run!.status, "failed");
		assert.equal(run!.publisherRequests, 1);
		assert.equal(run!.lastSuccessAt, null);
		await assert.rejects(collectFultonElectionCalendar(options), /next permitted attempt/u);
		assert.equal(requests, 1);
		assert.equal((await readdir(directory)).includes("fulton-calendar.json"), false);
		await assert.rejects(collectFultonElectionCalendar({ ...options, now: () => now + 21600000 }), /policy changed/u);
		assert.equal(requests, 2);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("unchanged robots precede privacy review with the approved request pacing and native bounds", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-calendar-pacing-"));
	try {
		const urls: string[] = [];
		const pauses: number[] = [];
		await assert.rejects(collectFultonElectionCalendar({ directory, now: () => now, pause: async (milliseconds) => {
			pauses.push(milliseconds);
		}, request: async (url, options) => {
			urls.push(String(url));
			assert.deepEqual(options!.allowedHosts, ["fultoncountyga.gov"]);
			assert.equal(options!.maxRedirects, 0);
			assert.equal(options!.maxBytes, 3 * 1024 * 1024);
			return urls.length === 1 ? robots : `<main>Changed privacy</main><footer><a href="/Privacy-Statement">Privacy Statement</a></footer>`;
		} }), /policy/u);
		assert.deepEqual(urls, ["https://fultoncountyga.gov/robots.txt", "https://fultoncountyga.gov/Privacy-Statement"]);
		assert.deepEqual(pauses, [11000]);
		assert.equal((await readFultonCalendarRun(directory, now))!.publisherRequests, 2);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("calendar preparation and collection share process-held ownership before source access", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-calendar-owner-"));
	try {
		let requests = 0;
		await withStateBallotAutomationLock(directory, "automation.lock", async () => {
			await assert.rejects(collectFultonElectionCalendar({ directory, request: async () => {
				requests++;
				return "";
			} }), /already running/u);
			await assert.rejects(prepareFultonCalendarCapture(directory, { schemaVersion: 1, type: "fulton-election-calendar-capture", documents: [] }), /already running/u);
		});
		assert.equal(requests, 0);
		assert.equal(await readFultonCalendarRun(directory), null);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("calendar readers reject redirected files, malformed journals and forged capture envelopes before requests", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-calendar-storage-"));
	try {
		const target = join(directory, "target.json");
		await writeFile(target, "{}");
		await symlink(target, join(directory, "fulton-calendar.json"));
		await assert.rejects(readFultonCalendarEnvelope(directory, now));
		await assert.rejects(collectFultonElectionCalendar({ directory, now: () => now, request: async () => assert.fail("Publisher access must remain excluded") }));
		await rm(join(directory, "fulton-calendar.json"));
		await writeFile(join(directory, "calendar-run.json"), "{}");
		await assert.rejects(readFultonCalendarRun(directory, now), /journal requires review/u);
		await rm(join(directory, "calendar-run.json"));
		for (const sourceConfigurationSha256 of ["unrecognized", fultonCalendarConfigurationSha256]) {
			await writeFile(join(directory, "fulton-calendar.json"), JSON.stringify({ schemaVersion: 1, sourceConfigurationSha256, storedAt: new Date(now).toISOString(), acquisition: "collected", capture: { schemaVersion: 1, type: "fulton-election-calendar-capture", documents: [] } }));
			await assert.rejects(readFultonCalendarEnvelope(directory, now));
		}
		assert.equal(await readFile(target, "utf8"), "{}");
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("calendar file promotion is atomic, immutable retries are exact and redirected destinations are refused", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-calendar-atomic-"));
	try {
		await writeFultonCalendarFile(directory, "capture.json", "original", true);
		await writeFultonCalendarFile(directory, "capture.json", "original", true);
		await assert.rejects(writeFultonCalendarFile(directory, "capture.json", "changed", true), /conflicts/u);
		await symlink(join(directory, "capture.json"), join(directory, "current.json"));
		await assert.rejects(writeFultonCalendarFile(directory, "current.json", "replacement"), /destination requires review/u);
		assert.equal(await readFile(join(directory, "capture.json"), "utf8"), "original");
		assert.equal((await readdir(directory)).some(name => name.endsWith(".tmp")), false);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("an interrupted calendar collector releases actual ownership while preserving its retry cooldown", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-calendar-crash-"));
	const source = new URL("../src/collect-fulton-election-calendar.ts", import.meta.url).href;
	const script = `import {collectFultonElectionCalendar} from ${JSON.stringify(source)}; await collectFultonElectionCalendar({directory:${JSON.stringify(directory)},now:()=>${now},request:async()=>{console.log('request-started');await new Promise(resolve=>setTimeout(resolve,30000));throw Error('fixture');}});`;
	const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { stdio: ["ignore", "pipe", "pipe"] });
	try {
		let output = "";
		child.stdout!.on("data", (chunk) => {
			output += String(chunk);
		});
		for (let attempt = 0; attempt < 100 && !output.includes("request-started"); attempt++) await setTimeout(50);
		assert.match(output, /request-started/u);
		const exit = once(child, "exit");
		child.kill("SIGKILL");
		await exit;
		assert.equal((await readFultonCalendarRun(directory, now))!.status, "running");
		await assert.rejects(collectFultonElectionCalendar({ directory, now: () => now + 1000, request: async () => assert.fail("Retry is premature") }), /next permitted attempt/u);
		let requests = 0;
		await assert.rejects(collectFultonElectionCalendar({ directory, now: () => now + 21600000, request: async () => {
			requests++;
			throw new Error("Controlled outage");
		} }), /Controlled outage/u);
		assert.equal(requests, 1);
		assert.equal((await readFultonCalendarRun(directory, now + 21600000))!.status, "failed");
	}
	finally {
		if (child.exitCode === null && child.signalCode === null) {
			const exit = once(child, "exit");
			child.kill("SIGKILL");
			await exit;
		}
		await rm(directory, { recursive: true, force: true });
	}
});
