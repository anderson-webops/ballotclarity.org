import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { auditOfficeInventory, hennepinOfficeSource, parseHennepinOfficeInventory, serializeOfficeInventoryCsv } from "./election-office-inventory.js";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const exact = (value: unknown, fields: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...fields].sort().join(","));
const canonicalTime = (value: unknown, now: number): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= now;
type TextRequest = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
export const hennepinOfficePolicies = [
	{ id: "robots", url: "https://www.hennepincounty.gov/robots.txt", format: "robots", sha256: "2f0bad469b692ef5c39b7ea8ae956980beb07f489a682642a5603166ca816c0d" },
	{ id: "home", url: "https://www.hennepincounty.gov/", format: "legal-footer", sha256: "09f3f43c02a3769ace84cbbf69d694bc503a1a52fe1a87e17554b44c6301d7b2" },
	{ id: "privacy", url: "https://www.hennepincounty.gov/government/about/policies/privacy-security-on-county-websites", format: "main", sha256: "7d81c989c6326d2fca385337d8d6acb6207fc230d4dba2a470f0eac9b17b99a8" },
] as const;
export const hennepinOfficePolicyReceipts = hennepinOfficePolicies.map(({ id, url, sha256 }) => ({ id, url, sha256 }));

export function hennepinOfficePolicyFingerprint(body: string, format: typeof hennepinOfficePolicies[number]["format"], url: string) {
	if (format !== "legal-footer") return electionDocumentPolicyFingerprint(Buffer.from(body), format, url);
	electionDocumentPolicyFingerprint(Buffer.from(body), "links", url);
	const document = parseStateHtml(body);
	const footers = descendants(document, node => node.nodeName === "footer");
	if (footers.length !== 1) throw new Error("The county policy footer requires review.");
	const footer = clean(stateHtmlText(footers[0]!));
	const years = [...footer.matchAll(/© Copyright 20\d{2} Hennepin County\. All rights reserved/gu)];
	if (years.length !== 1) throw new Error("The county copyright statement requires review.");
	const links = descendants(document, node => node.nodeName === "a" && /privacy|terms|licen[cs]e|legal|disclaimer|copyright/iu.test(`${stateHtmlText(node)} ${attribute(node, "href")}`)).map(node => new URL(attribute(node, "href"), url).href);
	const footerLinks = descendants(footers[0]!, node => node.nodeName === "a").map(node => new URL(attribute(node, "href"), url).href);
	return hash(JSON.stringify({ links: [...new Set(links)].sort(), footer: footer.replace(years[0]![0], "© Copyright YEAR Hennepin County. All rights reserved"), footerLinks }));
}

export function readOfficeInventoryCapture(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024) throw new Error("The office inventory capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "policies", "page"]) || value.schemaVersion !== 1 || value.type !== "hennepin-office-inventory-capture" || JSON.stringify(value.policies) !== JSON.stringify(hennepinOfficePolicyReceipts) || !exact(value.page, ["url", "body", "sha256", "retrievedAt"]) || value.page.url !== hennepinOfficeSource.url || typeof value.page.body !== "string" || value.page.sha256 !== hash(value.page.body) || !canonicalTime(value.page.retrievedAt, now)) throw new Error("The office inventory source or policy provenance requires review.");
	const inventory = parseHennepinOfficeInventory(value.page.body, value.page.retrievedAt, now);
	return { inventory, capture: value };
}

export async function collectHennepinOfficeCapture(options: { requestText?: TextRequest; wait?: (milliseconds: number) => Promise<void>; now?: () => number } = {}) {
	const request = options.requestText ?? fetchRemoteSourceText;
	const wait = options.wait ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
	const now = options.now ?? Date.now;
	const transport = { allowedHosts: ["www.hennepincounty.gov"], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 25000 };
	let robots: ReturnType<typeof electionDocumentRobotsPolicy> | undefined;
	const get = async (url: string) => {
		if (robots) {
			if (!robots.allowed(url)) throw new Error("The county robots policy disallows the office publication.");
			await wait(robots.delay);
		}
		return request(url, transport);
	};
	for (const policy of hennepinOfficePolicies) {
		const body = await get(policy.url);
		if (hennepinOfficePolicyFingerprint(body, policy.format, policy.url) !== policy.sha256) throw new Error("The county source access or reuse policy requires review.");
		if (policy.format === "robots") robots = electionDocumentRobotsPolicy(Buffer.from(body));
	}
	const body = await get(hennepinOfficeSource.url);
	const capture = JSON.stringify({ schemaVersion: 1, type: "hennepin-office-inventory-capture", policies: hennepinOfficePolicyReceipts, page: { url: hennepinOfficeSource.url, body, sha256: hash(body), retrievedAt: new Date(now()).toISOString() } });
	readOfficeInventoryCapture(capture, now());
	return capture;
}

