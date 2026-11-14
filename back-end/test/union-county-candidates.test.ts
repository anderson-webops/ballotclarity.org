import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { collectUnionCandidateResearch, prepareUnionCandidateResearch } from "../src/collect-union-candidate-research.js";
import { collectUnionCandidateDocuments, readUnionCandidateEdition, readUnionCandidateReferences, unionCandidateDocumentUrl, unionCandidateHash, unionCandidateIndexUrl, unionCandidateOrigin, unionCandidatePolicyHash, unionCandidatePolicyUrls } from "../src/union-county-candidates.js";

const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const link = `<a href="${unionCandidatePolicyUrls[1]}">Privacy Policy</a>`;
const generalUrl = `${unionCandidateOrigin}/wp-content/uploads/2030/09/GENERAL-2030.pdf`;
const schoolUrl = `${unionCandidateOrigin}/wp-content/uploads/2030/08/SCHOOL-2030.pdf`;
const index = `<div class="entry-content"><p>2030 General Election</p><ul><li><a href="${generalUrl}">General Election Candidates</a><ul><li>As of 9-3-2030</li></ul></li><li><a href="${schoolUrl}">School Board Candidates</a><ul><li>A<em>s of 8-12-2030</em></li></ul></li></ul><p>2029 General Election</p><ul><li>Older reviewed editions remain separate.</li></ul></div>${link}`;
const privacy = `<div class="entry-content">COUNTY OF UNION, NEW JERSEY Thank you for reviewing our Privacy Notice. Section F. Disclaimer Public source policy fixture. Section G. Contact Information</div>${link}`;
const robots = "User-agent: *\nCrawl-delay: 30\n";
const review = { robots: unionCandidatePolicyHash(robots, "robots"), privacy: unionCandidatePolicyHash(privacy, "privacy") };
const edition = readUnionCandidateEdition(index);
interface Field { value: string; left: number; top: number; width?: number }
function line(field: Field) {
	const right = field.left + (field.width ?? 35);
	return `<line xmin="${field.left}" xmax="${right}" ymin="${field.top}" ymax="${field.top + 10}"><word xmin="${field.left}" xmax="${right}" ymin="${field.top}" ymax="${field.top + 10}">${escape(field.value)}</word></line>`;
}
function document(kind: "general" | "school", change: (fields: Field[]) => Field[] = fields => fields) {
	const fields: Field[] = [
		{ value: "REFRAIN FROM PUBLISHING LITERATURE UNTIL POSITIONS ARE CONFIRMED, SEPTEMBER 1ST.", left: 250, top: 38 },
		{ value: "UNION COUNTY DEPUTY CLERK", left: 350, top: 75 },
		{ value: `CANDIDATE LIST FOR THE ${kind === "general" ? "GENERAL" : "SCHOOL BOARD"} ELECTION`, left: 350, top: 98 },
		{ value: "NOVEMBER 5, 2030", left: 450, top: 122 },
		{ value: kind === "general" ? "UNITED STATES SENATOR" : "TOWNSHIP OF CLARK", left: 400, top: 145 },
		...(["POSITION", "CANDIDATE", "ADDRESS", ...(kind === "general" ? ["PARTY"] : []), "SLOGAN", "TERM", "EMAIL ADDRESS"]).map((value, column) => ({ value, left: 60 + column * 125, top: 170 })),
		{ value: kind === "general" ? "1A" : "1-1", left: 60, top: 200 },
		{ value: "Example Person", left: 185, top: 200 },
		{ value: "Private address", left: 310, top: 200 },
		...(kind === "general" ? [{ value: "Dem", left: 435, top: 200 }] : []),
		{ value: "Campaign slogan", left: kind === "general" ? 560 : 435, top: 200 },
		{ value: "3 Yrs", left: kind === "general" ? 685 : 560, top: 200 },
		{ value: "personal@example.invalid", left: kind === "general" ? 810 : 685, top: 200 },
		{ value: "3 YEAR TERM - VOTE FOR ONE", left: 72, top: 350 },
		{ value: kind === "general" ? "9/3/2030" : "8/12/2030", left: 72, top: 564 },
	];
	const edited = change(fields);
	return { bbox: `<doc><page width="1008" height="612">${edited.map(line).join("")}</page></doc>`, layout: `${edited.map(field => field.value).join("\n")}\f` };
}
function network(change?: (url: string) => { body?: string; status?: number; contentType?: string } | undefined) {
	let now = Date.parse("2030-10-01T00:00:00Z");
	const requests: { url: string; time: number }[] = [];
	const options = {
		now: () => now,
		sleep: async (delay: number) => { now += delay; },
		fetchDocument: async (url: string, transport: { allowedHosts?: readonly string[]; timeoutMs?: number; maxBytes?: number }) => {
			assert.deepEqual(transport.allowedHosts, ["unioncountyvotes.com"]);
			assert.equal(transport.timeoutMs, 20000);
			assert.ok(transport.maxBytes! <= 12 * 1024 * 1024);
			requests.push({ url, time: now });
			const body = url === unionCandidatePolicyUrls[0] ? robots : url === unionCandidatePolicyUrls[1] ? privacy : url === unionCandidateIndexUrl ? index : url === generalUrl ? "%PDF-general" : url === schoolUrl ? "%PDF-school" : assert.fail("Unexpected source URL");
			const altered = change?.(url);
			return { status: altered?.status ?? 200, body: Buffer.from(altered?.body ?? body), contentType: altered?.contentType ?? (url.endsWith(".pdf") ? "application/pdf" : "text/html"), etag: undefined };
		},
	};
	return { options, requests };
}
async function extract(bytes: Buffer, format: "layout" | "bbox-layout") {
	const data = document(bytes.toString().endsWith("school") ? "school" : "general");
	return format === "layout" ? data.layout : data.bbox;
}

