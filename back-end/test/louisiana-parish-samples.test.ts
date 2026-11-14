import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { collectLouisianaParishSamples, prepareLouisianaParishSamples } from "../src/collect-louisiana-parish-samples.js";
import { collectParishSampleBatch, parishSampleDownloadControl, parishSampleHash, parishSampleIndexUrl, parishSampleOrigin, ParishSamplePersistenceError, parishSamplePolicyHash, parishSamplePolicyUrls, readParishCandidateReferences, readParishSampleIndex, resolveParishSampleDocument } from "../src/louisiana-parish-samples.js";
import { fetchRemoteSourceDocument } from "../src/remote-json-source.js";

const secure = "upgrade-insecure-requests";
const firstControl = `${parishSampleOrigin}/?sdm_process_download=1&download_id=1234`;
const secondControl = `${parishSampleOrigin}/?sdm_process_download=1&download_id=1235`;
const firstDocument = `${parishSampleOrigin}/wp-content/uploads/2030/11/West-Carroll-SampleBallot-Printable-DEC-2030-3.pdf`;
const secondDocument = `${parishSampleOrigin}/wp-content/uploads/2030/11/Caddo-SampleBallot-Printable-DEC-2030.pdf`;
const index = `<main class="entry-content"><h1>Older page title November 2028</h1><h1>December 14, 2030 U.S. Representative Runoff &amp; Municipal General</h1><a href="${firstControl}">West Carroll (opens in a new tab)</a><a href="${secondControl}">Caddo</a><a href="${parishSampleOrigin}/?">St Charles</a><h1>Other information</h1><a href="/privacy-policy">Privacy Policy</a><a href="/terms-of-service">Mobile Terms</a></main>`;
const robot = Buffer.from("User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\nCrawl-delay: 10\nSitemap: https://powercoalition.org/sitemap.xml\n");
const policy = Buffer.from("<div class=\"entry-content\">Reviewed publisher privacy and mobile service policy, retained for independent source-access assessment.</div>");
const review = { robots: parishSamplePolicyHash(robot, parishSamplePolicyUrls[0]), privacy: parishSamplePolicyHash(policy, parishSamplePolicyUrls[1]), terms: parishSamplePolicyHash(policy, parishSamplePolicyUrls[2]), secureNavigation: secure as typeof secure };
const native = `U.S.Representative Runoff
U.S.Representative,5th Congressional District
■Example Person – Republican, White, Male
■Another ‘Pat’ Example – Democrat, Black, Female
Parishwide Proposition
Shall this proposition be adopted?
■Yes ■No
Aldermen,Village of Example
■Third Person – No Party, Other, Female
WEST CARROLL SAMPLE BALLOT
U.S. Representative Runoff & Open General
December 14, 2030\f`;

function network(change?: (url: string) => { status: number; body: Buffer; contentType: string; location?: string; contentSecurityPolicy?: string } | undefined) {
	let time = Date.now() - 86400000;
	const requests: { url: string; time: number }[] = [];
	const fetchDocument: typeof fetchRemoteSourceDocument = async (url, options) => {
		assert.equal(new URL(url).protocol, "https:");
		assert.equal(new URL(url).origin, parishSampleOrigin);
		assert.deepEqual(options.allowedHosts, ["powercoalition.org"]);
		assert.equal(options.timeoutMs, 20000);
		assert.equal(options.maxBytes, 12 * 1024 * 1024);
		requests.push({ url, time });
		const modified = change?.(url);
		if (modified) return { ...modified, etag: undefined };
		if (url === parishSamplePolicyUrls[0]) return { status: 200, body: robot, contentType: "text/plain", etag: undefined };
		if (parishSamplePolicyUrls.includes(url as typeof parishSamplePolicyUrls[number])) return { status: 200, body: policy, contentType: "text/html", etag: undefined };
		if (url === parishSampleIndexUrl) return { status: 200, body: Buffer.from(index), contentType: "text/html", contentSecurityPolicy: secure, etag: undefined };
		if (url === firstControl || url === secondControl) return { status: 302, body: Buffer.alloc(0), contentType: "text/html", location: (url === firstControl ? firstDocument : secondDocument).replace("https:", "http:"), contentSecurityPolicy: secure, etag: undefined };
		if (url === firstDocument || url === secondDocument) return { status: 200, body: Buffer.from("%PDF-reviewed synthetic sample"), contentType: "application/pdf", etag: undefined };
		return assert.fail(`Unexpected publisher request: ${url}`);
	};
	return { requests, options: { fetchDocument, now: () => time, sleep: async (delay: number) => {
		time += delay;
	} } };
}