interface OfficeInventoryState {
	schemaVersion: 1;
	type: "office-inventory-state";
	capture: string;
	inventory: ReturnType<typeof parseHennepinOfficeInventory>;
	audit: ReturnType<typeof auditOfficeInventory>;
	candidateInputsSha256: string;
	auditSha256: string;
	lastSourceCheckAt: string;
	lastInventoryImportAt: string;
	lastAuditPreparedAt: string;
}

async function directoryPath(directory: string, create: boolean) {
	assertExternalStateDataDirectory(directory);
	if (create) await mkdir(directory, { recursive: true });
	const root = await realpath(directory);
	assertExternalStateDataDirectory(root);
	const path = join(root, hennepinOfficeSource.id);
	if (create) await mkdir(path, { recursive: true });
	if (await realpath(path) !== path) throw new Error("The office inventory source directory cannot be a symbolic link.");
	return path;
}

async function readText(path: string) {
	return new TextDecoder("utf-8", { fatal: true }).decode(await readBoundedStateDataBytes(path, 4 * 1024 * 1024));
}

function parseState(body: string, now: number): OfficeInventoryState {
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "capture", "inventory", "audit", "candidateInputsSha256", "auditSha256", "lastSourceCheckAt", "lastInventoryImportAt", "lastAuditPreparedAt"]) || value.schemaVersion !== 1 || value.type !== "office-inventory-state" || typeof value.capture !== "string" || !canonicalTime(value.lastSourceCheckAt, now) || !canonicalTime(value.lastInventoryImportAt, now) || !canonicalTime(value.lastAuditPreparedAt, now)) throw new Error("The stored office inventory metadata requires review.");
	const parsed = readOfficeInventoryCapture(value.capture, now);
	if (JSON.stringify(parsed.inventory) !== JSON.stringify(value.inventory) || parsed.inventory.retrievedAt > value.lastSourceCheckAt || value.lastInventoryImportAt < parsed.inventory.retrievedAt || value.lastAuditPreparedAt < value.lastInventoryImportAt || hash(JSON.stringify(value.audit)) !== value.auditSha256) throw new Error("The stored office inventory does not match its captured evidence.");
	const audit = value.audit as OfficeInventoryState["audit"];
	if (!audit || audit.schemaVersion !== 1 || audit.type !== "scheduled-office-coverage-audit" || audit.sourceId !== hennepinOfficeSource.id || audit.electionDate !== parsed.inventory.electionDate || audit.sourceSha256 !== parsed.inventory.sourceSha256 || !Array.isArray(audit.candidateSources) || audit.candidateSources.length > 100 || hash(JSON.stringify(audit.candidateSources)) !== value.candidateInputsSha256 || !Array.isArray(audit.comparisons) || audit.comparisons.length > 1000) throw new Error("The stored office coverage audit requires review.");
	const expected = auditOfficeInventory(parsed.inventory, []);
	const identifiers = new Set<string>();
	for (const source of audit.candidateSources) {
		if (!exact(source, ["id", "electionDate", "sourceSha256", "factsSha256", "retrievedAt", "compared"]) || typeof source.id !== "string" || !/^[a-z0-9-]{1,100}$/u.test(source.id) || identifiers.has(source.id) || typeof source.electionDate !== "string" || !/^20\d{2}-\d{2}-\d{2}$/u.test(source.electionDate) || !/^[a-f0-9]{64}$/u.test(String(source.sourceSha256)) || !/^[a-f0-9]{64}$/u.test(String(source.factsSha256)) || !canonicalTime(source.retrievedAt, now) || source.compared !== (source.electionDate === parsed.inventory.electionDate)) throw new Error("The stored candidate evidence requires review.");
		identifiers.add(source.id);
	}
	const compared = audit.candidateSources.some(source => source.compared);
	if (audit.status !== (!identifiers.size ? "candidate-input-not-configured" : compared ? "compared" : "no-same-election-candidate-snapshot") || audit.comparisonScope !== expected.comparisonScope || audit.inventoryRows !== expected.inventoryRows || audit.unassessedInventoryRows !== expected.unassessedInventoryRows || audit.comparableScheduledOffices !== expected.comparableScheduledOffices || audit.comparisons.length !== expected.comparisons.length) throw new Error("The stored office comparison scope is invalid.");
	for (const [index, row] of audit.comparisons.entries()) {
		const identity = expected.comparisons[index]!;
		if (!exact(row, ["inventoryRowId", "key", "status", "records"]) || row.inventoryRowId !== identity.inventoryRowId || row.key !== identity.key || !Array.isArray(row.records) || row.records.length > 25000 || row.records.some(record => !exact(record, ["sourceId", "recordId"]) || typeof record.recordId !== "string" || !/^[a-f0-9]{24,64}$/u.test(record.recordId) || !audit.candidateSources.some(source => source.compared && source.id === record.sourceId)) || row.status !== (!compared ? "not-compared" : row.records.length ? "represented-in-selected-snapshots" : "not-represented-in-selected-snapshots")) throw new Error("The stored office comparison evidence is invalid.");
	}
	if (audit.representedOffices !== audit.comparisons.filter(row => row.status === "represented-in-selected-snapshots").length || audit.notRepresentedOffices !== audit.comparisons.filter(row => row.status === "not-represented-in-selected-snapshots").length) throw new Error("The stored office comparison totals are invalid.");
	return value as unknown as OfficeInventoryState;
}

