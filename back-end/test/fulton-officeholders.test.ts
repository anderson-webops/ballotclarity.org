import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { collectFultonOfficeholders } from "../src/collect-fulton-officeholders.js";
import { createFultonOfficeholderRepository, FultonOfficeholderUnavailableError, importFultonOfficeholders, readFultonOfficeholderEnvelope, withFultonOfficeholderLock } from "../src/fulton-officeholder-storage.js";
import { fultonOfficeholderCsv, fultonOfficeholderPublication, parseFultonBoardSeats, prepareFultonOfficeholders, validateFultonOfficeholderSnapshot } from "../src/fulton-officeholders.js";
import { listSupplementalOfficeholders, listSupplementalOfficeholdersForDistrictMatches, resolveFultonSupplementalOfficeholders } from "../src/supplemental-officeholders.js";
import { exampleFultonOfficeholders, exampleFultonPublications, officeholderHash, officeholderTestTime } from "./helpers/fulton-officeholders.js";

test("Fulton board publications identify seven seats, six people, portraits and one explicit vacancy", () => {
	const source = exampleFultonPublications();
	const seats = parseFultonBoardSeats(source.roster, source.finder);
	assert.equal(seats.length, 7);
	assert.equal(seats.filter(seat => seat.person).length, 6);
	assert.deepEqual(seats[4], { district: 4, status: "vacant" });
	assert.equal(seats[6]!.person!.viceChair, true);
	assert.equal(seats[1]!.person!.officialWebsiteUrl, "https://fultoncountyga.gov/Commissioners/Alex-One");
	assert.equal(seats[1]!.person!.portraitUrl, "https://fultoncountyga.gov/-/media/Commissioners/1.png");
});

test("Fulton roster refresh discovers a new chair and newly filled seat without person or election-year configuration", () => {
	const snapshot = exampleFultonOfficeholders("Jordan Successor", true, Date.parse("2029-02-01T00:00:00.000Z"));
	validateFultonOfficeholderSnapshot(snapshot, Date.parse("2029-02-02T00:00:00.000Z"));
	assert.equal(snapshot.seats[0]!.person!.name, "Jordan Successor");
	assert.equal(snapshot.seats.filter(seat => seat.person).length, 7);
	assert.equal(snapshot.seats[4]!.person!.name, "Morgan Four");
});

test("contradictory, incomplete, expanded and duplicated official seat inventories require review", () => {
	const source = exampleFultonPublications();
	for (const finder of [source.finder.replace("District 1 - Alex One", "District 1 - Different Name"), source.finder.replace("District 4 - Vacant", "District 4 - Unknown Person"), source.finder.replace("<h3>District 2 - Blair Two</h3>", ""), source.finder.replace("</main>", "<h3>District 7 - New Seat</h3></main>"), source.finder.replace("District 2 - Blair Two", "District 1 - Alex One")]) assert.throws(() => parseFultonBoardSeats(source.roster, finder));
	assert.throws(() => parseFultonBoardSeats(source.roster.replace("seven-member", "eight-member"), source.finder));
	assert.throws(() => parseFultonBoardSeats(source.roster.replace("Chairman</div>", "Council Member</div>"), source.finder));
});

test("officeholder links, card identity, portrait boundaries and policy-link changes are not silently accepted", () => {
	const source = exampleFultonPublications();
	for (const roster of [source.roster.replaceAll("/Commissioners/Alex-One", "https://example.org/person"), source.roster.replaceAll("/Commissioners/Alex-One", "/Commissioners/Alex-One?token=private"), source.roster.replace("/-/media/Commissioners/1.png", "https://example.org/person.png"), source.roster.replace("background-image: url(/-/media/Commissioners/1.png);", "background-image: url(javascript:alert(1));"), source.roster.replaceAll("Alex One", "=FORMULA()"), source.roster.replace("Privacy Statement</a>", "Privacy Statement</a><a href='/other-terms'>Privacy</a>")]) assert.throws(() => parseFultonBoardSeats(roster, source.finder));
});

