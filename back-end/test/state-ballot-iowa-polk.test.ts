import type { StateBallotSource } from "../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchIowaPolkCandidateCapture, fetchIowaPolkCycleDiscovery, iowaPolkDiscoveryUrl, iowaPolkPolicyFingerprint, iowaPolkPolicyReceipts, parseIowaPolkCandidateCapture, readIowaPolkDiscovery, validateIowaPolkSource } from "../src/state-ballot-iowa-polk.js";
import { createStateCandidateRecord, parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository, resolveStateBallotConfiguration } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import { serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const source = configuredStateBallotSources.find(item => item.id === "ia-polk-2026")!;
const footer = readFileSync(new URL("./fixtures/iowa-polk-footer.html", import.meta.url), "utf8");
const instant = "2026-10-26T03:00:00.000Z";
const now = Date.parse("2026-10-26T05:00:00.000Z");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const pageUrl = (date: string) => `https://www.polkcountyiowa.gov/county-auditor/election/news-and-press-releases/general-election-november-${Number(date.slice(-2))}-${date.slice(0, 4)}-voter-information/`;
const documents = (date: string) => date === source.electionDate ? ["https://www.polkcountyiowa.gov/media/4xehjvif/candidate-list.pdf", "https://www.polkcountyiowa.gov/media/t3jkoopa/des_moines_1-sample.pdf"] : [`https://www.polkcountyiowa.gov/media/abcdefgh/candidates-${date}.pdf`, `https://www.polkcountyiowa.gov/media/ijklmnop/sample-${date}.pdf`];
function discovery(date = source.electionDate, pending = false) {
	const urls = documents(date);
	const url = pageUrl(date);
	const index = `<h1 aria-label="Election"><img alt="Election logo"></h1><a href="${url}">Upcoming Election Info</a>${footer}`;
	const body = `<h1>General Election - November ${Number(date.slice(-2))}, ${date.slice(0, 4)} - Voter Information</h1>${pending ? "Candidate list and sample ballots will be posted." : `<a href="${urls[0]}">Full Candidate List</a><table><tr><td>Precinct</td><td>Location</td><td>Address</td><td>Sample Ballot</td></tr><tr><td>Example precinct</td><td>Example site</td><td>Not imported</td><td><a href="${urls[1]}">Sample Ballot</a></td></tr></table>`}${footer}`;
	return { schemaVersion: 1, type: "iowa-polk-discovery", policies: iowaPolkPolicyReceipts, index: { url: iowaPolkDiscoveryUrl, body: index, sha256: hash(index), retrievedAt: instant }, pages: [{ url, body, sha256: hash(body), retrievedAt: instant }] };
}
function roster(date = source.electionDate) {
	const president = date === "2028-11-07";
	return `November ${Number(date.slice(-2))}, ${date.slice(0, 4)} - Statewide Offices
United States Senator
Candidate Name  Candidate Party  Email
Ada Senator  Republican  private@example.test
Bea Senator  Democratic  private@example.test
United States Representative District 3
Candidate Name  Candidate Party  Email
Ada Representative  Republican  private@example.test
Bea Representative  Democratic  private@example.test
${president ? "President" : "Governor"}
Candidate Name  Candidate Party  Email
Ada Nominee  Republican  private@example.test
Bea Nominee  Democratic  private@example.test
${president ? "Vice President" : "Lieutenant Governor"}
Candidate Name  Candidate Party
Ada Runningmate  Republican  private@example.test
Bea Runningmate  Democratic  private@example.test
Attorney General
Candidate Name  Candidate Party  Email
Ada Attorney  Republican  private@example.test
Bea Attorney  Democratic  private@example.test
\fState Senate
State Senate District 15
Candidate Name  Candidate Party  Email
(No candidate)  Republican
Bea Legislator  Democratic  private@example.test
\fState Representative
State Representative District 40
Candidate Name  Candidate Party  Email
Ada Legislator  Republican  private@example.test
Bea Housemember  Democratic  private@example.test
\fCountywide Offices
${president ? "County Auditor" : "County Attorney"}
Candidate Name  Candidate Party  Email
Ada County  Republican  private@example.test
Bea County  Democratic  private@example.test
${president
	? `County Sheriff
Candidate Name  Candidate Party  Email
Cam Sheriff  Republican  private@example.test
Dee Sheriff  Democratic  private@example.test
`
	: ""}Board of Supervisors
Board of Supervisors - District 1
Candidate Name  Candidate Party  Email
(No candidate)  Republican
Bea Supervisor  Democratic  private@example.test
\fCountwide Offices - Nonpartisan
County Hospital Trustees - Vote for no more than 2
Candidate Name  Email
Ada Trustee  private@example.test
Bea Trustee  private@example.test
Cam Trustee  private@example.test
Agricultural Extension Council (Vacancy)
Candidate Name  Email
Dee Councilmember  private@example.test
\fJudicial Retention
Shall the following judges be retained in office? YES/NO
Court of Appeals               District 5C Judge
Candidate Name                 Candidate Name
Ada Appeal                     Cam District
Bea Appeal                     Dee District
                               District 5C Associate Judge
                               Candidate Name
                               Eve Associate
\f`;
}
function sample(date = source.electionDate) {
	const president = date === "2028-11-07";
	const column = (left: string, right = "") => left.padEnd(55) + right;
	return ["SAMPLE BALLOT", "GENERAL ELECTION", "COUNTY OF POLK, STATE OF IOWA", `NOVEMBER ${Number(date.slice(-2))}, ${date.slice(0, 4)}`, "Party Abbreviations: Democratic Party:(DEM); Republican Party:(REP); Libertarian Party:(LIB)", column("Vote for no more than ONE", "Unrelated Candidate                        REP"), column(`${" Ada Senator".padEnd(44)}REP`), column(president ? "PRESIDENT AND" : "GOVERNOR AND"), column(president ? "VICE PRESIDENT" : "LT. GOVERNOR"), column("Vote for no more than ONE team"), column(`${" Ada Nominee".padEnd(44)}REP`), column(" Ada Runningmate"), column(`${" Bea Nominee".padEnd(44)}DEM`), column(" Bea Runningmate"), column("Write-in, if any"), column("SECRETARY OF STATE")].join("\n");
}
function capture(date = source.electionDate) {
	const urls = documents(date);
	return { schemaVersion: 1, type: "iowa-polk-candidate-capture", discovery: discovery(date), documents: [{ url: urls[0]!, text: roster(date), sha256: hash(`synthetic roster ${date}`), retrievedAt: instant }, { url: urls[1]!, text: sample(date), sha256: hash(`synthetic sample ${date}`), retrievedAt: instant }] };
}
function selected(date = source.electionDate) {
	return date === source.electionDate ? source : stateBallotCycleSources(discoverStateBallotElectionCycles(JSON.stringify(discovery(date)), source.id, now), now)[0]!;
}
function parsed(date = source.electionDate) {
	return parseIowaPolkCandidateCapture(selected(date), JSON.stringify(capture(date)), createStateCandidateRecord, now);
}
test("Polk facts preserve literal parties, individual retention choices, vacancy, vote limits and unknown eligibility", () => {
	const result = parsed();
	assert.equal(result.records.length, 23);
	assert.equal(result.printedCandidateRows, 25);
	assert.equal(result.emptyPartyRows.length, 2);
	assert.equal(result.records.filter(record => record.scope === "statewide").length, 8);
	assert.equal(result.records.filter(record => record.scope === "local").length, 10);
	assert.equal(result.records.filter(record => record.sourceStatus === "Judicial retention election").length, 5);
	assert.equal(result.records.filter(record => record.sourceStatus && record.scope === "statewide").length, 2);
	assert.equal(result.records.find(record => record.name === "Eve Associate")!.jurisdiction, "District 5C");
	assert.equal(result.records.find(record => record.name === "Ada Trustee")!.voteLimit, 2);
	assert.equal(result.records.find(record => record.name === "Dee Councilmember")!.office, "Agricultural Extension Council (Vacancy)");
	assert.equal(result.records.find(record => record.name === "Bea Supervisor")!.jurisdiction, "Polk County, Board of Supervisors - District 1");
	assert.ok(result.records.every(record => record.status === "listed" && !record.incumbent && !record.termYears && !record.seats));
	assert.doesNotMatch(JSON.stringify(result.records), /private@example|No candidate|Email|phone|Unrelated Candidate/u);
	assert.deepEqual(parseStateCandidateRecords(source, JSON.stringify(capture())), result.records);
});
test("Polk joint tickets are established by the sample, not merely matching party labels", () => {
	const result = parsed();
	assert.deepEqual(result.records.filter(record => record.office === "Governor and Lieutenant Governor").map(record => record.name), ["Ada Nominee / Ada Runningmate", "Bea Nominee / Bea Runningmate"]);
	assert.ok(!result.records.some(record => ["Governor", "Lieutenant Governor"].includes(record.office)));
	for (const text of [sample().replace("Ada Runningmate", "Wrong Runningmate"), sample().replace("ONE team", "TWO teams"), sample().replace("Party Abbreviations:", "Unknown Abbreviations:"), sample().replace(" Bea Runningmate", "")]) {
		const value = capture();
		value.documents[1]!.text = text;
		assert.throws(() => parseIowaPolkCandidateCapture(source, JSON.stringify(value), createStateCandidateRecord, now), /joint.ticket|running mate|disagree|abbreviation/iu);
	}
});
test("Polk's future offered date, actual document links and presidential pairing remain independent of annual guessed paths", () => {
	const date = "2028-11-07";
	const catalog = discoverStateBallotElectionCycles(JSON.stringify(discovery(date)), source.id, now);
	const future = stateBallotCycleSources(catalog, now)[0]!;
	assert.equal(future.id, "ia-polk-general-2028-11-07");
	assert.equal(future.pageUrl, pageUrl(date));
	assert.deepEqual(catalog.elections[0]!.polkDocuments!.map(document => document.url), documents(date));
	assert.equal(parsed(date).records.find(record => record.office === "President and Vice President")!.name, "Ada Nominee / Ada Runningmate");
	assert.deepEqual(parsed(date).records.filter(record => ["County Auditor", "County Sheriff"].includes(record.office)).map(record => ({ name: record.name, office: record.office, party: record.party, scope: record.scope, jurisdiction: record.jurisdiction })), [
		{ name: "Ada County", office: "County Auditor", party: "Republican", scope: "local", jurisdiction: "Polk County" },
		{ name: "Bea County", office: "County Auditor", party: "Democratic", scope: "local", jurisdiction: "Polk County" },
		{ name: "Cam Sheriff", office: "County Sheriff", party: "Republican", scope: "local", jurisdiction: "Polk County" },
		{ name: "Dee Sheriff", office: "County Sheriff", party: "Democratic", scope: "local", jurisdiction: "Polk County" },
	]);
	assert.equal(getStateBallotCycleFamily(source.id).discoveryUrl, iowaPolkDiscoveryUrl);
	assert.equal(parseStateBallotCycleCatalog(catalog, now).elections.length, 1);
});
test("Polk county offices preserve their printed identity without accepting unknown or misgrouped offices", () => {
	for (const office of ["County Auditor", "County Sheriff", "County Treasurer", "County Recorder", "County Attorney"]) {
		const value = capture();
		value.documents[0]!.text = roster().replace("County Attorney\n", `${office}\n`);
		const records = parseIowaPolkCandidateCapture(source, JSON.stringify(value), createStateCandidateRecord, now).records.filter(record => record.office === office);
		assert.deepEqual(records.map(record => ({ name: record.name, party: record.party, scope: record.scope, jurisdiction: record.jurisdiction })), [
			{ name: "Ada County", party: "Republican", scope: "local", jurisdiction: "Polk County" },
			{ name: "Bea County", party: "Democratic", scope: "local", jurisdiction: "Polk County" },
		]);
	}
	for (const text of [roster().replace("County Attorney\n", "County Marshal\n"), roster().replace("State Senate District 15\n", "County Auditor\n"), roster().replace("State Senate District 15\n", "County Sheriff\n")]) {
		const value = capture();
		value.documents[0]!.text = text;
		assert.throws(() => parseIowaPolkCandidateCapture(source, JSON.stringify(value), createStateCandidateRecord, now), /office or section requires review/u);
	}
});
test("Polk access-policy review distinguishes absent robots, employee policies, service licenses and actual site terms", async () => {
	assert.equal(iowaPolkPolicyFingerprint(footer, "legal-inventory"), iowaPolkPolicyReceipts[3].sha256);
	assert.equal(iowaPolkPolicyFingerprint(`${footer.replace("2026 Polk", "2028 Polk")}<a href="https://www.polkcountyiowa.gov/media/abcdefgh/2028-polk-county-dog-application.pdf">2028 Polk County Dog License Application</a>`, "legal-inventory"), iowaPolkPolicyReceipts[3].sha256);
	assert.notEqual(iowaPolkPolicyFingerprint(`${footer}<a href="/website-terms/">Website terms</a>`, "legal-inventory"), iowaPolkPolicyReceipts[3].sha256);
	assert.notEqual(iowaPolkPolicyFingerprint(`${footer}<a href="https://www.polkcountyiowa.gov/media/abcdefgh/2028-polk-county-dog-application.pdf">2028 Dog Website Terms</a>`, "legal-inventory"), iowaPolkPolicyReceipts[3].sha256);
	let requests = 0;
	await assert.rejects(fetchIowaPolkCycleDiscovery({ requestDocument: async () => {
		requests++;
		return { status: 200, contentType: "text/plain", body: Buffer.from("User-agent: *\nDisallow: /"), etag: undefined };
	}, sleep: async () => {
	} }), /policy requires review/u);
	assert.equal(requests, 1);
});
test("Polk discovery binds all dates, legal inventories, public hosts and the complete offered set", () => {
	for (const mutate of [
		(value: ReturnType<typeof discovery>) => {
			value.pages[0]!.url = value.pages[0]!.url.replace("november-3", "november-4");
		},
		(value: ReturnType<typeof discovery>) => {
			value.pages[0]!.body = value.pages[0]!.body.replace("November 3, 2026", "November 7, 2028");
			value.pages[0]!.sha256 = hash(value.pages[0]!.body);
		},
		(value: ReturnType<typeof discovery>) => {
			value.pages[0]!.body += "<a href=\"/terms/\">Terms of use</a>";
			value.pages[0]!.sha256 = hash(value.pages[0]!.body);
		},
		(value: ReturnType<typeof discovery>) => {
			value.pages[0]!.body = value.pages[0]!.body.replace(documents(source.electionDate)[0]!, "https://unreviewed.example/data.pdf");
			value.pages[0]!.sha256 = hash(value.pages[0]!.body);
		},
		(value: ReturnType<typeof discovery>) => {
			value.pages = [];
		},
		(value: ReturnType<typeof discovery>) => {
			value.index.retrievedAt = "2030-01-01T00:00:00.000Z";
		}
	]) {
		const value = discovery();
		mutate(value);
		assert.throws(() => readIowaPolkDiscovery(JSON.stringify(value), now));
	}
	assert.throws(() => validateIowaPolkSource({ ...source, countyName: "Other County" }));
	assert.throws(() => validateIowaPolkSource({ ...source, documentUrls: documents(source.electionDate).reverse() } as StateBallotSource), /./u);
});
test("Polk captures reject missing evidence, document clock problems, unknown rows and altered retention columns", () => {
	for (const mutate of [
		(value: ReturnType<typeof capture>) => {
			value.documents.pop();
		},
		(value: ReturnType<typeof capture>) => {
			value.documents[0]!.retrievedAt = "2030-01-01T00:00:00.000Z";
		},
		(value: ReturnType<typeof capture>) => {
			value.documents[0]!.sha256 = "invalid";
		},
		(value: ReturnType<typeof capture>) => {
			value.documents[0]!.text = value.documents[0]!.text.replace("County Attorney", "Unknown County Office");
		},
		(value: ReturnType<typeof capture>) => {
			value.documents[0]!.text = value.documents[0]!.text.replace("District 5C Judge", "Unknown regional court");
		},
		(value: ReturnType<typeof capture>) => {
			value.documents[0]!.text = value.documents[0]!.text.replace("Ada Attorney", "Email private@example.test");
		},
		(value: ReturnType<typeof capture>) => {
			value.documents[1]!.text = value.documents[1]!.text.replace("NOVEMBER 3, 2026", "NOVEMBER 7, 2028");
		}
	]) {
		const value = capture();
		mutate(value);
		assert.throws(() => parseIowaPolkCandidateCapture(source, JSON.stringify(value), createStateCandidateRecord, now));
	}
});
test("Polk snapshots preserve both source hashes and capture clocks and reject index/document substitutions", () => {
	const result = parsed();
	const snapshot = { source, ...result };
	const body = serializeStoredStateSnapshot(snapshot);
	const stored = parseBundledStateSnapshot(source, body, "automatic");
	assert.deepEqual(stored.records, JSON.parse(JSON.stringify(result.records)));
	assert.equal(stored.documents!.length, 2);
	assert.equal(stored.documents![1]!.includedRecordCount, 0);
	assert.equal(stored.retrievedAt, instant);
	const invalid = JSON.parse(body);
	invalid.collectionIndexSha256 = hash("changed");
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(invalid), "automatic"), /index/u);
	invalid.collectionIndexSha256 = result.collectionIndexSha256;
	invalid.documents[0].url = documents(source.electionDate)[1];
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(invalid), "automatic"), /document/u);
});
test("Polk future pending catalogs import when actual documents arrive while cached reads preserve original clocks", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-polk-cycle-"));
	const catalogPath = join(directory, "polk-catalog.json");
	const date = "2028-11-07";
	let requested = 0;
	try {
		const waiting = discovery(date, true);
		const future = stateBallotCycleSources(discoverStateBallotElectionCycles(JSON.stringify(waiting), source.id, now), now)[0]!;
		const pendingCapture = await fetchIowaPolkCandidateCapture(future, { discovery: JSON.stringify(waiting), now: () => now });
		assert.throws(() => parseIowaPolkCandidateCapture(future, pendingCapture, createStateCandidateRecord, now), StateBallotAwaitingRecordsError);
		const first = await syncStateBallotCycles({ familyId: source.id, catalogPath, dataDirectory: directory, now: () => now, fetchDiscovery: async () => JSON.stringify(waiting), fetchCandidates: async () => {
			requested++;
			return pendingCapture;
		} });
		assert.equal(first.results.find(result => result.sourceId === future.id)!.status, "awaiting-records");
		const available = await syncStateBallotCycles({ familyId: source.id, catalogPath, dataDirectory: directory, now: () => now, fetchDiscovery: async () => JSON.stringify(discovery(date)), fetchCandidates: async () => {
			requested++;
			return JSON.stringify(capture(date));
		} });
		assert.equal(available.results.find(result => result.sourceId === future.id)!.records, 25);
		assert.equal(available.results.find(result => result.sourceId === future.id)!.status, "available");
		assert.equal(available.results.find(result => result.sourceId === future.id)!.imported, true);
		const afterImport = requested;
		const cached = await syncStateBallotCycles({ familyId: source.id, catalogPath, dataDirectory: directory, now: () => now, fetchDiscovery: async () => JSON.stringify(discovery(date)), fetchCandidates: async () => {
			requested++;
			throw new Error("Unexpected refetch");
		} });
		assert.equal(cached.results.find(result => result.sourceId === future.id)!.retrievedAt, instant);
		assert.equal(cached.results.find(result => result.sourceId === future.id)!.status, "available");
		assert.equal(requested, afterImport);
		const reader = createStateBallotRepository({ sources: [selected(date)], dataDirectory: directory, now: () => now, fetchText: async () => {
			throw new Error("Converter/network unavailable");
		} });
		const restored = (await reader.getSnapshot("IA"))!;
		assert.equal(restored.records.length, 25);
		assert.deepEqual(restored.records, JSON.parse(JSON.stringify(parsed(date).records)));
		const config = resolveStateBallotConfiguration({ STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_FAMILIES: source.id }, now);
		assert.ok(config.sources.some(item => item.id === source.id));
		await assert.rejects(syncStateBallotCycles({ familyId: source.id, catalogPath, dataDirectory: directory, now: () => now, fetchDiscovery: async () => JSON.stringify(waiting) }), /disappeared/u);
	}
	finally {
		await rm(directory, { recursive: true });
	}
});
test("Polk previews offer only statewide and explicitly matched legislative records, not regional eligibility", () => {
	const snapshot = { source, ...parsed() };
	const preview = buildStateBallotPreview(snapshot, { districtMatches: [] })!;
	assert.ok(preview.contests.every(contest => !/District 5C|County|Hospital|Agricultural/u.test(contest.title)));
	assert.match(preview.disclaimer, /Polk County/u);
});
test("Polk's actual offered PDF links are acquired once with the bounded worker, without following contacts", async () => {
	const requests: string[] = [];
	const sleeps: number[] = [];
	const body = await fetchIowaPolkCandidateCapture(source, {
		discovery: JSON.stringify(discovery()),
		now: () => now,
		requestDocument: async (url) => {
			requests.push(url);
			return { status: 200, contentType: "application/pdf", body: Buffer.from(url === documents(source.electionDate)[0] ? "%PDF-candidates" : "%PDF-sample"), etag: undefined };
		},
		extractor: async bytes => bytes.toString() === "%PDF-candidates" ? roster() : sample(),
		sleep: async (milliseconds) => {
			sleeps.push(milliseconds);
		}
	});
	assert.deepEqual(requests, documents(source.electionDate));
	assert.deepEqual(sleeps, [11000, 11000]);
	assert.equal(parseIowaPolkCandidateCapture(source, body, createStateCandidateRecord, now).records.length, 23);
});
test("Polk admits a literal newly published party and matching ballot abbreviation, without guessing a ticket", () => {
	const value = capture();
	value.documents[0]!.text = value.documents[0]!.text.replaceAll("Republican", "Green");
	value.documents[1]!.text = value.documents[1]!.text.replaceAll("Republican Party:(REP)", "Green Party:(GRN)").replaceAll("REP", "GRN");
	const result = parseIowaPolkCandidateCapture(source, JSON.stringify(value), createStateCandidateRecord, now);
	assert.equal(result.records.find(record => record.name === "Ada Nominee / Ada Runningmate")!.party, "Green");
	assert.equal(result.records.find(record => record.name === "Ada Senator")!.party, "Green");
});
test("Polk current-election link updates invalidate the cache without changing the source descriptor or inventing freshness", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-polk-update-"));
	const catalogPath = join(directory, "polk-catalog.json");
	try {
		const first = await syncStateBallotCycles({ familyId: source.id, enabledSourceIds: [source.id], catalogPath, dataDirectory: directory, now: () => now, fetchDiscovery: async () => JSON.stringify(discovery()), fetchCandidates: async () => JSON.stringify(capture()) });
		assert.equal(first.results[0]!.status, "available");
		const updated = capture();
		const priorUrl = updated.documents[0]!.url;
		const url = "https://www.polkcountyiowa.gov/media/qrstuvwx/current-candidates.pdf";
		updated.documents[0]!.url = url;
		updated.discovery.pages[0]!.body = updated.discovery.pages[0]!.body.replace(priorUrl, url);
		updated.discovery.pages[0]!.sha256 = hash(updated.discovery.pages[0]!.body);
		let requests = 0;
		const next = await syncStateBallotCycles({ familyId: source.id, enabledSourceIds: [source.id], catalogPath, dataDirectory: directory, now: () => now + 1000, fetchDiscovery: async () => JSON.stringify(updated.discovery), fetchCandidates: async () => {
			requests++;
			return JSON.stringify(updated);
		} });
		assert.equal(next.results[0]!.status, "available");
		assert.equal(next.results[0]!.imported, true);
		assert.equal(next.results[0]!.retrievedAt, instant);
		assert.equal(requests, 1);
		const reader = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => now + 1000, fetchText: async () => {
			throw new Error("Unexpected fetch");
		} });
		assert.equal((await reader.getSnapshot("IA"))!.documents![0]!.url, url);
	}
	finally {
		await rm(directory, { recursive: true });
	}
});
