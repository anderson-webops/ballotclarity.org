import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { extractStateBallotPdfText, stateBallotPdfCollectorContract } from "../src/state-ballot-pdf.js";
import { configuredStateBallotSources, legacyReviewedStateBallotSource } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import {
	fetchTexasCandidateCapture,
	fetchTexasCycleDiscovery,
	parseTexasCandidateCapture,
	readTexasElectionDiscovery,
	texasDiscoveryUrl,
	texasPdfCollectorContract,
	texasPolicyReceipts
} from "../src/state-ballot-texas.js";
import { readReviewedStateFixture } from "./helpers/reviewed-state-fixtures.js";

const source = configuredStateBallotSources.find(item => item.id === "tx-sos-2026")!;
const now = Date.parse("2026-10-25T15:00:00.000Z");
const policy = "<a href=\"https://www.sos.state.tx.us/policies.shtml\">Website Policies</a>";
function capture(date = "2026-11-03") {
	const year = date.slice(0, 4);
	const day = Number(date.slice(-2));
	const pageUrl = `https://www.sos.state.tx.us/elections/laws/${year}-november-general-election.shtml`;
	const urls
		= year === "2026"
			? [...source.documentUrls!]
			: [
					`https://www.sos.state.tx.us/elections/forms/offered-${year}-certification.pdf`,
					`https://www.sos.state.tx.us/elections/forms/offered-${year}-writeins.pdf`
				];
	const pages = Array.from({ length: 254 }, (_, index) => {
		const county = `EXAMPLE ${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`;
		return `Texas Secretary of State\nBallot Certification Report\n${year} NOVEMBER GENERAL ELECTION\nNovember ${date.slice(-2)}, ${year}\nCounty     ${county}\n     GOVERNOR\n          ALEX SAMPLE                REP\n     COUNTY JUDGE\n          CASEY EXAMPLE              DEM\n08/28/${year} 03:21 PM       Page ${index + 1} of 254\n`;
	});
	return {
		schemaVersion: 1,
		type: "texas-certification-discovery",
		policies: texasPolicyReceipts,
		pages: [
			{
				url: texasDiscoveryUrl,
				body: `<div id="content"><a href="${pageUrl}">Nov ${day}, ${year} General Election</a></div>${policy}`
			},
			{
				url: pageUrl,
				body: `<div id="content"><h2>${year} November General Election – November ${day}, ${year}</h2><ul><li><a href="${urls[0]}">${year} Ballot Certification (PDF)</a></li><li><a href="${urls[1]}">${year} Certified List of Write-In Candidates (Federal, State, and District) (PDF)</a></li></ul><h2>${year} November Special Election</h2><a href="https://outside.example.invalid/primary.pdf">Primary</a></div>${policy}`
			}
		],
		documents: [
			{
				url: urls[0]!,
				text: `This constitutes the final ballot certification of candidates.\f${pages.join("\f")}\f`,
				sha256: "a".repeat(64),
				retrievedAt: "2026-10-25T14:00:00.000Z"
			},
			{
				url: urls[1]!,
				text: `The following candidates are certified as properly-filed declared write-in candidates for November ${day}, ${year} General Election.\nOffice Sought                 Name of Candidate\nGovernor                     Jordan Sample\nIN TESTIMONY WHEREOF\f`,
				sha256: "b".repeat(64),
				retrievedAt: "2026-10-25T14:00:01.000Z"
			}
		]
	};
}
const body = (value = capture()) => JSON.stringify(value);

test("Texas retains the original reviewed source and adds a separately validated automatic family", () => {
	assert.equal(source.format, "texas-certified-pdf");
	const original = legacyReviewedStateBallotSource(source)!;
	assert.equal(original.format, "reviewed-pdf");
	assert.equal(original.retrievalPolicy, "manual-snapshot");
	assert.equal(
		legacyReviewedStateBallotSource({ ...source, documentUrls: [...source.documentUrls!].reverse() }),
		null
	);
	const catalog = discoverStateBallotElectionCycles(body(), source.id, now);
	assert.equal(catalog.elections[0]!.electionDate, source.electionDate);
	assert.deepEqual(stateBallotCycleSources(catalog, now), []);
});

test("Texas reconciles every county page without turning a repeated county judge into a statewide official", () => {
	const parsed = parseTexasCandidateCapture(source, body());
	assert.equal(parsed.records.length, 256);
	assert.equal(parsed.records.filter(record => record.scope === "statewide").length, 2);
	assert.equal(parsed.records.filter(record => record.scope === "local").length, 254);
	assert.equal(new Set(parsed.records.map(record => record.id)).size, 256);
	assert.ok(parsed.records.every(record => ["qualified", "write-in"].includes(record.status)));
	assert.equal(parsed.records.find(record => record.status === "write-in")!.party, undefined);
	assert.deepEqual(
		parsed.documents.map(document => document.includedRecordCount),
		[255, 1]
	);
	assert.equal(parsed.verification.repeatedCandidateClaims, 508);
	assert.equal(parsed.verification.counties, 254);
	assert.equal(buildStateBallotPreview({ source, ...parsed }, { districtMatches: [] })!.candidateCount, 2);
	assert.ok(
		parsed.records.every(record => !Object.keys(record).some(key => /address|email|phone|voter/iu.test(key)))
	);
});

