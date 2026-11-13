import type { fetchRemoteSourceDocument } from "../src/remote-json-source.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { collectMauiCharterMeasures, mauiCharterRefreshIntervalMs, readLatestMauiCharterCapture, readMauiCharterCollectionRun } from "../src/maui-charter-collection.js";
import { readMauiCharterCapture } from "../src/maui-charter-measures.js";

const origin = "https://mauicountyvotes.gov";
const articleUrl = `${origin}/blog/f/two-proposed-maui-county-charter-amendments-on-general-ballot`;
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const initialClock = Date.parse("2028-09-20T12:00:00.000Z");
const robots = `User-agent: *\nDisallow: /404\nSitemap: ${origin}/sitemap.xml\n`;
const xml = (urls: string[], root = "urlset") => `<?xml version="1.0"?><${root}>${urls.map(url => `<loc>${url}</loc>`).join("")}</${root}>`;

function fixture() {
	let clock = initialClock;
	let requests = 0;
	let rejected = false;
	let replacement = "";
	const bodies = new Map([
		[`${origin}/robots.txt`, robots],
		[`${origin}/charter-amendments`, `<h1>2028 Charter Amendments</h1>${[1, 2].map(identifier => `<h4>Maui: Procedure ${identifier}</h4><a href="https://img1.wsimg.com/blobby/go/d625d658-8582-4d35-b9fe-7702a7c85585/downloads/00000000-0000-0000-0000-00000000000${identifier}/Reso%2028-${identifier}.pdf?ver=1789162285624">Reso 28-${identifier}</a>`).join("")}`],
		[`${origin}/sitemap.xml`, xml([`${origin}/sitemap.blog.xml`], "sitemapindex")],
		[`${origin}/sitemap.blog.xml`, xml([articleUrl])],
		[articleUrl, `<script>window._BLOG_DATA=${JSON.stringify({ head: { canonicalUrl: articleUrl }, post: { publishedDate: "2028-09-18T18:43:35.465Z", fullContent: JSON.stringify({ blocks: [{ text: "WAILUKU, Hawaii (Sept. 17, 2028), Councilmember reports that the Nov. 7 general election ballot will include two proposed amendments to the Maui County Charter." }, ...[1, 2].map(identifier => ({ text: `Resolution 28-${identifier}: “Shall the Charter be amended to establish procedure ${identifier}?”` }))] }) } })}</script>`]
	]);
	const request: typeof fetchRemoteSourceDocument = async (url, options) => {
		requests++;
		assert.deepEqual(options.allowedHosts, ["mauicountyvotes.gov"]);
		assert.equal(options.maxBytes, 2 * 1024 * 1024);
		assert.equal(options.timeoutMs, 20_000);
		assert.ok(bodies.has(url));
		const body = url === articleUrl && replacement ? replacement : bodies.get(url)!;
		return { status: rejected ? 403 : 200, body: Buffer.from(rejected ? "" : body), contentType: url.endsWith(".txt") ? "text/plain" : url.endsWith(".xml") ? "application/xml" : "text/html", etag: undefined };
	};
	return {
		options: { accessReview: { reviewedAt: new Date(initialClock).toISOString(), robotsSha256: hash(robots) }, now: () => clock, request, pause: async (milliseconds: number) => {
			assert.ok(milliseconds >= 11_000);
			clock += milliseconds;
		} },
		requests: () => requests,
		advance: (milliseconds = mauiCharterRefreshIntervalMs) => { clock += milliseconds; },
		deny: (value = true) => { rejected = value; },
		change: () => { replacement = bodies.get(articleUrl)!.replace("establish procedure 2?", "establish revised procedure 2?"); },
		future: () => {
			clock = Date.parse("2030-09-20T12:00:00.000Z");
			for (const [url, body] of bodies) bodies.set(url, body.replaceAll("2028", "2030").replaceAll("28-", "30-").replace("Nov. 7", "Nov. 5"));
			replacement = "";
		},
		article: () => bodies.get(articleUrl)!,
		replaceArticle: (body: string) => { replacement = body; },
		removeSecond: () => {
			bodies.set(`${origin}/charter-amendments`, bodies.get(`${origin}/charter-amendments`)!.replace(/<h4>Maui: Procedure 2<\/h4><a[^>]*>Reso 28-2<\/a>/u, ""));
			const article = JSON.parse(bodies.get(articleUrl)!.slice("<script>window._BLOG_DATA=".length, -"</script>".length));
			const content = JSON.parse(article.post.fullContent);
			content.blocks.pop();
			content.blocks[0].text = content.blocks[0].text.replace("two proposed amendments", "one proposed amendment");
			article.post.fullContent = JSON.stringify(content);
			replacement = `<script>window._BLOG_DATA=${JSON.stringify(article)}</script>`;
		}
	};
}