test("stored officeholder fields and provenance reject wrong counties, clocks, identities, links and vacancy people", () => {
	const original = exampleFultonOfficeholders();
	for (const change of [(value: typeof original) => {
		value.countyFips = "invalid" as "13121";
	}, (value: typeof original) => {
		value.retrievedAt = "invalid";
	}, (value: typeof original) => {
		value.sourceSha256 = "0".repeat(64);
	}, (value: typeof original) => {
		value.seats[4]!.person = value.seats[1]!.person;
	}, (value: typeof original) => {
		value.seats[1]!.person!.officialWebsiteUrl = "https://example.org/";
	}, (value: typeof original) => {
		value.seats[2]!.person!.slug = value.seats[1]!.person!.slug;
	}, (value: typeof original) => {
		value.documents[0]!.capturedAt = "2100-01-01T00:00:00.000Z";
	}, (value: typeof original) => {
		value.seats[1]!.person!.name = "Unsafe\tName";
	}]) {
		const value = structuredClone(original);
		change(value);
		assert.throws(() => validateFultonOfficeholderSnapshot(value, officeholderTestTime));
	}
	assert.throws(() => validateFultonOfficeholderSnapshot({ ...original, extra: true }));
	validateFultonOfficeholderSnapshot(original, officeholderTestTime);
	assert.equal(officeholderHash(JSON.stringify(original.documents)), original.sourceSha256);
});

test("capture preparation verifies publisher policy before parsing roster content", () => {
	const capture = { schemaVersion: 1 as const, type: "fulton-officeholder-capture" as const, documents: [...fultonOfficeholderPublication.policies.map(policy => policy.url), fultonOfficeholderPublication.rosterUrl, fultonOfficeholderPublication.districtUrl].map(url => ({ url, body: "Changed policy", sha256: officeholderHash("Changed policy"), capturedAt: new Date(officeholderTestTime).toISOString() })) };
	assert.throws(() => prepareFultonOfficeholders(capture, officeholderTestTime), /policy/u);
});

test("normalized CSV includes each office and keeps vacant seats separate from people", () => {
	const csv = fultonOfficeholderCsv(exampleFultonOfficeholders());
	assert.equal(csv.trim().split("\n").length, 8);
	assert.match(csv, /"District 4","vacant","","",""/u);
	assert.equal((csv.match(/https:\/\/fultoncountyga.gov\/Commissioners\//gu) ?? []).length, 6);
});

test("new officeholder data replaces the old county chair but preserves unrelated records and requires actual commission geography for district members", () => {
	const original = listSupplementalOfficeholders();
	const records = resolveFultonSupplementalOfficeholders(exampleFultonOfficeholders());
	assert.equal(records.some(record => record.slug === "robb-pitts"), false);
	assert.equal(records.filter(record => record.parentDistrictSlug === "fulton-county").length, 5);
	for (const record of original.filter(record => record.districtSlug !== "fulton-county")) assert.deepEqual(records.find(item => item.slug === record.slug), record);
	const county = [{ districtType: "county", districtCode: "121", id: "county:121", label: "Fulton County", stateFips: "13", sourceSystem: "U.S. Census Geocoder" }];
	assert.deepEqual(listSupplementalOfficeholdersForDistrictMatches(county, "GA", records).map(record => record.name), ["Avery Chair"]);
	assert.deepEqual(listSupplementalOfficeholdersForDistrictMatches(county, "NY", records), []);
	assert(records.filter(record => record.parentDistrictSlug).every(record => record.party === "" && record.biographySummary === ""));
});

test("external imports and restart reads preserve exact source identities and a recoverable previous snapshot", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "fulton-officeholders-"));
	context.after(() => rm(directory, { recursive: true }));
	const first = exampleFultonOfficeholders();
	await importFultonOfficeholders(directory, first, officeholderTestTime);
	assert.deepEqual(createFultonOfficeholderRepository(directory)!.getSnapshot(), first);
	const previous = await readFile(join(directory, "fulton-board.json"), "utf8");
	const next = exampleFultonOfficeholders("Jordan Successor", true, officeholderTestTime + 1);
	await importFultonOfficeholders(directory, next, officeholderTestTime + 1);
	assert.equal(await readFile(join(directory, "fulton-board.previous.json"), "utf8"), previous);
	assert.deepEqual(createFultonOfficeholderRepository(directory)!.getSnapshot(), next);
	assert.equal(readFultonOfficeholderEnvelope(directory, officeholderTestTime + 1).importedAt, new Date(officeholderTestTime + 1).toISOString());
});

