import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { refreshApprovedCandidateData } from "../src/state-ballot-automation.js";
import { certifiedPdfDiscoveryUrls, certifiedPdfPolicyReceipts, fetchCertifiedPdfCycleDiscovery, missouriCalendarUrl, parseCertifiedPdfCapture, readCertifiedPdfElectionDiscovery } from "../src/state-ballot-certified-pdf.js";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, stateBallotCycleSources, writeStateBallotCycleCatalog } from "../src/state-ballot-cycles.js";
import { extractFultonPdfText, FultonCollectorCapabilityError } from "../src/state-ballot-fulton.js";
import { extractStateBallotPdfText, fetchStateBallotPdfDocument, StateBallotPdfCapabilityError } from "../src/state-ballot-pdf.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources, legacyReviewedStateBallotSource } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { readReviewedStateFixture } from "./helpers/reviewed-state-fixtures.js";

const now = Date.parse("2026-10-25T13:00:00.000Z");
const timestamp = new Date(now).toISOString();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const sources = configuredStateBallotSources.filter(source => source.format === "certified-pdf");
const sourceFor = (code: "MO" | "NJ") => sources.find(source => source.stateCode === code)!;
const policies = (code: "MO" | "NJ") => code === "MO" ? "<a href=\"https://www.sos.mo.gov/ipolicy\">Internet Privacy Policy</a>" : "<a href=\"https://nj.gov/nj/privacy.html\">Privacy Notice</a><a href=\"https://nj.gov/nj/legal.html\">Legal Statement &amp; Disclaimers</a>";
const word = (value: string, xmin: number, ymin: number) => `<word xMin="${xmin}" xMax="${xmin + value.length * 3}" yMin="${ymin}" yMax="${ymin + 8}">${value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</word>`;
function jerseyPdf(date: string, senate: boolean, choices: { name: string; party: string; district?: string }[], revision = `${date.slice(0, 4)}-07-27`) {
	const printed = `${date.slice(5, 7)}/${date.slice(8)}/${date.slice(0, 4)}`;
	const issue = `${revision.slice(5, 7)}/${revision.slice(8)}/${revision.slice(0, 4)}`;
	const heading = (page: number) => word(`${issue} Official List Page ${page} of 2`, 14, 20) + word(senate ? "Candidates for US Senate" : "Candidates for House of Representatives", 14, 40) + word(`For GENERAL ELECTION ${printed} Election, * denotes incumbent`, 14, 60);
	const columns = word("Name", 14, 100) + word("Address", 134, 100) + word("Party", 265, 100) + word("County", 331, 100) + word("Slogan", 400, 100);
	const records = choices.map((choice, position) => (senate ? "" : word(`${choice.district === "7" ? "Seventh" : "First"} Congressional District: SYNTHETIC County`, 14, 120 + position * 100)) + word(choice.name, 14, 140 + position * 100) + word("Omitted private field", 134, 140 + position * 100) + word(choice.party, 265, 140 + position * 100) + word("SYNTHETIC", 331, 165 + position * 100)).join("");
	const parties = new Map<string, number>();
	for (const choice of choices) parties.set(choice.party, (parties.get(choice.party) ?? 0) + 1);
	const summary = word("Candidate Totals for Party", 14, 100) + [...parties].map(([party, count], position) => word(party, 14, 140 + position * 25) + word(String(count), 500, 140 + position * 25)).join("") + word("Total Candidates", 14, 250) + word(String(choices.length), 500, 250);
	return `<html><body><doc><page width="1000" height="800">${heading(1)}${columns}${records}</page><page width="1000" height="800">${heading(2)}${summary}</page></doc></body></html>`;
}
function capture(code: "MO" | "NJ", date = "2026-11-03", includeSenate = true) {
	const source = sourceFor(code);
	const year = date.slice(0, 4);
	const current = date === source.electionDate;
	let pages: { url: string; body: string }[];
	let documents: { url: string; text: string; sha256: string; retrievedAt: string }[];
	if (code === "MO") {
		const url = current ? source.documentUrls![0]! : "https://www.sos.mo.gov/CMSImages/ElectionCandidates/publisher-offered-certification.pdf";
		pages = [{ url: certifiedPdfDiscoveryUrls.MO, body: `<a href="${url}">Certified Candidates - November ${year}</a>${policies(code)}` }, { url: missouriCalendarUrl, body: `<div id="main"><h1>${year} Missouri Election Calendar</h1><table><tr><th>Official Election Day</th><th>Style of Election</th></tr><tr><td>November ${Number(date.slice(-2))}, ${year}</td><td>General Election</td></tr></table></div>${policies(code)}` }];
		const text = `General Election on Tuesday, November ${Number(date.slice(-2))}, ${year}\nREPUBLICAN CANDIDATES\nFor State Auditor\nSynthetic Republican\nFor U.S. Representative\nDistrict 1, Synthetic Representative\nDEMOCRATIC CANDIDATES\nFor State Auditor\nSynthetic Democrat\nLIBERTARIAN CANDIDATES\nFor State Auditor\nSynthetic Libertarian\nCERTIFICATION\nCertificate of Judicial Candidates\nJUDICIAL CANDIDATES\nArticle V, Section 25(c)\nFor the Missouri Supreme Court\nSynthetic Supreme Judge\nFor the Missouri Court of Appeals\nEastern District, Synthetic Appeal Judge\nFor Circuit Judge\nCircuit 6, Division 1, Synthetic Circuit Judge\nFor Associate Circuit Judge\nCircuit 6, Division 4, Synthetic Associate Judge\nCertificate of Judicial Candidates\nNOTICE OF ELECTION\n`;
		documents = [{ url, text, sha256: hash(url), retrievedAt: timestamp }];
	}
	else {
		const urls = current ? [...source.documentUrls!] : ["senate", "house", "amendment"].map(kind => `https://www.nj.gov/state/elections/assets/pdf/election-results/${year}/offered-${kind}.pdf`);
		const pageUrl = `https://www.nj.gov/state/elections/election-information-${year}.shtml`;
		const body = `${includeSenate ? `<a href="${urls[0]}">Official General Election Candidates: U.S. Senate</a>` : ""}<a href="${urls[1]}">Official General Election Candidates: U.S. House of Representatives</a><a href="${urls[2]}">Amended Certification of Nominees General Election U.S. House of Representatives: 7th Congressional District</a>${policies(code)}`;
		pages = [{ url: certifiedPdfDiscoveryUrls.NJ, body: `<a href="${pageUrl}">${year} Election Year Information</a>${policies(code)}` }, { url: pageUrl, body }];
		const texts = [jerseyPdf(date, true, [{ name: "Synthetic Senator", party: "Democratic" }]), jerseyPdf(date, false, [{ name: "Synthetic Old Nominee", party: "Republican", district: "7" }, { name: "Synthetic Other Nominee", party: "Democratic", district: "1" }]), jerseyPdf(date, false, [{ name: "Synthetic New Nominee", party: "Independent", district: "7" }], `${year}-09-04`)];
		documents = urls.map((url, position) => ({ url, text: texts[position]!, sha256: hash(url), retrievedAt: timestamp })).filter((_, position) => includeSenate || position > 0);
	}
	return JSON.stringify({ schemaVersion: 1, type: "certified-pdf-discovery", stateCode: code, policies: certifiedPdfPolicyReceipts[code], pages, documents });
}