async function isolated(work: (directory: string, source: ReturnType<typeof fixture>) => Promise<void>) {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "maui-recurring-")));
	try {
		await work(directory, fixture());
	}
	finally { await rm(directory, { recursive: true, force: true }); }
}

test("Maui scheduled collection saves original evidence and queues unpublished native question review", async () => isolated(async (directory, source) => {
	const result = await collectMauiCharterMeasures({ directory, ...source.options });
	assert.equal(result.questions, 2);
	assert.equal(result.electionDate, "2028-11-07");
	assert.equal(result.publisherRequests, 5);
	assert.equal(result.changed, true);
	assert.equal(result.imported, false);
	assert.equal(result.published, false);
	assert.equal(hash(await readFile(result.path)), result.sha256);
	const review = JSON.parse(await readFile(join(directory, result.review!), "utf8"));
	assert.deepEqual(review.changes, { added: ["28-1", "28-2"], changed: [], removed: [] });
	assert.equal(review.publicationApproved, false);
	assert.equal(review.automaticImportApproved, false);
	assert.equal(review.inventory.resultsInferred, false);
	assert.deepEqual((await readLatestMauiCharterCapture(directory, source.options.now())).inventory, review.inventory);
	assert.equal((await readMauiCharterCollectionRun(directory, source.options.now()))?.status, "succeeded");
}));

test("Maui retries use the same receipt, honor daily pacing and deduplicate unchanged captures across days", async () => isolated(async (directory, source) => {
	const first = await collectMauiCharterMeasures({ directory, ...source.options });
	const original = await readFile(first.path);
	const review = await readFile(join(directory, first.review!));
	const repeated = await collectMauiCharterMeasures({ directory, ...source.options });
	assert.equal(repeated.collected, false);
	assert.equal(repeated.published, false);
	assert.equal(source.requests(), 5);
	source.advance();
	const refreshed = await collectMauiCharterMeasures({ directory, ...source.options });
	assert.equal(refreshed.changed, false);
	assert.equal(refreshed.path, first.path);
	assert.equal(source.requests(), 10);
	assert.deepEqual(await readFile(first.path), original);
	assert.deepEqual(await readFile(join(directory, first.review!)), review);
	assert.equal((await readdir(directory)).filter(name => name.startsWith("maui-charter-")).length, 1);
	assert.equal((await readdir(directory)).filter(name => name.startsWith("maui-review-")).length, 1);
	const latest = await readLatestMauiCharterCapture(directory, source.options.now());
	assert.ok(latest.run!.lastSuccessAt! > latest.capture!.documents[0]!.capturedAt);
}));

test("Maui changed questions create a separate review without deleting the earlier evidence", async () => isolated(async (directory, source) => {
	const first = await collectMauiCharterMeasures({ directory, ...source.options });
	const original = await readFile(first.path);
	source.advance();
	source.change();
	const updated = await collectMauiCharterMeasures({ directory, ...source.options });
	assert.equal(updated.changed, true);
	assert.notEqual(updated.path, first.path);
	const review = JSON.parse(await readFile(join(directory, updated.review!), "utf8"));
	assert.deepEqual(review.changes, { added: [], changed: ["28-2"], removed: [] });
	assert.deepEqual(await readFile(first.path), original);
	assert.equal((await readdir(directory)).filter(name => name.startsWith("maui-review-")).length, 2);
}));

