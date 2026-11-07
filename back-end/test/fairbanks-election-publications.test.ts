import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fairbanksElectionIndexUrl, fairbanksPublicationAccessReview, fetchFairbanksElectionPublications, readFairbanksPublicationCapture, readFairbanksPublicationIndex, writeFairbanksElectionPublications } from "../src/fairbanks-election-publications.js";

const clock = "2026-11-07T08:00:00.000Z";
const now = Date.parse(clock);
const readFixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const robots = readFixture("fairbanks-publication-robots.txt").replace(/\n/gu, "\r\n");
const accessibility = readFixture("fairbanks-publication-accessibility.html");
const legal = readFixture("fairbanks-publication-legal.html");
const origin = "https://www.fnsb.gov";
const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const labels = { sample: "/DocumentCenter/View/28941/FNSB-Sample-Ballot-PDF", notice: "/DocumentCenter/View/29012/Notice-of-Election-PDF" };
function index(when = "Tuesday, October 6, 2026") {
	return `<html><head><title>Fairbanks North Star Borough, AK</title></head><body><div id="page"><h1>Election Information</h1><p>Municipal elections are conducted each year on the first Tuesday in October.</p><table><tr><td>Regular Municipal Election Day</td><td>${when} Polls Open from 7:00 a.m. to 8:00 p.m.</td></tr></table><a href="${labels.sample}">FNSB Sample Ballot (PDF)</a><a href="${labels.notice}">Notice of Election (PDF)</a></div>${legal}</body></html>`;
}
function pdf(kind: string) {
	return Buffer.from(`%PDF-1.7\n${kind}`);
}
function pdfText(kind: string, when = "Tuesday, October 6, 2026") {
	return `${kind === "sample" ? `OFFICIAL BALLOT\nREGULAR ELECTION - ${when.replace(/^\w+, /u, "").toUpperCase()}` : `Notice of Elections\n${when}`}\nFairbanks North Star Borough\f`;
}
function transport(body = index(), when = "Tuesday, October 6, 2026", current = now) {
	const requests: string[] = [];
	const pauses: number[] = [];
	return {
		requests,
		pauses,
		options: {
			now: () => current,
			accessReview: { ...fairbanksPublicationAccessReview, reviewedAt: new Date(current - 3600000).toISOString() },
			sleep: async (milliseconds: number) => { pauses.push(milliseconds); },
			requestText: async (url: string | URL) => {
				requests.push(String(url));
				if (url === `${origin}/robots.txt`) return robots;
				if (url === `${origin}/accessibility`) return accessibility;
				assert.equal(url, fairbanksElectionIndexUrl);
				return body;
			},
			requestDocument: async (url: string) => {
				requests.push(url);
				const kind = url.endsWith(labels.sample) ? "sample" : "notice";
				assert.ok(Object.values(labels).some(path => url === origin + path));
				return { status: 200, contentType: "application/pdf", body: pdf(kind), etag: undefined };
			},
			extractor: async (body: Buffer) => pdfText(body.toString().includes("sample") ? "sample" : "notice", when)
		}
	};
}
test("Fairbanks follows both actual offered publications and the explicit regular election date", () => {
	const result = readFairbanksPublicationIndex(index());
	assert.equal(result.electionDate, "2026-10-06");
	assert.deepEqual(result.documents.map(document => document.url), [origin + labels.sample, origin + labels.notice]);
	assert.equal(hash(robots), fairbanksPublicationAccessReview.robotsSha256);
});
test("Fairbanks rejects missing, duplicate, hidden, cross-host and ambiguously dated publications", () => {
	assert.throws(() => readFairbanksPublicationIndex(index("Tuesday, October 13, 2026")), /conflict/u);
	for (const body of [index().replace("Tuesday, October 6", "Wednesday, October 6"), index().replace("Tuesday, October 6", "Tuesday, October 32"), index().replace("FNSB Sample Ballot (PDF)", "Future sample"), index().replace(`href="${labels.sample}`, `href="https://example.com${labels.sample}`), index().replace("<table>", "<table hidden>"), index().replace("<h1>Election Information</h1>", "<h1>Other jurisdiction</h1>"), index().replace("</div>", `<a href="${labels.sample}">FNSB Sample Ballot (PDF)</a></div>`), index("Tuesday, November 2, 2027")]) assert.throws(() => readFairbanksPublicationIndex(body), /review|conflict|inconsistent/u);
});
test("Collection checks both publisher policies before PDFs, paces requests, and preserves original bytes", async () => {
	const working = transport();
	const capture = await fetchFairbanksElectionPublications(working.options);
	assert.equal(working.requests.length, 5);
	assert.deepEqual(working.requests.slice(0, 3), [`${origin}/robots.txt`, `${origin}/accessibility`, fairbanksElectionIndexUrl]);
	assert.equal(working.pauses.length, 4);
	assert.ok(working.pauses.every(value => value >= 20000));
	assert.deepEqual(Buffer.from(capture.documents[0]!.body, "base64"), pdf("sample"));
	const inventory = readFairbanksPublicationCapture(capture, now);
	assert.equal(inventory.candidateImportApproved, false);
	assert.equal(inventory.publicationApproved, false);
	assert.equal(inventory.resultsInferred, false);
	assert.ok(!("candidates" in inventory));
});
test("Source policy changes and expired access approval stop collection before candidate acquisition", async () => {
	const expired = transport();
	await assert.rejects(fetchFairbanksElectionPublications({ ...expired.options, accessReview: { ...expired.options.accessReview, reviewedAt: "2026-09-01T00:00:00.000Z" } }), /review/u);
	assert.equal(expired.requests.length, 0);
	for (const changed of ["robots", "accessibility"]) {
		const working = transport();
		await assert.rejects(fetchFairbanksElectionPublications({ ...working.options, requestText: async (url) => {
			const body = await working.options.requestText(url);
			return String(url).endsWith(`/${changed}${changed === "robots" ? ".txt" : ""}`) ? body + (changed === "robots" ? "\nDisallow: /\n" : "<div id=\"contentarea\">Changed legal content</div>") : body;
		} }), /policy|review/u);
		assert.ok(working.requests.every(url => !url.includes("/DocumentCenter/")));
	}
});
test("Future cycles use printed dates and offered URLs with fresh review, without guessed filenames", async () => {
	const futureClock = Date.parse("2027-10-01T12:00:00.000Z");
	const working = transport(index("Tuesday, October 5, 2027"), "Tuesday, October 5, 2027", futureClock);
	const capture = await fetchFairbanksElectionPublications(working.options);
	assert.equal(readFairbanksPublicationCapture(capture, futureClock).electionDate, "2027-10-05");
	assert.deepEqual(capture.documents.map(document => document.url), [origin + labels.sample, origin + labels.notice]);
	assert.equal(capture.accessReview.reviewedAt, new Date(futureClock - 3600000).toISOString());
});
test("A changed municipal schedule must agree across the index and both original PDFs", async () => {
	const futureClock = Date.parse("2027-10-01T12:00:00.000Z");
	const body = index("Tuesday, November 2, 2027").replace("first Tuesday in October", "first Tuesday after the first Monday in November");
	const working = transport(body, "Tuesday, November 2, 2027", futureClock);
	const capture = await fetchFairbanksElectionPublications(working.options);
	assert.equal(readFairbanksPublicationCapture(capture, futureClock).electionDate, "2027-11-02");
	const mismatch = transport(body, "Tuesday, October 5, 2027", futureClock);
	await assert.rejects(fetchFairbanksElectionPublications(mismatch.options), /disagree/u);
});
test("Unchanged repeated collection advances check time while retaining original capture clocks", async () => {
	const first = await fetchFairbanksElectionPublications(transport().options);
	const next = await fetchFairbanksElectionPublications({ ...transport(index(), "Tuesday, October 6, 2026", now + 3600000).options, previous: first });
	for (const [position, document] of next.documents.entries()) {
		assert.equal(document.capturedAt, first.documents[position]!.capturedAt);
		assert.equal(document.checkedAt, "2026-11-07T09:00:00.000Z");
		assert.equal(document.sha256, first.documents[position]!.sha256);
	}
	const original = structuredClone(first);
	await assert.rejects(fetchFairbanksElectionPublications({ ...transport().options, previous: first, requestDocument: async () => ({ status: 503, contentType: "", body: Buffer.alloc(0), etag: undefined }) }), /unavailable/u);
	assert.deepEqual(first, original);
});
test("An unexpired election disappearing retains evidence for review", async () => {
	const futureClock = Date.parse("2027-10-01T12:00:00.000Z");
	const prior = await fetchFairbanksElectionPublications(transport(index("Tuesday, October 5, 2027"), "Tuesday, October 5, 2027", futureClock).options);
	const changed = index("Tuesday, November 2, 2027").replace("first Tuesday in October", "first Tuesday after the first Monday in November");
	const working = transport(changed, "Tuesday, November 2, 2027", futureClock + 3600000);
	await assert.rejects(fetchFairbanksElectionPublications({ ...working.options, previous: prior }), /unexpired/u);
	assert.ok(working.requests.every(url => !url.includes("/DocumentCenter/")));
});
test("Archived capture reads retain their original approval window rather than inventing renewed approval", async () => {
	const capture = await fetchFairbanksElectionPublications(transport().options);
	assert.equal(readFairbanksPublicationCapture(capture, Date.parse("2028-01-01T00:00:00.000Z")).electionDate, "2026-10-06");
	const altered = structuredClone(capture);
	altered.documents[0]!.checkedAt = "2027-01-01T00:00:00.000Z";
	assert.throws(() => readFairbanksPublicationCapture(altered, Date.parse("2028-01-01T00:00:00.000Z")), /renewal/u);
});
test("Tampered capture bytes, provenance, policy inventories and PDF identities fail closed", async () => {
	const capture = await fetchFairbanksElectionPublications(transport().options);
	for (const mutate of [
		(value: typeof capture) => { value.documents[0]!.body = pdf("changed").toString("base64"); },
		(value: typeof capture) => { value.documents[0]!.capturedAt = "2027-01-01T00:00:00.000Z"; },
		(value: typeof capture) => { value.documents[1]!.text = pdfText("notice", "Tuesday, October 5, 2027"); },
		(value: typeof capture) => { value.documents[0]!.text += "\u001B"; },
		(value: typeof capture) => { value.policies = []; },
		(value: typeof capture) => { value.index.url = "https://example.com/elections"; }
	]) {
		const changed = structuredClone(capture);
		mutate(changed);
		assert.throws(() => readFairbanksPublicationCapture(changed, now));
	}
});
test("Immutable external bundles support exact retries and reject symlinked or corrupted destinations", async () => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "fairbanks-publication-")));
	try {
		const capture = await fetchFairbanksElectionPublications(transport().options);
		const output = join(directory, "evidence");
		const first = await writeFairbanksElectionPublications(output, capture, now);
		const second = await writeFairbanksElectionPublications(output, capture, now);
		assert.equal(first.path, second.path);
		assert.equal((await readdir(output)).length, 1);
		const bundle = JSON.parse(await readFile(first.path, "utf8"));
		assert.deepEqual(bundle.inventory, readFairbanksPublicationCapture(bundle.capture, now));
		await symlink(output, join(directory, "alias"));
		await assert.rejects(writeFairbanksElectionPublications(join(directory, "alias"), capture, now), /physical/u);
		await writeFile(first.path, "corrupted");
		await assert.rejects(writeFairbanksElectionPublications(output, capture, now));
		assert.equal((await readdir(output)).length, 1);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
