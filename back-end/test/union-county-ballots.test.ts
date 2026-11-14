import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { collectUnionBallotEvidence } from "../src/collect-union-ballot-evidence.js";
import { prepareUnionBallotCorroboration } from "../src/prepare-union-ballot-corroboration.js";
import { readUnionBallotCells, reconcileUnionBallotReferences } from "../src/union-ballot-witnesses.js";
import { collectUnionSampleBatch, readUnionSampleCatalog, readUnionSampleEdition, unionCountyPolicyHash, unionCountyPolicyUrls, unionSampleLandingUrl } from "../src/union-county-ballots.js";
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
			const original = url === unionCandidatePolicyUrls[0] ? unionRobots : url === unionCandidatePolicyUrls[1] ? unionPrivacy : url === unionCountyPolicyUrls[0] ? countyRobots : url === unionCountyPolicyUrls[1] ? countyLink : url === unionCountyPolicyUrls[2] ? countyPrivacy : url === unionSampleLandingUrl ? landing : url === edition.url ? editionBody : form ? `%PDF-form-${form}` : assert.fail("Unexpected source URL");
			const altered = change?.(url);
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
	return { layout: `${words.map(word => word.value).join("\n")}\f`, bbox: `<doc><page width="1824" height="1284">${words.map(word => `<word xmin="${word.left}" xmax="${word.left + (word.width ?? 50)}" ymin="${word.top}" ymax="${word.top + (word.size ?? 10)}">${escape(word.value)}</word>`).join("")}</page></doc>` };
}

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
	for (const [bbox, layout] of [[input.bbox.replace("1824", "1800"), input.layout], [input.bbox, input.layout.replace("FORM 1", "FORM 2")], [input.bbox, input.layout.replace("NOVEMBER 5", "NOVEMBER 6")], [input.bbox.replace("USED ON NOVEMBER 5", "USED ON NOVEMBER 6"), input.layout], [input.bbox, input.layout.replace("SAMPLE BALLOT", "PRIMARY BALLOT")], [input.bbox, input.layout.replace("Berkeley Heights", "Other")], [input.bbox, `${input.layout}${input.layout}`], [input.bbox.replace("xmin=\"430\"", "xmin=\"-1\""), input.layout]]) assert.throws(() => readUnionBallotCells(bbox!, layout!, source, edition.electionDate));
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