test("Maui discovers a controlled future cycle without relabeling historical capture or transferring editorial approval", async () => isolated(async (directory, source) => {
	const first = await collectMauiCharterMeasures({ directory, ...source.options });
	source.future();
	const options = { ...source.options, accessReview: { ...source.options.accessReview, reviewedAt: new Date(source.options.now()).toISOString() } };
	const next = await collectMauiCharterMeasures({ directory, ...options });
	assert.equal(next.electionDate, "2030-11-05");
	assert.equal(next.changed, true);
	assert.equal(next.automaticImportApproved, false);
	const original = JSON.parse(await readFile(first.path, "utf8"));
	assert.equal(readMauiCharterCapture(original.capture, source.options.now()).electionDate, "2028-11-07");
	const review = JSON.parse(await readFile(join(directory, next.review!), "utf8"));
	assert.deepEqual(review.changes, { added: ["30-1", "30-2"], changed: [], removed: [] });
}));

test("Maui publisher outage records failure, preserves accepted custody and limits retries until recovery", async () => isolated(async (directory, source) => {
	const first = await collectMauiCharterMeasures({ directory, ...source.options });
	const original = await readFile(first.path);
	source.advance();
	source.deny();
	await assert.rejects(collectMauiCharterMeasures({ directory, ...source.options }), /denied/u);
	const failed = await readMauiCharterCollectionRun(directory, source.options.now());
	assert.equal(failed?.reason, "collection-failed");
	assert.equal(failed?.latest?.sha256, first.sha256);
	const requests = source.requests();
	await assert.rejects(collectMauiCharterMeasures({ directory, ...source.options }), /next permitted/u);
	assert.equal(source.requests(), requests);
	source.advance();
	source.deny(false);
	assert.equal((await collectMauiCharterMeasures({ directory, ...source.options })).changed, false);
	assert.deepEqual(await readFile(first.path), original);
}));

test("Maui storage failure retains its prior pointer and success clock and recovers after the next permitted attempt", async () => isolated(async (directory, source) => {
	const first = await collectMauiCharterMeasures({ directory, ...source.options });
	const prior = await readMauiCharterCollectionRun(directory, source.options.now());
	const conflict = join(directory, "maui-charter-unreviewed.json");
	await writeFile(conflict, "retain this file");
	source.advance();
	source.change();
	await assert.rejects(collectMauiCharterMeasures({ directory, ...source.options }), /unreviewed/u);
	const failed = await readMauiCharterCollectionRun(directory, source.options.now());
	assert.equal(failed?.reason, "persistence-failed");
	assert.equal(failed?.latest?.sha256, first.sha256);
	assert.equal(failed?.lastSuccessAt, prior?.lastSuccessAt);
	assert.equal(await readFile(conflict, "utf8"), "retain this file");
	await rm(conflict);
	source.advance();
	assert.equal((await collectMauiCharterMeasures({ directory, ...source.options })).changed, true);
}));

test("Maui collection ownership excludes an overlapping collector and a saved interrupted run is recoverable", async () => isolated(async (directory, source) => {
	let resume!: () => void;
	let entered!: () => void;
	const held = new Promise<void>((resolve) => {
		resume = resolve;
	});
	const started = new Promise<void>((resolve) => {
		entered = resolve;
	});
	const request: typeof fetchRemoteSourceDocument = async (...args) => {
		entered();
		await held;
		return source.options.request(...args);
	};
	const running = collectMauiCharterMeasures({ directory, ...source.options, request });
	await started;
	await assert.rejects(collectMauiCharterMeasures({ directory, ...source.options }), /already running/u);
	resume();
	await running;
	const record = (await readMauiCharterCollectionRun(directory, source.options.now()))!;
	await writeFile(join(directory, "maui-collection-run.json"), JSON.stringify({ ...record, startedAt: new Date(source.options.now()).toISOString(), status: "running", finishedAt: null }));
	await assert.rejects(collectMauiCharterMeasures({ directory, ...source.options }), /next permitted/u);
	source.advance();
	assert.equal((await collectMauiCharterMeasures({ directory, ...source.options })).status, "succeeded");
}));

