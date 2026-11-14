import type { fetchRemoteSourceDocument } from "../src/remote-json-source.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, open, readdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import { collectFultonEducationNotice, compareFultonEducationNotice, fultonEducationNoticeCollection } from "../src/collect-fulton-education-notice.js";
import { readFultonEducationNotice } from "../src/fulton-education-notice.js";
import { withStateBallotAutomationLock } from "../src/state-ballot-automation-lock.js";
import { address, index, text } from "./helpers/fulton-education-notice.js";

const initialTime = Date.parse("2030-10-01T12:00:00.000Z");
const interval = fultonEducationNoticeCollection.minimumRefreshIntervalMs;
const robots = "\r\n\r\nUser-agent: *\r\nDisallow: /springboard-page*\r\nSitemap: sitemap.xml\r\n";
const privacy = await readFile(new URL("./fixtures/fulton-notice-policy.html", import.meta.url), "utf8");

async function fixture(context: test.TestContext) {
	const root = await realpath(await mkdtemp(join(tmpdir(), "fulton-notice-collection-")));
	context.after(() => rm(root, { recursive: true, force: true }));
	const directory = join(root, "data");
	const planPath = join(root, "plan.json");
	const plan = { schemaVersion: 1, type: "fulton-education-notice-collection", directory, electionDate: "latest-published" };
	await writeFile(planPath, JSON.stringify(plan));
	const state = { now: initialTime, year: "2030", index, text, status: 200, contentType: "application/pdf", outage: false, policy: privacy, afterPdf: async () => {} };
	const urls: string[] = [];
	const pauses: number[] = [];
	const options = { now: () => state.now, pause: async (milliseconds: number) => {
		pauses.push(milliseconds);
		state.now += milliseconds;
	}, extract: async (body: Buffer) => body.toString("utf8").split("\n").slice(1).join("\n"), request: async (url: string, bounds?: Parameters<typeof fetchRemoteSourceDocument>[1]) => {
		urls.push(url);
		assert.deepEqual(bounds?.allowedHosts, ["fultoncountyga.gov"]);
		assert.equal(bounds?.timeoutMs, 15000);
		if (state.outage) throw new Error("Controlled publisher outage");
		const pdf = url.endsWith(".pdf");
		assert.equal(bounds?.maxBytes, (pdf ? 12 : 3) * 1024 * 1024);
		const body = url.endsWith("/robots.txt") ? robots : url.endsWith("/Privacy-Statement") ? state.policy : pdf ? `%PDF-fixture-${state.year}\n${state.text}` : state.index;
		if (pdf) await state.afterPdf();
		return { status: pdf ? state.status : 200, body: Buffer.from(body), contentType: pdf ? state.contentType : url.endsWith("/robots.txt") ? "text/plain" : "text/html", etag: undefined };
	} };
	return { root, directory, planPath, plan, state, urls, pauses, options, collect: () => collectFultonEducationNotice(planPath, options), pointer: async () => readFile(join(directory, "notice-current.json"), "utf8"), journal: async () => JSON.parse(await readFile(join(directory, "notice-run.json"), "utf8")) };
}

test("notice collection paces four reviewed inputs and prepares future-edition research without importing", async (context) => {
	const source = await fixture(context);
	const result = await source.collect();
	assert.equal(result.status, "collected");
	assert.equal(result.publisherRequests, 4);
	assert.equal(result.electionDate, "2030-11-05");
	assert.equal(result.namedProjects, 6);
	assert.equal(result.principalYears, 2);
	assert.equal(result.imported, false);
	assert.equal(result.publicationApproved, false);
	assert.equal(source.urls.at(-1), address);
	assert.deepEqual(source.pauses, [11000, 11000, 11000]);
	assert.equal((await source.journal()).status, "succeeded");
	assert.equal((await readdir(result.outputDirectory!)).length, 7);
	const report = JSON.parse(await readFile(join(result.outputDirectory!, "notice-research.json"), "utf8"));
	assert.equal(report.projectInventoryComplete, false);
	assert.equal(report.electionOutcomeVerified, false);
});

