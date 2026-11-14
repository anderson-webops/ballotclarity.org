import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { collectUnionBallotEvidence } from "../src/collect-union-ballot-evidence.js";
import { prepareUnionBallotCorroboration } from "../src/prepare-union-ballot-corroboration.js";
import { prepareUnionBallotQuestions } from "../src/prepare-union-ballot-questions.js";
import { buildUnionCandidateSnapshot, prepareUnionCandidateSnapshot } from "../src/prepare-union-candidate-snapshot.js";
import { prepareUnionChoiceReview } from "../src/prepare-union-choice-review.js";
import { acquireStateBallotAutomationLock } from "../src/state-ballot-automation-lock.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { unionSampleSource } from "../src/state-ballot-union-source.js";
import { inspectUnionBallotAutomation, readUnionBallotAutomationPlan, runUnionBallotAutomation } from "../src/union-ballot-automation.js";
import { readUnionChoiceContext, unionOfficeCorroborated } from "../src/union-ballot-choice-context.js";
import { readUnionSampleQuestion } from "../src/union-ballot-questions.js";
import { readUnionBallotCells, reconcileUnionBallotReferences } from "../src/union-ballot-witnesses.js";
import { collectUnionSampleBatch, collectUnionSampleWindow, readUnionSampleCatalog, readUnionSampleEdition, unionCountyPolicyHash, unionCountyPolicyUrls, unionSampleLandingUrl } from "../src/union-county-ballots.js";
import { unionCandidateHash as hash, unionCandidateOrigin, unionCandidatePolicyHash, unionCandidatePolicyUrls } from "../src/union-county-candidates.js";

const municipalities = ["Berkeley Heights", "Clark", "Cranford", "Elizabeth", "Fanwood", "Garwood", "Hillside", "Kenilworth", "Linden", "Mountainside", "New Providence", "Plainfield", "Rahway", "Roselle", "Roselle Park", "Scotch Plains", "Springfield", "Summit", "Union", "Westfield", "Winfield"];
const privacyLink = `<a href="${unionCandidatePolicyUrls[1]}">Privacy Policy</a>`;
const countyLink = `<a href="${unionCountyPolicyUrls[2]}">Privacy Statement</a>`;
const unionRobots = "User-agent: *\nCrawl-delay: 30\n";
const countyRobots = "Sitemap: https://ucnj.org/sitemap.xml\nSitemap: https://ucnj.org/news-sitemap.xml\nUser-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n";
const unionPrivacy = `<div class="entry-content">COUNTY OF UNION, NEW JERSEY Thank you for reviewing our Privacy Notice. Section F. Disclaimer Reviewed public source policy. Section G. Contact Information</div>${privacyLink}`;
const countyPrivacy = `<div class="entry-content">September 20, 2006 Section A. Information Collected and How it is Used Reviewed county policy. Section F. Disclaimer Section G. Contact Information Share this Page</div>${countyLink}`;
const landing = `<div class="entry-content"><h4>Current</h4><p><a href="${unionCandidateOrigin}/sample-ballots-for-the-november-5-2030-general-election/">Sample Ballots for the November 5, 2030 General Election</a></p><h4>Past</h4><p>Earlier editions</p></div>${privacyLink}`;
const edition = readUnionSampleEdition(landing);
const documentUrl = (form: number) => `https://ucnj.org/wp-content/uploads/2030/09/2030-UNION-GEN-samples-FORM-${form}.pdf`;
const editionBody = `<h1>Sample Ballots for the November 5, 2030 General Election</h1><div class="entry-content">${municipalities.map((municipality, index) => `<div><h4>${municipality}</h4><ul>${municipality === "Clark" ? `<li>Ward 1<ul><li><a href="${documentUrl(index + 1)}">District 1</a></li><li><a href="${documentUrl(22)}">District 2</a></li></ul></li>` : `<li><a href="${documentUrl(index + 1)}">All Districts</a></li>`}</ul></div>`).join("")}</div>${privacyLink}`;
const catalog = readUnionSampleCatalog(editionBody, edition);
const review = { unionRobots: unionCandidatePolicyHash(unionRobots, "robots"), unionPrivacy: unionCandidatePolicyHash(unionPrivacy, "privacy"), countyRobots: unionCountyPolicyHash(countyRobots, "robots"), countyPrivacy: unionCountyPolicyHash(countyPrivacy, "privacy") };

function network(change?: (url: string) => { body?: string; status?: number; contentType?: string } | undefined) {
	let now = Date.parse("2030-10-01T00:00:00Z");
	const requests: { url: string; requestedAt: number; completedAt: number }[] = [];
	const options = {
		now: () => now,
		sleep: async (delay: number) => { now += delay; },
		request: async (url: string, transport: { allowedHosts?: readonly string[]; timeoutMs?: number; maxBytes?: number }) => {
			assert.deepEqual(transport.allowedHosts, [new URL(url).hostname]);
			assert.equal(transport.timeoutMs, 20000);
			assert.ok(transport.maxBytes! <= 12 * 1024 * 1024);
			const requestedAt = now;
			now += 250;
			requests.push({ url, requestedAt, completedAt: now });
			const form = /FORM-(\d+)\.pdf$/u.exec(url)?.[1];
			const altered = change?.(url);
			const original = url === unionCandidatePolicyUrls[0] ? unionRobots : url === unionCandidatePolicyUrls[1] ? unionPrivacy : url === unionCountyPolicyUrls[0] ? countyRobots : url === unionCountyPolicyUrls[1] ? countyLink : url === unionCountyPolicyUrls[2] ? countyPrivacy : url === unionSampleLandingUrl ? landing : url === edition.url ? editionBody : form ? `%PDF-form-${form}` : altered?.body ?? assert.fail("Unexpected source URL");
			return { status: altered?.status ?? 200, body: Buffer.from(altered?.body ?? original), contentType: altered?.contentType ?? (form ? "application/pdf" : "text/html"), etag: undefined };
		},
	};
	return { options, requests };
}

interface Word { value: string; left: number; top: number; size?: number; width?: number }
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
function document(form: number, change: (words: Word[]) => Word[] = words => words) {
	const municipality = catalog.documents.find(item => item.form === form)!.claims[0]!.municipality;
	const words = change([
		{ value: "OFFICIAL GENERAL ELECTION SAMPLE BALLOT", left: 300, top: 100 },
		{ value: "USED ON NOVEMBER 5, 2030", left: 300, top: 130 },
		{ value: "UNION COUNTY, NEW JERSEY", left: 300, top: 160 },
		{ value: municipality, left: 300, top: 190 },
		{ value: `FORM ${form}`, left: 300, top: 210 },
		{ value: "Cory", left: 430, top: 309, size: 12.5 },
		{ value: "BOOKER", left: 430, top: 319, size: 18.75 },
		{ value: "1A", left: 530, top: 320, size: 21.5 },
		...(municipality === "Roselle"
			? [
					{ value: "Antoinette", left: 430, top: 951, size: 12.5 },
					{ value: "BOWERS", left: 430, top: 960, size: 18.75 },
					{ value: "1-2", left: 530, top: 960, size: 21.5 },
					{ value: "Joseph", left: 430, top: 985, size: 12.5 },
					{ value: "LECONTE", left: 430, top: 995, size: 18.75 },
					{ value: "1-3", left: 530, top: 994, size: 21.5 },
				]
			: [
					{ value: "Anne", left: 430, top: 919, size: 12.5, width: 24 },
					{ value: "Marie", left: 460, top: 919, size: 12.5 },
					{ value: "WEISS", left: 430, top: 930, size: 18.75 },
					{ value: "1-1", left: 530, top: 924, size: 21.5 },
				]),
	]);
	return { layout: `${words.map(word => word.value).join("\n")}\f`, bbox: `<doc><page width="1824" height="1284">${words.map(word => `<line xmin="${word.left}" xmax="${word.left + (word.width ?? 50)}" ymin="${word.top}" ymax="${word.top + (word.size ?? 10)}"><word xmin="${word.left}" xmax="${word.left + (word.width ?? 50)}" ymin="${word.top}" ymax="${word.top + (word.size ?? 10)}">${escape(word.value)}</word></line>`).join("")}</page></doc>` };
}

