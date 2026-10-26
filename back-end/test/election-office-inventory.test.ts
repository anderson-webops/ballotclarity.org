import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { collectHennepinOfficeCapture, hennepinOfficePolicies, hennepinOfficePolicyFingerprint, hennepinOfficePolicyReceipts, persistOfficeInventory, readOfficeInventoryCapture, readOfficeInventoryState } from "../src/election-office-collection.js";
import { auditOfficeInventory, hennepinOfficeSource, parseHennepinOfficeInventory, serializeOfficeInventoryCsv } from "../src/election-office-inventory.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";

const fixture = readFileSync(new URL("./fixtures/hennepin-office-inventory.html", import.meta.url), "utf8");
const retrievedAt = "2026-10-26T02:41:59.505Z";
const now = Date.parse("2026-10-26T03:00:00.000Z");
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const read = (body = fixture) => parseHennepinOfficeInventory(body, retrievedAt, now);
function capture(body = fixture, clock = retrievedAt) {
	return JSON.stringify({ schemaVersion: 1, type: "hennepin-office-inventory-capture", policies: hennepinOfficePolicyReceipts, page: { url: hennepinOfficeSource.url, body, sha256: hash(body), retrievedAt: clock } });
}
function snapshot(): StateBallotSnapshot {
	const source = configuredStateBallotSources.find(source => source.id === "mn-independence-2026")!;
	return { source, retrievedAt, sha256: "b".repeat(64), records: [
		createStateCandidateRecord(source, { name: "Example Senator", office: "United States Senator", scope: "statewide", status: "listed", party: "" })!,
		createStateCandidateRecord(source, { name: "Example Representative", office: "United States Representative", scope: "congressional", district: "3", status: "listed", party: "" })!,
		createStateCandidateRecord(source, { name: "Example House Member", office: "State Representative", scope: "state-house", district: "37A", status: "listed", party: "" })!,
	] };
}

test("Hennepin inventory retains 91 printed office rows, not 91 candidates or individual contests", () => {
	const inventory = read();
	assert.equal(inventory.rows.length, 91);
	assert.equal(inventory.questionReferences.length, 1);
	assert.equal(inventory.electionDate, "2026-11-03");
	assert.equal(inventory.publicationDate, "2026-09-02");
	assert.deepEqual(Object.fromEntries([...new Set(inventory.rows.map(row => row.group))].map(group => [group, inventory.rows.filter(row => row.group === group).length])), { "Federal Offices": 2, "State Offices": 6, "County Offices": 4, "City Offices": 38, "School District Offices": 13, "Judicial Offices": 28 });
	assert.equal(inventory.rows.find(row => row.area === "ISD 281 Robbinsdale")?.office, "4 School Board members, 3 ballot questions");
	assert.ok(inventory.rows.some(row => row.area === "Loretto"));
	assert.ok(inventory.rows.some(row => row.area === "Champlin" && /special/iu.test(row.office)));
	assert.ok(inventory.rows.filter(row => row.group === "Judicial Offices").every(row => !/[()]/u.test(row.office) && !row.comparisonRole));
	assert.ok(inventory.rows.every(row => !("name" in row) && !("status" in row)));
	assert.match(inventory.sourceSha256, /^[a-f0-9]{64}$/u);
});

test("Hennepin comparisons use exact office and lettered district keys with no local or judicial guesses", () => {
	const inventory = read();
	const audit = auditOfficeInventory(inventory, [snapshot()]);
	assert.equal(audit.comparableScheduledOffices, 59);
	assert.equal(audit.unassessedInventoryRows, 83);
	assert.equal(audit.representedOffices, 3);
	assert.equal(audit.notRepresentedOffices, 56);
	assert.equal(audit.comparisons.find(row => row.key === "state-house:37A")?.records.length, 1);
	assert.equal(audit.comparisons.find(row => row.key === "state-house:37B")?.records.length, 0);
	const wrongScope = snapshot();
	wrongScope.records[1]!.scope = "local";
	assert.equal(auditOfficeInventory(inventory, [wrongScope]).representedOffices, 2);
	const inactive = snapshot();
	inactive.records[0]!.status = "withdrawn";
	assert.equal(auditOfficeInventory(inventory, [inactive]).representedOffices, 2);
	assert.match(audit.comparisonScope, /not candidate qualification/u);
});

