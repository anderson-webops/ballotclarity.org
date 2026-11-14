import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { collectLafayetteGuideResearch, discoverAcadianaBallotGuides, discoverAcadianaElectionHub, lafayetteGuideIndexUrl, lafayetteGuidePolicyHash, lafayetteGuidePolicyUrls } from "../src/lafayette-guide-collection.js";

const privacyLink = `<a href="${lafayetteGuidePolicyUrls.privacy}">Privacy Policy</a>`;
const privacy = `${privacyLink}<div id="main-content"><h1>Privacy Policy</h1><p>${"Reviewed publisher privacy statement. ".repeat(5)}</p></div>`;
const governmentPrivacy = `<a href="${lafayetteGuidePolicyUrls.governmentPrivacy}">Privacy</a><main><h1>Privacy Policy</h1><p>${"Reviewed government privacy statement. ".repeat(5)}</p></main>`;
const governmentRobots = "User-agent: *\nDisallow: /bin/\nDisallow: /config/\nDisallow: /install/\nDisallow: /umbraco/\nDisallow: /views/\nDisallow: /sandbox/\nSitemap: https://www.lafayettela.gov/sitemap-xml/";
const review = { robots: lafayetteGuidePolicyHash("", "robots"), privacy: lafayetteGuidePolicyHash(privacy, "privacy"), governmentRobots: lafayetteGuidePolicyHash(governmentRobots, "governmentRobots"), governmentPrivacy: lafayetteGuidePolicyHash(governmentPrivacy, "governmentPrivacy"), infoRobots: 404 };
const hub = { url: "https://www.oneacadiana.org/advocacy/2030-elections-hub/", year: 2030 };
const guideUrl = "https://www.oneacadiana.org/wp-content/uploads/GeauxVote_Dec2030_BallotGuide-FINAL-v2.pdf";
const bridgeUrl = "https://www.lafayettela.gov/millage";
const governmentUrl = "https://www.lafayettela.info/";
const guideLink = `<a href="${guideUrl}">View 1A’s December 14 Ballot Guide</a>`;
const index = `${privacyLink}<nav><a href="${hub.url}">2030 Elections Hub</a></nav>`;
const hubBody = `${privacyLink}<div id="main-content"><h1>2030 Elections Hub</h1>${guideLink}<a href="${bridgeUrl}">LCG proposition information</a>${guideLink}</div>`;
const question = "Shall the Parish of Lafayette, State of Louisiana (the \"Parish\"), continue to levy a 1.25 mills tax on all property subject to taxation (an estimated $1,000,000 reasonably expected at this time to be collected from the levy of the tax for an entire year), for a period of 10 years, beginning with the year 2031 and ending with the year 2040, for the purpose of maintaining public facilities?";
const guideText = `December 14, 2030 Ballot Guide\nParishwide Proposition No. 1\nExample\n\n1.25 mills | 10 years | 2031–2040\nOfficial ballot question: “${question}”\n`;
const government = `<title>Lafayette Consolidated Government</title><h1>December 14, 2030</h1><details class="prop-detail"><summary>Prop. 1 of 1 - Example 1.25 mills · 2031–2040</summary><p class="ballot-question">${question}</p></details>`;
const response = (body: string, contentType = "text/html", status = 200, location?: string) => ({ body: Buffer.from(body), contentType, status, etag: undefined, ...(location ? { location } : {}) });
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), "lafayette-guide-"));
	const planPath = join(root, "plan.json");
	const plan = { schemaVersion: 1, type: "lafayette-guide-collection", outputRoot: join(root, "intakes"), electionDate: null, accessReview: review };
	await writeFile(planPath, JSON.stringify(plan));
	const responses = new Map([
		[lafayetteGuidePolicyUrls.robots, response("", "text/plain")],
		[lafayetteGuidePolicyUrls.privacy, response(privacy)],
		[lafayetteGuideIndexUrl, response(index)],
		[hub.url, response(hubBody)],
		[guideUrl, response("%PDF-1.4\nSynthetic fixture\n%%EOF", "application/pdf")],
		[lafayetteGuidePolicyUrls.governmentRobots, response(governmentRobots, "text/plain")],
		[lafayetteGuidePolicyUrls.governmentPrivacy, response(governmentPrivacy)],
		[bridgeUrl, response("", "text/html", 301, "https://lafayettela.info")],
		["https://lafayettela.info/robots.txt", response("", "text/plain", 301, "https://www.lafayettela.info/robots.txt")],
		["https://www.lafayettela.info/robots.txt", response("", "text/html", 404)],
		["https://lafayettela.info/", response("", "text/html", 301, governmentUrl)],
		[governmentUrl, response(government)]
	]);
	const requests: string[] = [];
	const delays: number[] = [];
	const options = {
		now: () => Date.parse("2026-11-01T12:00:00.000Z"),
		sleep: async (milliseconds: number) => { delays.push(milliseconds); },
		extract: async () => guideText,
		fetchDocument: async (url: string, limits: { allowedHosts?: readonly string[]; maxBytes?: number; timeoutMs?: number }) => {
			requests.push(url);
			assert.deepEqual(limits.allowedHosts, [new URL(url).hostname]);
			assert.equal(limits.timeoutMs, 20000);
			assert.equal(limits.maxBytes, url === guideUrl ? 12 * 1024 * 1024 : 2 * 1024 * 1024);
			return responses.get(url) ?? assert.fail(`Unexpected source URL ${url}`);
		}
	};
	return { root, plan, planPath, responses, requests, delays, options };
}