function questionDocument(form: number, change: (words: Word[]) => Word[] = words => words) {
	return document(form, words => [...words.map(word => word.top > 750 ? { ...word, left: word.left + 700 } : word), ...change([
		{ value: "PUBLIC QUESTION TO BE VOTED UPON", left: 220, top: 805, width: 320, size: 20 },
		{ value: "PREGUNTA PÚBLICA PARA VOTACIÓN", left: 237, top: 823, width: 285, size: 19 },
		{ value: "QUESTION:", left: 350, top: 847, width: 65, size: 17 },
		{ value: "Shall the annual municipal rent increase be capped at twenty dollars?", left: 128, top: 865, width: 440, size: 14.88 },
		{ value: "YES/SÍ", left: 589, top: 850, width: 46, size: 17 },
		{ value: "NO", left: 601, top: 888, width: 23, size: 17 },
		{ value: "INTERPRETIVE STATEMENT:", left: 300, top: 921, width: 160, size: 17 },
		{ value: "Approval restores the annual increase cap; rejection retains the ordinance.", left: 128, top: 940, width: 500, size: 14.88 },
		{ value: "PREGUNTA:", left: 348, top: 1010, width: 68, size: 17 },
		{ value: "¿Debe limitarse el aumento anual del alquiler municipal a veinte dólares?", left: 128, top: 1030, width: 500, size: 14.88 },
		{ value: "DECLARACIÓN INTERPRETATIVA:", left: 286, top: 1099, width: 190, size: 17 },
		{ value: "La aprobación restablece el límite anual; el rechazo conserva la ordenanza.", left: 128, top: 1120, width: 500, size: 14.88 },
	])]);
}

function contextDocument(form: number, change: (words: Word[]) => Word[] = words => words) {
	const municipality = catalog.documents.find(source => source.form === form)!.claims[0]!.municipality;
	const nonpartisan = municipality === "Hillside";
	const shift = nonpartisan ? 329 : 0;
	const fields: Word[] = [
		{ value: "7th Congressional District - November 5, 2030", left: 617, top: 230, width: 590, size: 30 },
		...[["A", 692, "Democrat"], ["B", 834, "Republican"], ["C", 976, "Nomination by Petition"]].flatMap(([letter, center, label]) => [
			{ value: String(letter), left: Number(center) - 12, top: 285, width: 24, size: 40 },
			{ value: String(label), left: Number(center) - (label === "Nomination by Petition" ? 63 : 27), top: 320, width: label === "Nomination by Petition" ? 126 : 54, size: 12.9 },
		]),
		{ value: "United States Senator", left: 382, top: 356, width: 97, size: 10.692 },
		{ value: "6 Year Term - Vote for One", left: 385, top: 367, width: 90, size: 8.379 },
		{ value: "Member of House", left: 394, top: 386, width: 74, size: 10.692 },
		{ value: "of Representatives", left: 393, top: 396, width: 76, size: 10.692 },
		{ value: "2 Year Term - Vote for One", left: 385, top: 409, width: 90, size: 8.379 },
		{ value: "Sheriff", left: 417, top: 426, width: 27, size: 10.692 },
		{ value: "3 Year Term - Vote for One", left: 385, top: 438, width: 90, size: 8.379 },
		{ value: "County Clerk", left: 404, top: 461, width: 53, size: 10.692 },
		{ value: "5 Year Term - Vote for One", left: 385, top: 473, width: 90, size: 8.379 },
		{ value: "Members of", left: 405, top: 519, width: 50, size: 10.692 },
		{ value: "Board of County", left: 397, top: 529, width: 67, size: 10.692 },
		{ value: "Commissioners", left: 398, top: 539, width: 64, size: 10.692 },
		{ value: "3 Year Term - Vote for Three", left: 383, top: 554, width: 95, size: 8.379 },
		...Array.from({ length: 7 }, (_, index) => index + 1).flatMap(row => [
			{ value: String(row === 1 ? "Cory" : `Person${row}`), left: 650, top: 346 + (row - 1) * 35, width: 70, size: 12.5 },
			{ value: String(row === 1 ? "BOOKER" : "EXAMPLE"), left: 650, top: 356 + (row - 1) * 35, width: 70, size: 18.75 },
			{ value: `${row}A`, left: 739, top: 355 + (row - 1) * 35, width: 13, size: 21.1 },
		]),
		{ value: "Veronica", left: 940, top: 346, width: 75, size: 12.5 },
		{ value: "FERNANDEZ", left: 940, top: 356, width: 80, size: 18.75 },
		{ value: "1C", left: 1024, top: 355, width: 13, size: 21.1 },
		{ value: `OFFICIAL SCHOOL ELECTION BALLOT - ${municipality.toUpperCase()}`, left: nonpartisan ? 1006 : 407, top: 809, width: nonpartisan ? 468 : 1034, size: 23 },
		{ value: "OFFICE TITLE", left: 639 + shift, top: 858, width: 118, size: 21 },
		{ value: "Members of", left: 613 + shift, top: 933, width: 50, size: 10.8426 },
		{ value: "Board of Education", left: 599 + shift, top: 945, width: 80, size: 10.8426 },
		{ value: "3 Year Term - Vote for Three", left: 594 + shift, top: 961, width: 90, size: 8.28 },
		{ value: "Anne Marie", left: 850 + shift, top: 919, width: 80, size: 12.5 },
		{ value: "WEISS", left: 850 + shift, top: 930, width: 80, size: 18.75 },
		{ value: nonpartisan ? "1E" : "1-1", left: 948 + shift, top: 924, width: 14, size: 21.5 },
		{ value: "NO PETITION FILED", left: 1030 + shift, top: 975, width: 100, size: 12.5 },
		{ value: "2-1", left: 1140 + shift, top: 975, width: 14, size: 21.5 },
		...(nonpartisan
			? [
					{ value: "OFFICIAL MUNICIPAL NON-PARTISAN ELECTION BALLOT - HILLSIDE", left: 155, top: 786, width: 682, size: 23 },
					{ value: "OFFICE TITLE", left: 236, top: 858, width: 118, size: 21 },
					{ value: "1st Ward Council Member", left: 168, top: 925, width: 109, size: 10.8426 },
					{ value: "Unexpired Term - Vote for One", left: 174, top: 937, width: 97, size: 8.28 },
					{ value: "Local", left: 450, top: 915, width: 60, size: 12.5 },
					{ value: "CITIZEN", left: 450, top: 925, width: 60, size: 18.75 },
					{ value: "1C", left: 540, top: 924, width: 14, size: 21.5 },
				]
			: []),
	];
	return document(form, words => [...words.filter(word => word.top <= 210), ...change(fields)]);
}

function candidateSamples() {
	return catalog.documents.map((source) => {
		const input = contextDocument(source.form);
		return { document: source, sha256: hash(`sample-${source.form}`), capturedAt: "2030-10-01T00:00:00.000Z", cells: readUnionChoiceContext(input.bbox, input.layout, source, edition.electionDate) };
	});
}

async function automationFixture(root: string) {
	const path = join(root, "automation.json");
	const directory = join(await realpath(root), "automation");
	await mkdir(directory, { mode: 0o700 });
	await writeFile(path, JSON.stringify({ schemaVersion: 1, type: "union-ballot-automation", directory, accessReview: review, intervalMs: 21600000 }));
	const extract = async (body: Buffer, format: "layout" | "bbox-layout") => {
		const form = Number(/form-(\d+)/u.exec(body.toString("utf8"))?.[1]);
		const input = contextDocument(form);
		return format === "layout" ? input.layout : input.bbox;
	};
	return { path, directory, extract };
}

test("Union discovery windows collect every offered form in batches of at most twenty-five", async () => {
	const extra = Array.from({ length: 5 }, (_, index) => `<li><a href="${documentUrl(index + 23)}">District ${index + 3}</a></li>`).join("");
	const large = editionBody.replace(`<li><a href="${documentUrl(22)}">District 2</a></li>`, `<li><a href="${documentUrl(22)}">District 2</a></li>${extra}`);
	const net = network(url => url === edition.url ? { body: large } : undefined);
	const first = await collectUnionSampleWindow(0, review, null, net.options);
	const second = await collectUnionSampleWindow(25, review, first.catalog.sha256, net.options);
	assert.equal(first.catalog.documents.length, 27);
	assert.equal(first.selected.length, 25);
	assert.deepEqual(second.selected.map(document => document.form), [26, 27]);
	assert.equal(new Set([...first.selected, ...second.selected].map(document => document.form)).size, 27);
	const lastCompleted = new Map<string, number>();
	for (const request of net.requests) {
		const host = new URL(request.url).hostname;
		assert.ok(request.requestedAt - (lastCompleted.get(host) ?? -Infinity) >= (host === "unioncountyvotes.com" ? 30000 : 1000));
		lastCompleted.set(host, request.completedAt);
	}
	for (const offset of [-1, 1, 99, 100]) await assert.rejects(collectUnionSampleWindow(offset, review, null, net.options));
	await assert.rejects(collectUnionSampleWindow(25, review, "0".repeat(64), net.options));
});