test("parish discovery binds the dated section and retains malformed links as explicit exceptions", () => {
	const catalog = readParishSampleIndex(index);
	assert.equal(catalog.electionDate, "2030-12-14");
	assert.deepEqual(catalog.links.map(link => link.parish), ["West Carroll", "Caddo", "St Charles"]);
	assert.equal(catalog.links[2]!.downloadUrl, null);
	assert.equal(catalog.links[2]!.issue, "download-link-unavailable");
	assert.equal(readParishSampleIndex(index.replaceAll("2030", "2034").replace("December 14", "December 9")).electionDate, "2034-12-09");
});

test("parish discovery holds ambiguous elections, unknown sections, duplicate controls and new policies", () => {
	for (const body of [index.replace("December 14", "December 32"), index.replace("Municipal General", "Unknown Election"), index.replace("West Carroll (opens in a new tab)", "Unknown Parish"), index.replace(secondControl, firstControl), index.replace("</main>", "<a href=\"/new-terms\">New terms</a></main>"), index.replace("<h1>Other information</h1>", "<h1>December 14, 2030 U.S. Representative Runoff &amp; Municipal General</h1>"), index + index]) assert.throws(() => readParishSampleIndex(body));
	for (const address of [firstControl.replace("https:", "http:"), firstControl.replace("powercoalition.org", "example.org"), `${firstControl}&extra=1`, `${firstControl}#fragment`, firstControl.replace("1234", "0")]) assert.throws(() => parishSampleDownloadControl(address));
});

test("parish secure navigation upgrades only the exact same-host document with enforced publisher CSP", () => {
	assert.equal(resolveParishSampleDocument(firstDocument.replace("https:", "http:"), "2030-12-14", secure, secure), firstDocument);
	assert.equal(resolveParishSampleDocument(firstDocument, "2030-12-14", undefined, undefined), firstDocument);
	assert.equal(resolveParishSampleDocument(firstDocument.replace("SampleBallot", "Sample-Ballot"), "2030-12-14", secure, secure), firstDocument.replace("SampleBallot", "Sample-Ballot"));
	for (const [first, second] of [[undefined, secure], [secure, undefined], ["upgrade-insecure-requests-extra", secure], [secure, "default-src https:"]]) assert.throws(() => resolveParishSampleDocument(firstDocument.replace("https:", "http:"), "2030-12-14", first, second));
	for (const url of [firstDocument.replace("powercoalition.org", "other.example"), `${firstDocument}?download=1`, `${firstDocument}#page=1`, firstDocument.replace("2030-3", "2028-3"), firstDocument.replace("/uploads/", "/other/"), firstDocument.replace("powercoalition.org", "user:password@powercoalition.org"), firstDocument.replace("powercoalition.org", "powercoalition.org:8080")]) assert.throws(() => resolveParishSampleDocument(url, "2030-12-14", secure, secure));
});

test("parish collection follows offered controls serially with source fingerprints and no insecure request", async () => {
	const input = network();
	const result = await collectParishSampleBatch(["West Carroll", "Caddo", "St Charles", "Orleans"], review, input.options);
	assert.equal(result.official, false);
	assert.equal(result.publicationApproved, false);
	assert.deepEqual(result.results.map(item => item.status), ["collected", "collected", "held", "held"]);
	assert.equal(result.results[0]!.navigation!.location, firstDocument.replace("https:", "http:"));
	assert.equal(result.results[0]!.documentUrl, firstDocument);
	assert.equal(result.captures.length, 6);
	for (const [position, request] of input.requests.entries()) {
		if (position) assert.ok(request.time - input.requests[position - 1]!.time >= 11000);
	}
	for (const capture of result.captures) {
		assert.equal(capture.sha256, parishSampleHash(capture.body));
		assert.ok(Date.parse(capture.capturedAt) <= input.options.now());
	}
});