test("Missing or wrong-election inputs stay explicitly unassessed instead of reporting healthy zero coverage", () => {
	const inventory = read();
	assert.equal(auditOfficeInventory(inventory, []).status, "candidate-input-not-configured");
	const stale = snapshot();
	stale.source = { ...stale.source, electionDate: "2024-11-05" };
	const audit = auditOfficeInventory(inventory, [stale]);
	assert.equal(audit.status, "no-same-election-candidate-snapshot");
	assert.equal(audit.notRepresentedOffices, 0);
	assert.ok(audit.comparisons.every(row => row.status === "not-compared"));
	assert.throws(() => auditOfficeInventory(inventory, [snapshot(), snapshot()]), /distinct/u);
	stale.source = { ...stale.source, stateCode: "WI" };
	assert.throws(() => auditOfficeInventory(inventory, [stale]), /same state/u);
});

test("A future publisher-printed general-election date is parsed without manufacturing future nominees", () => {
	const body = fixture.replaceAll("2026", "2028").replaceAll("November 3,", "November 7,");
	const inventory = parseHennepinOfficeInventory(body, "2028-10-20T12:00:00.000Z", Date.parse("2028-10-21T12:00:00.000Z"));
	assert.equal(inventory.electionDate, "2028-11-07");
	assert.equal(inventory.rows.length, 91);
	assert.equal(auditOfficeInventory(inventory, [snapshot()]).status, "no-same-election-candidate-snapshot");
	assert.notEqual(inventory.rows[0]!.id, read().rows[0]!.id);
});

test("Office publication changes fail closed on ambiguous dates, labels, hidden content and incomplete lists", () => {
	for (const body of [
		fixture.replace("November 3, 2026", "November 4, 2026"),
		fixture.replace("September 2, 2026", "February 30, 2026"),
		fixture.replace("Federal Offices", "Unreviewed Offices"),
		fixture.replace("State Offices", "Federal Offices"),
		fixture.replace("<ul>", "<ul hidden>"),
		fixture.replace("<ul>", "<ul><li><ul><li>nested</li></ul></li>"),
		fixture.replace("<ul>", "<form></form><ul>"),
		fixture.replace("37A", "37"),
		fixture.replace("37A", "37B"),
		fixture.replace("<main>", `<main>${"<div>".repeat(70)}`).replace("</main>", `${"</div>".repeat(70)}</main>`),
	]) assert.throws(() => read(body));
	assert.throws(() => parseHennepinOfficeInventory(fixture, "2026-10-27T00:00:00.000Z", now), /clock/u);
	assert.throws(() => read("x".repeat(2 * 1024 * 1024 + 1)), /capture/u);
});

test("Capture envelopes bind exact source, policy receipts, bytes and capture clocks", () => {
	assert.equal(readOfficeInventoryCapture(capture(), now).inventory.rows.length, 91);
	for (const mutate of [
		(value: any) => { value.page.url = "https://example.com/"; },
		(value: any) => { value.page.body += "changed"; },
		(value: any) => { value.policies[0].sha256 = "0".repeat(64); },
		(value: any) => { value.extra = true; },
		(value: any) => { value.page.retrievedAt = "2026-10-27T00:00:00.000Z"; },
	]) {
		const value = JSON.parse(capture());
		mutate(value);
		assert.throws(() => readOfficeInventoryCapture(JSON.stringify(value), now), /provenance/u);
	}
});

test("Only the known copyright year token can change without a new legal-footer review", () => {
	const url = hennepinOfficePolicies[1].url;
	const home = "<html><body><footer><a href=\"/privacy\">Privacy</a> © Copyright 2026 Hennepin County. All rights reserved</footer></body></html>";
	const baseline = hennepinOfficePolicyFingerprint(home, "legal-footer", url);
	assert.equal(hennepinOfficePolicyFingerprint(home.replace("2026", "2028"), "legal-footer", url), baseline);
	assert.throws(() => hennepinOfficePolicyFingerprint(home.replace("All rights", "Some rights"), "legal-footer", url), /copyright/u);
	assert.notEqual(hennepinOfficePolicyFingerprint(home.replace("/privacy", "/new-privacy"), "legal-footer", url), baseline);
	assert.throws(() => hennepinOfficePolicyFingerprint(`${home}<footer>extra</footer>`, "legal-footer", url), /footer/u);
});

