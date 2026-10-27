import type { StateBallotWorkbookSheet } from "../src/state-ballot-workbook.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { crc32, deflateRawSync } from "node:zlib";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { orderStateBallotSources, StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import {
	fetchVermontCandidateCapture,
	fetchVermontCycleDiscovery,
	parseVermontCandidateCapture,
	readVermontElectionDiscovery,
	vermontDiscoveryUrl,
	vermontPolicyReceipts
} from "../src/state-ballot-vermont.js";
import { readStateBallotWorkbook, stateBallotWorkbookContract } from "../src/state-ballot-workbook.js";

const source = configuredStateBallotSources.find(item => item.id === "vt-sos-2026")!;
const now = Date.parse("2026-10-25T14:00:00.000Z");
const headers = [
	"Contest",
	"District Name",
	"Name On Ballot",
	"Town Of Residence",
	"Party",
	"Address",
	"City",
	"State",
	"Zip",
	"Day Time Phone",
	"Evening Phone",
	"Email",
	"Website",
	"Term Length(Years)",
	"Vote for Count",
	"Financial Disclosure"
];
function row(office: string,	district: string,	name: string,	party = "DEMOCRATIC",	website: string | null = null,	seats = "ONE") {
	return [
		office,
		district,
		name,
		"Private residence",
		party,
		"Private street",
		"Private city",
		"VT",
		"Private ZIP",
		"Private phone",
		"Private evening",
		"Private email",
		website,
		2,
		seats,
		"Private disclosure"
	];
}
function capture(
	date = source.electionDate,
	rows = [
		row("GOVERNOR", "N/A", "Alex Sample", "DEM/PROG", "EXAMPLE.ORG/KeepCase"),
		row("STATE REPRESENTATIVE", "ADD RUT", "Casey Example", "UNKNOWN", "not-public@example.invalid", "TWO"),
		row("JUSTICE OF THE PEACE", "EXAMPLE TOWN", "Jordan Sample", "DEM/REP", "http://localhost/private", "FIFTEEN"),
		row("STATE SENATOR", "CHI CT 1", "Morgan Example")
	]
) {
	const year = date.slice(0, 4);
	const workbookUrl = source.url.replace("2026_general", `${year}_general`);
	const index = `<h1>General Election Candidates</h1><p>Primary Election - Tuesday, August 11, ${year} | General Election - Tuesday, November ${Number(date.slice(-2))}, ${year}</p><a href="${workbookUrl}">${year} General Election Candidate Listing/Financial Disclosure</a><a href="https://www.vermont.gov/policies/privacy">Privacy</a>`;
	return {
		schemaVersion: 1,
		type: "vermont-election-discovery",
		policies: vermontPolicyReceipts,
		index,
		workbook: {
			url: workbookUrl,
			sha256: "a".repeat(64),
			retrievedAt: `${year}-10-25T14:00:00.000Z`,
			sheets: [
				{ sheet: "Candidate Listing", data: [[...headers], ...rows] },
				{ sheet: "Selection Criteria", data: [[`Last Updated: 9/23/${year}`]] }
			]
		}
	};
}
const body = (value = capture()) => JSON.stringify(value);
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll("\"", "&quot;");
function archive(files: Record<string, string>) {
	const local: Buffer[] = [];
	const central: Buffer[] = [];
	let offset = 0;
	for (const [name, text] of Object.entries(files)) {
		const nameBytes = Buffer.from(name);
		const contents = Buffer.from(text);
		const compressed = deflateRawSync(contents);
		const header = Buffer.alloc(30);
		header.writeUInt32LE(0x04034B50);
		header.writeUInt16LE(20, 4);
		header.writeUInt16LE(8, 8);
		header.writeUInt32LE(crc32(contents), 14);
		header.writeUInt32LE(compressed.length, 18);
		header.writeUInt32LE(contents.length, 22);
		header.writeUInt16LE(nameBytes.length, 26);
		local.push(header, nameBytes, compressed);
		const directory = Buffer.alloc(46);
		directory.writeUInt32LE(0x02014B50);
		directory.writeUInt16LE(20, 4);
		directory.writeUInt16LE(20, 6);
		directory.writeUInt16LE(8, 10);
		directory.writeUInt32LE(crc32(contents), 16);
		directory.writeUInt32LE(compressed.length, 20);
		directory.writeUInt32LE(contents.length, 24);
		directory.writeUInt16LE(nameBytes.length, 28);
		directory.writeUInt32LE(offset, 42);
		central.push(directory, nameBytes);
		offset += header.length + nameBytes.length + compressed.length;
	}
	const directory = Buffer.concat(central);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054B50);
	end.writeUInt16LE(Object.keys(files).length, 8);
	end.writeUInt16LE(Object.keys(files).length, 10);
	end.writeUInt32LE(directory.length, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([...local, directory, end]);
}
function workbookFiles() {
	const sheets = capture().workbook.sheets;
	const xml = (rows: StateBallotWorkbookSheet["data"]) =>
		`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:P${rows.length}"/><sheetData>${rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, column) => `<c r="${String.fromCharCode(65 + column)}${rowIndex + 1}"${typeof value === "number" ? "" : " t=\"inlineStr\""}>${typeof value === "number" ? `<v>${value}</v>` : `<is><t>${escape(String(value ?? ""))}</t></is>`}</c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
	return {
		"[Content_Types].xml":
			"<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/><Override PartName=\"/xl/worksheets/sheet2.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>",
		"_rels/.rels":
			"<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>",
		"xl/workbook.xml":
			"<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"Candidate Listing\" sheetId=\"1\" r:id=\"rId1\"/><sheet name=\"Selection Criteria\" sheetId=\"2\" r:id=\"rId2\"/></sheets></workbook>",
		"xl/_rels/workbook.xml.rels":
			"<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet2.xml\"/></Relationships>",
		"xl/worksheets/sheet1.xml": xml(sheets[0]!.data),
		"xl/worksheets/sheet2.xml": xml(sheets[1]!.data)
	};
}