test("parish publisher access holds stop later requests without replacing prior evidence", async () => {
	const input = network(url => url === firstControl ? { status: 403, body: Buffer.alloc(0), contentType: "text/html" } : undefined);
	const result = await collectParishSampleBatch(["West Carroll", "Caddo"], review, input.options);
	assert.deepEqual(result.results.map(item => item.status), ["held", "held"]);
	assert.equal(result.results[1]!.reason, "publisher-access-or-capacity-held");
	assert.equal(input.requests.some(item => item.url === firstDocument || item.url === secondControl), false);
	const changed = network(url => url === parishSamplePolicyUrls[1] ? { status: 200, body: Buffer.from("<div class=\"entry-content\">Changed publisher policy that requires a separate review before subsequent collection or download requests.</div>"), contentType: "text/html" } : undefined);
	await assert.rejects(collectParishSampleBatch(["West Carroll"], review, changed.options), /policy changed/u);
	assert.equal(changed.requests.some(item => item.url === parishSampleIndexUrl), false);
});

test("parish evidence is persisted before subsequent requests and a storage failure ends intake", async () => {
	const input = network();
	const retained: string[] = [];
	await assert.rejects(collectParishSampleBatch(["West Carroll", "Caddo"], review, { ...input.options, onCapture: async (capture) => {
		if (capture.url === firstDocument) throw new Error("Synthetic storage failure.");
		retained.push(capture.url);
	} }), ParishSamplePersistenceError);
	assert.deepEqual(retained, [...parishSamplePolicyUrls, parishSampleIndexUrl]);
	assert.equal(input.requests.some(item => item.url === secondControl), false);
});

test("parish format holds retain safe redirect evidence without following an unknown document", async () => {
	const location = firstDocument.replace("-2030-3.pdf", "-2030-final-.pdf").replace("https:", "http:");
	const input = network(url => url === firstControl ? { status: 302, body: Buffer.alloc(0), contentType: "text/html", contentSecurityPolicy: secure, location } : undefined);
	const result = await collectParishSampleBatch(["West Carroll"], review, input.options);
	assert.equal(result.results[0]!.status, "held");
	assert.equal(result.results[0]!.navigation!.location, location);
	assert.equal(input.requests.some(item => item.url === firstDocument), false);
});

test("parish collection requires bounded selection and current enforced secure navigation", async () => {
	for (const selected of [[], Array.from<string>({ length: 26 }).fill("Caddo"), ["Caddo", "Caddo"], ["Unknown Parish"]]) await assert.rejects(collectParishSampleBatch(selected, review), /at most 25/u);
	const input = network(url => url === parishSampleIndexUrl ? { status: 200, body: Buffer.from(index), contentType: "text/html" } : undefined);
	await assert.rejects(collectParishSampleBatch(["West Carroll"], review, input.options), /secure navigation/u);
	assert.equal(input.requests.some(item => item.url === firstControl), false);
});

test("parish preparation preserves source-stated party while excluding race, gender and explanatory prose", () => {
	const records = readParishCandidateReferences(native, "West Carroll", "2030-12-14");
	assert.equal(records.length, 3);
	assert.equal(records[0]!.office, "U.S.Representative,5th Congressional District");
	assert.equal(records[2]!.office, "Aldermen,Village of Example");
	assert.equal(records[2]!.statedParty, "No Party");
	assert.doesNotMatch(JSON.stringify(records), /White|Black|Female|Male|Shall|Republican leaning/u);
	for (const record of records) assert.deepEqual(Object.keys(record).sort(), ["id", "name", "office", "sourcePage", "statedParty"]);
	for (const text of [native.replace("December 14", "December 15"), native.replace("WEST CARROLL", "CADDO"), native.replace("Aldermen,Village of Example", "Unknown office"), native.replace("Republican, White, Male", "Republican or Democrat"), native.replace("■Example Person", "■Example\u0000Person"), native.replace("■Third Person", "■Example Person").replace("No Party", "Republican").replace("Aldermen,Village of Example", "U.S.Representative,5th Congressional District")]) assert.throws(() => readParishCandidateReferences(text, "West Carroll", "2030-12-14"));
});