test("A changed county access policy stops acquisition before the office publication is requested", async () => {
	const requested: string[] = [];
	await assert.rejects(collectHennepinOfficeCapture({ requestText: async (url, options) => {
		requested.push(url);
		assert.equal(options.maxRedirects, 0);
		assert.equal(options.timeoutMs, 25000);
		assert.deepEqual(options.allowedHosts, ["www.hennepincounty.gov"]);
		return "User-agent: *\nDisallow: /\n";
	}, wait: async () => {} }), /policy requires review/u);
	assert.deepEqual(requested, [hennepinOfficePolicies[0].url]);
});

test("External inventory state survives cold reads, preserves cached source clocks and keeps recoverable history", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-offices-"));
	try {
		const initial = await persistOfficeInventory(directory, capture(), [snapshot()], now);
		assert.equal(initial.inventoryChanged, true);
		assert.equal((await readOfficeInventoryState(directory, now))!.audit.representedOffices, 3);
		const later = now + 60000;
		const repeated = await persistOfficeInventory(directory, capture(fixture, new Date(later).toISOString()), [snapshot()], later);
		assert.equal(repeated.inventoryChanged, false);
		assert.equal(repeated.auditChanged, false);
		assert.equal(repeated.state.lastInventoryImportAt, initial.state.lastInventoryImportAt);
		assert.equal(repeated.state.lastAuditPreparedAt, initial.state.lastAuditPreparedAt);
		assert.equal(repeated.state.inventory.retrievedAt, retrievedAt);
		assert.equal(repeated.state.lastSourceCheckAt, new Date(later).toISOString());
		const updated = snapshot();
		updated.records = updated.records.slice(1);
		const auditOnly = await persistOfficeInventory(directory, repeated.state.capture, [updated], later + 1);
		assert.equal(auditOnly.auditChanged, true);
		assert.equal(auditOnly.state.lastSourceCheckAt, repeated.state.lastSourceCheckAt);
		assert.equal(auditOnly.state.lastInventoryImportAt, initial.state.lastInventoryImportAt);
		assert.equal(auditOnly.state.audit.representedOffices, 2);
		const history = await readdir(join(directory, hennepinOfficeSource.id, "history"));
		assert.equal(history.length, 1);
		const previous = JSON.parse(await readFile(join(directory, hennepinOfficeSource.id, "history", history[0]!), "utf8"));
		assert.deepEqual(previous, repeated.state);
		await assert.rejects(persistOfficeInventory(directory, capture(fixture.replace("September 2,", "September 3,")), [snapshot()], later + 2), /older office publication/u);
		assert.deepEqual(await readOfficeInventoryState(directory, later + 2), auditOnly.state);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Corrupt, locked, symlinked and in-checkout inventory storage never replaces accepted evidence", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-offices-"));
	try {
		const result = await persistOfficeInventory(directory, capture(), [snapshot()], now);
		const path = join(directory, hennepinOfficeSource.id, "current.json");
		const original = await readFile(path, "utf8");
		const corrupt = JSON.parse(original);
		corrupt.audit.representedOffices++;
		corrupt.auditSha256 = hash(JSON.stringify(corrupt.audit));
		await writeFile(path, JSON.stringify(corrupt));
		await assert.rejects(readOfficeInventoryState(directory, now), /totals/u);
		await writeFile(path, original);
		await writeFile(join(directory, hennepinOfficeSource.id, ".write.lock"), "owned by another collector");
		await assert.rejects(persistOfficeInventory(directory, capture(), [], now), /EEXIST/u);
		assert.equal(await readFile(path, "utf8"), original);
		await rm(join(directory, hennepinOfficeSource.id, ".write.lock"));
		await rm(path);
		await symlink(join(directory, "target.json"), path);
		await assert.rejects(persistOfficeInventory(directory, capture(), [], now), /ELOOP/u);
		assert.equal(result.state.inventory.rows.length, 91);
		await assert.rejects(persistOfficeInventory(new URL("../", import.meta.url).pathname, capture(), [], now), /outside/u);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("CSV exports preserve consistent fields and neutralize spreadsheet formula cells", () => {
	const inventory = read();
	inventory.rows[0]!.office = "=HYPERLINK(\"bad\")";
	const csv = serializeOfficeInventoryCsv(inventory);
	assert.equal(csv.trim().split("\n").length, 92);
	assert.match(csv, /"'=HYPERLINK\(""bad""\)"/u);
	assert.match(csv.split("\n")[0]!, /"election_date"/u);
});