export async function readOfficeInventoryState(directory: string, now = Date.now()) {
	try {
		const path = await directoryPath(directory, false);
		return parseState(await readText(join(path, "current.json")), now);
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

async function writeAtomic(path: string, body: string) {
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		const handle = await open(temporary, "wx", 0o600);
		try {
			await handle.writeFile(body);
			await handle.sync();
		}
		finally {
			await handle.close();
		}
		await rename(temporary, path);
	}
	finally {
		await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		});
	}
}

async function persistUnlocked(directory: string, body: string, snapshots: readonly StateBallotSnapshot[], now: number) {
	const incoming = readOfficeInventoryCapture(body, now);
	const current = await readOfficeInventoryState(directory, now);
	if (current && (incoming.inventory.electionDate < current.inventory.electionDate || (incoming.inventory.sourceSha256 !== current.inventory.sourceSha256 && incoming.inventory.retrievedAt < current.lastSourceCheckAt))) throw new Error("An older office publication cannot replace newer accepted inventory.");
	const inventoryChanged = !current || current.inventory.sourceSha256 !== incoming.inventory.sourceSha256;
	const capture = inventoryChanged ? body : current.capture;
	const inventory = inventoryChanged ? incoming.inventory : current.inventory;
	const audit = auditOfficeInventory(inventory, snapshots);
	const candidateInputsSha256 = hash(JSON.stringify(audit.candidateSources));
	const auditChanged = inventoryChanged || current.candidateInputsSha256 !== candidateInputsSha256;
	const preparedAt = new Date(now).toISOString();
	const state: OfficeInventoryState = { schemaVersion: 1, type: "office-inventory-state", capture, inventory, audit: auditChanged ? audit : current.audit, candidateInputsSha256, auditSha256: hash(JSON.stringify(auditChanged ? audit : current.audit)), lastSourceCheckAt: current && current.lastSourceCheckAt > incoming.inventory.retrievedAt ? current.lastSourceCheckAt : incoming.inventory.retrievedAt, lastInventoryImportAt: inventoryChanged ? preparedAt : current.lastInventoryImportAt, lastAuditPreparedAt: auditChanged ? preparedAt : current.lastAuditPreparedAt };
	const serialized = JSON.stringify(state);
	parseState(serialized, now);
	const path = await directoryPath(directory, true);
	const previous = await readOfficeInventoryState(directory, now);
	if (JSON.stringify(previous) !== JSON.stringify(current)) throw new Error("The office inventory changed concurrently; retry the collection.");
	if (current && (inventoryChanged || auditChanged)) {
		const history = join(path, "history");
		await mkdir(history, { recursive: true });
		if (await realpath(history) !== history) throw new Error("The office inventory history cannot be a symbolic link.");
		const old = JSON.stringify(current);
		const target = join(history, `${hash(old)}.json`);
		try {
			const handle = await open(target, "wx", 0o600);
			try {
				await handle.writeFile(old);
				await handle.sync();
			}
			finally {
				await handle.close();
			}
		}
		catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST" || await readText(target) !== old) throw error;
		}
	}
	await writeAtomic(join(path, "current.json"), serialized);
	return { state, inventoryChanged, auditChanged, csv: serializeOfficeInventoryCsv(inventory) };
}

export async function persistOfficeInventory(directory: string, body: string, snapshots: readonly StateBallotSnapshot[], now = Date.now()) {
	readOfficeInventoryCapture(body, now);
	const path = await directoryPath(directory, true);
	const lockPath = join(path, ".write.lock");
	const lock = await open(lockPath, "wx", 0o600);
	try {
		return await persistUnlocked(directory, body, snapshots, now);
	}
	finally {
		await lock.close();
		await unlink(lockPath);
	}
}