test("latest Texas boundary holds protect retained snapshots while keeping all congressional records browsable", () => {
	const original = legacyReviewedStateBallotSource(source)!;
	const retained = parseBundledStateSnapshot(original, readReviewedStateFixture("texas"));
	const congressional = retained.records.find(record => record.scope === "congressional")!;
	const house = retained.records.find(record => record.scope === "state-house")!;
	assert.ok(congressional);
	const lookup = { districtMatches: [congressional, house].map(record => ({ id: `${record.scope}:${record.district}`, districtType: record.scope, districtCode: record.district, label: record.district, sourceSystem: "Unverified boundary vintage" })) };
	for (const snapshot of [retained, { ...retained, source }]) {
		const preview = buildStateBallotPreview(snapshot, lookup)!;
		const displayedIds = new Set(preview.contests.flatMap(contest => contest.candidates.map(candidate => candidate.id)));
		assert.ok(retained.records.filter(record => record.scope === "congressional").every(record => !displayedIds.has(record.id)));
		assert.ok(displayedIds.has(house.id));
		assert.ok(snapshot.records.some(record => record.id === congressional.id));
	}
});

test("Texas future rollovers use actually offered dates and documents, excluding separately headed special elections", async () => {
	const future = capture("2028-11-07");
	const clock = Date.parse("2028-10-25T15:00:00Z");
	const catalog = discoverStateBallotElectionCycles(body(future), source.id, clock);
	const [selected] = stateBallotCycleSources(catalog, clock);
	assert.equal(selected!.id, "tx-general-2028-11-07");
	assert.deepEqual(selected!.withheldDistrictScopes, ["congressional"]);
	assert.equal(selected!.url, future.pages[1]!.url);
	assert.deepEqual(
		selected!.documentUrls,
		future.documents.map(item => item.url)
	);
	assert.equal(parseTexasCandidateCapture(selected!, body(future)).records.length, 256);
	assert.equal(await fetchTexasCandidateCapture(selected!, body(future)), body(future));
	const wrongDate = capture("2028-11-08");
	assert.throws(() => readTexasElectionDiscovery(body(wrongDate)), /ambiguous|unsupported/u);
	const primary = capture();
	primary.pages[0]!.body = primary.pages[0]!.body.replace("General Election", "Primary Election");
	assert.throws(() => readTexasElectionDiscovery(body(primary)), /offered/u);
	const foreign = capture();
	foreign.pages[1]!.body = foreign.pages[1]!.body.replace(
		source.documentUrls![0]!,
		"https://outside.example.invalid/list.pdf"
	);
	assert.throws(() => readTexasElectionDiscovery(body(foreign)), /publisher/u);
});

test("Texas rejects missing, reordered, mixed-date, truncated, unsupported-party and unfamiliar-ticket evidence", () => {
	for (const mutate of [
		(value: ReturnType<typeof capture>) => {
			value.documents[0]!.text = value.documents[0]!.text.replace("Page 4 of 254", "Page 3 of 254");
		},
		(value: ReturnType<typeof capture>) => {
			value.documents[0]!.text = value.documents[0]!.text.replace("November 03, 2026", "November 04, 2026");
		},
		(value: ReturnType<typeof capture>) => {
			value.documents[0]!.text = value.documents[0]!.text.replace("08/28/2026", "08/29/2026");
		},
		(value: ReturnType<typeof capture>) => {
			value.documents[0]!.text = value.documents[0]!.text.replace(
				"ALEX SAMPLE                REP",
				"ALEX SAMPLE                UNKNOWN"
			);
		},
		(value: ReturnType<typeof capture>) => {
			value.documents[0]!.text = value.documents[0]!.text.replace(
				"     GOVERNOR",
				"     PRESIDENT AND VICE PRESIDENT"
			);
		},
		(value: ReturnType<typeof capture>) => {
			value.documents[0]!.text = value.documents[0]!.text.replace(
				"CASEY EXAMPLE              DEM",
				"casey@example.invalid       DEM"
			);
		},
		(value: ReturnType<typeof capture>) => {
			value.documents[1]!.text = value.documents[1]!.text.replace("IN TESTIMONY WHEREOF", "");
		},
		(value: ReturnType<typeof capture>) => {
			value.documents.reverse();
		},
		(value: ReturnType<typeof capture>) => {
			value.documents.pop();
		}
	]) {
		const value = capture();
		mutate(value);
		assert.throws(() => parseTexasCandidateCapture(source, body(value)), /Texas/u);
	}
});

test("Texas reviewed OCR corrections apply only to the exact retained write-in PDF hash", () => {
	const corrected = capture();
	corrected.documents[1]!.text = corrected.documents[1]!.text.replace(
		"Governor                     Jordan Sample",
		"District Attorney, 3fS1 Judicial District- Unexpired Term     L.D.Howard"
	);
	assert.throws(() => parseTexasCandidateCapture(source, body(corrected)), /review/u);
	corrected.documents[1]!.sha256 = "eece7f9fa38c65eef150d62ba0a142672dc187b7feb2f90bc330f9c5a226aa24";
	const record = parseTexasCandidateCapture(source, body(corrected)).records.at(-1)!;
	assert.equal(record.name, "L.D. Howard");
	assert.equal(record.office, "DISTRICT ATTORNEY, 31ST JUDICIAL DISTRICT (UNEXPIRED TERM)");
	assert.equal(record.scope, "local");
});