test("notice cache and refresh retain original clocks and byte-identical research while preserving history", async (context) => {
	const source = await fixture(context);
	const first = await source.collect();
	const original = await source.pointer();
	const cached = await source.collect();
	assert.equal(cached.status, "cached");
	assert.equal(cached.publisherRequests, 0);
	assert.equal(source.urls.length, 4);
	source.state.now += interval;
	const refreshed = await source.collect();
	assert.equal(refreshed.capturedAt, first.capturedAt);
	assert.equal(refreshed.captureSha256, first.captureSha256);
	assert.deepEqual(await readFile(join(refreshed.outputDirectory!, "notice-research.json")), await readFile(join(first.outputDirectory!, "notice-research.json")));
	assert.equal(await readFile(join(source.directory, "notice-previous.json"), "utf8"), original);
	assert.equal((await readdir(join(source.directory, "notice-captures"))).length, 2);
});

test("notice collection follows explicitly published future editions and retains the earlier capture", async (context) => {
	const source = await fixture(context);
	const previous = await source.collect();
	source.state.now += interval;
	source.state.year = "2034";
	source.state.index = index.replaceAll("2030", "2034");
	source.state.text = text.replaceAll("2030", "2034").replaceAll("2031", "2035").replaceAll("2032", "2036").replaceAll("2033", "2037");
	const result = await source.collect();
	assert.equal(result.electionDate, "2034-11-05");
	assert.equal(source.urls.at(-1), address.replace("2030", "2034"));
	assert.equal(JSON.parse(await readFile(join(previous.outputDirectory!, "notice-research.json"), "utf8")).electionDate, "2030-11-05");
});

test("changed notice fiscal facts and project removal retain the previous current evidence for review", async (context) => {
	const source = await fixture(context);
	await source.collect();
	const before = await source.pointer();
	source.state.now += interval;
	source.state.text = text.replace("six percent 6%", "seven percent 7%");
	await assert.rejects(source.collect(), /fiscal facts require review/u);
	assert.equal(await source.pointer(), before);
	assert.equal((await source.journal()).reason, "persistence-or-review-failed");
	const requests = source.urls.length;
	await assert.rejects(source.collect(), /next permitted attempt/u);
	assert.equal(source.urls.length, requests);
	const prior = readFultonEducationNotice(text, "2030-11-05");
	assert.throws(() => compareFultonEducationNotice(prior, { ...prior, projects: prior.projects.slice(1) }), /projects require review/u);
	assert.throws(() => compareFultonEducationNotice(prior, { ...prior, electionDate: "2026-11-03" }), /older education notice/u);
});

test("notice publisher failures and policy changes preserve originals and bound retry attempts", async (context) => {
	const source = await fixture(context);
	const first = await source.collect();
	const before = await source.pointer();
	for (const failure of ["outage", "policy", "redirect", "denial", "format", "missing-edition"]) {
		source.state.now += interval;
		source.state.outage = failure === "outage";
		source.state.policy = failure === "policy" ? "<main>Changed terms</main>" : privacy;
		source.state.status = failure === "redirect" ? 302 : failure === "denial" ? 403 : 200;
		source.state.contentType = failure === "format" ? "text/html" : "application/pdf";
		source.state.index = failure === "missing-edition" ? index.replace("Call for Election - ESPLOST", "Missing notice") : index;
		await assert.rejects(source.collect());
		assert.equal(await source.pointer(), before);
		assert.equal((await source.journal()).status, "failed");
		const requests = source.urls.length;
		await assert.rejects(source.collect(), /next permitted attempt/u);
		assert.equal(source.urls.length, requests);
	}
	assert.equal(JSON.parse(await readFile(join(first.outputDirectory!, "notice-research.json"), "utf8")).projects.length, 6);
	source.state.now += interval;
	source.state.index = index;
	assert.equal((await source.collect()).status, "collected");
});