function printerWorkbookFiles() {
	const files: Record<string, string> = workbookFiles();
	files["[Content_Types].xml"] = files["[Content_Types].xml"]!.replace("</Types>", "<Default Extension=\"bin\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.printerSettings\"/></Types>");
	files["xl/worksheets/_rels/sheet1.xml.rels"] = "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"print1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/printerSettings\" Target=\"../printerSettings/printerSettings1.bin\"/></Relationships>";
	files["xl/printerSettings/printerSettings1.bin"] = "\0".repeat(11400);
	return files;
}

test("only the Boone workbook profile ignores bounded internal printer metadata", async () => {
	const bytes = archive(printerWorkbookFiles());
	await assert.rejects(readStateBallotWorkbook(bytes), /failed/u);
	assert.deepEqual(await readStateBallotWorkbook(bytes, "boone-candidates"), capture().workbook.sheets);
	await assert.rejects(readStateBallotWorkbook(bytes, "unsupported" as "boone-candidates"), /format or size/u);
});

test("Boone printer metadata requires its exact internal role and keeps binary bounds", async () => {
	for (const change of [
		(files: Record<string, string>) => { files["xl/printerSettings/printerSettings1.bin"] = ""; },
		(files: Record<string, string>) => { files["xl/printerSettings/printerSettings1.bin"] = "x".repeat(16385); },
		(files: Record<string, string>) => { files["xl/printerSettings/other.bin"] = "not allowed"; },
		(files: Record<string, string>) => { files["xl/vbaProject.bin"] = "not allowed"; },
		(files: Record<string, string>) => { delete files["xl/worksheets/_rels/sheet1.xml.rels"]; },
		(files: Record<string, string>) => { files["[Content_Types].xml"] = files["[Content_Types].xml"]!.replace("Extension=\"bin\"", "Extension=\"other\""); },
		(files: Record<string, string>) => { files["xl/worksheets/_rels/sheet1.xml.rels"] = files["xl/worksheets/_rels/sheet1.xml.rels"]!.replace(" Id=", " TargetMode=\"External\" Id="); },
		(files: Record<string, string>) => { files["xl/worksheets/sheet1.xml"] = files["xl/worksheets/sheet1.xml"]!.replace("<sheetData>", "<sheetData><f>1+1</f>"); },
		(files: Record<string, string>) => { files["xl/worksheets/sheet1.xml"] = files["xl/worksheets/sheet1.xml"]!.replace("<row ", "<row hidden=\"1\" "); },
		(files: Record<string, string>) => { files["xl/workbook.xml"] = files["xl/workbook.xml"]!.replace("<sheet ", "<sheet state=\"veryHidden\" "); },
		(files: Record<string, string>) => { files["xl/styles.xml"] = "<styleSheet><fonts><font><strike/></font></fonts></styleSheet>"; },
		(files: Record<string, string>) => { files["custom.xml"] = "<!DOCTYPE x [<!ENTITY hidden 'value'>]><x/>"; },
	]) {
		const files = printerWorkbookFiles();
		change(files);
		await assert.rejects(readStateBallotWorkbook(archive(files), "boone-candidates"), /failed/u);
	}
});

