import type { MauiCharterCapture } from "../src/maui-charter-measures.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fetchMauiCharterCapture, readMauiCharterCapture, writeMauiCharterCapture } from "../src/maui-charter-measures.js";

const origin = "https://mauicountyvotes.gov";
const articleUrl = `${origin}/blog/f/two-proposed-maui-county-charter-amendments-on-general-ballot`;
const clock = "2028-09-20T12:00:00.000Z";
const now = Date.parse(clock);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const robots = `User-agent: *\nDisallow: /404\nSitemap: ${origin}/sitemap.xml\n`;
const accessReview = { reviewedAt: clock, robotsSha256: hash(robots) };
const question = (identifier: number) => ({ text: `Resolution 28-${identifier}:\n“Shall the Charter be amended to establish procedure ${identifier}?”` });
const post = {
	publishedDate: "2028-09-18T18:43:35.465Z",
	fullContent: JSON.stringify({ blocks: [{ text: "WAILUKU, Hawaii (Sept. 17, 2028), Councilmember reports that the Nov. 7 general election ballot will include two proposed amendments to the Maui County Charter." }, question(1), question(2)] })
};
const article = (value: unknown = post) => `<script>window._BLOG_DATA=${JSON.stringify({ head: { canonicalUrl: articleUrl }, post: value })}</script>`;
const index = `<h1>2028 Charter Amendments</h1>${[1, 2].map(identifier => `<h4>Maui: Procedure ${identifier}</h4><a href="https://img1.wsimg.com/blobby/go/d625d658-8582-4d35-b9fe-7702a7c85585/downloads/00000000-0000-0000-0000-00000000000${identifier}/Reso%2028-${identifier}.pdf?ver=1789162285624">Reso 28-${identifier}</a>`).join("")}`;
const xml = (urls: string[], root = "urlset") => `<?xml version="1.0"?><${root}>${urls.map(url => `<loc>${url}</loc>`).join("")}</${root}>`;
function fixture(): MauiCharterCapture {
	return { schemaVersion: 1, type: "maui-charter-measure-capture", accessReview, documents: [
		[`${origin}/robots.txt`, robots],
		[`${origin}/charter-amendments`, index],
		[`${origin}/sitemap.xml`, xml([`${origin}/sitemap.blog.xml`], "sitemapindex")],
		[`${origin}/sitemap.blog.xml`, xml([articleUrl])],
		[articleUrl, article()]
	].map(([url, body]) => ({ url: url!, body: body!, sha256: hash(body!), capturedAt: clock })) };
}
function mutate(url: string, change: (body: string) => string) {
	const capture = fixture();
	const document = capture.documents.find(document => document.url.endsWith(url))!;
	document.body = change(document.body);
	document.sha256 = hash(document.body);
	return capture;
}

test("Maui discovers a synthetic future election from explicit county publication evidence", () => {
	const result = readMauiCharterCapture(fixture(), now);
	assert.equal(result.electionDate, "2028-11-07");
	assert.equal(result.questions.length, 2);
	assert.equal(result.questions[1]!.title, "Procedure 2");
	assert.equal(result.questions[1]!.resolution, "28-2");
	assert.equal(result.questions[1]!.ballotQuestion, "Shall the Charter be amended to establish procedure 2?");
	assert.equal(result.questions[1]!.publicationDate, "2028-09-18");
	assert.equal(result.jurisdiction.slug, "hi-maui-county");
	assert.equal(result.publicationApproved, false);
	assert.equal(result.automaticImportApproved, false);
	assert.equal(result.resultsInferred, false);
});

for (const [label, url, replace, replacement] of [
	["missing election year", "charter-amendments", "2028 Charter Amendments", "Charter Amendments"],
	["missing question", articleUrl, "Resolution 28-2", "Unidentified question"],
	["inconsistent count", articleUrl, "include two proposed", "include three proposed"],
	["ambiguous date", articleUrl, "Nov. 7 general election", "a future general election"],
	["statewide scope", articleUrl, "to the Maui County Charter", "to the Hawaii Constitution"],
	["unknown resolution", articleUrl, "Resolution 28-2", "Resolution 28-9"],
	["stale publication", articleUrl, "2028-09-18", "2027-09-18"],
	["unoffered article", "sitemap.blog.xml", articleUrl, `${origin}/blog/f/other-page`],
	["new policy", "charter-amendments", "</h1>", `</h1><a href="/terms">Terms of use</a>`],
	["external sitemap", "sitemap.xml", `${origin}/sitemap.blog.xml`, "https://other.example/sitemap.blog.xml"],
	["modified asset namespace", "charter-amendments", "d625d658-8582-4d35-b9fe-7702a7c85585", "00000000-0000-0000-0000-000000000000"]
]) {
	test(`Maui holds ${label}`, () => {
		const capture = mutate(url!, body => body.replace(replace!, replacement!));
		assert.throws(() => readMauiCharterCapture(capture, now));
	});
}

test("Maui reads JSON only, rejects executable suffixes and conflicting article instances", () => {
	assert.throws(() => readMauiCharterCapture(mutate(articleUrl, body => body.replace("</script>", ";globalThis.executed=true;</script>")), now));
	assert.throws(() => readMauiCharterCapture(mutate(articleUrl, body => body + body), now));
	assert.throws(() => readMauiCharterCapture(mutate("charter-amendments", body => body + index), now));
});

