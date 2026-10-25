import type { TestContext } from "node:test";
import type { ElectionDocumentPlan, ElectionDocumentSeed } from "../src/election-document-collection.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { collectElectionDocuments, discoverElectionDocuments, electionDocumentConfigurationSha256, electionDocumentPolicyFingerprint, electionDocumentPublisherHosts, electionDocumentRobotsPolicy, seedElectionDocuments } from "../src/election-document-collection.js";
import { electionDocumentSources } from "../src/election-document-sources.js";
import { RemoteSourceDocumentPolicyError } from "../src/remote-json-source.js";

const epoch = Date.parse("2026-10-23T05:00:00Z");
const day = 86_400_000;
const hash = (body: Uint8Array | string) => createHash("sha256").update(body).digest("hex");
const robots = "User-agent: *\nDisallow: /private/\nAllow: /private/public$\n";
const pdf = Buffer.from([37, 80, 68, 70, 45, 255, 0, 128]);

test("reviewed relative extension disallows remain restrictive for every nested path", () => {
	const patterns = ["*.json", "*.csv", "*.xls", "*.xlsx"];
	const body = Buffer.from(`User-agent: *\n${patterns.map(pattern => `Disallow: ${pattern}`).join("\n")}\n`);
	assert.throws(() => electionDocumentRobotsPolicy(body), /robots-format-changed/u);
	const policy = electionDocumentRobotsPolicy(body, [], patterns);
	for (const extension of ["json", "csv", "xls", "xlsx"]) assert.equal(policy.allowed(`https://www.elections.virginia.gov/nested/report.${extension}?download=1`), false);
	assert.equal(policy.allowed("https://www.elections.virginia.gov/casting-a-ballot/candidate-list/"), true);
	assert.equal(policy.allowed("https://www.elections.virginia.gov/guide.html"), true);
});

test("relative robots review never permits unknown patterns or relative allow rules", () => {
	for (const rule of ["Disallow: *.zip", "Allow: *.json", "Disallow: file.json", "Disallow: *"]) assert.throws(() => electionDocumentRobotsPolicy(Buffer.from(`User-agent: *\n${rule}\n`), [], ["*.json"]), /robots-format-changed/u);
	for (const patterns of [["*.json", "*.json"], ["*"], ["/allowed"], ["*.j(s)on"], Array.from({ length: 11 }, (_, index) => `*.${String.fromCharCode(97 + index)}`)]) assert.throws(() => electionDocumentRobotsPolicy(Buffer.from(robots), [], patterns), /robots-relative-rule-review-required/u);
	assert.throws(() => electionDocumentPublisherHosts({ ...electionDocumentSources[0]!, relativeRobotsDisallows: ["Allow: /"] }), /robots-relative-rule-review-required/u);
});

test("reviewed extension restrictions retain explicit path specificity and crawl limits", () => {
	const policy = electionDocumentRobotsPolicy(Buffer.from("User-agent: *\nDisallow: *.json\nAllow: /public/reviewed.json$\nCrawl-delay: 20\n"), [], ["*.json"]);
	assert.equal(policy.delay, 20_000);
	assert.equal(policy.allowed("https://example.org/public/reviewed.json"), true);
	assert.equal(policy.allowed("https://example.org/private/reviewed.json"), false);
});