test("the bounded workbook worker reads all sheets without a host conversion tool", async () => {
	assert.deepEqual(await readStateBallotWorkbook(archive(workbookFiles())), capture().workbook.sheets);
	assert.equal(stateBallotWorkbookContract.timeoutMs, 12000);
});

test("workbook limits reject corrupt, encrypted, oversized, formula and entity-bearing archives", async () => {
	await assert.rejects(readStateBallotWorkbook(Buffer.from("bad")), /format or size/u);
	await assert.rejects(
		readStateBallotWorkbook(Buffer.alloc(stateBallotWorkbookContract.maximumBytes + 1)),
		/format or size/u
	);
	const corrupted = archive(workbookFiles());
	corrupted[40] = corrupted[40]! ^ 1;
	await assert.rejects(readStateBallotWorkbook(corrupted), /failed/u);
	const encrypted = archive(workbookFiles());
	encrypted.writeUInt16LE(1, 6);
	await assert.rejects(readStateBallotWorkbook(encrypted), /failed/u);
	for (const value of ["<!DOCTYPE x [<!ENTITY secret \"bad\">]>", "<f>1+1</f>"]) {
		const files = workbookFiles();
		files["xl/worksheets/sheet1.xml"] = files["xl/worksheets/sheet1.xml"].replace(
			"<sheetData>",
			`<sheetData>${value}`
		);
		await assert.rejects(readStateBallotWorkbook(archive(files)), /failed/u);
	}
	const huge = archive({
		...workbookFiles(),
		"custom.xml": "x".repeat(stateBallotWorkbookContract.maximumEntryBytes + 1)
	});
	await assert.rejects(readStateBallotWorkbook(huge), /failed/u);
});

test("Vermont retains literal parties, term/vote limits and source areas, excluding all private fields", () => {
	const records = parseStateCandidateRecords(source, body());
	assert.equal(records.length, 4);
	assert.equal(records[0]!.candidateUrl, "https://example.org/KeepCase");
	assert.equal(records[0]!.party, "DEM/PROG");
	assert.equal(records[1]!.party, undefined);
	assert.equal(records[1]!.candidateUrl, undefined);
	assert.equal(records[1]!.district, "");
	assert.equal(records[1]!.sourceDistrictLabel, "ADD RUT");
	assert.equal(records[2]!.jurisdiction, "EXAMPLE TOWN");
	assert.equal(records[2]!.voteLimit, 15);
	assert.equal(records[2]!.seats, undefined);
	assert.equal(records[2]!.candidateUrl, undefined);
	assert.doesNotMatch(JSON.stringify(records), /Private|not-public|localhost|@/u);
	const changed = capture();
	changed.workbook.sheets[0]!.data[1]![5] = "Another private address";
	assert.deepEqual(parseStateCandidateRecords(source, body(changed)), records);
	assert.equal(
		buildStateBallotPreview(
			{ source, ...parseVermontCandidateCapture(source, body()) },
			{
				districtMatches: [
					{
						id: "not-mapped",
						districtCode: "1",
						districtType: "state-house",
						label: "House 1",
						sourceSystem: "census-geocoder"
					}
				]
			}
		)!.contests.length,
		1
	);
});

test("changed columns, missing parties, ambiguous offices, revisions and duplicate identities fail", () => {
	for (const mutate of [
		(value: ReturnType<typeof capture>) => {
			value.workbook.sheets[0]!.data[0]![0] = "Changed";
		},
		(value: ReturnType<typeof capture>) => {
			value.workbook.sheets[0]!.data[1]![4] = null;
		},
		(value: ReturnType<typeof capture>) => {
			value.workbook.sheets[0]!.data[1]![0] = "NEW OFFICE";
		},
		(value: ReturnType<typeof capture>) => {
			value.workbook.sheets[1]!.data[0]![0] = "Last Updated: 12/31/2026";
		},
		(value: ReturnType<typeof capture>) => {
			value.workbook.sheets[0]!.data.push(value.workbook.sheets[0]!.data[1]!);
		}
	]) {
		const value = capture();
		mutate(value);
		assert.throws(() => parseVermontCandidateCapture(source, body(value)));
	}
});