test("certified PDF promotions preserve exact legacy descriptors and the shared Fulton capability aliases", () => {
	assert.equal(sources.length, 2);
	for (const source of sources) {
		assert.deepEqual(legacyReviewedStateBallotSource(source), stateBallotSources.find(item => item.id === source.id));
		assert.equal(legacyReviewedStateBallotSource({ ...source, pageUrl: "https://example.org/" }), null);
	}
	assert.equal(extractFultonPdfText, extractStateBallotPdfText);
	assert.equal(FultonCollectorCapabilityError, StateBallotPdfCapabilityError);
});

test("Missouri preserves literal party labels and distinct statewide, legislative and regional retention contexts", () => {
	const source = sourceFor("MO");
	const parsed = parseCertifiedPdfCapture(source, capture("MO"));
	assert.equal(parsed.records.length, 8);
	assert.equal(parsed.records.filter(record => record.sourceStatus === "Certified judicial retention candidate").length, 4);
	assert.equal(parsed.records.filter(record => record.sourceStatus === "Certified judicial retention candidate" && record.scope === "statewide").length, 1);
	assert.equal(parsed.records.find(record => record.name === "Synthetic Circuit Judge")!.jurisdiction, "Circuit 6, Division 1");
	assert.equal(parsed.records[0]!.id, hash(JSON.stringify(["MO", source.electionDate, "state auditor", "", "synthetic republican", "republican"])).slice(0, 24));
	assert.deepEqual(parseStateCandidateRecords(source, capture("MO")), parsed.records);
	assert.doesNotMatch(buildStateBallotPreview({ source, ...parsed }, { districtMatches: [] })!.disclaimer, /Filing does not establish/iu);
});