test("Union discovery selects only the latest explicitly offered general edition and paired dated lists", () => {
	assert.equal(edition.year, 2030);
	assert.deepEqual(edition.documents.map(document => [document.kind, document.sourceAsOfDate]), [["general", "2030-09-03"], ["school", "2030-08-12"]]);
	assert.equal(readUnionCandidateEdition(index.replaceAll("2030", "2034")).year, 2034);
	for (const body of [index.replace("2030 General Election", "2030 Primary Election"), index.replace("School Board Candidates", "Candidate List"), index.replace("8-12-2030", "8-12-2029"), index.replace("9-3-2030", "2-31-2030"), index.replace("</div>", "<p>2030 General Election</p></div>"), `${index}<a href="/terms">New terms</a>`, index.replace(generalUrl, schoolUrl)]) assert.throws(() => readUnionCandidateEdition(body));
	for (const url of [generalUrl.replace("https:", "http:"), generalUrl.replace("unioncountyvotes.com", "other.example"), `${generalUrl}?download=1`, `${generalUrl}#page=1`, generalUrl.replace("/2030/", "/2029/"), generalUrl.replace("unioncountyvotes.com", "user:password@unioncountyvotes.com")]) assert.throws(() => unionCandidateDocumentUrl(url, 2030));
});

test("Union source review pins the complete robots policy and substantive privacy region", () => {
	assert.equal(unionCandidatePolicyHash(`${robots}\n`, "robots"), review.robots);
	for (const body of [robots.replace("30", "10"), `${robots}User-agent: GPTBot\nDisallow: /`, `${robots}Disallow: /wp-content/`]) assert.throws(() => unionCandidatePolicyHash(body, "robots"));
	assert.notEqual(unionCandidatePolicyHash(privacy.replace("Public source", "Changed source"), "privacy"), review.privacy);
	assert.throws(() => unionCandidatePolicyHash(`${privacy}<a href="/new-terms">Terms</a>`, "privacy"));
});

test("Union native research preserves literal fields without publishing private contact data or inferred roles", () => {
	for (const kind of ["general", "school"] as const) {
		const input = document(kind);
		const parsed = readUnionCandidateReferences(input.bbox, input.layout, kind, edition);
		assert.equal(parsed.electionDate, "2030-11-05");
		assert.equal(parsed.references.length, 1);
		assert.equal(parsed.references[0]!.partyCode, kind === "general" ? "Dem" : "");
		assert.equal(parsed.references[0]!.termLabel, "3 Yrs");
		assert.equal(parsed.qualificationVerified, false);
		assert.equal(parsed.positionConfirmationVerified, false);
		assert.equal(parsed.personalApplicabilityVerified, false);
		assert.doesNotMatch(JSON.stringify(parsed), /Private address|personal@example|Campaign slogan|incumbent|unopposed/u);
	}
});

test("Union native guards require every page, date, original as-of date and comparison field", () => {
	const input = document("general");
	for (const body of [input.bbox.replace("width=\"1008\"", "width=\"1007\""), input.bbox.replace("NOVEMBER 5, 2030", "NOVEMBER 3, 2028"), input.bbox.replace("9/3/2030", "9/4/2030"), input.bbox.replace(">Dem<", ">Unknown<"), input.bbox.replace("CANDIDATE LIST FOR THE GENERAL", "CANDIDATE LIST FOR THE PRIMARY"), input.bbox.replace("UNITED STATES SENATOR", "Unreviewed office"), input.bbox.replace("Example Person", "Changed Name"), input.bbox.replace("3 Yrs", ""), input.bbox.replace("1A", "XX")]) assert.throws(() => readUnionCandidateReferences(body, input.layout, "general", edition));
	assert.throws(() => readUnionCandidateReferences(input.bbox, `${input.layout}${input.layout}`, "general", edition));
	assert.throws(() => readUnionCandidateReferences(input.bbox.replace("</doc>", `${input.bbox.replace("NOVEMBER 5", "NOVEMBER 6")}</doc>`), input.layout + input.layout, "general", edition));
});