test("Union recurring preparation discovers its edition, persists both outputs and reuses exact content across checks", async (context) => {
	const root = await mkdtemp(join(tmpdir(), "union-recurring-"));
	context.after(() => rm(root, { recursive: true, force: true }));
	const fixture = await automationFixture(root);
	const net = network();
	const options = { now: net.options.now, pause: net.options.sleep, collection: net.options, extract: fixture.extract };
	assert.equal((await inspectUnionBallotAutomation(fixture.path, net.options.now())).state, null);
	const first = await runUnionBallotAutomation(fixture.path, options);
	assert.equal(first.status, "prepared-review-required");
	assert.equal(first.publisherRequests, catalog.documents.length + 7);
	assert.equal(first.latestPrepared!.files.length, 6);
	assert.equal(first.latestPrepared!.candidates, buildUnionCandidateSnapshot(catalog, candidateSamples()).snapshot.recordCount);
	assert.equal(first.latestPrepared!.questions, 0);
	assert.deepEqual(first.issues, ["initial-review-required"]);
	const state = await readFile(join(fixture.directory, "state.json"));
	const count = net.requests.length;
	const cached = await runUnionBallotAutomation(fixture.path, options);
	assert.equal(cached.skipped, true);
	assert.equal(cached.publisherRequests, 0);
	assert.equal(net.requests.length, count);
	assert.deepEqual(await readFile(join(fixture.directory, "state.json")), state);
	await net.options.sleep(21600001);
	const unchangedExtract = async () => {
		throw new Error("Unchanged sources require no native reprocessing.");
	};
	const reused = await runUnionBallotAutomation(fixture.path, { ...options, extract: unchangedExtract });
	assert.equal(reused.status, "unchanged");
	assert.deepEqual(reused.issues, first.issues);
	assert.deepEqual(reused.latestPrepared, first.latestPrepared);
	assert.notEqual(reused.lastCollectedAt, first.lastCollectedAt);
	assert.equal((await inspectUnionBallotAutomation(fixture.path, net.options.now())).state!.status, "unchanged");
	assert.equal(reused.imported, false);
	assert.equal(reused.publicationApproved, false);
	assert.equal(reused.recurringImportEnabled, false);
});

test("Union publisher denial, policy changes and native failures preserve the previous prepared cohort", async (context) => {
	const root = await mkdtemp(join(tmpdir(), "union-recurring-failure-"));
	context.after(() => rm(root, { recursive: true, force: true }));
	const fixture = await automationFixture(root);
	let mode = "normal";
	const net = network(url => mode === "denied" && url === documentUrl(1) ? { status: 403 } : mode === "policy" && url === unionCandidatePolicyUrls[0] ? { body: "User-agent: * Disallow: /" } : mode === "native" && /FORM-\d+\.pdf$/u.test(url) ? { body: `%PDF-form-${/FORM-(\d+)/u.exec(url)![1]}-changed` } : undefined);
	const options = { now: net.options.now, pause: net.options.sleep, collection: net.options, extract: fixture.extract };
	const first = await runUnionBallotAutomation(fixture.path, options);
	const invalidExtract = async () => {
		throw new Error("Changed native layout.");
	};
	for (const failure of ["denied", "policy", "native"]) {
		mode = failure;
		await net.options.sleep(21600001);
		const before = net.requests.length;
		await assert.rejects(runUnionBallotAutomation(fixture.path, failure === "native" ? { ...options, extract: invalidExtract } : options));
		const inspected = await inspectUnionBallotAutomation(fixture.path, net.options.now());
		assert.equal(inspected.state!.status, "failed");
		assert.equal(inspected.state!.failure, failure === "native" ? "preparation" : "collection");
		assert.deepEqual(inspected.state!.latestPrepared, first.latestPrepared);
		assert.equal(inspected.publicationApproved, false);
		if (failure === "policy") assert.equal(net.requests.length - before, 1);
		if (failure === "denied") assert.equal(net.requests.at(-1)!.url, documentUrl(1));
	}
});

test("Union recurring ownership and prepared-file integrity reject work before new publisher requests", async (context) => {
	const root = await mkdtemp(join(tmpdir(), "union-recurring-integrity-"));
	context.after(() => rm(root, { recursive: true, force: true }));
	const fixture = await automationFixture(root);
	const net = network();
	const options = { now: net.options.now, pause: net.options.sleep, collection: net.options, extract: fixture.extract };
	const held = await acquireStateBallotAutomationLock(fixture.directory);
	await assert.rejects(runUnionBallotAutomation(fixture.path, options), /already running/u);
	assert.equal(net.requests.length, 0);
	await held.release();
	const first = await runUnionBallotAutomation(fixture.path, options);
	const path = join(fixture.directory, "runs", first.latestPrepared!.runId, first.latestPrepared!.files[0]!.path);
	const original = await readFile(path);
	await writeFile(path, `${original.toString("utf8")} `);
	const requests = net.requests.length;
	await assert.rejects(inspectUnionBallotAutomation(fixture.path, net.options.now()), /bytes changed/u);
	await assert.rejects(runUnionBallotAutomation(fixture.path, options), /bytes changed/u);
	assert.equal(net.requests.length, requests);
	await writeFile(path, original);
	assert.equal((await inspectUnionBallotAutomation(fixture.path, net.options.now())).state!.status, "prepared-review-required");
});

test("Union recurring recovery keeps prior outputs and applies an interrupted-request cooldown", async (context) => {
	const root = await mkdtemp(join(tmpdir(), "union-recurring-recovery-"));
	context.after(() => rm(root, { recursive: true, force: true }));
	const fixture = await automationFixture(root);
	const net = network();
	const options = { now: net.options.now, pause: net.options.sleep, collection: net.options, extract: fixture.extract };
	const first = await runUnionBallotAutomation(fixture.path, options);
	const path = join(fixture.directory, "state.json");
	const state = JSON.parse(await readFile(path, "utf8"));
	await writeFile(path, JSON.stringify({ ...state, status: "running", finishedAt: null }));
	const requests = net.requests.length;
	const started = net.options.now();
	const recovered = await runUnionBallotAutomation(fixture.path, options);
	assert.equal(recovered.status, "unchanged");
	assert.ok(recovered.issues.includes("interrupted-run-retained"));
	assert.deepEqual(recovered.latestPrepared, first.latestPrepared);
	assert.ok(net.requests[requests]!.requestedAt - started >= 51000);
});

test("Union source changes queue candidate disappearance without importing or erasing earlier evidence", async (context) => {
	const root = await mkdtemp(join(tmpdir(), "union-recurring-changes-"));
	context.after(() => rm(root, { recursive: true, force: true }));
	const fixture = await automationFixture(root);
	let changed = false;
	const net = network(url => changed && /FORM-\d+\.pdf$/u.test(url) ? { body: `%PDF-form-${/FORM-(\d+)/u.exec(url)![1]}-changed` } : undefined);
	const options = { now: net.options.now, pause: net.options.sleep, collection: net.options, extract: fixture.extract };
	const first = await runUnionBallotAutomation(fixture.path, options);
	changed = true;
	await net.options.sleep(21600001);
	const next = await runUnionBallotAutomation(fixture.path, { ...options, extract: async (body, format) => {
		const form = Number(/form-(\d+)/u.exec(body.toString("utf8"))?.[1]);
		const input = contextDocument(form, words => words.filter(word => !["Veronica", "FERNANDEZ"].includes(word.value)));
		return format === "layout" ? input.layout : input.bbox;
	} });
	assert.equal(next.status, "prepared-review-required");
	assert.ok(next.issues.includes("candidate-removed"));
	assert.deepEqual(next.previousPrepared, first.latestPrepared);
	assert.equal(next.latestPrepared!.candidates, first.latestPrepared!.candidates - 1);
	assert.equal(next.recurringImportEnabled, false);
	assert.equal(next.publicationApproved, false);
});

test("Union recurring profiles use bounded external storage and explicit policy fingerprints", async (context) => {
	const root = await mkdtemp(join(tmpdir(), "union-recurring-plan-"));
	context.after(() => rm(root, { recursive: true, force: true }));
	const fixture = await automationFixture(root);
	const valid = JSON.parse(await readFile(fixture.path, "utf8"));
	assert.equal((await readUnionBallotAutomationPlan(fixture.path)).intervalMs, 21600000);
	for (const changed of [{ ...valid, intervalMs: 1 }, { ...valid, forms: [1] }, { ...valid, directory: "relative" }, { ...valid, accessReview: { ...review, unionPrivacy: "invalid" } }]) {
		await writeFile(fixture.path, JSON.stringify(changed));
		await assert.rejects(readUnionBallotAutomationPlan(fixture.path));
	}
});