test("New Jersey reconciles every published party/total and replaces only the explicitly amended district", () => {
	const parsed = parseCertifiedPdfCapture(sourceFor("NJ"), capture("NJ"));
	assert.equal(parsed.records.length, 3);
	assert.deepEqual(parsed.documents.map(document => document.includedRecordCount), [1, 1, 1]);
	assert.equal(parsed.records.find(record => record.district === "7")!.name, "Synthetic New Nominee");
	assert.ok(!parsed.records.some(record => record.name === "Synthetic Old Nominee"));
	assert.ok(parsed.records.some(record => record.district === "1"));
	assert.doesNotMatch(JSON.stringify(parsed.records), /Omitted private field|address|email|phone/iu);
});

test("both certified PDF families bind actual future dates and publication links without guessing annual paths", () => {
	for (const code of ["MO", "NJ"] as const) {
		const source = sourceFor(code);
		const body = capture(code, "2028-11-07", false);
		const catalog = discoverStateBallotElectionCycles(body, source.id, now);
		const selected = stateBallotCycleSources(catalog, now)[0]!;
		assert.equal(selected.electionDate, "2028-11-07");
		assert.equal(selected.documentUrls![0], readCertifiedPdfElectionDiscovery(body)[0]!.pdfDocuments[0]!.url);
		assert.equal(parseCertifiedPdfCapture(selected, body).records.length, code === "MO" ? 8 : 2);
		assert.equal(selected.format, "certified-pdf");
	}
});

test("changed dates, hosts, complete document sets, policy links, unknown offices and truncated sections fail closed", () => {
	for (const code of ["MO", "NJ"] as const) {
		const body = capture(code);
		for (const changed of [body.replaceAll("https://www.sos.mo.gov/CMSImages/", "https://example.org/CMSImages/").replaceAll("https://www.nj.gov/state/elections/assets/", "https://example.org/state/elections/assets/"), `${body}x`, body.replace(certifiedPdfPolicyReceipts[code][0]!.sha256, "f".repeat(64))]) assert.throws(() => parseCertifiedPdfCapture(sourceFor(code), changed));
		const value = JSON.parse(body);
		value.pages[0].body += "<a href=\"/changed-terms\">Terms of Use</a>";
		assert.throws(() => readCertifiedPdfElectionDiscovery(JSON.stringify(value)));
		const missing = JSON.parse(body);
		missing.documents.pop();
		assert.throws(() => parseCertifiedPdfCapture(sourceFor(code), JSON.stringify(missing)));
	}
	for (const old of ["For State Auditor", "REPUBLICAN CANDIDATES", "NOTICE OF ELECTION"]) assert.throws(() => parseCertifiedPdfCapture(sourceFor("MO"), capture("MO").replaceAll(old, "Unknown source layout")));
	assert.throws(() => parseCertifiedPdfCapture(sourceFor("NJ"), capture("NJ").replaceAll("11/03/2026", "11/04/2026")));
});

test("New Jersey rejects mismatched totals, wrong amendment districts, invalid coordinates and conflicting revision order", () => {
	for (const change of [
		(value: ReturnType<typeof JSON.parse>) => { value.documents[2].text = value.documents[2].text.replaceAll("Seventh Congressional District:", "First Congressional District:"); },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[1].text = value.documents[1].text.replaceAll("xMin=\"14\"", "xMin=\"-1\""); },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[2].text = value.documents[2].text.replaceAll("09/04/2026", "12/01/2026"); },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[0].text = value.documents[0].text.replaceAll(">1</word>", ">2</word>"); },
	]) {
		const value = JSON.parse(capture("NJ"));
		change(value);
		assert.throws(() => parseCertifiedPdfCapture(sourceFor("NJ"), JSON.stringify(value)));
	}
});