test("Union blank parties stay blank, and nomination placeholders and empty schools create no people", () => {
	const blank = document("general", fields => fields.filter(field => field.value !== "Dem"));
	assert.equal(readUnionCandidateReferences(blank.bbox, blank.layout, "general", edition).references[0]!.partyCode, "");
	const missing = document("general", fields => [...fields, { value: "No Nomination Made", left: 185, top: 250 }, { value: "Rep", left: 435, top: 250 }]);
	const parsed = readUnionCandidateReferences(missing.bbox, missing.layout, "general", edition);
	assert.equal(parsed.references.length, 1);
	assert.equal(parsed.inventory[0]!.notices?.[0]!.text, "No Nomination Made");
	const empty = document("school", fields => [...fields.filter(field => field.top !== 200), { value: "NO PETITION FILED", left: 185, top: 200 }]);
	assert.throws(() => readUnionCandidateReferences(empty.bbox, empty.layout, "school", edition));
	const valid = document("school");
	const combined = valid.bbox.replace("</doc>", `${empty.bbox}</doc>`);
	const schools = readUnionCandidateReferences(combined, valid.layout + empty.layout, "school", edition);
	assert.equal(schools.references.length, 1);
	assert.equal(schools.inventory[1]!.sourceNotice, "NO PETITION FILED");
});

test("Union collection paces every exact-host request and preserves original source clocks", async () => {
	const native = network();
	const result = await collectUnionCandidateDocuments(review, native.options);
	assert.equal(result.captures.length, 5);
	assert.equal(result.publicationApproved, false);
	assert.deepEqual(result.captures.map(capture => capture.url), [unionCandidatePolicyUrls[0], unionCandidateIndexUrl, unionCandidatePolicyUrls[1], generalUrl, schoolUrl]);
	for (const [position, request] of native.requests.entries()) {
		if (position) assert.ok(request.time - native.requests[position - 1]!.time >= 31000);
		assert.equal(result.captures[position]!.capturedAt, new Date(request.time).toISOString());
		assert.equal(result.captures[position]!.sha256, unionCandidateHash(result.captures[position]!.body));
	}
});

test("Union municipal positions can repeat across explicitly different wards without merging people", () => {
	const municipal = document("general", fields => [
		...fields.filter(field => field.value !== "TERM" && field.value !== "3 Yrs").map((field) => {
			if (field.value === "UNITED STATES SENATOR") return { ...field, value: "TOWNSHIP OF CLARK" };
			if (field.value === "SLOGAN" || field.value === "Campaign slogan") return { ...field, left: 685 };
			return field;
		}),
		{ value: "OFFICE", left: 560, top: 170 },
		{ value: "1st Ward Council Member", left: 560, top: 200 },
		{ value: "1A", left: 60, top: 250 },
		{ value: "Another Person", left: 185, top: 250 },
		{ value: "Rep", left: 435, top: 250 },
		{ value: "2nd Ward Council Member", left: 560, top: 250 },
	]);
	const parsed = readUnionCandidateReferences(municipal.bbox, municipal.layout, "general", edition);
	assert.deepEqual(parsed.references.map(reference => [reference.position, reference.office]), [["1A", "1st Ward Council Member"], ["1A", "2nd Ward Council Member"]]);
	assert.equal(parsed.inventory[0]!.selectionInstructions?.[0], "3 YEAR TERM - VOTE FOR ONE");
	const fragmented = municipal.bbox.replace("1st Ward Council Member", "1 Ward Council Member").replace("</page>", `${line({ value: "st", left: 566, top: 199, width: 3 })}</page>`);
	assert.deepEqual(readUnionCandidateReferences(fragmented, municipal.layout, "general", edition).references, parsed.references);
});

test("Union native ordinals retain superscript office identity and merged slogan/term words retain the term", () => {
	const school = document("school");
	const originalSlogan = line({ value: "Campaign slogan", left: 435, top: 200 });
	const originalTerm = line({ value: "3 Yrs", left: 560, top: 200 });
	const merged = `<line xmin="435" xmax="600" ymin="200" ymax="210"><word xmin="435" xmax="500" ymin="200" ymax="210">Campaign slogan</word><word xmin="560" xmax="568" ymin="200" ymax="210">3</word><word xmin="570" xmax="590" ymin="200" ymax="210">Yrs</word></line>`;
	const parsed = readUnionCandidateReferences(school.bbox.replace(originalSlogan, merged).replace(originalTerm, ""), school.layout, "school", edition);
	assert.equal(parsed.references[0]!.termLabel, "3 Yrs");
	const senate = document("general");
	const congressional = senate.bbox.replace("UNITED STATES SENATOR", "MEMBER OF HOUSE OF REPRESENTATIVES (7th CONGRESSIONAL DISTRICT)");
	assert.throws(() => readUnionCandidateReferences(congressional, senate.layout, "general", edition));
});