test("Lafayette discovers the offered newest hub and future dated guide without annual URL substitution", () => {
	assert.deepEqual(discoverAcadianaElectionHub(`${index}<a href="https://www.oneacadiana.org/advocacy/2026-elections-hub/">2026 Elections Hub</a>`), hub);
	const previous = { url: "https://www.oneacadiana.org/advocacy/2026-elections-hub/", year: 2026 };
	assert.deepEqual(discoverAcadianaElectionHub(`${index}<a href="${previous.url}">2026 Elections Hub</a>`, 2026), previous);
	assert.throws(() => discoverAcadianaElectionHub(index, 2030.5));
	assert.deepEqual(discoverAcadianaBallotGuides(hubBody, hub), { guides: [{ electionDate: "2030-12-14", url: guideUrl }], governmentLinked: true });
	assert.deepEqual(discoverAcadianaBallotGuides(hubBody.replaceAll(guideLink, ""), hub).guides, []);
	const laterHub = { url: hub.url.replaceAll("2030", "2034"), year: 2034 };
	assert.equal(discoverAcadianaBallotGuides(hubBody.replaceAll("2030", "2034"), laterHub).guides[0]?.electionDate, "2034-12-14");
});
test("Lafayette rejects ambiguous, off-origin, malformed and differently dated offered links", () => {
	for (const body of [index.replaceAll("https://www.oneacadiana.org/advocacy/2030", "https://other.example/advocacy/2030"), index.replaceAll("2030 Elections Hub", "2028 Elections Hub"), privacyLink]) assert.throws(() => discoverAcadianaElectionHub(body));
	for (const body of [hubBody.replaceAll("Dec2030", "Nov2030"), hubBody.replaceAll("December 14", "February 30"), hubBody.replaceAll("-v2.pdf", "-v2.pdf?download=1"), hubBody.replaceAll("2030 Elections Hub", "2026 Elections Hub"), hubBody.replaceAll("https://www.oneacadiana.org/wp-content", "https://other.example/wp-content"), hubBody.replace("</div>", `${guideLink.replace("-v2.pdf", "-v3.pdf")}</div>`), `${hubBody}<a href="/new-terms">Terms</a>`]) assert.throws(() => discoverAcadianaBallotGuides(body, hub));
});
test("Lafayette policy pins preserve substantive text and reject changed robots or new legal links", () => {
	assert.equal(lafayetteGuidePolicyHash(" \r\n", "robots"), review.robots);
	assert.equal(lafayetteGuidePolicyHash(privacy.replaceAll("</p>", "  </p>"), "privacy"), review.privacy);
	assert.notEqual(lafayetteGuidePolicyHash(privacy.replace("publisher", "amended publisher"), "privacy"), review.privacy);
	for (const body of ["User-agent: *\nDisallow: /", "User-agent: GPTBot\nDisallow: /"]) assert.throws(() => lafayetteGuidePolicyHash(body, "robots"));
	assert.throws(() => lafayetteGuidePolicyHash(`${governmentRobots}\nDisallow: /millage`, "governmentRobots"));
	assert.throws(() => lafayetteGuidePolicyHash(`${privacy}<a href='/terms'>Terms</a>`, "privacy"));
});
test("Lafayette persists bounded originals, native research, source clocks and review status", async () => {
	const local = await fixture();
	try {
		const result = await collectLafayetteGuideResearch(local.planPath, local.options);
		assert.equal(result.status, "prepared-for-review");
		assert.equal(result.electionDate, "2030-12-14");
		assert.equal(result.preparation?.measures, 1);
		assert.equal(result.imported, false);
		const capture = JSON.parse(await readFile(join(result.outputDirectory, "capture.json"), "utf8"));
		assert.equal(capture.captures.length, 12);
		assert.equal(capture.automaticImportApproved, false);
		assert.equal(capture.personalApplicabilityVerified, false);
		for (const input of capture.captures) {
			assert.equal((await readFile(join(result.outputDirectory, input.path))).length, input.bytes);
			assert.equal(input.capturedAt, "2026-11-01T12:00:00.000Z");
		}
		assert.equal(local.delays[0], 0);
		assert.ok(local.delays.slice(1).every(delay => delay === 11000));
		const research = JSON.parse(await readFile(join(result.outputDirectory, "research/research.json"), "utf8"));
		assert.equal(research.rows[0].question, question);
		assert.equal(research.sources.guide.url, guideUrl);
		assert.equal(research.sources.governmentPage.url, governmentUrl);
	}
	finally { await rm(local.root, { recursive: true, force: true }); }
});
test("Lafayette default selection excludes expired guides while explicit history remains preparable", async () => {
	const local = await fixture();
	try {
		const pending = await collectLafayetteGuideResearch(local.planPath, { ...local.options, now: () => Date.parse("2030-12-15T00:00:00Z") });
		assert.equal(pending.status, "awaiting-offered-guide");
		assert.equal(pending.preparation, null);
		assert.equal(local.requests.length, 4);
		await writeFile(local.planPath, JSON.stringify({ ...local.plan, electionDate: "2030-12-14" }));
		assert.equal((await collectLafayetteGuideResearch(local.planPath, local.options)).preparation?.measures, 1);
	}
	finally { await rm(local.root, { recursive: true, force: true }); }
});
test("Lafayette pending collection invents neither a missing guide nor unrelated publisher requests", async () => {
	const local = await fixture();
	try {
		local.responses.set(hub.url, response(hubBody.replaceAll(guideLink, "")));
		assert.equal((await collectLafayetteGuideResearch(local.planPath, local.options)).electionDate, null);
		assert.deepEqual(local.requests, [lafayetteGuidePolicyUrls.robots, lafayetteGuidePolicyUrls.privacy, lafayetteGuideIndexUrl, hub.url]);
	}
	finally { await rm(local.root, { recursive: true, force: true }); }
});
test("Lafayette retains evidence on access, policy, redirect, document and wording failures", async () => {
	for (const [url, replacement] of [[lafayetteGuidePolicyUrls.robots, response("User-agent: * Disallow: /", "text/plain")], [lafayetteGuidePolicyUrls.privacy, response(privacy.replace("publisher", "changed publisher"))], [guideUrl, response("", "text/plain", 403)], [guideUrl, response("<html>not a PDF</html>", "text/html")], [bridgeUrl, response("", "text/html", 301, "https://unreviewed.example/")], ["https://www.lafayettela.info/robots.txt", response("User-agent: *\nDisallow: /", "text/plain")], [governmentUrl, response(government.replace("$1,000,000", "$2,000,000"))]] as const) {
		const local = await fixture();
		try {
			local.responses.set(url, replacement);
			await assert.rejects(collectLafayetteGuideResearch(local.planPath, local.options));
			const directories = (await readdir(local.plan.outputRoot)).filter(name => name.startsWith("intake-"));
			assert.equal(directories.length, 1);
			const failure = JSON.parse(await readFile(join(local.plan.outputRoot, directories[0]!, "failure.json"), "utf8"));
			assert.equal(failure.status, "review-required");
			assert.ok(failure.captures.some((capture: { url: string }) => capture.url === url));
			assert.equal(failure.imported, false);
			assert.ok(!local.requests.includes("https://unreviewed.example/"));
		}
		finally { await rm(local.root, { recursive: true, force: true }); }
	}
});
test("Lafayette repeat and extraction recovery preserve previous complete research", async () => {
	const local = await fixture();
	try {
		const first = await collectLafayetteGuideResearch(local.planPath, local.options);
		const original = await readFile(join(first.outputDirectory, "capture.json"));
		await assert.rejects(collectLafayetteGuideResearch(local.planPath, { ...local.options, extract: async () => {
			throw new Error("Native extraction unavailable.");
		} }), /extraction unavailable/u);
		assert.deepEqual(await readFile(join(first.outputDirectory, "capture.json")), original);
		const restarted = await collectLafayetteGuideResearch(local.planPath, local.options);
		assert.notEqual(first.outputDirectory, restarted.outputDirectory);
		assert.deepEqual(await readFile(join(first.outputDirectory, "research/measures.csv")), await readFile(join(restarted.outputDirectory, "research/measures.csv")));
	}
	finally { await rm(local.root, { recursive: true, force: true }); }
});
test("Lafayette rejects extra configuration, malformed dates and unsupported approvals before requests", async () => {
	const local = await fixture();
	try {
		for (const plan of [{ ...local.plan, publicationApproved: true }, { ...local.plan, electionDate: "2030-02-30" }, { ...local.plan, accessReview: { ...review, infoRobots: 200 } }, { ...local.plan, accessReview: { ...review, privacy: "changed" } }]) {
			await writeFile(local.planPath, JSON.stringify(plan));
			await assert.rejects(collectLafayetteGuideResearch(local.planPath, local.options));
		}
		assert.equal(local.requests.length, 0);
	}
	finally { await rm(local.root, { recursive: true, force: true }); }
});