test("Texas policy drift stops before candidate acquisition and a captured discovery performs no additional request", async () => {
	const requests: string[] = [];
	await assert.rejects(
		fetchTexasCycleDiscovery({
			extractor: async () => "unused",
			requestText: async (url) => {
				requests.push(url);
				return url.endsWith("robots.txt") ? "" : "changed policy";
			}
		}),
		/policy|layout/u
	);
	assert.deepEqual(requests, [texasPolicyReceipts[0].url, texasPolicyReceipts[1].url]);
	assert.equal(
		await fetchTexasCandidateCapture(source, body(), {
			requestText: async () => {
				throw new Error("No further request expected");
			}
		}),
		body()
	);
});

test("Texas durable import is idempotent, serves cold without publishers and retains an unexpired catalog on identity drift", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-texas-cycle-"));
	context.after(() => rm(directory, { recursive: true }));
	const catalogPath = join(directory, "catalog.json");
	const dataDirectory = join(directory, "data");
	const first = await syncStateBallotCycles({
		familyId: source.id,
		catalogPath,
		dataDirectory,
		now: () => now,
		fetchDiscovery: async () => body()
	});
	assert.equal(first.results[0]!.status, "available");
	assert.equal(first.results[0]!.records, 256);
	assert.equal(first.results[0]!.imported, true);
	const second = await syncStateBallotCycles({
		familyId: source.id,
		catalogPath,
		dataDirectory,
		now: () => now + 1000,
		fetchDiscovery: async () => body()
	});
	assert.equal(second.results[0]!.imported, false);
	assert.equal(second.results[0]!.retrievedAt, first.results[0]!.retrievedAt);
	const cold = createStateBallotRepository({
		sources: [source],
		dataDirectory,
		now: () => now + 2000,
		fetchText: async () => {
			throw new Error("Publishers disabled");
		}
	});
	assert.equal((await cold.getSnapshot("TX"))!.records.length, 256);
	const previous = await readFile(catalogPath, "utf8");
	const changed = capture();
	changed.pages[1]!.body = changed.pages[1]!.body.replaceAll(
		source.documentUrls![1]!,
		"https://www.sos.state.tx.us/elections/forms/new-writeins-2026.pdf"
	);
	changed.documents[1]!.url = "https://www.sos.state.tx.us/elections/forms/new-writeins-2026.pdf";
	await assert.rejects(
		syncStateBallotCycles({
			familyId: source.id,
			catalogPath,
			dataDirectory,
			now: () => now + 3000,
			fetchDiscovery: async () => body(changed)
		}),
		/original|unexpired|conflict/u
	);
	assert.equal(await readFile(catalogPath, "utf8"), previous);
});

test("Texas original reviewed files remain readable without an extractor or fresh provider access", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-texas-legacy-"));
	context.after(() => rm(directory, { recursive: true }));
	const original = legacyReviewedStateBallotSource(source)!;
	const snapshot = parseBundledStateSnapshot(original, readReviewedStateFixture("texas"));
	await createStateBallotStorage(directory).write(snapshot);
	let requests = 0;
	const repository = createStateBallotRepository({
		sources: [source],
		dataDirectory: directory,
		now: () => now,
		fetchText: async () => {
			requests++;
			throw new Error("No collection allowed");
		}
	});
	assert.deepEqual((await repository.getSnapshot("TX"))!.records, snapshot.records);
	assert.equal((await repository.getSnapshot("TX"))!.retrievedAt, snapshot.retrievedAt);
	assert.equal(requests, 0);
});

test("Texas has a separately bounded large-report allowance without changing other PDF sources' default", async (context) => {
	assert.equal(stateBallotPdfCollectorContract.maximumPages, 50);
	assert.equal(texasPdfCollectorContract.maximumPages, 2000);
	const directory = await mkdtemp(join(tmpdir(), "ballot-texas-pdf-bound-"));
	context.after(() => rm(directory, { recursive: true }));
	const executable = join(directory, "extractor.mjs");
	await writeFile(
		executable,
		`#!${process.execPath}\nfor await(const chunk of process.stdin){}process.stdout.write('Synthetic page\\f'.repeat(51));`,
		{ mode: 0o700 }
	);
	await assert.rejects(extractStateBallotPdfText(Buffer.from("%PDF-synthetic"), executable), /bounded/u);
	assert.ok(
		(await extractStateBallotPdfText(Buffer.from("%PDF-synthetic"), executable, 12000, "layout", 2000)).includes(
			"Synthetic page"
		)
	);
	await assert.rejects(
		extractStateBallotPdfText(Buffer.from("%PDF-synthetic"), executable, 12000, "layout", 2001),
		/bounds/u
	);
});