async function fixture(context: TestContext, sourceIds = ["nd-measure-documents-2026"]) {
	const directory = await mkdtemp(join(tmpdir(), "election-document-test-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const sources = sourceIds.map(id => electionDocumentSources.find(source => source.id === id)!);
	const bodies = new Map<string, Buffer>();
	const sourceDocuments = new Map(sources.map(source => [source.id, source.reviewedDocumentUrls ?? (source.stateCode === "NY"
		? [1, 2, 3, 4, 5].map(number => `${source.indexUrl}ballot-proposal-${number}/`)
		: ["MI", "AK"].includes(source.stateCode)
				? source.encodedDocumentPaths!.map(path => `https://${source.host}${path}`)
				: source.stateCode === "MO"
					? ["SECONDREVISEDHCSHJR73", "2026-106"].map(name => `https://${source.host}/CMSImages/Elections/Petitions/${name}WebCert.pdf`)
					: source.stateCode === "NM"
						? [`https://${source.host}/Publications/New_Mexico_State_Government/Constitutional_Amendment/Constitutional_Amendments_2026.pdf`]
						: source.stateCode === "UT"
							? [`https://${source.host}/api/media/file/2026_General_Sample_Ballots_Corrected_2_e50150f2c0.PDF`]
							: source.stateCode === "MD"
								? [`https://${source.host}/elections/2026/ballot_questions.html`]
								: ["WA", "OK", "OR", "GA", "MA", "CA", "KS", "TX", "NV", "FL", "OH", "WY", "WV", "AR"].includes(source.stateCode)
										? source.documentPatterns.map(pattern => `https://${source.host}${pattern.slice(1, -1).replaceAll("\\.", ".")}`)
										: source.stateCode === "VA"
											? [`https://${source.host}/casting-a-ballot/candidate-list/${source.id.includes("candidates") ? "november-3-2026-gen-elect-all-offices" : "november-2026-proposed-constitutional-amendments"}/`]
											: [1, 2].map(number => `https://${source.host}/sites/default/files/documents/elections/measures/ballot-language-2026-general-measure${number}.pdf`))]));
	const documentUrls = [...sourceDocuments.values()].flat();
	const plan: ElectionDocumentPlan = { schemaVersion: 1, type: "election-document-collection", sourceIds, cacheDirectory: join(directory, "cache"), outputRoot: join(directory, "out"), accessReviews: [] };
	const seed: ElectionDocumentSeed = { schemaVersion: 1, type: "election-document-seed", captures: [] };
	for (const source of sources) {
		const localUrls = sourceDocuments.get(source.id)!;
		const sharedIndex = sources.filter(other => other.indexUrl === source.indexUrl);
		for (const policy of source.policies) bodies.set(policy.url, policy.format === "pdf" ? pdf : Buffer.from(policy.format === "robots" ? robots + (source.repeatWildcardGroup ? "\nUser-agent: *\nDisallow: /reviewed-private/\n" : "") + (source.relativeRobotsDisallows ?? []).map(pattern => `Disallow: ${pattern}\n`).join("") + (policy.otherRobotsAgents ?? source.otherRobotsAgents ?? []).map(agent => `\nUser-agent: ${agent}\nDisallow: /\n`).join("") : `<main${policy.regionId ? ` id="${policy.regionId}"` : ""}${policy.regionClass ? ` class="${policy.regionClass}"` : ""}><h1>${policy.id}</h1>Public policy factual text retained for explicit review. Changes need review.</main><footer>State policy</footer>`));
		bodies.set(source.indexUrl, Buffer.from(`<main><h1>${sharedIndex.flatMap(other => other.dateMarkers).join(" ")}</h1>${sharedIndex.flatMap(other => sourceDocuments.get(other.id)!).map(url => `<a href="${url}">Document</a>`).join("")}</main><footer>State election office</footer>`));
		for (const url of localUrls) bodies.set(url, source.documentFormat === "html" ? Buffer.from(`<main>${source.documentDateMarkers!.join(" ")}${url === source.indexUrl ? `<a href="${url}">Question listing</a>` : ""}</main><footer>Reviewed publisher notice</footer>`) : pdf);
		const fingerprints = Object.fromEntries(source.policies.map(policy => [policy.id, electionDocumentPolicyFingerprint(bodies.get(policy.url)!, policy.format, policy.url, policy.regionId, policy.regionClass)]));
		fingerprints.indexLinks = electionDocumentPolicyFingerprint(bodies.get(source.indexUrl)!, "links", source.indexUrl);
		if (source.documentFormat === "html") fingerprints.documentLinks = electionDocumentPolicyFingerprint(bodies.get(localUrls[0]!)!, "links", localUrls[0]!);
		plan.accessReviews.push({ sourceId: source.id, reviewedAt: new Date(epoch).toISOString(), configurationSha256: electionDocumentConfigurationSha256(source), policyFingerprints: fingerprints });
		const observedUrls = new Set([source.indexUrl, ...source.policies.map(policy => policy.url), ...localUrls]);
		for (const [url, body] of bodies) {
			if (!observedUrls.has(url)) continue;
			const path = join(directory, `capture-${hash(url)}`);
			await writeFile(path, body);
			seed.captures.push({ sourceId: source.id, url, path, sha256: hash(body), capturedAt: new Date(epoch).toISOString(), etag: "\"first\"" });
		}
	}
	return { directory, plan, seed, sources, bodies, documentUrls };
}

test("West Virginia collects only its reviewed SOS amendment notice", async (context) => {
	const input = await fixture(context, ["wv-amendment-notice-2026"]);
	const source = input.sources[0]!;
	assert.deepEqual(electionDocumentPublisherHosts(source), ["sos.wv.gov", "www.wv.gov"]);
	assert.equal(source.documentFormat, "html");
	assert.deepEqual([source.minimumDocuments, source.maximumDocuments], [1, 1]);
	assert.ok(!input.seed.captures.some(capture => /apps\.sos\.wv\.gov|candidates\.wvsos\.gov/u.test(capture.url)));
	assert.equal((await seedElectionDocuments(input.plan, input.seed, epoch)).seeded, 12);
	const result = await collectElectionDocuments(input.plan, { now: () => epoch + 1000, fetchDocument: async () => assert.fail("Retained notice validation requires no publisher request.") });
	assert.equal(result.complete, true);
	assert.equal(result.publisherRequests, 0);
	assert.equal(result.observations[0]!.documents!.length, 1);
	assert.equal(result.imported, false);
	assert.equal(result.published, false);
});

test("West Virginia notice discovery retains year, exact path and policy identity gates", async (context) => {
	const input = await fixture(context, ["wv-amendment-notice-2026"]);
	const source = input.sources[0]!;
	const index = input.bodies.get(source.indexUrl)!.toString();
	for (const mutation of [index.replaceAll("2026", "2028"), index.replace("constitution-will", "constitution-will?mode=all"), index.replace("constitution-will", "constitution-will-other")])
		assert.throws(() => discoverElectionDocuments(source, Buffer.from(mutation)));
	const changed = structuredClone(source);
	changed.policies.find(policy => policy.id === "policy-links")!.url += "/Pages/default.aspx";
	assert.notEqual(electionDocumentConfigurationSha256(source), electionDocumentConfigurationSha256(changed));
});

test("Pulaski notice collection is independent of denied Arkansas publishers", async (context) => {
	const input = await fixture(context, ["ar-pulaski-election-notice-2026"]);
	const source = input.sources[0]!;
	assert.deepEqual(electionDocumentPublisherHosts(source), ["votepulaskiar.gov"]);
	assert.deepEqual([source.minimumDocuments, source.maximumDocuments], [1, 1]);
	assert.equal((await seedElectionDocuments(input.plan, input.seed, epoch)).seeded, 3);
	const result = await collectElectionDocuments(input.plan, { now: () => epoch + 1000, fetchDocument: async () => assert.fail("Retained county evidence needs no publisher request.") });
	assert.equal(result.complete, true);
	assert.equal(result.publisherRequests, 0);
	assert.equal(result.observations[0]!.documents!.length, 1);
	assert.equal(result.imported, false);
	assert.equal(result.published, false);
});

test("different publisher hosts retain their own exact robots group reviews", async (context) => {
	const source = electionDocumentSources.find(source => source.stateCode === "CA")!;
	const input = await fixture(context, [source.id]);
	assert.doesNotMatch(input.bodies.get("https://elections.sbcounty.gov/robots.txt")!.toString(), /SemrushBot/u);
	assert.match(input.bodies.get("https://main.sbcounty.gov/robots.txt")!.toString(), /SemrushBot-SA/u);
	assert.deepEqual(await seedElectionDocuments(input.plan, input.seed, epoch), { seeded: 5, publisherRequests: 0, imported: false });
	const result = await collectElectionDocuments(input.plan, { now: () => epoch + 1000, fetchDocument: async () => assert.fail("Retained host-specific policies require no requests.") });
	assert.equal(result.complete, true);
	assert.equal(result.publisherRequests, 0);
	assert.equal(result.observations[0]!.documents!.length, 1);
	assert.throws(() => electionDocumentPublisherHosts({ ...source, policies: source.policies.map(policy => policy.format === "links" ? { ...policy, otherRobotsAgents: [] } : policy) }), /robots-group-review-required/u);
	assert.notEqual(electionDocumentConfigurationSha256(source), electionDocumentConfigurationSha256({ ...source, policies: source.policies.map(policy => ({ ...policy, otherRobotsAgents: undefined })) }));
});

test("host-specific robots reviews reject missing groups, extra groups and denied inventory paths", async (context) => {
	const source = electionDocumentSources.find(source => source.stateCode === "CA")!;
	for (const kind of ["missing", "extra", "denied"] as const) {
		const input = await fixture(context, [source.id]);
		const url = kind === "missing" ? "https://main.sbcounty.gov/robots.txt" : "https://elections.sbcounty.gov/robots.txt";
		const capture = input.seed.captures.find(capture => capture.url === url)!;
		const body = Buffer.from(kind === "missing" ? robots : input.bodies.get(url)!.toString() + (kind === "extra" ? "\nUser-agent: SemrushBot\nDisallow: /\n" : "\nDisallow: /elections/\n"));
		await writeFile(capture.path, body);
		capture.sha256 = hash(body);
		const policy = source.policies.find(policy => policy.url === url)!;
		input.plan.accessReviews[0]!.policyFingerprints[policy.id] = electionDocumentPolicyFingerprint(body, "robots", url);
		await assert.rejects(seedElectionDocuments(input.plan, input.seed, epoch), kind === "denied" ? /outside its permitted observed source links/u : /robots-group-review-required/u);
		assert.deepEqual(await readdir(join(input.plan.cacheDirectory, "captures")), []);
	}
});

test("PDF policy fingerprints retain exact bytes and reject non-PDF bodies", () => {
	const address = "https://example.org/policies/use.pdf";
	assert.equal(electionDocumentPolicyFingerprint(pdf, "pdf", address), hash(pdf));
	assert.notEqual(electionDocumentPolicyFingerprint(Buffer.concat([pdf, Buffer.from("changed")]), "pdf", address), hash(pdf));
	for (const body of [Buffer.alloc(0), Buffer.from("<html>Denied</html>"), Buffer.alloc(12 * 1024 * 1024 + 1)])
		assert.throws(() => electionDocumentPolicyFingerprint(body, "pdf", address), /policy-pdf-invalid/u);
});

test("Tuscola collection binds both current November documents and exact PDF policies", async (context) => {
	const input = await fixture(context, ["mi-tuscola-documents-2026"]);
	const source = input.sources[0]!;
	assert.deepEqual(electionDocumentPublisherHosts(source), ["www.tuscolacounty.org"]);
	assert.equal(source.policies.filter(policy => policy.format === "pdf").length, 3);
	assert.deepEqual(discoverElectionDocuments(source, input.bodies.get(source.indexUrl)!), [...input.documentUrls].sort());
	assert.throws(() => discoverElectionDocuments(source, Buffer.from(input.bodies.get(source.indexUrl)!.toString().replace("2026, November 3rd", "2026, August 4th"))), /index-election-changed/u);
	assert.throws(() => discoverElectionDocuments(source, Buffer.from(input.bodies.get(source.indexUrl)!.toString().replace(input.documentUrls[0]!, "https://www.tuscolacounty.org/elections/2026/11/unreviewed.pdf"))), /document-count-changed/u);
	const seeded = await seedElectionDocuments(input.plan, input.seed, epoch);
	assert.equal(seeded.publisherRequests, 0);
	const collected = await collectElectionDocuments(input.plan, { now: () => epoch + 1000, fetchDocument: async () => assert.fail("Fresh retained documents require no network.") });
	assert.equal(collected.complete, true);
	assert.equal(collected.publisherRequests, 0);
});

test("changed PDF policies hold the publisher before election documents are requested", async (context) => {
	const input = await fixture(context, ["mi-tuscola-documents-2026"]);
	await seedElectionDocuments(input.plan, input.seed, epoch);
	const policy = input.sources[0]!.policies.find(policy => policy.format === "pdf")!;
	const requests: string[] = [];
	let clock = epoch + day;
	const result = await collectElectionDocuments(input.plan, {
		now: () => clock,
		sleep: async (milliseconds) => { clock += milliseconds; },
		fetchDocument: async (url) => {
			requests.push(url);
			return url === policy.url ? { status: 200, body: Buffer.concat([pdf, Buffer.from("changed")]), contentType: "application/pdf", etag: undefined } : { status: 304, body: Buffer.alloc(0), contentType: "", etag: undefined };
		},
	});
	assert.equal(result.complete, false);
	assert.equal(result.observations[0]!.reason, "publisher-policy-changed");
	assert.ok(!requests.some(url => input.documentUrls.includes(url)));
	assert.deepEqual(await readFile(join(input.plan.cacheDirectory, "bodies", hash(pdf))), pdf);
	const held = await collectElectionDocuments(input.plan, { now: () => clock, fetchDocument: async () => assert.fail("A publisher hold must prevent transport.") });
	assert.equal(held.publisherRequests, 0);
});

test("Kansas collection binds its exact November amendment publication and policy region", () => {
	const source = electionDocumentSources.find(source => source.id === "ks-statewide-amendment-2026")!;
	const url = "https://www.sos.ks.gov/elections/26elec/2026-General-Election-Constitutional-Amendment-Citizen-Clarification.pdf";
	const index = Buffer.from(`<h1>November 3, 2026 General Election</h1><p>Vote Yes or No</p><a href="${url}">Download</a><a href="${url}">Repeated link</a>`);
	assert.deepEqual(discoverElectionDocuments(source, index), [url]);
	assert.deepEqual(electionDocumentPublisherHosts(source), ["www.sos.ks.gov"]);
	assert.deepEqual(source.policies.find(policy => policy.id === "open-records"), { id: "open-records", url: "https://www.sos.ks.gov/general-services/kora-policy-statement.html", format: "region", regionClass: "page-content" });
	assert.throws(() => discoverElectionDocuments(source, Buffer.from(index.toString().replace("November 3, 2026", "August 4, 2026"))), /election-changed/u);
	assert.throws(() => discoverElectionDocuments(source, Buffer.from(index.toString().replaceAll(url, "https://www.sos.ks.gov/elections/26elec/2026-Primary-Election-Constitutional-Amendment-Judicial-Election.pdf"))), /count-changed/u);
});

test("reviewed document discovery is election-bound, same-host, bounded and additive", () => {
	assert.deepEqual(electionDocumentSources.map(source => source.stateCode), ["ND", "MO", "NM", "UT", "MD", "VA", "VA", "WA", "OK", "CT", "OR", "GA", "MA", "CA", "KS", "MI", "TX", "NV", "FL", "OH", "NY", "AK", "DC", "WY", "WV", "AR"]);
	const source = electionDocumentSources[0]!;
	const url = `https://${source.host}/sites/default/files/documents/elections/measures/analysis-2026-general-measure3.pdf`;
	assert.deepEqual(discoverElectionDocuments(source, Buffer.from(`<main>2026 General Election <a href="${url}#page=1">New publication</a><a href="${url}">Repeated link</a><a href="https://elsewhere.invalid/file.pdf">Not allowed</a></main>`)), [url]);
	assert.throws(() => discoverElectionDocuments(source, Buffer.from(`<main>2028 General Election<a href="${url}">Wrong cycle</a></main>`)), /election-changed/u);
	assert.throws(() => discoverElectionDocuments(source, Buffer.from("<main>2026 General Election</main>")), /count-changed/u);
	assert.throws(() => discoverElectionDocuments(source, Buffer.from(`<main>2026 General Election<a href="${url}?mode=private">Not normal</a></main>`)), /link-changed/u);
});

test("Franklin charter discovery retains fifteen exact documents and the canonical public homepage", () => {
	const source = electionDocumentSources.find(item => item.id === "oh-franklin-charter-documents-2026")!;
	const addresses = source.documentPatterns.map(pattern => `https://${source.host}${pattern.slice(1, -1)}`);
	const index = (urls: string[]) => Buffer.from(`<main>${source.dateMarkers.join(" ")}${urls.map(url => `<a href="${url}">Document</a>`).join("")}</main>`);
	assert.equal(addresses.length, 15);
	assert.deepEqual(discoverElectionDocuments(source, index(addresses)), addresses.toSorted());
	assert.equal(source.policies.find(policy => policy.id === "home-links")!.url, `https://${source.host}/home`);
	assert.throws(() => discoverElectionDocuments(source, index(addresses.slice(1))), /count-changed/u);
	assert.throws(() => discoverElectionDocuments(source, Buffer.from(index(addresses).toString().replace("2026 Election Info", "2028 Election Info"))), /election-changed/u);
	assert.throws(() => discoverElectionDocuments(source, index(addresses.map(url => `${url}?download=all`))), /link-changed/u);
});

test("Franklin unavailable robots stops automatic collection before homepage or document requests", async (context) => {
	const sourceId = "oh-franklin-charter-documents-2026";
	const input = await fixture(context, [sourceId]);
	const requests: string[] = [];
	const result = await collectElectionDocuments(input.plan, { now: () => epoch, fetchDocument: async (url) => {
		requests.push(url);
		return { status: 404, body: Buffer.alloc(0), contentType: "text/html", etag: undefined };
	} });
	assert.deepEqual(requests, ["https://www.vote.franklincountyohio.gov/robots.txt"]);
	assert.equal(result.complete, false);
	assert.deepEqual(result.observations, [{ sourceId, complete: false, reason: "document-or-policy-unavailable", status: 404 }]);
	assert.equal(result.imported, false);
	assert.equal(result.published, false);
});

test("reviewed English asset URLs retain exact D.C. editions and reject unreviewed query or path changes", () => {
	const source = electionDocumentSources.find(item => item.id === "dc-general-measure-documents-2026")!;
	const addresses = source.reviewedDocumentUrls!;
	const index = (urls: string[]) => Buffer.from(`<main>${source.dateMarkers.join(" ")}${urls.map(url => `<a href="${url}">Sample</a>`).join("")}</main>`);
	assert.equal(addresses.length, 12);
	assert.deepEqual(discoverElectionDocuments(source, index(addresses)), addresses.toSorted());
	for (const change of ["?language=fr", "?language=%65n", "?language=en&language=en", "?language=en&download=all", ""]) {
		assert.throws(() => discoverElectionDocuments(source, index([addresses[0]!.replace("?language=en", change), ...addresses.slice(1)])), /link-changed/u);
		assert.throws(() => electionDocumentPublisherHosts({ ...source, reviewedDocumentUrls: [addresses[0]!.replace("?language=en", change)] }), /query-review-required/u);
	}
	assert.throws(() => discoverElectionDocuments(source, index(addresses.slice(1))), /count-changed/u);
	assert.throws(() => discoverElectionDocuments(source, Buffer.from(index(addresses).toString().replace("2026", "2028"))), /election-changed/u);
	assert.throws(() => electionDocumentPublisherHosts({ ...source, reviewedDocumentUrls: [addresses[0]!.replace(".pdf?", ".html?")] }), /query-review-required/u);
});

test("D.C. unavailable robots stops unattended collection before index or ballot requests", async (context) => {
	const sourceId = "dc-general-measure-documents-2026";
	const input = await fixture(context, [sourceId]);
	const requests: string[] = [];
	const result = await collectElectionDocuments(input.plan, { now: () => epoch, fetchDocument: async (url) => {
		requests.push(url);
		return { status: 404, body: Buffer.alloc(0), contentType: "text/html", etag: undefined };
	} });
	assert.deepEqual(requests, ["https://dcboe.org/robots.txt"]);
	assert.equal(result.complete, false);
	assert.deepEqual(result.observations, [{ sourceId, complete: false, reason: "document-or-policy-unavailable", status: 404 }]);
	assert.equal(result.imported, false);
	assert.equal(result.published, false);
});

test("reviewed revision URLs retain the complete public identity and reject every unreviewed query", () => {
	const source = electionDocumentSources.find(item => item.stateCode === "CT")!;
	const body = (addresses: string[]) => Buffer.from(`<main>${source.dateMarkers.join(" ")} ${addresses.map(address => `<a href="${address}">Sample</a>`).join("")}</main>`);
	const addresses = source.reviewedDocumentUrls!;
	assert.deepEqual(discoverElectionDocuments(source, body(addresses.map(address => `${address}#page=1`))), [...addresses].sort());
	const first = new URL(addresses[0]!);
	for (const replacement of [first.origin + first.pathname, addresses[0]!.replace("rev=", "version="), `${addresses[0]!}&token=public`, addresses[0]!.replace(/hash=[a-f\d]+/iu, `hash=${"0".repeat(32)}`), addresses[0]!.replace("?rev=", "?REV="), addresses[0]!.replace("&hash=", "&hash=unexpected&extra=")]) assert.throws(() => discoverElectionDocuments(source, body([replacement, ...addresses.slice(1)])), /document-link-changed/u);
	assert.throws(() => discoverElectionDocuments({ ...source, reviewedDocumentUrls: undefined }, body(addresses)), /document-link-changed/u);
});

test("Fulton discovery retains only its exact current consolidated sample and rejects changed cycles or queries", () => {
	const source = electionDocumentSources.find(item => item.id === "ga-fulton-documents-2026")!;
	const url = `https://${source.host}/-/media/2026-Election/November-3-Election/Sample-Ballot--Consolidated--Nov-32026-General--Special-Election--1082026.pdf`;
	const body = (address: string, markers = source.dateMarkers.join(" ")) => Buffer.from(`<main>${markers}<a href="${address}">Consolidated sample</a><a href="https://sos.ga.gov/write-ins.pdf">Other publisher</a><a href="https://${source.host}/-/media/old-sample.pdf">Older sample</a></main>`);
	assert.deepEqual(discoverElectionDocuments(source, body(`${url}#page=3`)), [url]);
	assert.throws(() => discoverElectionDocuments(source, body(url, "November 2028 General Election")), /index-election-changed/u);
	assert.throws(() => discoverElectionDocuments(source, body(`${url}?download=private`)), /document-link-changed/u);
	assert.throws(() => discoverElectionDocuments(source, body(url.replace("1082026", "1092026"))), /document-count-changed/u);
	assert.deepEqual(electionDocumentPublisherHosts(source), ["fultoncountyga.gov"]);
});

test("Boston discovery pins the current independently published English questions without following other publishers", () => {
	const source = electionDocumentSources.find(item => item.id === "ma-boston-documents-2026")!;
	const url = `https://${source.host}/sites/default/files/file/2026/10/2026-11-03-Statewide-Ballot-Questions-English.pdf`;
	const body = (address: string, markers = source.dateMarkers.join(" ")) => Buffer.from(`<main>${markers}<a href="${address}">English</a><a href="${url.replace("English", "Spanish")}">Spanish</a><a href="https://www.sec.state.ma.us/guide.pdf">State portal</a></main>`);
	assert.deepEqual(discoverElectionDocuments(source, body(`${url}#page=6`)), [url]);
	assert.deepEqual(electionDocumentPublisherHosts(source), ["www.boston.gov"]);
	assert.deepEqual(source.policies.find(policy => policy.id === "terms-privacy"), { id: "terms-privacy", url: "https://www.boston.gov/government/cabinets/innovation-and-technology/terms-use-and-privacy-policy-city-boston-digital", format: "region", regionId: "content" });
	assert.throws(() => discoverElectionDocuments(source, body(url, "November 2028 State Election")), /index-election-changed/u);
	assert.throws(() => discoverElectionDocuments(source, body(`${url}?download=1`)), /document-link-changed/u);
	assert.throws(() => discoverElectionDocuments(source, body(url.replace("2026-11-03", "2026-11-04"))), /document-count-changed/u);
	assert.throws(() => discoverElectionDocuments(source, body(url.replace("English.pdf", "English-revised.pdf"))), /document-count-changed/u);
});

test("San Bernardino inventory discovery never follows the held upload or state-guide hosts", () => {
	const source = electionDocumentSources.find(item => item.id === "ca-san-bernardino-measure-inventory-2026")!;
	const url = "https://elections.sbcounty.gov/elections/2026/1103/measures/";
	const body = (address: string, marker = source.dateMarkers[0]!) => Buffer.from(`<main>${marker}<a href="${address}">Current measures</a><a href="https://uploads.rov.sbcounty.gov/ROV/Elections/2026/1103/VIG.pdf">County PDF</a><a href="https://voterguide.sos.ca.gov/propositions/1/index.htm">State guide</a></main>`);
	assert.deepEqual(discoverElectionDocuments(source, body(url)), [url]);
	assert.deepEqual(electionDocumentPublisherHosts(source), ["elections.sbcounty.gov", "main.sbcounty.gov"]);
	assert.equal(source.documentFormat, "html");
	assert.throws(() => discoverElectionDocuments(source, body(url, "November 2028 General Election")), /index-election-changed/u);
	assert.throws(() => discoverElectionDocuments(source, body(`${url}?download=1`)), /document-link-changed/u);
	assert.throws(() => discoverElectionDocuments(source, body(url.replace("1103", "0602"))), /document-count-changed/u);
});

test("revision-query review rejects credentials, routing, encoded values and malformed identity lists", () => {
	const source = electionDocumentSources.find(item => item.stateCode === "CT")!;
	const first = source.reviewedDocumentUrls![0]!;
	for (const replacement of [first.replace("https://", "http://"), first.replace("portal.ct.gov", "elsewhere.invalid"), first.replace("https://", "https://name@"), first.replace("portal.ct.gov", "portal.ct.gov:444"), `${first}#page=1`, `${first}&rev=${"0".repeat(32)}`, first.replace("rev=", "rev=%61"), first.replace(/hash=[a-f\d]+/iu, "hash=123"), first.replace("?rev=", "?token="), first.replace("?rev=", "?%72ev=")]) assert.throws(() => electionDocumentPublisherHosts({ ...source, reviewedDocumentUrls: [replacement] }), /document-query-review-required/u);
	for (const addresses of [[], [first, first], Array.from<string>({ length: 22 }).fill(first)]) assert.throws(() => electionDocumentPublisherHosts({ ...source, reviewedDocumentUrls: addresses }), /document-query-review-required/u);
});

test("a reviewed second wildcard group combines restrictions without changing default refusal", () => {
	const body = Buffer.from("User-agent: *\nAllow: /\nDisallow: /first-private/\nUser-agent: *\nDisallow: /second-private/\nCrawl-delay: 20\nUser-agent: *semrush*\nDisallow: /\n");
	assert.throws(() => electionDocumentRobotsPolicy(body, ["*semrush*"]), /robots-group-review-required/u);
	const permission = electionDocumentRobotsPolicy(body, ["*semrush*"], [], true);
	assert.equal(permission.delay, 20_000);
	assert.equal(permission.allowed("https://portal.ct.gov/public.pdf"), true);
	assert.equal(permission.allowed("https://portal.ct.gov/first-private/file.pdf"), false);
	assert.equal(permission.allowed("https://portal.ct.gov/second-private/file.pdf"), false);
});

test("wildcard-group review never permits additional groups, unrelated patterns or crawler identity changes", () => {
	const body = "User-agent: *\nDisallow: /first/\nUser-agent: *\nDisallow: /second/\n";
	for (const value of [robots, `${body}User-agent: *\nAllow: /\n`, `${body}User-agent: OtherBot\nDisallow: /\n`, "User-agent: *\nUser-agent: *\nDisallow: /\n"]) assert.throws(() => electionDocumentRobotsPolicy(Buffer.from(value), [], [], true), /robots-group-review-required/u);
	for (const agent of ["*source*", "*bot*", "*GPTBot*", "GPTBot", "BallotClarity", "ClaudeBot"]) assert.throws(() => electionDocumentRobotsPolicy(Buffer.from(`${body}User-agent: ${agent}\nDisallow: /\n`), [agent], [], true), /robots-group-review-required/u);
	assert.throws(() => electionDocumentRobotsPolicy(Buffer.from(body), [], [], false as unknown as true), /robots-group-review-required/u);
});

test("encoded filenames require an exact reviewed path without changing the public address", () => {
	const source = { ...electionDocumentSources[0]!, documentPatterns: ["^/published/.*\\.pdf$"], maximumDocuments: 3 };
	const paths = ["/published/first%20title.pdf", "/published/second%26title.pdf"];
	const body = Buffer.from(`<main>2026 General Election ${paths.map(path => `<a href="${path}">Publication</a>`).join("")}</main>`);
	assert.throws(() => discoverElectionDocuments(source, body), /document-link-changed/u);
	assert.deepEqual(discoverElectionDocuments({ ...source, encodedDocumentPaths: paths }, body), paths.map(path => `https://${source.host}${path}`));
	assert.throws(() => discoverElectionDocuments({ ...source, encodedDocumentPaths: paths.slice(0, 1) }, body), /document-link-changed/u);
});

test("Woodward collection is restricted to the three current county-published samples", () => {
	const source = electionDocumentSources.find(item => item.stateCode === "OK")!;
	const paths = source.documentPatterns.map(pattern => pattern.slice(1, -1).replaceAll("\\.", "."));
	const body = (included: string[]) => Buffer.from(`<main>${source.dateMarkers.join(" ")} ${included.map(path => `<a href="${path}">Sample ballot</a>`).join("")}</main>`);
	assert.deepEqual(discoverElectionDocuments(source, body([...paths, "/media/view/special_county_question_sample_ballot_1232.pdf", "https://www.sos.ok.gov/documents/questions/845.pdf"])), paths.map(path => `https://${source.host}${path}`).sort());
	assert.throws(() => discoverElectionDocuments(source, body(paths.slice(1))), /document-count-changed/u);
	assert.throws(() => discoverElectionDocuments(source, Buffer.from(body(paths).toString().replace("2026", "2028"))), /index-election-changed/u);
	assert.equal(source.minimumDocuments, source.maximumDocuments);
});

test("encoded filename review cannot permit encoded routing, traversal or double decoding", () => {
	const source = electionDocumentSources.find(item => item.stateCode === "WA")!;
	for (const path of ["/published/a%2Fb.pdf", "/published/a%5Cb.pdf", "/published/a%00b.pdf", "/published/a%2520b.pdf", "/published/%2e%2e/a.pdf", "/published/a%3Fb.pdf", "/published/a%23b.pdf", "/published/a%20b.pdf?x=1", "/published/a%20b.pdf#page=1", "/published/../a%20b.pdf", "//elsewhere.invalid/a%20b.pdf", "/published/a title.pdf"]) assert.throws(() => electionDocumentPublisherHosts({ ...source, encodedDocumentPaths: [path] }), /document-path-review-required/u);
	assert.throws(() => electionDocumentPublisherHosts({ ...source, encodedDocumentPaths: [source.encodedDocumentPaths![0]!, source.encodedDocumentPaths![0]!] }), /document-path-review-required/u);
});

test("a required document floor rejects missing government sections instead of claiming a complete capture", () => {
	const source = electionDocumentSources.find(item => item.stateCode === "WA")!;
	const paths = source.documentPatterns.map(pattern => pattern.slice(1, -1).replaceAll("\\.", "."));
	const body = (values: string[]) => Buffer.from(`<main>${source.dateMarkers.join(" ")} ${values.map(path => `<a href="${path}">Publication</a>`).join("")}</main>`);
	assert.equal(discoverElectionDocuments(source, body(paths)).length, 14);
	assert.throws(() => discoverElectionDocuments(source, body(paths.slice(1))), /document-count-changed/u);
	assert.throws(() => discoverElectionDocuments(source, body([...paths.slice(1), paths[1]!])), /document-count-changed/u);
});

test("document bounds are explicitly reviewed and cannot be empty, fractional or unbounded", () => {
	const source = electionDocumentSources.find(item => item.stateCode === "WA")!;
	for (const minimumDocuments of [0, -1, 1.5, 15, Number.NaN]) assert.throws(() => electionDocumentPublisherHosts({ ...source, minimumDocuments }), /document-count-review-required/u);
	for (const maximumDocuments of [0, -1, 1.5, 101, Number.NaN]) assert.throws(() => electionDocumentPublisherHosts({ ...source, maximumDocuments }), /document-count-review-required/u);
});

test("policy fingerprints ignore scripts but bind policy text, links and footer notices", () => {
	const address = "https://www.sos.nd.gov/privacy-policy";
	const body = Buffer.from("<main>Reviewed policy text with meaningful access and privacy conditions for this source.</main><footer>State notice</footer>");
	assert.equal(electionDocumentPolicyFingerprint(body, "main", address), electionDocumentPolicyFingerprint(Buffer.from(`${body}<script>random token</script>`), "main", address));
	assert.notEqual(electionDocumentPolicyFingerprint(body, "main", address), electionDocumentPolicyFingerprint(Buffer.from(body.toString().replace("Reviewed", "Changed")), "main", address));
	for (const extra of ["<a href='/terms'>Terms</a>", "<a href='http://legacy.example/policies'>Statements &amp; Policies</a>", "<footer>New use restriction</footer>", "<section class='footer'>New use restriction</section>", "<div role='contentinfo'>New use restriction</div>"])
		assert.notEqual(electionDocumentPolicyFingerprint(body, "links", address), electionDocumentPolicyFingerprint(Buffer.from(`${body}${extra}`), "links", address));
});

test("each explicit publisher host requires its own exact robots policy", () => {
	const source = electionDocumentSources.find(source => source.stateCode === "UT")!;
	assert.deepEqual(electionDocumentPublisherHosts(source), ["vote.utahcounty.gov", "www.utahcounty.gov"]);
	for (const mutation of ["missing", "duplicate", "wrong-path", "credentials", "http", "port", "query", "fragment"]) {
		const changed = structuredClone(source);
		const policy = changed.policies.find(policy => policy.id === "county-robots")!;
		if (mutation === "missing") changed.policies = changed.policies.filter(item => item !== policy);
		if (mutation === "duplicate") changed.policies.push({ ...policy, id: "another-robots" });
		if (mutation === "wrong-path") policy.url += "/another";
		if (mutation === "credentials") policy.url = policy.url.replace("https://", "https://user@");
		if (mutation === "http") policy.url = policy.url.replace("https:", "http:");
		if (mutation === "port") policy.url = policy.url.replace(".gov/", ".gov:8443/");
		if (mutation === "query") policy.url += "?access=public";
		if (mutation === "fragment") policy.url += "#section";
		assert.throws(() => electionDocumentPublisherHosts(changed), /robots policy|HTTPS addresses/u, mutation);
	}
});

test("multi-host collection checks both robots policies and preserves independent request spacing", async (context) => {
	const input = await fixture(context, ["ut-county-measure-documents-2026"]);
	const requests: { url: string; startedAt: number; completedAt: number }[] = [];
	let clock = epoch;
	const result = await collectElectionDocuments(input.plan, { now: () => clock, sleep: async (milliseconds) => {
		clock += milliseconds;
	}, fetchDocument: async (url, options) => {
		const startedAt = clock;
		assert.deepEqual(options.allowedHosts, [new URL(url).hostname]);
		const isPdf = /\.pdf$/iu.test(new URL(url).pathname);
		assert.equal(options.maxBytes, (isPdf ? 12 : 2) * 1024 * 1024);
		clock += 500;
		requests.push({ url, startedAt, completedAt: clock });
		return { status: 200, body: input.bodies.get(url)!, contentType: isPdf ? "application/pdf" : "text/html", etag: undefined };
	} });
	assert.equal(result.complete, true);
	assert.equal(requests.length, 7);
	assert.deepEqual(requests.slice(0, 2).map(request => request.url), input.sources[0]!.policies.filter(policy => policy.format === "robots").map(policy => policy.url));
	for (const host of electionDocumentPublisherHosts(input.sources[0]!)) {
		const publisherRequests = requests.filter(request => new URL(request.url).hostname === host);
		for (let index = 1; index < publisherRequests.length; index++) assert.ok(publisherRequests[index]!.startedAt - publisherRequests[index - 1]!.completedAt >= 11_000);
	}
	assert.equal(result.observations[0]!.documents![0]!.url, input.documentUrls[0]);
	const replay = await collectElectionDocuments(input.plan, { now: () => clock, fetchDocument: async () => {
		throw new Error("Daily reuse must not fetch.");
	} });
	assert.equal(replay.complete, true);
	assert.equal(replay.publisherRequests, 0);
});

test("external policy-host denials stop before content and remain held on either host", async (context) => {
	const input = await fixture(context, ["ut-county-measure-documents-2026"]);
	const requests: string[] = [];
	let clock = epoch;
	const result = await collectElectionDocuments(input.plan, { now: () => clock, sleep: async (milliseconds) => {
		clock += milliseconds;
	}, fetchDocument: async (url) => {
		requests.push(url);
		return new URL(url).hostname === "www.utahcounty.gov"
			? { status: 403, body: Buffer.from("Denied"), contentType: "text/html", etag: undefined }
			: { status: 200, body: input.bodies.get(url)!, contentType: "text/plain", etag: undefined };
	} });
	assert.equal(result.complete, false);
	assert.equal(result.observations[0]!.reason, "publisher-denial-or-redirect");
	assert.equal(requests.length, 2);
	for (const host of electionDocumentPublisherHosts(input.sources[0]!)) assert.equal(JSON.parse(await readFile(join(input.plan.cacheDirectory, "hosts", host, "hold.json"), "utf8")).reason, "publisher-denial-or-redirect");
	const replay = await collectElectionDocuments(input.plan, { now: () => clock + day, fetchDocument: async () => {
		throw new Error("No hold bypass.");
	} });
	assert.equal(replay.publisherRequests, 0);
	assert.equal(replay.observations[0]!.reason, "publisher-on-hold");
});

test("multi-host seeds cannot substitute another host's robots permissions", async (context) => {
	for (const [host, blockedPath] of [["www.utahcounty.gov", "/terms-of-use"], ["vote.utahcounty.gov", "/api/media/"]]) {
		const input = await fixture(context, ["ut-county-measure-documents-2026"]);
		const policy = input.sources[0]!.policies.find(policy => policy.format === "robots" && new URL(policy.url).hostname === host)!;
		const capture = input.seed.captures.find(capture => capture.url === policy.url)!;
		const body = Buffer.from(`User-agent: *\nDisallow: ${blockedPath}\n`);
		await writeFile(capture.path, body);
		capture.sha256 = hash(body);
		input.plan.accessReviews[0]!.policyFingerprints[policy.id] = electionDocumentPolicyFingerprint(body, "robots", policy.url);
		await assert.rejects(() => seedElectionDocuments(input.plan, input.seed, epoch), /permitted observed source links/u);
		assert.deepEqual(await readdir(join(input.plan.cacheDirectory, "captures")), []);
	}
});

test("uppercase PDF extensions retain content-type and binary checks", async (context) => {
	const input = await fixture(context, ["ut-county-measure-documents-2026"]);
	let clock = epoch;
	const result = await collectElectionDocuments(input.plan, { now: () => clock, sleep: async (milliseconds) => {
		clock += milliseconds;
	}, fetchDocument: async url => ({ status: 200, body: input.bodies.get(url)!, contentType: "text/html", etag: undefined }) });
	assert.equal(result.complete, false);
	assert.equal(result.observations[0]!.reason, "document-format-changed");
});

test("explicit HTML sources collect dated content without weakening PDF checks", async (context) => {
	const input = await fixture(context, ["md-question-documents-2026"]);
	let clock = epoch;
	const result = await collectElectionDocuments(input.plan, { now: () => clock, sleep: async (duration) => {
		clock += duration;
	}, fetchDocument: async (url, options) => {
		assert.equal(options.maxBytes, 2 * 1024 * 1024);
		return { status: 200, body: input.bodies.get(url)!, contentType: "text/html", etag: undefined };
	} });
	assert.equal(result.complete, true);
	assert.equal(result.observations[0]!.documents!.length, 1);
	assert.equal(result.capturedContentReviewed, false);
	assert.equal(result.imported, false);
	const replay = await collectElectionDocuments(input.plan, { now: () => clock, fetchDocument: async () => {
		throw new Error("No fresh-cache fetch.");
	} });
	assert.equal(replay.complete, true);
	assert.equal(replay.publisherRequests, 0);
});

test("HTML content requires its own reviewed policy links, election and bounded structure", async (context) => {
	for (const mutation of ["policy-links", "date", "size", "type", "utf8"]) {
		const input = await fixture(context, ["md-question-documents-2026"]);
		const url = input.documentUrls[0]!;
		const original = input.bodies.get(url)!;
		let clock = epoch;
		const result = await collectElectionDocuments(input.plan, { now: () => clock, sleep: async (duration) => {
			clock += duration;
		}, fetchDocument: async (address) => {
			let body = input.bodies.get(address)!;
			if (address === url) {
				if (mutation === "policy-links") body = Buffer.from(`${original}<a href='/new-terms'>Terms</a>`);
				if (mutation === "date") body = Buffer.from(original.toString().replaceAll("2026", "2028"));
				if (mutation === "size") body = Buffer.alloc(2 * 1024 * 1024 + 1);
				if (mutation === "utf8") body = Buffer.from([255, 254]);
			}
			return { status: 200, body, contentType: address === url && mutation === "type" ? "application/pdf" : "text/html", etag: undefined };
		} });
		assert.equal(result.complete, false, mutation);
		assert.equal(result.observations[0]!.reason, mutation === "policy-links" ? "publisher-policy-links-changed" : mutation === "date" ? "document-election-changed" : mutation === "size" ? "html-size-limit" : mutation === "type" ? "document-format-changed" : "cache-or-format-invalid");
		const held = await collectElectionDocuments(input.plan, { now: () => clock, fetchDocument: async () => {
			throw new Error("No hold bypass.");
		} });
		assert.equal(held.publisherRequests, 0);
		assert.equal(held.observations[0]!.reason, "publisher-on-hold");
	}
});

test("HTML review fingerprints and markers cannot be omitted or silently added to PDF sources", async (context) => {
	const input = await fixture(context, ["md-question-documents-2026"]);
	delete input.plan.accessReviews[0]!.policyFingerprints.documentLinks;
	await assert.rejects(() => collectElectionDocuments(input.plan, { now: () => epoch }), /matching current access review/u);
	const htmlSource = structuredClone(input.sources[0]!);
	htmlSource.documentDateMarkers = [];
	assert.throws(() => electionDocumentPublisherHosts(htmlSource), /election markers/u);
	const pdfSource = structuredClone(electionDocumentSources[0]!);
	pdfSource.documentDateMarkers = ["2026"];
	assert.throws(() => electionDocumentPublisherHosts(pdfSource), /default PDF source/u);
});

test("reviewed dotted policy IDs use one exact region and preserve class and malformed-selector refusals", () => {
	const address = "https://sites.google.com/a/wyo.gov/wy-ag/privacy";
	const region = "h.policy_2026-privacy";
	const body = Buffer.from(`<div id="${region}"><p>Reviewed government policy content includes meaningful privacy and access conditions.</p></div>`);
	const fingerprint = electionDocumentPolicyFingerprint(body, "region", address, region);
	assert.notEqual(fingerprint, electionDocumentPolicyFingerprint(Buffer.from(body.toString().replace("access conditions", "different use conditions")), "region", address, region));
	assert.throws(() => electionDocumentPolicyFingerprint(body, "region", address, "hpolicy_2026-privacy"), /policy-main-unavailable/u);
	assert.throws(() => electionDocumentPolicyFingerprint(Buffer.concat([body, body]), "region", address, region), /policy-main-unavailable/u);
	assert.throws(() => electionDocumentPolicyFingerprint(body, "main", address), /policy-main-unavailable/u);
	for (const invalid of ["#h.policy", "h.policy space", "h.policy/other", "h.policy[0]"])
		assert.throws(() => electionDocumentPolicyFingerprint(body, "region", address, invalid), /policy-region-unavailable/u);
	assert.throws(() => electionDocumentPolicyFingerprint(body, "region", address, undefined, "h.policy"), /policy-region-unavailable/u);
});

test("Wyoming document discovery retains its exact election files and both publisher policy hosts", () => {
	const source = electionDocumentSources.find(item => item.stateCode === "WY")!;
	const addresses = source.documentPatterns.map(pattern => `https://${source.host}${pattern.slice(1, -1).replaceAll("\\.", ".")}`);
	const index = (urls: string[]) => Buffer.from(`<main>${source.dateMarkers.join(" ")}${urls.map(url => `<a href="${url}">Publication</a>`).join("")}</main>`);
	assert.deepEqual(discoverElectionDocuments(source, index(addresses)), addresses.toSorted());
	assert.deepEqual(electionDocumentPublisherHosts(source), ["sos.wyo.gov", "sites.google.com"]);
	assert.deepEqual(source.policies[0]!.otherRobotsAgents, ["googlebot"]);
	assert.deepEqual(source.relativeRobotsDisallows, ["*.csi"]);
	assert.equal(source.policies.find(policy => policy.id === "privacy")!.regionId, "h.2a7fdfc9a085ee03_341");
	assert.throws(() => discoverElectionDocuments(source, index(addresses.slice(1))), /count-changed/u);
	assert.throws(() => discoverElectionDocuments(source, index(addresses.map(url => `${url}?download=all`))), /link-changed/u);
	assert.throws(() => discoverElectionDocuments(source, Buffer.from(index(addresses).toString().replaceAll("2026", "2024"))), /election-changed/u);
});

test("reviewed policy regions do not silently replace main-only review", () => {
	const address = "https://www.sos.mo.gov/ipolicy";
	const body = Buffer.from("<body><form><div id='main'><h1>Privacy</h1><p>Public policy text with meaningful publisher access conditions and reuse notices.</p></div></form></body>");
	assert.throws(() => electionDocumentPolicyFingerprint(body, "main", address), /policy-main-unavailable/u);
	assert.throws(() => electionDocumentPolicyFingerprint(body, "region", address), /policy-region-unavailable/u);
	assert.throws(() => electionDocumentPolicyFingerprint(body, "region", address, "absent"), /policy-main-unavailable/u);
	assert.throws(() => electionDocumentPolicyFingerprint(Buffer.from(`${body}<div id='main'>A duplicate region must not be chosen.</div>`), "region", address, "main"), /policy-main-unavailable/u);
	assert.equal(electionDocumentPolicyFingerprint(body, "region", address, "main"), electionDocumentPolicyFingerprint(Buffer.from(`${body}<script>ignored dynamic token</script>`), "region", address, "main"));
	assert.notEqual(electionDocumentPolicyFingerprint(body, "region", address, "main"), electionDocumentPolicyFingerprint(Buffer.from(body.toString().replace("reuse notices", "new reuse restriction")), "region", address, "main"));
});

test("Missouri discovery includes only its five reviewed November certificate families", () => {
	const source = electionDocumentSources.find(source => source.stateCode === "MO")!;
	const names = ["SECONDREVISEDHCSHJR73", "2026-106", "SSSCSSJR95", "CCSHCSSSSJR87", "2026-R004"];
	const urls = names.map(name => `https://${source.host}/CMSImages/Elections/Petitions/${name}WebCert.pdf`);
	const body = Buffer.from(`<main>${source.dateMarkers[0]}${[...urls, `https://${source.host}/CMSImages/Elections/Petitions/HCSHJR23and3WebCert.pdf`, "https://unreviewed.example/proposal.pdf"].map(url => `<a href="${url}">Certificate</a>`).join("")}</main>`);
	assert.deepEqual(discoverElectionDocuments(source, body), urls.sort());
});

test("reviewed class regions are unique exact tokens without main-only fallback", () => {
	const address = "https://www.nmlegis.gov/PrivacyPolicy";
	const body = Buffer.from("<form><div class='panel full-width'><h1>Privacy Policy</h1><p>Complete reviewed publisher privacy text with meaningful access conditions and notices.</p></div></form>");
	const fingerprint = electionDocumentPolicyFingerprint(body, "region", address, undefined, "full-width");
	assert.notEqual(fingerprint, electionDocumentPolicyFingerprint(Buffer.from(body.toString().replace("reviewed", "changed")), "region", address, undefined, "full-width"));
	assert.throws(() => electionDocumentPolicyFingerprint(body, "main", address), /policy-main-unavailable/u);
	assert.throws(() => electionDocumentPolicyFingerprint(body, "region", address, "main", "full-width"), /policy-region-unavailable/u);
	assert.throws(() => electionDocumentPolicyFingerprint(body, "region", address, undefined, "full"), /policy-main-unavailable/u);
	assert.throws(() => electionDocumentPolicyFingerprint(body, "region", address, undefined, ".full-width"), /policy-region-unavailable/u);
	assert.throws(() => electionDocumentPolicyFingerprint(Buffer.from(body.toString() + body.toString()), "region", address, undefined, "full-width"), /policy-main-unavailable/u);
});

test("New Mexico discovery excludes other cycles and unreviewed documents", () => {
	for (const stateCode of ["NM"]) {
		const source = electionDocumentSources.find(source => source.stateCode === stateCode)!;
		const path = "/Publications/New_Mexico_State_Government/Constitutional_Amendment/Constitutional_Amendments_2026.pdf";
		const url = `https://${source.host}${path}`;
		assert.deepEqual(discoverElectionDocuments(source, Buffer.from(`<main>${source.dateMarkers[0]}<a href='${url}'>Reviewed document</a><a href='${url.replaceAll("2026", "2024")}'>Old document</a><a href='https://elsewhere.invalid/2026.pdf'>Other host</a></main>`)), [url]);
	}
});

test("reviewed unrelated robots groups may precede the mandatory wildcard group", async (context) => {
	const input = await fixture(context, ["nm-measure-documents-2026"]);
	const url = input.sources[0]!.policies[0]!.url;
	const body = Buffer.from("User-agent: Googlebot\nDisallow: /signalr/\nDisallow: /*.axd\n\nUser-agent: AhrefsBot\nCrawl-Delay: 2\n\nUser-agent: *\nDisallow: /*.axd\n");
	const capture = input.seed.captures.find(capture => capture.url === url)!;
	await writeFile(capture.path, body);
	capture.sha256 = hash(body);
	input.plan.accessReviews[0]!.policyFingerprints.robots = electionDocumentPolicyFingerprint(body, "robots", url);
	assert.equal((await seedElectionDocuments(input.plan, input.seed, epoch)).publisherRequests, 0);
	const denied = await fixture(context, ["nm-measure-documents-2026"]);
	const deniedBody = Buffer.from(body.toString().replace("User-agent: *\nDisallow: /*.axd", "User-agent: *\nDisallow: /Publications/"));
	const deniedCapture = denied.seed.captures.find(capture => capture.url === url)!;
	await writeFile(deniedCapture.path, deniedBody);
	deniedCapture.sha256 = hash(deniedBody);
	denied.plan.accessReviews[0]!.policyFingerprints.robots = electionDocumentPolicyFingerprint(deniedBody, "robots", url);
	await assert.rejects(seedElectionDocuments(denied.plan, denied.seed, epoch), /permitted observed source links/u);
});

test("encoded document paths remain held even when a pattern matches", () => {
	const source = { ...electionDocumentSources.find(source => source.stateCode === "NM")!, documentPatterns: ["^/reviewed/.*\\.pdf$"] };
	const htmlFor = (path: string) => Buffer.from(`<main>${source.dateMarkers[0]}<a href='https://${source.host}/reviewed/${path}.pdf'>Document</a></main>`);
	for (const encoded of ["%20", "%2520", "%2F", "%2e", "%00", "%09"])
		assert.throws(() => discoverElectionDocuments(source, htmlFor(`Ballot${encoded}Measures`)), /link-changed/u);
});

test("reviewed unrelated robot groups do not cancel wildcard path restrictions", async (context) => {
	const input = await fixture(context, ["mo-measure-documents-2026"]);
	const url = input.sources[0]!.policies[0]!.url;
	const body = Buffer.from(input.bodies.get(url)!.toString().replace("Disallow: /private/", "Disallow: /CMSImages/"));
	input.bodies.set(url, body);
	const capture = input.seed.captures.find(capture => capture.url === url)!;
	await writeFile(capture.path, body);
	capture.sha256 = hash(body);
	input.plan.accessReviews[0]!.policyFingerprints.robots = electionDocumentPolicyFingerprint(body, "robots", url);
	await assert.rejects(seedElectionDocuments(input.plan, input.seed, epoch), /permitted observed source links/u);
});

test("unknown, applicable and merged robot groups require a new supported review", async (context) => {
	for (const replacement of ["GPTBot", "Ballot-Clarity-Coverage-Importer", "UnknownCrawler"]) {
		const input = await fixture(context, ["mo-measure-documents-2026"]);
		const url = input.sources[0]!.policies[0]!.url;
		const body = Buffer.from(input.bodies.get(url)!.toString().replace("SemrushBot", replacement));
		const capture = input.seed.captures.find(capture => capture.url === url)!;
		await writeFile(capture.path, body);
		capture.sha256 = hash(body);
		input.plan.accessReviews[0]!.policyFingerprints.robots = electionDocumentPolicyFingerprint(body, "robots", url);
		await assert.rejects(seedElectionDocuments(input.plan, input.seed, epoch), /robots-group-review-required/u);
	}
	const input = await fixture(context, ["mo-measure-documents-2026"]);
	const url = input.sources[0]!.policies[0]!.url;
	const body = Buffer.from("User-agent: *\nUser-agent: SemrushBot\nDisallow: /\nUser-agent: BLEXBot\nDisallow: /\n");
	const capture = input.seed.captures.find(capture => capture.url === url)!;
	await writeFile(capture.path, body);
	capture.sha256 = hash(body);
	input.plan.accessReviews[0]!.policyFingerprints.robots = electionDocumentPolicyFingerprint(body, "robots", url);
	await assert.rejects(seedElectionDocuments(input.plan, input.seed, epoch), /robots-group-review-required/u);
});

test("Travis collection pins the corrected ballot, election identity and copyright review", async (context) => {
	const source = electionDocumentSources.find(source => source.id === "tx-travis-documents-2026")!;
	assert.deepEqual(electionDocumentPublisherHosts(source), ["votetravis.gov"]);
	assert.equal(source.minimumDocuments, 1);
	assert.equal(source.maximumDocuments, 1);
	assert.equal(source.policies.find(policy => policy.id === "footer-copyright")!.regionClass, "elementor-element-de68400");
	const url = "https://votetravis.gov/wp-content/uploads/G26-Bedsheet-Ballot-Corrected-Final2.pdf";
	const index = (address: string, markers = source.dateMarkers.join(" ")) => Buffer.from(`<main>${markers}<a href="${address}">Consolidated ballot</a></main>`);
	assert.deepEqual(discoverElectionDocuments(source, index(url)), [url]);
	assert.throws(() => discoverElectionDocuments(source, index(url.replace("Final2", "Final3"))), /document-count/u);
	assert.throws(() => discoverElectionDocuments(source, index(url, "November 4, 2025")), /index-election-changed/u);
	const input = await fixture(context, [source.id]);
	await seedElectionDocuments(input.plan, input.seed, epoch);
	const result = await collectElectionDocuments(input.plan, { now: () => epoch + 1000, fetchDocument: async () => {
		throw new Error("No publisher request during retained-data reuse.");
	} });
	assert.equal(result.complete, true);
	assert.equal(result.publisherRequests, 0);
	assert.equal(result.observations[0]!.documents![0]!.url, url);
	assert.equal(result.imported, false);
	assert.equal(result.published, false);
});

test("Clark County questions pin the independent publisher, document and election", async (context) => {
	const source = electionDocumentSources.find(source => source.id === "nv-clark-questions-2026")!;
	assert.deepEqual(electionDocumentPublisherHosts(source), ["www.clarkcountynv.gov"]);
	assert.equal(source.minimumDocuments, 1);
	assert.equal(source.maximumDocuments, 1);
	assert.equal(source.policies.find(policy => policy.id === "privacy-and-use")!.format, "main");
	const url = "https://www.clarkcountynv.gov/adobe/assets/urn:aaid:aem:e74294d7-218d-41cc-995f-0e16bc0a9e1f/original/as/all-quests-26g.pdf";
	const index = (address: string, markers = source.dateMarkers.join(" ")) => Buffer.from(`<main>${markers}<a href="${address}">Ballot questions</a></main>`);
	assert.deepEqual(discoverElectionDocuments(source, index(url)), [url]);
	assert.throws(() => discoverElectionDocuments(source, index(url.replace("26g.pdf", "28g.pdf"))), /document-count/u);
	assert.throws(() => discoverElectionDocuments(source, index(url, "2024 General Election")), /index-election-changed/u);
	assert.throws(() => discoverElectionDocuments(source, index(url.replace("www.clarkcountynv.gov", "www.nvsos.gov"))), /document-count/u);
	const input = await fixture(context, [source.id]);
	await seedElectionDocuments(input.plan, input.seed, epoch);
	const result = await collectElectionDocuments(input.plan, { now: () => epoch + 1000, fetchDocument: async () => {
		throw new Error("No publisher request during retained-data verification.");
	} });
	assert.equal(result.complete, true);
	assert.equal(result.publisherRequests, 0);
	assert.equal(result.observations[0]!.documents![0]!.url, url);
	assert.equal(result.imported, false);
	assert.equal(result.published, false);
});

test("Clark County reuse policy changes require a fresh review", async (context) => {
	const input = await fixture(context, ["nv-clark-questions-2026"]);
	const policy = input.seed.captures.find(capture => capture.url.endsWith("/privacy-policy"))!;
	const body = Buffer.from("<main>Changed copyright and public access terms require an independent factual-use review before collection.</main>");
	await writeFile(policy.path, body);
	policy.sha256 = hash(body);
	await assert.rejects(seedElectionDocuments(input.plan, input.seed, epoch), /policy-changed/u);
});

test("Brevard pins its independent HTML questions and state/local election markers", async (context) => {
	const source = electionDocumentSources.find(source => source.id === "fl-brevard-questions-2026")!;
	assert.deepEqual(electionDocumentPublisherHosts(source), ["www.votebrevard.gov"]);
	assert.equal(source.documentFormat, "html");
	assert.equal(source.minimumDocuments, 1);
	assert.equal(source.maximumDocuments, 1);
	assert.equal(source.policies.find(policy => policy.id === "footer-notice")!.regionId, "footer");
	const index = (url: string, markers = source.dateMarkers.join(" ")) => Buffer.from(`<main>${markers}<a href="${url}">Questions</a></main>`);
	assert.deepEqual(discoverElectionDocuments(source, index(source.indexUrl)), [source.indexUrl]);
	assert.throws(() => discoverElectionDocuments(source, index(source.indexUrl.replace("2026-", "2028-"))), /document-count/u);
	assert.throws(() => discoverElectionDocuments(source, index(source.indexUrl, "November 2024 election")), /index-election-changed/u);
	assert.throws(() => discoverElectionDocuments(source, index(`${source.indexUrl}?export=all`)), /document-link-changed/u);
	const input = await fixture(context, [source.id]);
	await seedElectionDocuments(input.plan, input.seed, epoch);
	const result = await collectElectionDocuments(input.plan, { now: () => epoch + 1000, fetchDocument: async () => {
		throw new Error("No network during exact retained HTML reuse.");
	} });
	assert.equal(result.complete, true);
	assert.equal(result.publisherRequests, 0);
	assert.equal(result.observations[0]!.documents![0]!.url, source.indexUrl);
	assert.equal(result.imported, false);
	assert.equal(result.published, false);
});

test("Brevard footer changes require review even when the question identity is unchanged", async (context) => {
	const input = await fixture(context, ["fl-brevard-questions-2026"]);
	const capture = input.seed.captures.find(capture => capture.url === "https://www.votebrevard.gov/")!;
	const body = Buffer.from("<main id=\"footer\">Changed public-access or use notice requires independent review before collection resumes.</main>");
	await writeFile(capture.path, body);
	capture.sha256 = hash(body);
	await assert.rejects(seedElectionDocuments(input.plan, input.seed, epoch), /policy-changed/u);
});

test("NYC Votes collection pins five city proposals, their policies and their election", async (context) => {
	const source = electionDocumentSources.find(source => source.id === "ny-nyc-proposals-2026")!;
	assert.deepEqual(electionDocumentPublisherHosts(source), ["www.nycvotes.org"]);
	assert.equal(source.documentFormat, "html");
	assert.equal(source.minimumDocuments, 5);
	assert.equal(source.maximumDocuments, 5);
	const urls = [1, 2, 3, 4, 5].map(number => `${source.indexUrl}ballot-proposal-${number}/`);
	const index = (addresses: string[], markers = source.dateMarkers.join(" ")) => Buffer.from(`<main>${markers}${addresses.map(url => `<a href="${url}">Proposal</a>`).join("")}</main>`);
	assert.deepEqual(discoverElectionDocuments(source, index(urls)), urls);
	assert.throws(() => discoverElectionDocuments(source, index(urls.slice(0, 4))), /count-changed/u);
	assert.throws(() => discoverElectionDocuments(source, index(urls.map(url => url.replace("ballot-proposal-5/", "ballot-proposal-6/")))), /count-changed/u);
	assert.throws(() => discoverElectionDocuments(source, index(urls, "2024 Ballot Proposals")), /index-election-changed/u);
	assert.throws(() => discoverElectionDocuments(source, index(urls.map(url => `${url}?export=all`))), /document-link-changed/u);
	const input = await fixture(context, [source.id]);
	await seedElectionDocuments(input.plan, input.seed, epoch);
	const result = await collectElectionDocuments(input.plan, { now: () => epoch + 1000, fetchDocument: async () => {
		throw new Error("Retained city-guide validation makes no publisher requests.");
	} });
	assert.equal(result.complete, true);
	assert.equal(result.publisherRequests, 0);
	assert.deepEqual(result.observations[0]!.documents!.map(document => document.url), urls);
	assert.equal(result.imported, false);
	assert.equal(result.published, false);
});

test("NYC Votes document footer changes retain the last reviewed collection", async (context) => {
	const input = await fixture(context, ["ny-nyc-proposals-2026"]);
	const capture = input.seed.captures.find(capture => capture.url.endsWith("/ballot-proposal-3/"))!;
	const body = Buffer.from("<main>2026 General Election 2026 Ballot Proposals What this proposal means</main><footer>Changed reuse conditions</footer>");
	await writeFile(capture.path, body);
	capture.sha256 = hash(body);
	await assert.rejects(seedElectionDocuments(input.plan, input.seed, epoch), /policy-links-changed/u);
});

test("Alaska pamphlet discovery explicitly reviews native select options without widening document paths", async (context) => {
	const source = electionDocumentSources.find(source => source.id === "ak-general-pamphlet-2026")!;
	const url = `https://${source.host}${source.encodedDocumentPaths![0]}`;
	const index = (address: string, markers = source.dateMarkers.join(" ")) => Buffer.from(`<main>${markers}<select><option value="">Select document</option><option value="${address}">2026 Region 1 OEP</option><option value="/doc/oep/2024/old.pdf">2024 edition</option></select></main>`);
	assert.deepEqual(discoverElectionDocuments(source, index(url)), [url]);
	assert.throws(() => discoverElectionDocuments({ ...source, selectDocumentOptions: undefined }, index(url)), /document-count-changed/u);
	assert.throws(() => discoverElectionDocuments(source, index(url.replace("2026/General", "2024/General"))), /document-count-changed/u);
	assert.throws(() => discoverElectionDocuments(source, index(url.replace("www.elections.alaska.gov", "elsewhere.invalid"))), /document-count-changed/u);
	assert.throws(() => discoverElectionDocuments(source, index(`${url}?download=1`)), /document-link-changed/u);
	assert.throws(() => discoverElectionDocuments(source, index(url, "2024 Region 1 OEP")), /index-election-changed/u);
	assert.deepEqual(electionDocumentPublisherHosts(source), [source.host]);
	const input = await fixture(context, [source.id]);
	await seedElectionDocuments(input.plan, input.seed, epoch);
	const result = await collectElectionDocuments(input.plan, { now: () => epoch + 1000, fetchDocument: async () => {
		throw new Error("No publisher requests during retained pamphlet validation.");
	} });
	assert.equal(result.complete, true);
	assert.equal(result.publisherRequests, 0);
	assert.equal(result.observations[0]!.documents![0]!.url, url);
	assert.equal(result.imported, false);
	assert.equal(result.published, false);
});

test("select-option discovery rejects unreviewed flags and unapproved encoded document identities", () => {
	const source = electionDocumentSources.find(source => source.id === "ak-general-pamphlet-2026")!;
	for (const value of [false, 1, "true", null]) assert.throws(() => electionDocumentPublisherHosts({ ...source, selectDocumentOptions: value as true }), /document-option-review-required/u);
	const url = `https://${source.host}${source.encodedDocumentPaths![0]}`;
	const body = Buffer.from(`<main>${source.dateMarkers.join(" ")}<select><option value="${url}">Document</option></select></main>`);
	assert.throws(() => discoverElectionDocuments({ ...source, encodedDocumentPaths: [] }, body), /document-link-changed/u);
});

test("retained binary seeds and daily cache reuse never fetch, import or relabel capture times", async (context) => {
	let documents = 0;
	for (let offset = 0; offset < electionDocumentSources.length; offset += 25) {
		const input = await fixture(context, electionDocumentSources.slice(offset, offset + 25).map(source => source.id));
		assert.equal((await seedElectionDocuments(input.plan, input.seed, epoch + 1000)).publisherRequests, 0);
		const result = await collectElectionDocuments(input.plan, { now: () => epoch + 1000, fetchDocument: async () => {
			throw new Error("No network allowed.");
		} });
		assert.equal(result.complete, true);
		assert.equal(result.publisherRequests, 0);
		assert.equal(result.imported, false);
		assert.equal(result.published, false);
		assert.equal(result.coverageCompletenessClaimed, false);
		assert.equal(result.capturedContentReviewed, false);
		documents += input.documentUrls.length;
		assert.equal(result.observations.flatMap(item => item.documents ?? []).length, input.documentUrls.length);
		for (const capture of result.observations.flatMap(item => item.documents ?? [])) {
			assert.equal(capture.capturedAt, new Date(epoch).toISOString());
			assert.deepEqual(await readFile(join(input.plan.cacheDirectory, "bodies", capture.sha256)), input.bodies.get(capture.url));
		}
		await assert.rejects(seedElectionDocuments(input.plan, input.seed, epoch + 1000), /never replace/u);
	}
	assert.equal(documents, 95);
});

test("conditional revalidation preserves bytes and capture dates, with per-host request spacing", async (context) => {
	const input = await fixture(context);
	await seedElectionDocuments(input.plan, input.seed, epoch);
	let clock = epoch + day;
	const requestTimes: number[] = [];
	const result = await collectElectionDocuments(input.plan, { now: () => clock, sleep: async (duration) => {
		clock += duration;
	}, fetchDocument: async (_url, options) => {
		assert.equal(options.etag, "\"first\"");
		requestTimes.push(clock);
		return { status: 304, body: Buffer.alloc(0), contentType: "", etag: "\"first\"" };
	} });
	assert.equal(result.complete, true);
	assert.equal(requestTimes.length, input.bodies.size);
	assert.ok(requestTimes.slice(1).every((time, index) => time - requestTimes[index]! >= 11_000));
	assert.ok(result.observations[0]!.documents!.every(capture => capture.capturedAt === new Date(epoch).toISOString() && Date.parse(capture.checkedAt) >= epoch + day));
});

test("publisher spacing starts after request completion, including DNS and body latency", async (context) => {
	const input = await fixture(context);
	await seedElectionDocuments(input.plan, input.seed, epoch);
	let clock = epoch + day;
	const networkStarts: number[] = [];
	const result = await collectElectionDocuments(input.plan, {
		now: () => clock,
		sleep: async (duration) => {
			clock += duration;
		},
		fetchDocument: async () => {
			clock += networkStarts.length ? 0 : 500;
			networkStarts.push(clock);
			clock += 20;
			return { status: 304, body: Buffer.alloc(0), contentType: "", etag: "\"first\"" };
		},
	});
	assert.equal(result.complete, true);
	assert.ok(networkStarts.slice(1).every((time, index) => time - networkStarts[index]! >= 11_000));
	assert.equal(JSON.parse(await readFile(join(input.plan.cacheDirectory, "hosts", input.sources[0]!.host, "last-request.json"), "utf8")).at, new Date(clock).toISOString());
});

test("fresh seeds and early timer wakeups preserve the full publisher delay", async (context) => {
	const input = await fixture(context);
	input.seed.captures = input.seed.captures.filter(capture => capture.url !== input.documentUrls[0]);
	await seedElectionDocuments(input.plan, input.seed, epoch);
	let clock = epoch;
	const sleeps: number[] = [];
	let requestedAt = 0;
	const result = await collectElectionDocuments(input.plan, {
		now: () => clock,
		sleep: async (duration) => {
			sleeps.push(duration);
			clock += duration - (sleeps.length === 1 ? 1 : 0);
		},
		fetchDocument: async () => {
			requestedAt = clock;
			return { status: 200, body: pdf, contentType: "application/pdf", etag: undefined };
		},
	});
	assert.equal(result.complete, true);
	assert.equal(result.publisherRequests, 1);
	assert.deepEqual(sleeps, [11_000, 1]);
	assert.equal(requestedAt, epoch + 11_000);
});

test("newly linked permitted documents are collected but remain unreviewed source material", async (context) => {
	const input = await fixture(context);
	await seedElectionDocuments(input.plan, input.seed, epoch);
	let clock = epoch + day;
	const extra = `https://${input.sources[0]!.host}/sites/default/files/documents/elections/measures/analysis-2026-general-measure3.pdf`;
	const nextIndex = Buffer.from(input.bodies.get(input.sources[0]!.indexUrl)!.toString().replace("</main>", `<a href="${extra}">New file</a></main>`));
	const result = await collectElectionDocuments(input.plan, { now: () => clock, sleep: async (duration) => {
		clock += duration;
	}, fetchDocument: async url => ({ status: 200, body: url === extra ? pdf : url === input.sources[0]!.indexUrl ? nextIndex : input.bodies.get(url)!, contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html", etag: "\"next\"" }) });
	assert.equal(result.complete, true);
	assert.equal(result.observations[0]!.documents!.length, 3);
	assert.equal(result.capturedContentReviewed, false);
	assert.equal(result.imported, false);
	assert.equal((await readdir(join(input.plan.cacheDirectory, "bodies"))).length, new Set([...input.bodies.values()].map(hash)).size + 1);
});

test("publisher denials, redirects, invalid PDFs and changed policies persist holds without overwriting last-good bytes", async (context) => {
	for (const condition of ["403", "429", "302", "policy", "mime", "size", "tls"] as const) {
		const input = await fixture(context);
		await seedElectionDocuments(input.plan, input.seed, epoch);
		const before = await readFile(join(input.plan.cacheDirectory, "bodies", hash(pdf)));
		let clock = epoch + day;
		const result = await collectElectionDocuments(input.plan, { now: () => clock, sleep: async (duration) => {
			clock += duration;
		}, fetchDocument: async (url) => {
			if (["403", "429", "302"].includes(condition)) return { status: Number(condition), body: Buffer.alloc(0), contentType: "", etag: undefined };
			if (condition === "size") throw new RemoteSourceDocumentPolicyError("Oversized body.");
			if (condition === "tls") throw Object.assign(new Error("TLS denied."), { code: "CERT_HAS_EXPIRED" });
			if (condition === "policy") return { status: 200, body: Buffer.from("User-agent: *\nDisallow: /\n"), contentType: "text/plain", etag: undefined };
			return { status: url.endsWith(".pdf") ? 200 : 304, body: pdf, contentType: "text/html", etag: "\"first\"" };
		} });
		assert.equal(result.complete, false, condition);
		assert.deepEqual(await readFile(join(input.plan.cacheDirectory, "bodies", hash(pdf))), before);
		const held = await collectElectionDocuments(input.plan, { now: () => clock, fetchDocument: async () => {
			assert.fail("A publisher hold must not request again.");
		} });
		assert.equal(held.publisherRequests, 0);
		assert.equal(held.observations[0]!.reason, "publisher-on-hold");
	}
});

test("temporary failures cool down, and missing publications do not become reviewed records", async (context) => {
	for (const status of [404, 503]) {
		const input = await fixture(context);
		await seedElectionDocuments(input.plan, input.seed, epoch);
		const clock = epoch + day;
		const failed = await collectElectionDocuments(input.plan, { now: () => clock, fetchDocument: async () => ({ status, body: Buffer.alloc(0), contentType: "", etag: undefined }) });
		assert.equal(failed.complete, false);
		assert.equal(failed.publisherRequests, 1);
		const retry = await collectElectionDocuments(input.plan, { now: () => clock + 1000, fetchDocument: async () => {
			assert.fail("Cooldown must prevent network access.");
		} });
		assert.equal(retry.publisherRequests, 0);
		assert.equal(retry.observations[0]!.reason, "cooldown");
	}
});

test("plan identity, review age, election expiry and in-checkout output remain enforced", async (context) => {
	const input = await fixture(context);
	for (const change of [
		{ sourceIds: ["unknown-source"] },
		{ sourceIds: [input.plan.sourceIds[0]!, input.plan.sourceIds[0]!] },
		{ cacheDirectory: fileURLToPath(new URL("../data/not-an-external-cache", import.meta.url)) },
		{ cacheDirectory: fileURLToPath(new URL("../../..hidden-cache", import.meta.url)) },
		{ outputRoot: input.plan.cacheDirectory },
		{ accessReviews: [{ ...input.plan.accessReviews[0]!, reviewedAt: new Date(epoch + 1000).toISOString() }] },
		{ accessReviews: [{ ...input.plan.accessReviews[0]!, configurationSha256: "0".repeat(64) }] },
	]) await assert.rejects(collectElectionDocuments({ ...input.plan, ...change }, { now: () => epoch }));
	await assert.rejects(collectElectionDocuments(input.plan, { now: () => epoch + 31 * day }));
	await assert.rejects(collectElectionDocuments(input.plan, { now: () => Date.parse("2026-11-05T00:00:00Z") }));
});

test("seeds reject unobserved files, hash drift and linked inputs before writing captures", async (context) => {
	for (const kind of ["hash", "url", "future", "link"] as const) {
		const input = await fixture(context);
		const capture = input.seed.captures.at(-1)!;
		if (kind === "hash") capture.sha256 = "0".repeat(64);
		if (kind === "url") capture.url = "https://www.sos.nd.gov/private/unobserved.pdf";
		if (kind === "future") capture.capturedAt = new Date(epoch + 1).toISOString();
		if (kind === "link") {
			const linked = join(input.directory, "linked");
			await symlink(capture.path, linked);
			capture.path = linked;
		}
		await assert.rejects(seedElectionDocuments(input.plan, input.seed, epoch));
		assert.deepEqual(await readdir(join(input.plan.cacheDirectory, "captures")), []);
	}
});

test("linked cache directories and another collector's lock are never bypassed", async (context) => {
	const input = await fixture(context);
	await mkdir(input.plan.cacheDirectory);
	await symlink(input.directory, join(input.plan.cacheDirectory, "bodies"));
	await assert.rejects(collectElectionDocuments(input.plan, { now: () => epoch }), /linked/u);
	await rm(join(input.plan.cacheDirectory, "bodies"));
	await mkdir(join(input.plan.cacheDirectory, "bodies"));
	await writeFile(join(input.plan.cacheDirectory, ".collection.lock"), JSON.stringify({ owner: "another-owner" }));
	await assert.rejects(collectElectionDocuments(input.plan, { now: () => epoch }), /EEXIST/u);
	assert.deepEqual(JSON.parse(await readFile(join(input.plan.cacheDirectory, ".collection.lock"), "utf8")), { owner: "another-owner" });
});

test("the source CLI seeds and reuses binary data without network or active imports", async (context) => {
	const input = await fixture(context);
	const planFile = join(input.directory, "plan.json");
	const seedFile = join(input.directory, "seed.json");
	const guard = join(input.directory, "network-guard.mjs");
	await writeFile(planFile, JSON.stringify(input.plan));
	await writeFile(seedFile, JSON.stringify(input.seed));
	await writeFile(guard, `import https from 'node:https'; import {syncBuiltinESMExports} from 'node:module'; https.request=()=>{throw new Error('Network denied in test.');};syncBuiltinESMExports();Date.now=()=>${epoch + 1000};`);
	const script = fileURLToPath(new URL("../src/manage-election-documents.ts", import.meta.url));
	const command = (...args: string[]) => spawnSync(process.execPath, ["--import", guard, "--import", import.meta.resolve("tsx"), script, ...args], { env: { PATH: process.env.PATH, HOME: process.env.HOME }, encoding: "utf8" });
	assert.equal(command("catalog").status, 0);
	const seeded = command("seed", planFile, seedFile);
	assert.equal(seeded.status, 0, seeded.stderr);
	assert.equal(JSON.parse(seeded.stdout).publisherRequests, 0);
	const collected = command("collect", planFile);
	assert.equal(collected.status, 0, collected.stderr);
	assert.equal(JSON.parse(collected.stdout).publisherRequests, 0);
	assert.equal(JSON.parse(collected.stdout).complete, true);
	assert.equal(JSON.parse(collected.stdout).published, false);
	assert.notEqual(command("seed", planFile, seedFile).status, 0);
});