test("Union automation rejects shared storage permissions without modifying them or contacting publishers", async (context) => {
	const root = await mkdtemp(join(tmpdir(), "union-recurring-permissions-"));
	context.after(() => rm(root, { recursive: true, force: true }));
	const fixture = await automationFixture(root);
	const directory = join(await realpath(root), "shared");
	await mkdir(directory, { mode: 0o755 });
	const plan = JSON.parse(await readFile(fixture.path, "utf8"));
	await writeFile(fixture.path, JSON.stringify({ ...plan, directory }));
	const net = network();
	await assert.rejects(runUnionBallotAutomation(fixture.path, { now: net.options.now, collection: net.options }), /private owner-controlled/u);
	await assert.rejects(inspectUnionBallotAutomation(fixture.path, net.options.now()), /private owner-controlled/u);
	assert.equal(net.requests.length, 0);
	assert.deepEqual(await readdir(directory), []);
});

test("Union recurring discovery follows a later offered election without annual profile edits and holds regressions", async (context) => {
	const root = await mkdtemp(join(tmpdir(), "union-recurring-future-"));
	context.after(() => rm(root, { recursive: true, force: true }));
	const fixture = await automationFixture(root);
	const later = (value: string) => value.replaceAll("2030", "2034").replaceAll("november-5", "november-7").replaceAll("November 5", "November 7").replaceAll("NOVEMBER 5", "NOVEMBER 7");
	let future = false;
	const net = network(url => future && url === unionSampleLandingUrl ? { body: later(landing) } : future && url === later(edition.url) ? { body: later(editionBody) } : undefined);
	const options = { now: net.options.now, pause: net.options.sleep, collection: net.options, extract: fixture.extract };
	const first = await runUnionBallotAutomation(fixture.path, options);
	const planBefore = await readFile(fixture.path);
	await net.options.sleep(Date.parse("2034-10-01T00:00:00Z") - net.options.now());
	future = true;
	const laterRun = await runUnionBallotAutomation(fixture.path, { ...options, extract: async (body, format) => later(await fixture.extract(body, format)) });
	assert.equal(laterRun.latestPrepared!.electionDate, "2034-11-07");
	assert.equal(laterRun.latestPrepared!.candidates, first.latestPrepared!.candidates);
	assert.ok(laterRun.issues.includes("new-election-review-required"));
	assert.deepEqual(laterRun.previousPrepared, first.latestPrepared);
	assert.deepEqual(await readFile(fixture.path), planBefore);
	future = false;
	await net.options.sleep(21600001);
	await assert.rejects(runUnionBallotAutomation(fixture.path, options), /older Union source/u);
	assert.deepEqual((await inspectUnionBallotAutomation(fixture.path, net.options.now())).state!.latestPrepared, laterRun.latestPrepared);
});

test("Union sample directory source preserves historical scope and leaves existing federal selection preferred", () => {
	const source = unionSampleSource();
	assert.equal(source.id, "nj-union-2026-11-03");
	assert.equal(source.documentUrls!.length, 42);
	assert.equal(source.ballotPreview, false);
	assert.equal(source.retrievalPolicy, "manual-snapshot");
	assert.equal(source.defaultPriority, -20);
	assert.equal(unionSampleSource(catalog).electionDate, "2030-11-05");
	assert.throws(() => unionSampleSource({ ...catalog, edition: { ...edition, electionDate: "2030-11-06" } }));
	assert.throws(() => unionSampleSource({ ...catalog, documents: [...catalog.documents, catalog.documents[0]!] }));
	assert.throws(() => unionSampleSource({ ...catalog, documents: catalog.documents.map((source, index) => index ? source : { ...source, url: "https://elsewhere.example/ballot.pdf" }) }));
});

test("Union directory snapshots deduplicate repeated sample choices and retain every source witness", () => {
	const samples = candidateSamples();
	const first = buildUnionCandidateSnapshot(catalog, samples);
	const repeated = buildUnionCandidateSnapshot(catalog, [...samples].reverse());
	assert.deepEqual(repeated, first);
	assert.ok(first.evidence.length > first.snapshot.recordCount);
	assert.equal(first.snapshot.documents.reduce((count, document) => count + document.includedRecordCount, 0), first.snapshot.recordCount);
	const parsed = parseBundledStateSnapshot(first.source, JSON.stringify(first.snapshot));
	assert.equal(parsed.records.length, first.snapshot.recordCount);
	assert.ok(parsed.records.every(record => record.status === "listed" && record.incumbent === undefined));
	assert.ok(parsed.records.some(record => record.name === "Anne Marie WEISS"));
	assert.ok(parsed.records.every(record => record.name !== "Ann Marie Weiss"));
	assert.ok(parsed.records.every(record => !/NO NOMINATION|NO PETITION|WRITE.?IN/iu.test(record.name)));
	assert.equal(parsed.records.find(record => record.name === "Cory BOOKER")!.party, "Democrat");
	const petition = parsed.records.find(record => record.name === "Veronica FERNANDEZ")!;
	assert.equal(petition.party, undefined);
	assert.match(petition.ballotDesignation!, /Nomination by Petition/u);
	assert.ok(parsed.records.filter(record => record.office === "Members of Board of Education").every(record => record.party === undefined));
	assert.equal(parsed.records.find(record => record.name === "Local CITIZEN")!.party, "Non-Partisan");
	assert.ok(parsed.records.filter(record => record.scope === "congressional").every(record => record.district === "7"));
	assert.ok(parsed.records.filter(record => record.scope === "congressional").every(record => record.office.endsWith(" - District 7")));
	assert.equal(first.snapshot.retrievedAt, "2030-10-01T00:00:00.000Z");
});

test("Union candidate snapshots hold incomplete, repeated, conflicting and altered sample evidence", () => {
	const samples = candidateSamples();
	assert.throws(() => buildUnionCandidateSnapshot(catalog, samples.slice(1)));
	assert.throws(() => buildUnionCandidateSnapshot(catalog, [samples[0]!, ...samples.slice(0, -1)]));
	for (const mutate of [
		(sample: typeof samples[number]) => { sample.sha256 = "invalid"; },
		(sample: typeof samples[number]) => { sample.document = { ...sample.document, url: "https://elsewhere.example/ballot.pdf" }; },
		(sample: typeof samples[number]) => { sample.cells.push(sample.cells[0]!); },
		(sample: typeof samples[number]) => { sample.cells.find(cell => cell.position === "1A")!.printedPartyOrColumn = "Unreviewed"; },
		(sample: typeof samples[number]) => { sample.cells.find(cell => cell.position === "2A")!.congressionalDistrict = null; },
		(sample: typeof samples[number]) => { sample.cells.find(cell => cell.position === "1A")!.printedSelections = ["2 Year Term - Vote for One"]; },
	]) {
		const changed = structuredClone(samples);
		mutate(changed[1]!);
		assert.throws(() => buildUnionCandidateSnapshot(catalog, changed));
	}
});

test("Union candidate CLI preparation emits replayable import data with separate review and unchanged capture clocks", async () => {
	const root = await mkdtemp(join(tmpdir(), "union-candidate-snapshot-"));
	try {
		const collectionPath = join(root, "collect.json");
		await writeFile(collectionPath, JSON.stringify({ schemaVersion: 1, type: "union-sample-ballot-collection", outputRoot: join(root, "intakes"), forms: catalog.documents.map(source => source.form), accessReview: review, catalogSha256: catalog.sha256 }));
		const collect: typeof collectUnionSampleBatch = async (forms, access, expected, options) => collectUnionSampleBatch(forms, access, expected, { ...network().options, onCapture: options!.onCapture });
		const intake = await collectUnionBallotEvidence(collectionPath, { collect });
		const capturePath = join(intake.outputDirectory, "capture.json");
		const original = await readFile(capturePath);
		const path = join(root, "plan.json");
		const plan = { schemaVersion: 1, type: "union-candidate-snapshot-preparation", ballotCaptures: [{ path: capturePath, sha256: hash(original) }], outputRoot: join(root, "prepared") };
		await writeFile(path, JSON.stringify(plan));
		const options = { now: () => Date.parse("2030-10-02T00:00:00Z"), extract: async (body: Buffer, format: "layout" | "bbox-layout") => {
			const form = Number(body.toString("utf8").split("-").at(-1));
			const input = contextDocument(form);
			return format === "layout" ? input.layout : input.bbox;
		} };
		const first = await prepareUnionCandidateSnapshot(path, options);
		const repeated = await prepareUnionCandidateSnapshot(path, options);
		assert.equal(repeated.sha256, first.sha256);
		for (const name of [`${first.sourceId}.json`, "source.json", "candidate-evidence.csv", "review.json"]) assert.deepEqual(await readFile(join(first.outputDirectory, name)), await readFile(join(repeated.outputDirectory, name)));
		const report = JSON.parse(await readFile(join(first.outputDirectory, "review.json"), "utf8"));
		assert.equal(report.publisherRequests, 0);
		assert.equal(report.identitiesMergedWithEarlierLists, false);
		for (const key of ["qualificationVerified", "voterApplicabilityVerified", "imported", "publicationApproved", "automaticImportApproved"]) assert.equal(report[key], false);
		assert.equal(report.evidence.length, first.sourceOccurrences);
		assert.deepEqual(await readFile(capturePath), original);
		await writeFile(path, JSON.stringify({ ...plan, ballotCaptures: [{ path: capturePath, sha256: "0".repeat(64) }] }));
		await assert.rejects(prepareUnionCandidateSnapshot(path, options));
	}
	finally { await rm(root, { recursive: true, force: true }); }
});