test("parish CLI preserves exact external evidence and release-independent research files", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "parish-samples-")));
	context.after(() => rm(directory, { force: true, recursive: true }));
	const input = network();
	const plan = { schemaVersion: 1, type: "louisiana-parish-sample-research-collection", outputRoot: join(directory, "captured"), parishes: ["West Carroll", "St Charles"], accessReview: review };
	const path = join(directory, "plan.json");
	await writeFile(path, JSON.stringify(plan));
	const result = await collectLouisianaParishSamples(path, { collect: (selected, accessReview) => collectParishSampleBatch(selected, accessReview, input.options), extract: async () => native });
	assert.equal(result.referenceRecords, 3);
	assert.equal(result.heldParishes, 1);
	assert.equal(result.imported, false);
	const body = await readFile(join(result.outputDirectory, "capture.json"));
	assert.equal(parishSampleHash(body), result.captureSha256);
	const report = JSON.parse(body.toString());
	assert.equal(report.officialQualificationVerified, false);
	assert.equal(report.personalApplicabilityVerified, false);
	assert.equal(parishSampleHash(await readFile(join(result.outputDirectory, "candidate-references.csv"))), report.csvSha256);
	for (const document of report.inputs) assert.equal(parishSampleHash(await readFile(join(result.outputDirectory, document.path))), document.sha256);
	const preparationPath = join(directory, "preparation-plan.json");
	const preparationPlan = { schemaVersion: 1, type: "louisiana-parish-sample-research-preparation", capturePath: join(result.outputDirectory, "capture.json"), captureSha256: result.captureSha256, outputRoot: join(directory, "prepared") };
	await writeFile(preparationPath, JSON.stringify(preparationPlan));
	const requestCount = input.requests.length;
	const first = await prepareLouisianaParishSamples(preparationPath, { extract: async () => native });
	const second = await prepareLouisianaParishSamples(preparationPath, { extract: async () => native });
	assert.equal(first.referenceRecords, 3);
	assert.equal(first.heldParishes, 1);
	assert.equal(first.publisherRequests, 0);
	assert.equal(input.requests.length, requestCount);
	assert.equal(first.preparationSha256, second.preparationSha256);
	assert.deepEqual(await readFile(join(first.outputDirectory, "candidate-references.csv")), await readFile(join(second.outputDirectory, "candidate-references.csv")));
	const prepared = JSON.parse(await readFile(join(first.outputDirectory, "preparation.json"), "utf8"));
	assert.equal(prepared.sourceCaptureSha256, result.captureSha256);
	assert.equal(prepared.publicationApproved, false);
	assert.equal(prepared.personalApplicabilityVerified, false);
	assert.equal(prepared.references[0].capturedAt, report.references[0].capturedAt);
	await writeFile(preparationPath, JSON.stringify({ ...preparationPlan, captureSha256: "0".repeat(64) }));
	await assert.rejects(prepareLouisianaParishSamples(preparationPath), /manifest hash changed/u);
	await writeFile(preparationPath, JSON.stringify(preparationPlan));
	const pdf = report.inputs.find((document: { path: string }) => document.path.endsWith(".pdf"));
	await writeFile(join(result.outputDirectory, pdf.path), "%PDF-altered original bytes");
	await assert.rejects(prepareLouisianaParishSamples(preparationPath), /document bytes changed/u);
	await writeFile(path, JSON.stringify({ ...plan, extra: "unreviewed" }));
	await assert.rejects(collectLouisianaParishSamples(path), /reviewed parish/u);
});