test("published election dates and actual document controls bind current and future catalogs", () => {
	const current = discoverStateBallotElectionCycles(body(), source.id, now);
	assert.equal(current.elections[0]!.workbookUrl, source.url);
	assert.deepEqual(stateBallotCycleSources(current, now), []);
	const future = capture("2028-11-07");
	const futureNow = Date.parse("2028-10-25T14:00:00.000Z");
	const catalog = discoverStateBallotElectionCycles(body(future), source.id, futureNow);
	const next = stateBallotCycleSources(catalog, futureNow)[0]!;
	assert.equal(next.id, "vt-general-2028-11-07");
	assert.equal(next.url, future.workbook.url);
	assert.equal(parseVermontCandidateCapture(next, body(future)).records.length, 4);
	for (const mutate of [
		(value: ReturnType<typeof capture>) => {
			value.index = value.index.replace("November 3", "November 4");
		},
		(value: ReturnType<typeof capture>) => {
			value.index += `<a href="${source.url}">2026 General Election Candidate Listing/Financial Disclosure</a>`;
		},
		(value: ReturnType<typeof capture>) => {
			value.workbook.url = "https://other.example.invalid/candidates.xlsx";
		},
		(value: ReturnType<typeof capture>) => {
			value.policies = [] as unknown as typeof vermontPolicyReceipts;
		}
	]) {
		const value = capture();
		mutate(value);
		assert.throws(() => readVermontElectionDiscovery(body(value)));
	}
	assert.throws(() => parseVermontCandidateCapture({ ...source, url: `${source.url}?changed=1` }, body()));
});

test("future empty publications wait durably, exact allowlists remain narrow and stored data reloads offline", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-vt-cycle-"));
	try {
		const catalogPath = join(directory, "catalog.json");
		const options = {
			dataDirectory: directory,
			catalogPath,
			familyId: source.id,
			now: () => now,
			fetchDiscovery: async () => body()
		};
		const first = await syncStateBallotCycles(options);
		assert.equal(first.results[0]!.records, 4);
		assert.equal(first.results[0]!.imported, true);
		const stored = await readFile(join(directory, "vt-sos-2026.json"), "utf8");
		const cached = await syncStateBallotCycles(options);
		assert.equal(cached.results[0]!.imported, false);
		assert.equal(await readFile(join(directory, "vt-sos-2026.json"), "utf8"), stored);
		const repository = createStateBallotRepository({
			sources: [source],
			dataDirectory: directory,
			now: () => now,
			fetchText: async () => {
				throw new Error("Offline reads require no publisher requests");
			}
		});
		assert.equal((await repository.getSnapshot("VT"))!.records.length, 4);
		const future = capture("2028-11-07", []);
		const futureNow = Date.parse("2028-10-25T14:00:00.000Z");
		const futureCatalog = discoverStateBallotElectionCycles(body(future), source.id, futureNow);
		const next = stateBallotCycleSources(futureCatalog, futureNow)[0]!;
		assert.throws(() => parseVermontCandidateCapture(next, body(future)), StateBallotAwaitingRecordsError);
		const waiting = await syncStateBallotCycles({
			...options,
			now: () => futureNow,
			fetchDiscovery: async () => body(future)
		});
		assert.equal(waiting.results[0]!.status, "awaiting-records");
		assert.equal(waiting.results[0]!.imported, false);
		const isolated = await syncStateBallotCycles({
			...options,
			now: () => futureNow,
			fetchDiscovery: async () => body(future),
			enabledSourceIds: [source.id]
		});
		assert.equal(isolated.results.length, 0);
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("the statewide source is preferred while existing South Burlington records remain separately reachable", () => {
	const sources = configuredStateBallotSources.filter(item => item.stateCode === "VT");
	assert.equal(sources.length, 2);
	assert.equal(sources.find(item => item.id !== source.id)!.retrievalPolicy, "manual-snapshot");
	assert.equal(orderStateBallotSources(sources, now)[0]!.id, source.id);
});

test("a publisher-policy change stops before candidate acquisition", async () => {
	let indexRequests = 0;
	await assert.rejects(
		fetchVermontCycleDiscovery({
			requestText: async () => {
				indexRequests++;
				return "";
			},
			requestDocument: async () => ({ status: 403, contentType: "", body: Buffer.alloc(0), etag: undefined })
		}),
		/policy/u
	);
	assert.equal(indexRequests, 0);
	assert.equal(await fetchVermontCandidateCapture(source, body()), body());
});

test("candidate source identity and retained document hashes remain explicit", () => {
	const parsed = parseVermontCandidateCapture(source, body());
	assert.equal(parsed.documents[0]!.sha256, "a".repeat(64));
	assert.equal(parsed.documents[0]!.includedRecordCount, 4);
	assert.equal(
		parsed.sha256,
		createHash("sha256")
			.update(JSON.stringify([{ url: source.url, sha256: "a".repeat(64) }]))
			.digest("hex")
	);
	assert.equal(parsed.retrievedAt, new Date(now).toISOString());
	assert.equal(source.pageUrl, vermontDiscoveryUrl);
	assert.match(createHash("sha256").update(JSON.stringify(parsed.records)).digest("hex"), /^[a-f0-9]{64}$/u);
});