function reference(name: string, position: string, municipality: string, kind: "general" | "school" = "school") {
	return { stateCode: "NJ", publicationCounty: "Union County", kind, electionDate: edition.electionDate, page: 1, name, position, office: kind === "school" ? "School Board" : "United States Senator", jurisdictionLabel: municipality === "UNION COUNTY" ? municipality : `TOWNSHIP OF ${municipality.toUpperCase()}`, partyCode: kind === "school" ? "" : "Dem", termLabel: "3 Yrs", sourceAsOfDate: "2030-08-12", sourceUrl: `${unionCandidateOrigin}/wp-content/uploads/2030/08/SCHOOL.pdf`, sourceSha256: "a".repeat(64), capturedAt: "2030-09-30T00:00:00.000Z" };
}
const references = [reference("Cory Booker", "1A", "UNION COUNTY", "general"), reference("Antoinette Bowers", "1-2", "Roselle"), reference("Ann Marie Weiss", "1-1", "Winfield")];
async function extract(bytes: Buffer, format: "layout" | "bbox-layout") {
	const form = Number(/form-(\d+)$/u.exec(bytes.toString())?.[1]);
	const parsed = document(form);
	return format === "layout" ? parsed.layout : parsed.bbox;
}

test("Union samples follow explicitly offered future general editions and preserve nested geographic labels", () => {
	assert.equal(edition.electionDate, "2030-11-05");
	assert.equal(catalog.documents.length, 22);
	assert.deepEqual(catalog.documents.find(item => item.form === 22)!.claims, [{ municipality: "Clark", labels: ["Ward 1", "District 2"] }]);
	const shared = readUnionSampleCatalog(editionBody.replace(documentUrl(22), documentUrl(2)), edition);
	assert.equal(shared.documents.length, 21);
	assert.equal(shared.documents.find(item => item.form === 2)!.claims.length, 2);
	const later = landing.replaceAll("2030", "2034").replaceAll("November 5", "November 7").replaceAll("november-5", "november-7");
	assert.equal(readUnionSampleEdition(later).electionDate, "2034-11-07");
	for (const body of [landing.replace("General Election</a>", "Primary Election</a>"), landing.replace("<h4>Current</h4>", ""), landing.replaceAll("November 5", "November 4"), landing.replace("<h4>Past</h4>", `<a href="/another">Another</a><h4>Past</h4>`), `${landing}<a href="/terms">Terms</a>`]) assert.throws(() => readUnionSampleEdition(body));
});

test("Union sample inventories reject missing municipalities, duplicated claims and unreviewed document hosts", () => {
	for (const body of [editionBody.replace("<h4>Winfield</h4>", "<h4>Other</h4>"), editionBody.replace(documentUrl(21), documentUrl(20)), editionBody.replace(documentUrl(22), `${documentUrl(22)}?download=1`), editionBody.replace(documentUrl(22), documentUrl(22).replace("https:", "http:")), editionBody.replace(documentUrl(22), documentUrl(22).replace("ucnj.org", "other.example")), editionBody.replace(documentUrl(22), documentUrl(22).replace("2030/09", "2029/09")), editionBody.replace("District 2</a>", "District 1</a>"), `${editionBody}<a href="/license">License</a>`]) assert.throws(() => readUnionSampleCatalog(body, edition));
	assert.throws(() => readUnionSampleCatalog(editionBody.replace("</div><a", "<a href=\"https://ucnj.org/extra.pdf\">Extra</a></div><a"), edition));
});

test("Union's two publisher policies retain exact robots directives and substantive privacy text", () => {
	assert.equal(unionCountyPolicyHash(`${countyRobots}\n`, "robots"), review.countyRobots);
	for (const body of [countyRobots.replace("/wp-admin/", "/"), `${countyRobots}User-agent: GPTBot\nDisallow: /`, `${countyRobots}Crawl-delay: 60`]) assert.throws(() => unionCountyPolicyHash(body, "robots"));
	assert.notEqual(unionCountyPolicyHash(countyPrivacy.replace("Reviewed county", "Updated county"), "privacy"), review.countyPrivacy);
	assert.throws(() => unionCountyPolicyHash(`${countyPrivacy}<a href="/terms">Terms</a>`, "privacy"));
	assert.throws(() => unionCountyPolicyHash(countyPrivacy.replace("Section G. Contact Information", ""), "privacy"));
});

test("Union sample acquisition paces each host from response completion and persists evidence before continuing", async () => {
	const native = network();
	const retained: string[] = [];
	const result = await collectUnionSampleBatch([1, 2], review, catalog.sha256, { ...native.options, onCapture: async (capture) => {
		retained.push(capture.role);
	} });
	assert.equal(result.captures.length, 9);
	assert.deepEqual(retained, result.captures.map(capture => capture.role));
	assert.equal(result.imported, false);
	assert.equal(result.publicationApproved, false);
	assert.ok(native.requests[0]!.requestedAt - Date.parse("2030-10-01T00:00:00Z") >= 31000);
	const completed = new Map<string, number>();
	for (const [index, request] of native.requests.entries()) {
		const host = new URL(request.url).hostname;
		assert.ok(request.requestedAt - (completed.get(host) ?? -Infinity) >= (host === "ucnj.org" ? 1100 : 31000));
		completed.set(host, request.completedAt);
		assert.equal(result.captures[index]!.capturedAt, new Date(request.completedAt).toISOString());
		assert.equal(result.captures[index]!.sha256, hash(result.captures[index]!.body));
	}
});

test("Union collection holds publisher denials, redirects, policy drift, invalid bounds and changed catalogs", async () => {
	for (const [target, change] of [[unionCandidatePolicyUrls[0], { body: unionRobots.replace("30", "1") }], [unionCandidatePolicyUrls[1], { body: unionPrivacy.replace("Reviewed public", "New public") }], [unionCountyPolicyUrls[0], { body: `${countyRobots}Disallow: /wp-content/` }], [unionCountyPolicyUrls[2], { body: countyPrivacy.replace("Reviewed county", "New county") }], [documentUrl(1), { status: 403 }], [documentUrl(1), { status: 302 }], [documentUrl(1), { body: "<html>challenge</html>" }], [documentUrl(1), { contentType: "text/html" }]] as const) {
		const native = network(url => url === target ? change : undefined);
		await assert.rejects(collectUnionSampleBatch([1, 2], review, catalog.sha256, native.options));
		assert.equal(native.requests.at(-1)!.url, target);
		assert.ok(!native.requests.some(request => request.url === documentUrl(2)));
	}
	for (const forms of [[], [1, 1], [0], [100], Array.from({ length: 26 }, (_, index) => index + 1)]) await assert.rejects(collectUnionSampleBatch(forms, review, null, network().options));
	const changed = network();
	await assert.rejects(collectUnionSampleBatch([1], review, "0".repeat(64), changed.options));
	assert.equal(changed.requests.at(-1)!.url, edition.url);
	const persistence = network();
	await assert.rejects(collectUnionSampleBatch([1], review, null, { ...persistence.options, onCapture: async () => {
		throw new Error("Storage unavailable");
	} }));
	assert.equal(persistence.requests.length, 1);
});

test("Union pacing waits again when a timer wakes before the target interval", async () => {
	const native = network();
	let earlyWakeups = 0;
	await collectUnionSampleBatch([1, 2], review, catalog.sha256, { ...native.options, sleep: async (delay) => {
		if (delay > 1) {
			earlyWakeups++;
			await native.options.sleep(delay - 1);
		}
		else {
			await native.options.sleep(delay);
		}
	} });
	assert.ok(earlyWakeups > 1);
	const completed = new Map<string, number>();
	for (const request of native.requests) {
		const host = new URL(request.url).hostname;
		assert.ok(request.requestedAt - (completed.get(host) ?? -Infinity) >= (host === "ucnj.org" ? 1100 : 31000));
		completed.set(host, request.completedAt);
	}
});