test("parish native preparation retains explicit wrapped court and city headings", () => {
	const text = native.replace("U.S.Representative,5th Congressional District", "District Judge,12th Judicial District\nCourt,Division B").replace("Aldermen,Village of Example", "Councilman District F,\nCity of Example").replace("– Republican", "–Republican").replace("U.S. Representative Runoff & Open General", "Municipal General");
	const records = readParishCandidateReferences(text, "West Carroll", "2030-12-14");
	assert.equal(records[0]!.office, "District Judge,12th Judicial District Court,Division B");
	assert.equal(records[2]!.office, "Councilman District F, City of Example");
	assert.throws(() => readParishCandidateReferences(text.replace("City of Example", "Unrecognized jurisdiction line"), "West Carroll", "2030-12-14"));
});

test("parish references preserve quoted ballot names, stated seat counts and optional demographic omissions", () => {
	const text = native.replace("Aldermen,Village of Example", "Aldermen,Village of Example,\n2 to be elected").replace("■Third Person – No Party, Other, Female", "■‘Third’ Person – No Party");
	const records = readParishCandidateReferences(text, "West Carroll", "2030-12-14");
	assert.equal(records[2]!.name, "‘Third’ Person");
	assert.equal(records[2]!.voteFor, 2);
	assert.equal(records[2]!.statedParty, "No Party");
});

test("parish references preserve a city school-board heading that precedes its office", () => {
	const records = readParishCandidateReferences(native.replace("Aldermen,Village of Example", "City of Example\nMember of School Board District 3"), "West Carroll", "2030-12-14");
	assert.equal(records[2]!.office, "Member of School Board District 3, City of Example");
	assert.throws(() => readParishCandidateReferences(native.replace("December 14, 2030", "November 5, 2030"), "West Carroll", "2030-12-14"), /date changed/u);
});

test("parish references retain explicit judicial election sections and plural municipal office labels", () => {
	for (const heading of ["City Marshal,City Court,\nCity of Example", "Council Member(s),Town of Example", "Councilmen at Large,City of Example,\n2 to be elected"]) {
		const records = readParishCandidateReferences(native.replace("Aldermen,Village of Example", heading).replace("U.S.Representative,5th Congressional District", "District Judge,27th Judicial District\nCourt,ES 1,Div.C"), "West Carroll", "2030-12-14");
		assert.equal(records[0]!.office, "District Judge,27th Judicial District Court,ES 1,Div.C");
		assert.equal(records[2]!.office, heading.split("\n").filter(line => line !== "2 to be elected").join(" "));
	}
});

test("parish references support runoff-only guides and a wrapped judicial election section", () => {
	const text = native.replace("U.S. Representative Runoff & Open General", "U.S. Representative Runoff").replace("Aldermen,Village of Example", "District Judge,18th Judicial District Court,\nES 1,Div.C");
	assert.equal(readParishCandidateReferences(text, "West Carroll", "2030-12-14")[2]!.office, "District Judge,18th Judicial District Court, ES 1,Div.C");
	assert.throws(() => readParishCandidateReferences(text.replace("ES 1,Div.C", "Unknown election section"), "West Carroll", "2030-12-14"), /association requires review/u);
});

test("public document metadata exposes only bounded enforced CSP and keeps redirect handling passive", async () => {
	for (const policyValue of [secure, `${secure}\r\nInjected: value`, "a".repeat(4097), [secure, "default-src none"]]) {
		let requests = 0;
		const result = await fetchRemoteSourceDocument("https://example.com/export", { allowedHosts: ["example.com"], resolveAddresses: async () => [{ address: "93.184.216.34", family: 4 }], transport: async () => {
			requests++;
			return { statusCode: 302, headers: { "content-security-policy": policyValue, "location": "http://example.com/document.pdf" }, body: Readable.from([]) };
		} });
		assert.equal(requests, 1);
		assert.equal(result.location, "http://example.com/document.pdf");
		assert.equal(result.contentSecurityPolicy, policyValue === secure ? secure : undefined);
	}
});