test("Union publisher denial, redirects, bad types and policy changes stop subsequent acquisition", async () => {
	for (const [target, change] of [[unionCandidatePolicyUrls[0], { body: robots.replace("30", "31") }], [unionCandidatePolicyUrls[1], { body: privacy.replace("Public source", "Changed source") }], [generalUrl, { status: 403 }], [generalUrl, { status: 301 }], [generalUrl, { body: "<html>challenge</html>" }], [generalUrl, { contentType: "text/html" }]] as const) {
		const native = network(url => url === target ? change : undefined);
		await assert.rejects(collectUnionCandidateDocuments(review, native.options));
		assert.equal(native.requests.at(-1)!.url, target);
		assert.ok(!native.requests.some(request => request.url === schoolUrl));
	}
	const failed = network();
	await assert.rejects(collectUnionCandidateDocuments(review, { ...failed.options, onCapture: async () => {
		throw new Error("Persistence unavailable");
	} }));
	assert.equal(failed.requests.length, 1);
});

test("Union persistent collection and offline preparation survive repeated use without overwriting source custody", async () => {
	const root = await mkdtemp(join(tmpdir(), "union-candidates-"));
	try {
		const path = join(root, "collection-plan.json");
		await writeFile(path, JSON.stringify({ schemaVersion: 1, type: "union-candidate-research-collection", outputRoot: join(root, "intakes"), accessReview: review }));
		const collect = async (accessReview: typeof review, options: Parameters<typeof collectUnionCandidateDocuments>[1]) => {
			const native = network();
			return collectUnionCandidateDocuments(accessReview, { ...native.options, onCapture: options!.onCapture });
		};
		const first = await collectUnionCandidateResearch(path, { collect, extract });
		const second = await collectUnionCandidateResearch(path, { collect, extract });
		assert.notEqual(first.outputDirectory, second.outputDirectory);
		const manifestPath = join(first.outputDirectory, "capture.json");
		const original = await readFile(manifestPath);
		const report = JSON.parse(original.toString());
		assert.equal(report.references.length, 2);
		assert.doesNotMatch(await readFile(join(first.outputDirectory, "candidate-references.csv"), "utf8"), /Private address|personal@example|Campaign slogan/u);
		const preparationPlan = join(root, "prepare.json");
		await writeFile(preparationPlan, JSON.stringify({ schemaVersion: 1, type: "union-candidate-research-preparation", capturePath: manifestPath, captureSha256: unionCandidateHash(original), outputRoot: join(root, "prepared") }));
		const clock = { extract, now: () => Date.parse("2030-10-02T00:00:00Z") };
		await assert.rejects(prepareUnionCandidateResearch(preparationPlan, { extract, now: () => Date.parse("2029-10-02T00:00:00Z") }));
		const prepared = await prepareUnionCandidateResearch(preparationPlan, clock);
		const repeated = await prepareUnionCandidateResearch(preparationPlan, clock);
		assert.equal(prepared.preparationSha256, repeated.preparationSha256);
		assert.deepEqual(await readFile(join(prepared.outputDirectory, "candidate-references.csv")), await readFile(join(first.outputDirectory, "candidate-references.csv")));
		assert.deepEqual(await readFile(manifestPath), original);
		assert.equal(prepared.publisherRequests, 0);
		const source = report.inputs[3];
		await writeFile(join(first.outputDirectory, source.path), "altered");
		const before = await readdir(join(root, "prepared"));
		await assert.rejects(prepareUnionCandidateResearch(preparationPlan, clock));
		assert.deepEqual(await readdir(join(root, "prepared")), before);
	}
	finally { await rm(root, { recursive: true, force: true }); }
});

test("Union plans reject extra fields and symlinked plan inputs", async () => {
	const root = await mkdtemp(join(tmpdir(), "union-plans-"));
	try {
		const path = join(root, "plan.json");
		await writeFile(path, JSON.stringify({ schemaVersion: 1, type: "union-candidate-research-collection", outputRoot: join(root, "intakes"), accessReview: review, publish: true }));
		await assert.rejects(collectUnionCandidateResearch(path));
		const alias = join(root, "alias.json");
		await symlink(path, alias);
		await assert.rejects(collectUnionCandidateResearch(alias));
	}
	finally { await rm(root, { recursive: true, force: true }); }
});