test("Union native sample cells separate adjacent rows and preserve literal name discrepancies", () => {
	const roselle = catalog.documents.find(item => item.claims[0]!.municipality === "Roselle")!;
	const input = document(roselle.form);
	const cells = readUnionBallotCells(input.bbox, input.layout, roselle, edition.electionDate);
	assert.deepEqual(cells.find(cell => cell.position === "1-2"), { page: 1, position: "1-2", observedName: "Antoinette BOWERS", nameWordCount: 2 });
	assert.equal(cells.find(cell => cell.position === "1-3")!.observedName, "Joseph LECONTE");
	const samples = catalog.documents.map((source) => {
		const native = document(source.form);
		return { form: source.form, cells: readUnionBallotCells(native.bbox, native.layout, source, edition.electionDate), sourceUrl: source.url, sourceSha256: "b".repeat(64), capturedAt: "2030-10-01T00:00:00.000Z" };
	});
	const rows = reconcileUnionBallotReferences(references, catalog, samples);
	assert.deepEqual(rows.map(row => row.status), ["name-and-position-corroborated", "name-and-position-corroborated", "review-required"]);
	assert.equal(rows[2]!.reference.name, "Ann Marie Weiss");
	assert.equal(rows[2]!.positionEvidence[0]!.observedName, "Anne Marie WEISS");
	assert.equal(rows[2]!.reviewReason, "different-visible-name-at-position");
	assert.ok(rows.every(row => !row.qualificationVerified && !row.officeAndPartyVerified && !row.personalApplicabilityVerified && !row.publicationApproved));
	assert.throws(() => reconcileUnionBallotReferences(references, catalog, samples.slice(1)));
	assert.throws(() => reconcileUnionBallotReferences(references, catalog, [...samples, samples[0]!]));
});

test("Union sample native identity requires matching form, election, municipality and single-page dimensions", () => {
	const source = catalog.documents[0]!;
	const input = document(source.form);
	for (const [bbox, layout] of [[input.bbox.replace("1824", "1800"), input.layout], [input.bbox, input.layout.replace("FORM 1", "FORM 2")], [input.bbox, input.layout.replace("NOVEMBER 5", "NOVEMBER 6")], [input.bbox.replace("USED ON NOVEMBER 5", "USED ON NOVEMBER 6"), input.layout], [input.bbox, input.layout.replace("SAMPLE BALLOT", "PRIMARY BALLOT")], [input.bbox, input.layout.replace("Berkeley Heights", "Other")], [input.bbox, `${input.layout}${input.layout}`], [input.bbox.replaceAll("xmin=\"430\"", "xmin=\"-1\""), input.layout]]) assert.throws(() => readUnionBallotCells(bbox!, layout!, source, edition.electionDate));
	const noName = document(source.form, words => words.filter(word => !["Cory", "BOOKER"].includes(word.value)));
	assert.equal(readUnionBallotCells(noName.bbox, noName.layout, source, edition.electionDate).find(cell => cell.position === "1A")!.observedName, "");
});

test("Union persistent sample custody and pinned offline preparation replay exactly without source requests", async () => {
	const root = await mkdtemp(join(tmpdir(), "union-ballot-evidence-"));
	try {
		const collectionPath = join(root, "collect.json");
		await writeFile(collectionPath, JSON.stringify({ schemaVersion: 1, type: "union-sample-ballot-collection", outputRoot: join(root, "intakes"), forms: catalog.documents.map(source => source.form), accessReview: review, catalogSha256: catalog.sha256 }));
		const collect: typeof collectUnionSampleBatch = async (forms, access, expected, options) => collectUnionSampleBatch(forms, access, expected, { ...network().options, onCapture: options!.onCapture });
		const first = await collectUnionBallotEvidence(collectionPath, { collect });
		const second = await collectUnionBallotEvidence(collectionPath, { collect });
		assert.notEqual(first.outputDirectory, second.outputDirectory);
		const capturePath = join(first.outputDirectory, "capture.json");
		const original = await readFile(capturePath);
		const candidatePath = join(root, "candidate-preparation.json");
		const candidateBody = JSON.stringify({ schemaVersion: 1, type: "union-candidate-research-preparation", references, publicationApproved: false, qualificationVerified: false });
		await writeFile(candidatePath, candidateBody);
		const plan = { schemaVersion: 1, type: "union-ballot-corroboration", candidatePreparation: { path: candidatePath, sha256: hash(candidateBody) }, ballotCaptures: [{ path: capturePath, sha256: hash(original) }], outputRoot: join(root, "prepared") };
		const path = join(root, "prepare.json");
		await writeFile(path, JSON.stringify(plan));
		const options = { extract, now: () => Date.parse("2030-10-02T00:00:00Z") };
		const prepared = await prepareUnionBallotCorroboration(path, options);
		const repeated = await prepareUnionBallotCorroboration(path, options);
		assert.equal(prepared.sha256, repeated.sha256);
		assert.equal(prepared.corroborated, 2);
		assert.equal(prepared.reviewRequired, 1);
		assert.equal(prepared.publisherRequests, 0);
		assert.deepEqual(await readFile(join(prepared.outputDirectory, "corroboration.csv")), await readFile(join(repeated.outputDirectory, "corroboration.csv")));
		assert.match(await readFile(join(prepared.outputDirectory, "corroboration.csv"), "utf8"), /"Ann Marie Weiss".*"Anne Marie WEISS"/u);
		assert.deepEqual(await readFile(capturePath), original);
		const inventory = JSON.parse(original.toString());
		const before = await readdir(plan.outputRoot);
		for (const altered of [{ ...plan, extra: true }, { ...plan, candidatePreparation: { ...plan.candidatePreparation, sha256: "0".repeat(64) } }, { ...plan, ballotCaptures: [...plan.ballotCaptures, ...plan.ballotCaptures] }]) {
			await writeFile(path, JSON.stringify(altered));
			await assert.rejects(prepareUnionBallotCorroboration(path, options));
		}
		await writeFile(path, JSON.stringify(plan));
		await assert.rejects(prepareUnionBallotCorroboration(path, { ...options, now: () => Date.parse("2029-10-02T00:00:00Z") }));
		const altered = { ...inventory, inputs: inventory.inputs.map((input: { role: string; requestedAt: string }) => input.role === "sample-landing" ? { ...input, requestedAt: inventory.inputs[4].capturedAt } : input) };
		await writeFile(capturePath, JSON.stringify(altered));
		await writeFile(path, JSON.stringify({ ...plan, ballotCaptures: [{ path: capturePath, sha256: hash(JSON.stringify(altered)) }] }));
		await assert.rejects(prepareUnionBallotCorroboration(path, options), /spacing/u);
		await writeFile(capturePath, original);
		await writeFile(path, JSON.stringify(plan));
		await writeFile(join(first.outputDirectory, inventory.inputs.at(-1).path), "%PDF-tampered");
		await assert.rejects(prepareUnionBallotCorroboration(path, options));
		assert.deepEqual(await readdir(plan.outputRoot), before);
		const alias = join(root, "alias.json");
		await symlink(path, alias);
		await assert.rejects(prepareUnionBallotCorroboration(alias, options));
	}
	finally { await rm(root, { recursive: true, force: true }); }
});

test("Union incomplete sample acquisition retains originals and metadata without a completed capture", async () => {
	const root = await mkdtemp(join(tmpdir(), "union-ballot-interrupted-"));
	try {
		const path = join(root, "plan.json");
		const outputRoot = join(root, "intakes");
		await writeFile(path, JSON.stringify({ schemaVersion: 1, type: "union-sample-ballot-collection", outputRoot, forms: [1, 2], accessReview: review, catalogSha256: catalog.sha256 }));
		const collect: typeof collectUnionSampleBatch = async (forms, access, expected, options) => collectUnionSampleBatch(forms, access, expected, { ...network(url => url === documentUrl(2) ? { status: 503 } : undefined).options, onCapture: options!.onCapture });
		await assert.rejects(collectUnionBallotEvidence(path, { collect }));
		const intake = (await readdir(outputRoot)).find(name => name.startsWith("intake-"))!;
		const files = await readdir(join(outputRoot, intake));
		assert.ok(files.includes("form-1.metadata.json"));
		assert.ok(!files.includes("capture.json"));
		assert.ok(!files.includes("form-2.metadata.json"));
	}
	finally { await rm(root, { recursive: true, force: true }); }
});