test("missing PDF capability and changed robots stop before document acquisition", async () => {
	const previous = process.env.STATE_BALLOT_PDFTOTEXT;
	let requests = 0;
	try {
		delete process.env.STATE_BALLOT_PDFTOTEXT;
		await assert.rejects(fetchCertifiedPdfCycleDiscovery("MO", { requestText: async () => {
			requests++;
			return "";
		} }), StateBallotPdfCapabilityError);
		assert.equal(requests, 0);
		await assert.rejects(fetchCertifiedPdfCycleDiscovery("NJ", { extractor: async () => "", requestText: async () => {
			requests++;
			return "User-agent: *\nDisallow: /";
		} }));
		assert.equal(requests, 1);
	}
	finally {
		if (previous === undefined) delete process.env.STATE_BALLOT_PDFTOTEXT;
		else process.env.STATE_BALLOT_PDFTOTEXT = previous;
	}
});

test("a newer complete New Jersey list supersedes older amendments without losing their provenance", () => {
	const value = JSON.parse(capture("NJ"));
	value.documents[2].text = value.documents[2].text.replaceAll("09/04/2026", "06/01/2026");
	const parsed = parseCertifiedPdfCapture(sourceFor("NJ"), JSON.stringify(value));
	assert.equal(parsed.records.find(record => record.district === "7")!.name, "Synthetic Old Nominee");
	assert.deepEqual(parsed.documents.map(document => document.includedRecordCount), [1, 2, 0]);
});

test("shared PDF acquisition validates status, type, magic and original hashes without following refusals", async () => {
	const url = sourceFor("MO").documentUrls![0]!;
	let extracted = 0;
	for (const [status, contentType, body] of [[302, "application/pdf", "%PDF-1.7"], [403, "text/html", "denied"], [200, "text/html", "%PDF-1.7"], [200, "application/pdf", "not a PDF"]] as const) {
		await assert.rejects(fetchStateBallotPdfDocument(url, { allowedHosts: ["www.sos.mo.gov"], request: async () => ({ status, contentType, body: Buffer.from(body), etag: undefined }), extractor: async () => {
			extracted++;
			return "unused";
		} }));
	}
	assert.equal(extracted, 0);
	const accepted = await fetchStateBallotPdfDocument(url, { allowedHosts: ["www.sos.mo.gov"], now: () => now, request: async () => ({ status: 200, contentType: "application/pdf", body: Buffer.from("%PDF-1.7 synthetic"), etag: undefined }), extractor: async () => "Synthetic text" });
	assert.equal(accepted.sha256, hash("%PDF-1.7 synthetic"));
	assert.equal(accepted.retrievedAt, timestamp);
});

test("the positional extractor retains bounded page and format validation", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-certified-tool-"));
	try {
		const path = join(directory, "extractor");
		const bytes = Buffer.from("%PDF-1.7 synthetic");
		await writeFile(path, `#!${process.execPath}\nprocess.stdin.resume();process.stdin.on('end',()=>process.stdout.write('<html><page></page></html>'));`, { mode: 0o700 });
		assert.match(await extractStateBallotPdfText(bytes, path, 12000, "bbox-layout"), /<page>/u);
		await writeFile(path, `#!${process.execPath}\nprocess.stdin.resume();process.stdin.on('end',()=>process.stdout.write('<page></page>'.repeat(51)));`);
		await assert.rejects(extractStateBallotPdfText(bytes, path, 12000, "bbox-layout"));
		await assert.rejects(extractStateBallotPdfText(bytes, path, 12000, "unknown" as "layout"));
	}
	finally { await rm(directory, { recursive: true }); }
});