test("Maui separates numbered question headings and board terms from cookie and legal controls", () => {
	const capture = mutate("charter-amendments", body => `${body.replace("Maui: Procedure 1", "1) Maui: Procedure 1").replace("Reso 28-2</a>", "Reso 28-2 Board terms</a>")}<h4>This website uses cookies.</h4>`);
	assert.equal(readMauiCharterCapture(capture, now).questions[0]!.title, "Procedure 1");
});

test("Maui keeps older offered articles separate from an explicitly dated future cycle", () => {
	const capture = fixture();
	const previousUrl = articleUrl.replace("two-proposed", "previous-proposed");
	const map = capture.documents.find(document => document.url.endsWith("sitemap.blog.xml"))!;
	map.body = xml([articleUrl, previousUrl]);
	map.sha256 = hash(map.body);
	const body = article({ ...post, publishedDate: "2026-09-18T18:43:35.465Z" }).replace(articleUrl, previousUrl);
	capture.documents.push({ url: previousUrl, body, sha256: hash(body), capturedAt: clock });
	assert.equal(readMauiCharterCapture(capture, now).electionDate, "2028-11-07");
});

test("Maui retains original hash and timestamp evidence after election day without inferring results", () => {
	assert.equal(readMauiCharterCapture(fixture(), Date.parse("2029-01-01")).electionDate, "2028-11-07");
	const broken = fixture();
	broken.documents[4]!.body += "tampered";
	assert.throws(() => readMauiCharterCapture(broken, now));
	broken.documents[4]!.sha256 = hash(broken.documents[4]!.body);
	broken.documents[4]!.capturedAt = "2030-01-01T00:00:00.000Z";
	assert.throws(() => readMauiCharterCapture(broken, now));
});

test("Maui fetches only normally offered county pages with bounded serial requests", async () => {
	const expected = fixture();
	const requests: string[] = [];
	const waits: number[] = [];
	const capture = await fetchMauiCharterCapture({ now: () => now, accessReview, sleep: async (delay) => {
		waits.push(delay);
	}, fetchDocument: async (url, options) => {
		requests.push(url);
		assert.deepEqual(options.allowedHosts, ["mauicountyvotes.gov"]);
		assert.equal(options.maxBytes, 2 * 1024 * 1024);
		const document = expected.documents.find(document => document.url === url);
		assert.ok(document);
		return { status: 200, body: Buffer.from(document.body), contentType: url.endsWith(".xml") ? "application/xml" : url.endsWith("robots.txt") ? "text/plain" : "text/html", etag: undefined };
	} });
	assert.deepEqual(capture, expected);
	assert.equal(requests.length, 5);
	assert.deepEqual(waits, [11_000, 11_000, 11_000, 11_000]);
});

for (const status of [301, 302, 401, 403, 429, 500]) {
	test(`Maui stops on publisher status ${status} without alternate requests`, async () => {
		let requests = 0;
		await assert.rejects(fetchMauiCharterCapture({ now: () => now, accessReview, fetchDocument: async () => {
			requests++;
			return { status, contentType: "text/plain", body: Buffer.from(robots), etag: undefined };
		} }));
		assert.equal(requests, 1);
	});
}

test("Maui holds changed or expired access reviews before retrieving election pages", async () => {
	for (const review of [{ ...accessReview, reviewedAt: "2028-01-01T00:00:00.000Z" }, { ...accessReview, robotsSha256: "0".repeat(64) }]) {
		let requests = 0;
		await assert.rejects(fetchMauiCharterCapture({ now: () => now, accessReview: review, fetchDocument: async () => {
			requests++;
			return { status: 200, body: Buffer.from(robots), contentType: "text/plain", etag: undefined };
		} }));
		assert.equal(requests, 1);
	}
});

test("Maui persists immutable external evidence with exact retries and conflict rejection", async () => {
	const directory = await realTemporaryDirectory();
	try {
		const capture = fixture();
		const first = await writeMauiCharterCapture(directory, capture, now);
		assert.deepEqual(await writeMauiCharterCapture(directory, capture, now), first);
		assert.equal((await readdir(directory)).length, 1);
		const bytes = await readFile(first.path);
		assert.equal(hash(bytes.toString()), first.sha256);
		await assert.rejects(writeMauiCharterCapture(directory, mutate(articleUrl, body => body.replace("include two", "include three")), now));
		assert.deepEqual(await readFile(first.path), bytes);
		await writeFile(first.path, "conflict");
		await assert.rejects(writeMauiCharterCapture(directory, capture, now));
		assert.equal((await readdir(directory)).length, 1);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

async function realTemporaryDirectory() {
	const { realpath } = await import("node:fs/promises");
	return realpath(await mkdtemp(join(tmpdir(), "maui-charter-test-")));
}

test("Maui rejects checkout output and linked storage without overwriting retained data", async () => {
	await assert.rejects(writeMauiCharterCapture(new URL("../data", import.meta.url).pathname, fixture(), now));
	const directory = await realTemporaryDirectory();
	try {
		const linked = `${directory}-linked`;
		await symlink(directory, linked);
		try {
			await assert.rejects(writeMauiCharterCapture(linked, fixture(), now));
		}
		finally { await rm(linked); }
		assert.deepEqual(await readdir(directory), []);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