test("Union public-question extraction preserves both publisher languages and printed choices without drafting meanings", () => {
	const source = catalog.documents.find(item => item.claims[0]!.municipality === "Elizabeth")!;
	const native = questionDocument(source.form);
	const question = readUnionSampleQuestion(native.bbox, native.layout, source, edition.electionDate)!;
	assert.equal(question.municipality, "Elizabeth");
	assert.match(question.officialText.en, /twenty dollars\?$/u);
	assert.match(question.officialText.es, /^¿Debe/u);
	assert.match(question.interpretiveStatement.en, /^Approval restores/u);
	assert.match(question.interpretiveStatement.es, /^La aprobación/u);
	assert.deepEqual(question.printedChoices, ["YES/SÍ", "NO"]);
	assert.equal(question.page, 1);
	const blank = document(source.form);
	assert.equal(readUnionSampleQuestion(blank.bbox, blank.layout, source, edition.electionDate), null);
	const future = readUnionSampleQuestion(native.bbox.replaceAll("NOVEMBER 5, 2030", "NOVEMBER 7, 2034"), native.layout.replaceAll("NOVEMBER 5, 2030", "NOVEMBER 7, 2034"), source, "2034-11-07")!;
	assert.deepEqual(future, question);
});

test("Union question layouts hold missing translations, unknown headings, clipped text and dual-extraction differences", () => {
	const source = catalog.documents[0]!;
	const changes: ((words: Word[]) => Word[])[] = [
		words => words.filter(word => word.value !== "PREGUNTA:"),
		words => [...words, words.find(word => word.value === "QUESTION:")!],
		words => words.map(word => word.value === "QUESTION:" ? { ...word, value: "QUESTION ONE:" } : word),
		words => words.map(word => word.value === "NO" ? { ...word, value: "MAYBE" } : word),
		words => words.map(word => word.value.startsWith("Shall") ? { ...word, width: 600 } : word),
		words => words.map(word => word.value.startsWith("Shall") ? { ...word, left: 110 } : word),
		words => [...words, { value: "Unreviewed continuation beyond the panel", left: 128, top: 1201, width: 480, size: 14.88 }],
		words => [...words, { value: "Additional unexplained panel heading", left: 200, top: 1000, width: 400, size: 20 }],
	];
	for (const change of changes) {
		const native = questionDocument(source.form, change);
		assert.throws(() => readUnionSampleQuestion(native.bbox, native.layout, source, edition.electionDate));
	}
	const native = questionDocument(source.form);
	assert.throws(() => readUnionSampleQuestion(native.bbox, native.layout.replace("twenty dollars", "forty dollars"), source, edition.electionDate));
});

test("Union complete pinned question preparation is repeatable and rejects conflicting forms or partial capture sets", async () => {
	const root = await mkdtemp(join(tmpdir(), "union-public-questions-"));
	try {
		const collectPath = join(root, "collect.json");
		await writeFile(collectPath, JSON.stringify({ schemaVersion: 1, type: "union-sample-ballot-collection", outputRoot: join(root, "intakes"), forms: catalog.documents.map(source => source.form), accessReview: review, catalogSha256: catalog.sha256 }));
		const collect: typeof collectUnionSampleBatch = async (forms, access, expected, options) => collectUnionSampleBatch(forms, access, expected, { ...network().options, onCapture: options!.onCapture });
		const intake = await collectUnionBallotEvidence(collectPath, { collect });
		const capturePath = join(intake.outputDirectory, "capture.json");
		const original = await readFile(capturePath);
		const plan = { schemaVersion: 1, type: "union-ballot-question-preparation", ballotCaptures: [{ path: capturePath, sha256: hash(original) }], outputRoot: join(root, "prepared") };
		const path = join(root, "questions.json");
		await writeFile(path, JSON.stringify(plan));
		const extraction = (changed = false) => async (body: Buffer, format: "layout" | "bbox-layout") => {
			const form = Number(/form-(\d+)$/u.exec(body.toString())?.[1]);
			const parsed = [2, 22].includes(form) ? questionDocument(form, words => words.map(word => changed && form === 22 && word.value.startsWith("Shall") ? { ...word, value: word.value.replace("twenty", "thirty") } : word)) : document(form);
			return format === "layout" ? parsed.layout : parsed.bbox;
		};
		const options = { extract: extraction(), now: () => Date.parse("2030-10-02T00:00:00Z") };
		const first = await prepareUnionBallotQuestions(path, options);
		const second = await prepareUnionBallotQuestions(path, options);
		assert.equal(first.sha256, second.sha256);
		assert.equal(first.questions, 1);
		assert.equal(first.sampleForms, 22);
		assert.deepEqual(first.questionForms, [2, 22]);
		assert.equal(first.publisherRequests, 0);
		const report = JSON.parse(await readFile(join(first.outputDirectory, "questions.json"), "utf8"));
		assert.equal(report.questions[0].sources.length, 2);
		assert.equal(report.questions[0].question.municipality, "Clark");
		assert.equal(report.questions[0].sources[0].capturedAt, JSON.parse(original.toString()).inputs.find((input: { role: string }) => input.role === "form-2").capturedAt);
		for (const field of ["translationEquivalenceVerified", "currentLawIndependentlyVerified", "voterApplicabilityVerified", "substantiveReviewComplete", "imported", "publicationApproved", "automaticImportApproved"]) assert.equal(report[field], false);
		assert.deepEqual(await readFile(join(first.outputDirectory, "questions.csv")), await readFile(join(second.outputDirectory, "questions.csv")));
		const before = await readdir(plan.outputRoot);
		await assert.rejects(prepareUnionBallotQuestions(path, { ...options, extract: extraction(true) }), /conflicting/u);
		for (const altered of [{ ...plan, extra: true }, { ...plan, ballotCaptures: [] }, { ...plan, ballotCaptures: [{ path: capturePath, sha256: "0".repeat(64) }] }]) {
			await writeFile(path, JSON.stringify(altered));
			await assert.rejects(prepareUnionBallotQuestions(path, options));
		}
		const partial = JSON.parse(original.toString());
		partial.selected.pop();
		partial.inputs.pop();
		await writeFile(capturePath, JSON.stringify(partial));
		await writeFile(path, JSON.stringify({ ...plan, ballotCaptures: [{ path: capturePath, sha256: hash(JSON.stringify(partial)) }] }));
		await assert.rejects(prepareUnionBallotQuestions(path, options), /complete/u);
		assert.deepEqual(await readdir(plan.outputRoot), before);
		await writeFile(capturePath, original);
		assert.deepEqual(await readFile(capturePath), original);
	}
	finally { await rm(root, { recursive: true, force: true }); }
});

test("Union choice evidence binds printed offices, multi-seat rows, Congress districts and literal party headers", () => {
	const source = catalog.documents[0]!;
	const input = contextDocument(source.form);
	const cells = readUnionChoiceContext(input.bbox, input.layout, source, edition.electionDate);
	assert.equal(cells.find(cell => cell.position === "1A")!.printedPartyOrColumn, "Democrat");
	assert.equal(cells.find(cell => cell.position === "1C")!.printedPartyOrColumn, "Nomination by Petition");
	assert.ok(["5A", "6A", "7A"].every(position => cells.find(cell => cell.position === position)!.printedOffice === "Members of Board of County Commissioners"));
	const house = cells.find(cell => cell.position === "2A")!;
	assert.equal(house.congressionalDistrict, 7);
	assert.ok(unionOfficeCorroborated("MEMBER OF HOUSE OF REPRESENTATIVES (7 th CONGRESSIONAL DISTRICT)", house));
	assert.ok(!unionOfficeCorroborated("MEMBER OF HOUSE OF REPRESENTATIVES (8 th CONGRESSIONAL DISTRICT)", house));
	assert.ok(unionOfficeCorroborated("School Board", cells.find(cell => cell.position === "1-1")!));
	const swapped = contextDocument(source.form, words => words.map(word => word.value === "Democrat" ? { ...word, value: "Republican" } : word));
	assert.equal(readUnionChoiceContext(swapped.bbox, swapped.layout, source, edition.electionDate).find(cell => cell.position === "1A")!.printedPartyOrColumn, "Republican");
});

test("Union lower nonpartisan and school panels preserve distinct office and party evidence", () => {
	const source = catalog.documents.find(document => document.claims[0]!.municipality === "Hillside")!;
	const input = contextDocument(source.form);
	const cells = readUnionChoiceContext(input.bbox, input.layout, source, edition.electionDate);
	const municipal = cells.find(cell => cell.observedName === "Local CITIZEN")!;
	const school = cells.find(cell => cell.observedName === "Anne Marie WEISS")!;
	assert.equal(municipal.position, "1C");
	assert.equal(municipal.panel, "municipal-nonpartisan");
	assert.equal(municipal.printedPartyOrColumn, "Non-Partisan");
	assert.equal(school.panel, "school");
	assert.equal(school.printedPartyOrColumn, "");
	assert.ok(unionOfficeCorroborated("1 st Ward Council Member", municipal));
	assert.ok(!unionOfficeCorroborated("2 nd Ward Council Member", municipal));
	assert.ok(!unionOfficeCorroborated("Member of Council - unexpired", { ...municipal, printedSelections: ["3 Year Term - Vote for One"] }));
});