test("recent collection is reused without publisher requests or successful-clock changes", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "fulton-officeholders-reuse-"));
	context.after(() => rm(directory, { recursive: true }));
	await importFultonOfficeholders(directory, exampleFultonOfficeholders(), officeholderTestTime);
	const before = await readFile(join(directory, "fulton-board.json"), "utf8");
	const result = await collectFultonOfficeholders({ directory, now: () => officeholderTestTime + 1, request: async () => {
		throw new Error("No publisher request expected");
	} });
	assert.equal(result.publisherRequests, 0);
	assert.equal(result.collected, false);
	assert.equal(await readFile(join(directory, "fulton-board.json"), "utf8"), before);
});

test("blocked refresh retains last-good records and import clocks, records failure and respects retry spacing", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "fulton-officeholders-held-"));
	context.after(() => rm(directory, { recursive: true }));
	await importFultonOfficeholders(directory, exampleFultonOfficeholders(), officeholderTestTime);
	const before = await readFile(join(directory, "fulton-board.json"), "utf8");
	let requests = 0;
	const options = { directory, now: () => officeholderTestTime + fultonOfficeholderPublication.minimumRefreshIntervalMs + 1, request: async () => {
		requests++;
		throw new Error("HTTP 403");
	} };
	await assert.rejects(() => collectFultonOfficeholders(options), /403/u);
	assert.equal(requests, 1);
	assert.equal(await readFile(join(directory, "fulton-board.json"), "utf8"), before);
	await assert.rejects(() => collectFultonOfficeholders(options), /next permitted retry/u);
	assert.equal(requests, 1);
	const datasets = await createFultonOfficeholderRepository(directory)!.inspectSources!();
	assert.equal(datasets[0]!.status, "error");
	assert.equal(datasets[0]!.records, 6);
	assert.equal(datasets[0]!.lastImportAt, new Date(officeholderTestTime).toISOString());
});

test("a changed publisher policy stops before any roster request", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "fulton-officeholders-policy-"));
	context.after(() => rm(directory, { recursive: true }));
	const requested: string[] = [];
	await assert.rejects(() => collectFultonOfficeholders({ directory, now: () => officeholderTestTime, request: async (url) => {
		requested.push(String(url));
		return "Changed policy";
	} }), /policy/u);
	assert.deepEqual(requested, [fultonOfficeholderPublication.policies[0].url]);
});

test("missing or symlinked configured data is an error, never an empty healthy roster", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "fulton-officeholders-invalid-"));
	context.after(() => rm(directory, { recursive: true }));
	const repository = createFultonOfficeholderRepository(directory)!;
	assert.throws(() => repository.getSnapshot(), FultonOfficeholderUnavailableError);
	assert.equal((await repository.inspectSources!())[0]!.status, "error");
	const target = join(directory, "outside.json");
	await writeFile(target, "{}");
	await symlink(target, join(directory, "fulton-board.json"));
	assert.throws(() => repository.getSnapshot(), FultonOfficeholderUnavailableError);
	assert.throws(() => createFultonOfficeholderRepository("relative/path"));
});

test("a second collector cannot replace a lock owned by an active collector", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "fulton-officeholders-lock-"));
	context.after(() => rm(directory, { recursive: true }));
	await withFultonOfficeholderLock(directory, async () => {
		await assert.rejects(() => withFultonOfficeholderLock(directory, async () => {}), { code: "EEXIST" });
	});
});