test("legacy approved Missouri and New Jersey files remain readable and failed workers never report cached success", async () => {
	for (const code of ["MO", "NJ"] as const) {
		const directory = await mkdtemp(join(tmpdir(), "ballot-certified-legacy-"));
		try {
			const source = sourceFor(code);
			const legacy = legacyReviewedStateBallotSource(source)!;
			const original = parseBundledStateSnapshot(legacy, readReviewedStateFixture(code));
			const storage = createStateBallotStorage(directory);
			await storage.write(original);
			const path = join(directory, `${source.id}.json`);
			const bytes = await readFile(path, "utf8");
			let requests = 0;
			const repository = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => now, fetchText: async () => {
				requests++;
				throw new Error("No public legacy refresh");
			} });
			assert.deepEqual(await repository.getSnapshot(code), original);
			assert.equal(requests, 0);
			const environment = { STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: code, STATE_BALLOT_ENABLED_SOURCES: source.id };
			const failed = await refreshApprovedCandidateData({ environment, now: () => now, fetchText: async () => {
				throw new Error("offline");
			} });
			assert.equal(failed.status, "failed");
			assert.equal(failed.lastImportAt, null);
			assert.equal(failed.lastSuccessAt, null);
			assert.equal(await readFile(path, "utf8"), bytes);
			const imported = await refreshApprovedCandidateData({ environment, now: () => now, fetchText: async () => capture(code) });
			assert.equal(imported.status, "succeeded");
			assert.equal(imported.results[0]!.status, "imported");
			const cached = await refreshApprovedCandidateData({ environment, now: () => now + 1000, fetchText: async () => {
				throw new Error("already cached");
			} });
			assert.equal(cached.status, "succeeded");
			assert.equal(cached.results[0]!.status, "cached");
			assert.equal(cached.lastSuccessAt, imported.lastSuccessAt);
			await assert.rejects(storage.read(legacy));
		}
		finally { await rm(directory, { recursive: true }); }
	}
});

test("future catalogs survive hot/cold reload, retain changed unexpired publications and keep exact-source allowlists narrow", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-certified-catalog-"));
	const keys = ["STATE_BALLOT_ENABLED_STATES", "STATE_BALLOT_ENABLED_SOURCES", "STATE_BALLOT_ENABLED_FAMILIES", "STATE_BALLOT_CYCLE_CATALOGS"];
	const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
	try {
		const source = sourceFor("MO");
		const path = join(directory, "catalog.json");
		const body = capture("MO", "2028-11-07");
		const catalog = discoverStateBallotElectionCycles(body, source.id, now);
		const instance = stateBallotCycleSources(catalog, now)[0]!;
		process.env.STATE_BALLOT_ENABLED_STATES = "MO";
		process.env.STATE_BALLOT_ENABLED_SOURCES = source.id;
		process.env.STATE_BALLOT_ENABLED_FAMILIES = source.id;
		process.env.STATE_BALLOT_CYCLE_CATALOGS = JSON.stringify({ [source.id]: path });
		const hot = createStateBallotRepository({ dataDirectory: directory, now: () => now, fetchText: async () => body });
		assert.equal(await hot.getSnapshot("MO", instance.id), null);
		await writeStateBallotCycleCatalog(path, catalog, now);
		assert.equal((await hot.getSnapshot("MO", instance.id))!.records.length, 8);
		const cold = createStateBallotRepository({ dataDirectory: directory, now: () => now, fetchText: async () => {
			throw new Error("already persisted");
		} });
		assert.equal((await cold.getSnapshot("MO", instance.id))!.records.length, 8);
		const accepted = await readFile(path, "utf8");
		await assert.rejects(syncStateBallotCycles({ familyId: source.id, catalogPath: path, dataDirectory: directory, now: () => now, fetchDiscovery: async () => body.replaceAll("publisher-offered-certification", "changed-certification"), fetchCandidates: async () => body }));
		assert.equal(await readFile(path, "utf8"), accepted);
		delete process.env.STATE_BALLOT_ENABLED_FAMILIES;
		assert.equal(await hot.getSnapshot("MO", instance.id), null);
	}
	finally {
		for (const key of keys) {
			if (previous[key] === undefined) delete process.env[key];
			else process.env[key] = previous[key];
		}
		await rm(directory, { recursive: true });
	}
});