test("Union office word boundaries separate merged bilingual lines and preserve long publication footers", () => {
	const source = catalog.documents[0]!;
	const input = contextDocument(source.form, words => [...words, { value: "10th Ward Council Member", left: 375, top: 600, width: 113, size: 10.692 }, { value: "3 Year Term - Vote for One", left: 385, top: 612, width: 90, size: 8.379 }, { value: "Town", left: 650, top: 591, width: 70, size: 12.5 }, { value: "PERSON", left: 650, top: 601, width: 70, size: 18.75 }, { value: "8A", left: 739, top: 600, width: 13, size: 21.1 },]);
	const spanish = "<word xmin=\"492\" xmax=\"620\" ymin=\"600\" ymax=\"610.692\">Miembro del Consejo Barrio 10</word>";
	const merged = input.bbox.replace(/(<line xmin="375" xmax=")488(" ymin="600"[^>]*>)(.*?)(<\/line>)/u, (_match, prefix, suffix, content, closing) => `${prefix}620${suffix}${content}${spanish}${closing}`);
	assert.notEqual(merged, input.bbox);
	const footer = "<line xmin=\"373\" xmax=\"580\" ymin=\"700\" ymax=\"712.134416\"><word xmin=\"373\" xmax=\"405\" ymin=\"700\" ymax=\"712.134416\">Master</word><word xmin=\"408\" xmax=\"425\" ymin=\"700\" ymax=\"712.134416\">7th</word><word xmin=\"428\" xmax=\"432\" ymin=\"700\" ymax=\"712.134416\">-</word><word xmin=\"435\" xmax=\"535\" ymin=\"700\" ymax=\"712.134416\">Berkeley Heights,</word><word xmin=\"538\" xmax=\"560\" ymin=\"700\" ymax=\"712.134416\">Form</word><word xmin=\"563\" xmax=\"570\" ymin=\"700\" ymax=\"712.134416\">1</word></line>";
	const bbox = merged.replace("</page>", `${footer}</page>`);
	const layout = input.layout.replace("\f", "\nMiembro del Consejo Barrio 10\nMaster 7th - Berkeley Heights, Form 1\f");
	const cells = readUnionChoiceContext(bbox, layout, source, edition.electionDate);
	assert.equal(cells.find(cell => cell.position === "8A")!.printedOffice, "10th Ward Council Member");
});

test("Union office evidence rejects changed row counts, clipped columns, unknown parties and missing lower headers", () => {
	const source = catalog.documents[0]!;
	for (const change of [
		(words: Word[]) => words.map(word => word.value === "3 Year Term - Vote for Three" && word.top < 700 ? { ...word, value: "3 Year Term - Vote for Two" } : word),
		(words: Word[]) => words.map(word => word.value === "Democrat" ? { ...word, value: "Unreviewed Party" } : word),
		(words: Word[]) => words.filter(word => !word.value.startsWith("OFFICIAL SCHOOL")),
		(words: Word[]) => words.map(word => word.value === "Sheriff" ? { ...word, width: 100 } : word),
		(words: Word[]) => words.filter(word => word.value !== "7A"),
		(words: Word[]) => words.map(word => word.value.startsWith("7th Congressional") ? { ...word, value: "7th Congressional District - November 6, 2030" } : word),
	]) {
		const input = contextDocument(source.form, change);
		assert.throws(() => readUnionChoiceContext(input.bbox, input.layout, source, edition.electionDate));
	}
	const input = contextDocument(source.form);
	assert.throws(() => readUnionChoiceContext(input.bbox, input.layout.replace("County Clerk", "County Office"), source, edition.electionDate));
});

test("Union office/party review preserves parent facts and clocks across exact replay while retaining source-only classifications", async () => {
	const root = await mkdtemp(join(tmpdir(), "union-choice-context-"));
	try {
		const collectionPath = join(root, "collect.json");
		await writeFile(collectionPath, JSON.stringify({ schemaVersion: 1, type: "union-sample-ballot-collection", outputRoot: join(root, "intakes"), forms: catalog.documents.map(document => document.form), accessReview: review, catalogSha256: catalog.sha256 }));
		const collect: typeof collectUnionSampleBatch = async (forms, access, expected, options) => collectUnionSampleBatch(forms, access, expected, { ...network().options, onCapture: options!.onCapture });
		const intake = await collectUnionBallotEvidence(collectionPath, { collect });
		const capturePath = join(intake.outputDirectory, "capture.json");
		const captured = await readFile(capturePath);
		const local = reference("Local Citizen", "1C", "Hillside", "general");
		const parentReferences = [references[0]!, { ...reference("Veronica Fernandez", "1C", "UNION COUNTY", "general"), partyCode: "Ind" }, reference("Anne Marie Weiss", "1-1", "Winfield"), reference("Ann Marie Weiss", "1-1", "Winfield"), { ...local, office: "1st Ward Council Member", partyCode: "" }];
		const parentBody = JSON.stringify({ schemaVersion: 1, type: "union-ballot-corroboration-review", publicationApproved: false, qualificationVerified: false, catalog, references: parentReferences.map(reference => ({ reference })) });
		const parentPath = join(root, "parent.json");
		await writeFile(parentPath, parentBody);
		const plan = { schemaVersion: 1, type: "union-choice-context-review", candidateCorroboration: { path: parentPath, sha256: hash(parentBody) }, ballotCaptures: [{ path: capturePath, sha256: hash(captured) }], outputRoot: join(root, "prepared") };
		const path = join(root, "prepare.json");
		await writeFile(path, JSON.stringify(plan));
		const options = { now: () => Date.parse("2030-10-02T00:00:00Z"), extract: async (body: Buffer, format: "layout" | "bbox-layout") => {
			const form = Number(/form-(\d+)$/u.exec(body.toString())?.[1]);
			const input = contextDocument(form);
			return format === "layout" ? input.layout : input.bbox;
		} };
		const first = await prepareUnionChoiceReview(path, options);
		const second = await prepareUnionChoiceReview(path, options);
		assert.equal(first.sha256, second.sha256);
		assert.equal(first.officesCorroborated, 4);
		assert.equal(first.partiesCorroborated, 1);
		assert.deepEqual(first.partyStatusCounts, { "corroborated": 1, "petition-column-only": 1, "blank-retained": 1, "no-name-match": 1, "explicit-nonpartisan": 1 });
		const report = JSON.parse(await readFile(join(first.outputDirectory, "choice-context.json"), "utf8"));
		assert.deepEqual(report.references.map((row: { reference: unknown }) => row.reference), parentReferences);
		assert.equal(report.publisherRequests, 0);
		assert.equal(report.qualificationVerified, false);
		assert.equal(report.publicationApproved, false);
		assert.equal(report.references[0].witnesses[0].capturedAt, JSON.parse(captured.toString()).inputs.find((input: { role: string }) => input.role === "form-1").capturedAt);
		assert.deepEqual(await readFile(join(first.outputDirectory, "choice-context.csv")), await readFile(join(second.outputDirectory, "choice-context.csv")));
		assert.deepEqual(await readFile(join(first.outputDirectory, "unlinked-printed-choices.csv")), await readFile(join(second.outputDirectory, "unlinked-printed-choices.csv")));
		assert.equal(report.excludedPositionCells.length, 22);
		assert.ok(report.unlinkedSampleChoices.some((cell: { observedName: string }) => cell.observedName === "Person2 EXAMPLE"));
		assert.ok(report.unlinkedSampleChoices.every((cell: { observedName: string }) => cell.observedName !== "NO PETITION FILED" && cell.observedName !== "Ann Marie Weiss"));
		const changed = await prepareUnionChoiceReview(path, { ...options, extract: async (body, format) => (await options.extract(body, format)).replaceAll("Democrat", "Republican") });
		const changedReport = JSON.parse(await readFile(join(changed.outputDirectory, "choice-context.json"), "utf8"));
		assert.equal(changedReport.references[0].reference.partyCode, "Dem");
		assert.equal(changedReport.references[0].partyStatus, "review-required");
		assert.equal(changedReport.references[0].partyCorroborated, false);
		const before = await readdir(plan.outputRoot);
		for (const altered of [{ ...plan, extra: true }, { ...plan, candidateCorroboration: { path: parentPath, sha256: "0".repeat(64) } }, { ...plan, ballotCaptures: [] }]) {
			await writeFile(path, JSON.stringify(altered));
			await assert.rejects(prepareUnionChoiceReview(path, options));
		}
		assert.deepEqual(await readdir(plan.outputRoot), before);
		assert.deepEqual(await readFile(capturePath), captured);
		assert.equal(await readFile(parentPath, "utf8"), parentBody);
	}
	finally { await rm(root, { recursive: true, force: true }); }
});