test("Maui tampered journal, capture, review and linked output fail closed without a publisher retry", async () => isolated(async (directory, source) => {
	const first = await collectMauiCharterMeasures({ directory, ...source.options });
	const original = await readFile(first.path);
	source.advance();
	await writeFile(first.path, "tampered");
	await assert.rejects(collectMauiCharterMeasures({ directory, ...source.options }));
	assert.equal(source.requests(), 5);
	await writeFile(first.path, original);
	const runPath = join(directory, "maui-collection-run.json");
	const run = await readFile(runPath);
	await writeFile(runPath, run.toString().replace("\"status\":\"succeeded\"", "\"status\":\"running\""));
	await assert.rejects(collectMauiCharterMeasures({ directory, ...source.options }));
	assert.equal(source.requests(), 5);
	await writeFile(runPath, run);
	const linked = `${directory}-link`;
	await symlink(directory, linked);
	try {
		await assert.rejects(collectMauiCharterMeasures({ directory: linked, ...source.options }), /physical/u);
	}
	finally { await rm(linked); }
	await writeFile(join(directory, first.review!), "{}");
	await assert.rejects(collectMauiCharterMeasures({ directory, ...source.options }), /pending Maui review/u);
	assert.equal((await readMauiCharterCollectionRun(directory, source.options.now()))?.latest?.sha256, first.sha256);
}));

test("Maui rejects changed access terms and disappeared question text while retaining earlier data", async () => isolated(async (directory, source) => {
	const first = await collectMauiCharterMeasures({ directory, ...source.options });
	source.advance();
	source.replaceArticle(source.article().replace("Shall the Charter be amended to establish procedure 2?", "Incomplete question"));
	await assert.rejects(collectMauiCharterMeasures({ directory, ...source.options }), /question/u);
	assert.equal((await readMauiCharterCollectionRun(directory, source.options.now()))?.latest?.sha256, first.sha256);
	source.advance();
	await assert.rejects(collectMauiCharterMeasures({ directory, ...source.options, accessReview: { ...source.options.accessReview, robotsSha256: "0".repeat(64) } }), /access review/u);
	assert.equal((await readMauiCharterCollectionRun(directory, source.options.now()))?.latest?.sha256, first.sha256);
}));

test("Maui consistent source removals are queued with pinned earlier evidence instead of deleting a question silently", async () => isolated(async (directory, source) => {
	const first = await collectMauiCharterMeasures({ directory, ...source.options });
	source.advance();
	source.removeSecond();
	const updated = await collectMauiCharterMeasures({ directory, ...source.options });
	const review = JSON.parse(await readFile(join(directory, updated.review!), "utf8"));
	assert.deepEqual(review.changes, { added: [], changed: [], removed: ["28-2"] });
	assert.equal(review.previousCapture.sha256, first.sha256);
	assert.equal(review.publicationApproved, false);
	assert.equal(JSON.parse(await readFile(first.path, "utf8")).inventory.questions.length, 2);
	await readLatestMauiCharterCapture(directory, source.options.now());
}));

test("Maui archive capacity fails closed and keeps every earlier capture", async () => isolated(async (directory, source) => {
	const first = await collectMauiCharterMeasures({ directory, ...source.options });
	for (let index = 0; index < 255; index++) await writeFile(join(directory, `maui-charter-2028-11-07-${String(index).padStart(64, "0")}.json`), "retained");
	source.advance();
	source.change();
	await assert.rejects(collectMauiCharterMeasures({ directory, ...source.options }), /retention review/u);
	assert.equal((await readMauiCharterCollectionRun(directory, source.options.now()))?.latest?.sha256, first.sha256);
	assert.equal((await readdir(directory)).filter(name => name.startsWith("maui-charter-")).length, 256);
}));