test("notice planning and process ownership reject conflicting work before publisher access", async (context) => {
	const source = await fixture(context);
	await withStateBallotAutomationLock(source.directory, "automation.lock", async () => {
		await assert.rejects(source.collect(), /already running/u);
	});
	assert.equal(source.urls.length, 0);
	await writeFile(source.planPath, JSON.stringify({ ...source.plan, extra: "unreviewed" }));
	await assert.rejects(source.collect(), /configured Fulton/u);
	assert.equal(source.urls.length, 0);
});

test("notice storage tampering and changed selection fail before fetching cached or new documents", async (context) => {
	const source = await fixture(context);
	const first = await source.collect();
	const requests = source.urls.length;
	await writeFile(source.planPath, JSON.stringify({ ...source.plan, electionDate: "2030-11-05" }));
	await assert.rejects(source.collect(), /current-pointer/u);
	await writeFile(source.planPath, JSON.stringify(source.plan));
	const capture = JSON.parse(await readFile(join(first.outputDirectory!, "capture.json"), "utf8"));
	await writeFile(join(first.outputDirectory!, capture.documents[3].path), "%PDF-tampered");
	await assert.rejects(source.collect(), /document bytes changed/u);
	assert.equal(source.urls.length, requests);
});

test("notice falsy or malformed metadata remains a hold rather than resetting collection state", async (context) => {
	const source = await fixture(context);
	await mkdir(source.directory);
	for (const name of ["notice-current.json", "notice-run.json"]) {
		for (const body of ["null", "false", "0", "\"\"", "{}", ""]) {
			await writeFile(join(source.directory, name), body);
			await assert.rejects(source.collect());
			assert.equal(source.urls.length, 0);
			await rm(join(source.directory, name));
		}
	}
});

test("notice persistence failure preserves the prior pointer and rejects redirected metadata destinations", async (context) => {
	const source = await fixture(context);
	await source.collect();
	const before = await source.pointer();
	const target = join(source.root, "protected-proof.json");
	await writeFile(target, "original");
	source.state.now += interval;
	source.state.afterPdf = async () => {
		await symlink(target, join(source.directory, "notice-previous.json"));
	};
	await assert.rejects(source.collect(), /destination requires review/u);
	assert.equal(await source.pointer(), before);
	assert.equal(await readFile(target, "utf8"), "original");
	assert.equal((await source.journal()).status, "failed");
});

test("notice archive capacity holds new publisher requests while preserving retained evidence", async (context) => {
	const source = await fixture(context);
	const archive = join(source.directory, "notice-captures", "capture-00000000-0000-0000-0000-000000000000");
	await mkdir(archive, { recursive: true });
	const file = await open(join(archive, "retained-sparse-evidence"), "wx");
	try {
		await file.truncate(110 * 1024 * 1024);
	}
	finally { await file.close(); }
	await assert.rejects(source.collect(), /capacity review/u);
	assert.equal(source.urls.length, 0);
});

test("interrupted notice collection releases actual process ownership and preserves its retry journal", async (context) => {
	const source = await fixture(context);
	const module = new URL("../src/collect-fulton-education-notice.ts", import.meta.url).href;
	const script = `import {collectFultonEducationNotice} from ${JSON.stringify(module)};await collectFultonEducationNotice(${JSON.stringify(source.planPath)},{now:()=>${initialTime},request:async()=>{console.log('request-started');await new Promise(resolve=>setTimeout(resolve,30000));throw Error('fixture');}});`;
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
		assert.equal((await source.journal()).status, "running");
		assert.equal((await source.journal()).publisherRequests, 1);
		await assert.rejects(source.collect(), /next permitted attempt/u);
		assert.equal(source.urls.length, 0);
		source.state.now += interval;
		assert.equal((await source.collect()).status, "collected");
	}
	finally {
		if (child.exitCode === null && child.signalCode === null) {
			const exit = once(child, "exit");
			child.kill("SIGKILL");
			await exit;
		}
	}
});
