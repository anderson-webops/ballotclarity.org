import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fetchGoffstownCycleDiscovery, goffstownDiscoveryUrl, goffstownPolicyFingerprint, readGoffstownCycleDiscovery, readGoffstownOfferedElections, validateGoffstownDocumentUrl } from "../src/state-ballot-goffstown-discovery.js";

const fixture: Record<string, string> = JSON.parse(readFileSync(new URL("./fixtures/goffstown-discovery-policy.json", import.meta.url), "utf8"));
const origin = "https://www.goffstownnh.gov";
const documentUrl = `${origin}/DocumentCenter/View/6157/Goffstown-SAMPLE-BALLOT---State-General-Election-110326-PDF`;
const now = Date.parse("2026-10-27T02:00:00.000Z");
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const section = (body: string) => body.slice(0, body.indexOf("<footer"));
const future = (body: string) => body.replaceAll("November 3, 2026", "November 7, 2028").replaceAll("11/03/26", "11/07/28").replaceAll("110326", "110728").replaceAll("/6157/", "/8100/");
async function capture(overrides: Record<string, string> = {}, clock = now) {
	const calls: string[] = [];
	const delays: number[] = [];
	const pages = { ...fixture, ...overrides };
	const body = await fetchGoffstownCycleDiscovery({ now: () => clock, sleep: async (delay) => {
		delays.push(delay);
	}, requestDocument: async (url, options) => {
		calls.push(url);
		assert.deepEqual(options, { allowedHosts: ["www.goffstownnh.gov"], maxBytes: 2097152, timeoutMs: 45000 });
		const name = url === goffstownDiscoveryUrl ? "index" : url.slice(origin.length + 1).replace(".txt", "");
		assert.ok(pages[name]);
		return { status: 200, contentType: name === "robots" ? "text/plain" : "text/html", body: Buffer.from(pages[name]!), etag: undefined };
	} });
	return { body, calls, delays };
}
test("Goffstown discovery retains the actual offered date and URL without collecting PDF names", async () => {
	const result = await capture();
	assert.deepEqual(result.calls, [`${origin}/robots.txt`, goffstownDiscoveryUrl, `${origin}/copyright`, `${origin}/privacy`, `${origin}/accessibility`]);
	assert.deepEqual(result.delays, [11000, 11000, 11000, 11000]);
	const parsed = readGoffstownCycleDiscovery(result.body, now);
	assert.deepEqual(parsed.elections, [{ electionDate: "2026-11-03", documentUrls: [documentUrl] }]);
	assert.equal(parsed.index.sha256, hash(fixture.index!));
	assert.equal(parsed.index.retrievedAt, new Date(now).toISOString());
	assert.equal("records" in parsed, false);
});
test("an independently offered future election needs no guessed document identifier or annual edit", async () => {
	const clock = Date.parse("2028-10-01T00:00:00.000Z");
	const body = future(fixture.index!);
	const result = readGoffstownCycleDiscovery((await capture({ index: body }, clock)).body, clock);
	assert.deepEqual(result.elections, [{ electionDate: "2028-11-07", documentUrls: [`${origin}/DocumentCenter/View/8100/Goffstown-SAMPLE-BALLOT---State-General-Election-110728-PDF`] }]);
	const both = fixture.index! + section(body);
	assert.deepEqual(readGoffstownOfferedElections(both).map(item => item.electionDate), ["2026-11-03", "2028-11-07"]);
});
test("primary and town ballots are separate, and missing publications never become an accepted roster", () => {
	const unrelated = "<div class=\"relatedDocumentsSection\"><h3>State Primary - September 8, 2026</h3><a href=\"/DocumentCenter/View/6107/Democratic-Sample-Ballot-PDF\">Democratic Sample Ballot (PDF)</a></div><div class=\"relatedDocumentsSection\"><h3>Town &amp; School Election - March 10, 2026</h3><a href=\"/DocumentCenter/View/5642/Town-PDF\">Town ballot</a></div>";
	assert.deepEqual(readGoffstownOfferedElections(unrelated + fixture.index!), [{ electionDate: "2026-11-03", documentUrls: [documentUrl] }]);
	assert.deepEqual(readGoffstownOfferedElections(unrelated), []);
	assert.deepEqual(readGoffstownOfferedElections("<div class=\"relatedDocumentsSection\"><h3>State General Election - November 3, 2026</h3></div>"), [{ electionDate: "2026-11-03", documentUrls: [] }]);
});
test("ambiguous headings, mismatched dates, duplicate offerings and changed document roles require review", () => {
	for (const body of [fixture.index! + section(fixture.index!), fixture.index!.replace("November 3", "November 4"), fixture.index!.replace("November 3", "November 7").replace("2026", "2028"), fixture.index!.replace("SAMPLE BALLOT -", "RESULTS -"), fixture.index!.replace("110326", "110726"), fixture.index!.replace("<h3>", "<h4>Other</h4><h3>"), fixture.index!.replace("</a></div>", "</a><a href=\"/extra\">Additional ballot</a></div>")]) assert.throws(() => readGoffstownOfferedElections(body), /requires review/u);
});
test("offered documents retain exact origin, role, canonical encoding and election binding", () => {
	validateGoffstownDocumentUrl(documentUrl, "2026-11-03");
	for (const url of [documentUrl.replace("https:", "http:"), documentUrl.replace("www.goffstownnh.gov", "other.example"), documentUrl.replace("https://", "https://user@"), `${documentUrl}#page=1`, `${documentUrl}?download=1`, documentUrl.replace("/6157/", "/06157/"), documentUrl.replace("SAMPLE", "%53AMPLE"), documentUrl.replace("110326", "110728"), documentUrl.replace("-PDF", "-Results-PDF")]) assert.throws(() => validateGoffstownDocumentUrl(url, "2026-11-03"));
});
test("annual copyright ranges normalize without accepting different rights, owners, notices or future years", async () => {
	const clock = Date.parse("2030-01-01T00:00:00.000Z");
	const current = Buffer.from(fixture.copyright!);
	const advanced = Buffer.from(fixture.copyright!.replaceAll("-2026", "-2030"));
	assert.equal(goffstownPolicyFingerprint(current, "region", `${origin}/copyright`, "mainWrapTS", clock), goffstownPolicyFingerprint(advanced, "region", `${origin}/copyright`, "mainWrapTS", clock));
	await capture({ copyright: advanced.toString() }, clock);
	for (const body of [fixture.copyright!.replace("All content", "Permission required for all content"), fixture.copyright!.replace("Goffstown, NH", "Other owner"), `${fixture.copyright!}<a href="/terms">Terms</a>`]) await assert.rejects(capture({ copyright: body }), /requires review/u);
	assert.throws(() => goffstownPolicyFingerprint(Buffer.from(fixture.copyright!.replaceAll("-2026", "-2031")), "region", `${origin}/copyright`, "mainWrapTS", clock), /requires review/u);
});
test("changed robots and denied, redirected or failed requests stop without retries or PDF collection", async () => {
	let calls = 0;
	await assert.rejects(fetchGoffstownCycleDiscovery({ requestDocument: async () => {
		calls++;
		return { status: 200, contentType: "text/plain", body: Buffer.from(`${fixture.robots!}\nUser-agent: GPTBot\nDisallow: /\n`), etag: undefined };
	} }), /requires review/u);
	assert.equal(calls, 1);
	for (const status of [301, 302, 403, 429, 503]) {
		calls = 0;
		await assert.rejects(fetchGoffstownCycleDiscovery({ requestDocument: async () => {
			calls++;
			return { status, contentType: "text/plain", body: Buffer.alloc(0), location: "https://other.example/challenge", etag: undefined };
		} }), /requires review/u);
		assert.equal(calls, 1);
	}
	calls = 0;
	await assert.rejects(fetchGoffstownCycleDiscovery({ requestDocument: async () => {
		calls++;
		throw new Error("certificate validation failed");
	} }), /certificate validation failed/u);
	assert.equal(calls, 1);
});
test("stored discovery validates every original policy body, URL, hash and capture clock", async () => {
	const original = JSON.parse((await capture()).body);
	const mutations = [(value: typeof original) => {
		value.index.sha256 = "0".repeat(64);
	}, (value: typeof original) => {
		value.index.url += "?other=1";
	}, (value: typeof original) => {
		value.index.retrievedAt = "2028-01-01T00:00:00.000Z";
	}, (value: typeof original) => {
		value.policies.reverse();
	}, (value: typeof original) => {
		value.policies[0].body += "\nDisallow: /\n";
		value.policies[0].sha256 = hash(value.policies[0].body);
	}, (value: typeof original) => {
		value.policies[2].body = value.policies[2].body.replace("does not sell", "does sell");
		value.policies[2].sha256 = hash(value.policies[2].body);
	}, (value: typeof original) => {
		value.records = [];
	}];
	for (const mutate of mutations) {
		const changed = structuredClone(original);
		mutate(changed);
		assert.throws(() => readGoffstownCycleDiscovery(JSON.stringify(changed), now), /requires review/u);
	}
});
test("untrusted discovery structure and text stay bounded before recursive traversal", () => {
	assert.throws(() => readGoffstownOfferedElections("<div>".repeat(100) + "</div>".repeat(100)), /requires review/u);
	assert.throws(() => readGoffstownOfferedElections(" ".repeat(2 * 1024 * 1024 + 1)), /requires review/u);
	assert.throws(() => readGoffstownCycleDiscovery(" ".repeat(10 * 1024 * 1024 + 1), now), /requires review/u);
});