test("Lafayette transport and byte-limit failures retain earlier intakes and release coordination", async () => {
	const local = await fixture();
	try {
		const accepted = await collectLafayetteGuideResearch(local.planPath, local.options);
		const original = await readFile(join(accepted.outputDirectory, "capture.json"));
		await assert.rejects(collectLafayetteGuideResearch(local.planPath, { ...local.options, fetchDocument: async (url, limits) => {
			if (url === guideUrl) throw new Error("Publisher timeout.");
			return local.options.fetchDocument(url, limits);
		} }), /Publisher timeout/u);
		local.responses.set(guideUrl, response(`%PDF-${"x".repeat(12 * 1024 * 1024)}`, "application/pdf"));
		await assert.rejects(collectLafayetteGuideResearch(local.planPath, local.options), /requires review/u);
		assert.deepEqual(await readFile(join(accepted.outputDirectory, "capture.json")), original);
	}
	finally { await rm(local.root, { recursive: true, force: true }); }
});

test("Lafayette process-held ownership prevents overlapping runs against one output root", async () => {
	const local = await fixture();
	let release: (() => void) | undefined;
	let entered: (() => void) | undefined;
	const started = new Promise<void>((resolve) => {
		entered = resolve;
	});
	const waiting = new Promise<void>((resolve) => {
		release = resolve;
	});
	try {
		const first = collectLafayetteGuideResearch(local.planPath, { ...local.options, fetchDocument: async (url, limits) => {
			if (url === lafayetteGuidePolicyUrls.robots) {
				entered!();
				await waiting;
			}
			return local.options.fetchDocument(url, limits);
		} });
		await started;
		await assert.rejects(collectLafayetteGuideResearch(local.planPath, local.options), /already running/u);
		release!();
		assert.equal((await first).status, "prepared-for-review");
	}
	finally {
		release?.();
		await rm(local.root, { recursive: true, force: true });
	}
});
