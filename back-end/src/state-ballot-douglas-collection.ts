import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { buildDouglasElectionForm, douglasCalendarUrl, douglasDiscoveryUrl, douglasLinksSha256, douglasOrigin, douglasPolicyFingerprint, douglasPrivacySha256, douglasPrivacyUrl, douglasRecord, douglasRobotsSha256, readDouglasCalendar, readDouglasForm, readDouglasProfile, readDouglasRoster, validateDouglasDate, validateDouglasProfileUrl } from "./state-ballot-douglas.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";

interface Page {
	url: string;
	body: string;
	sha256: string;
	retrievedAt: string;
}
interface Collection {
	electionDate: string;
	selected: Page;
	profiles: Page[];
}
interface Options {
	requestText?: typeof fetchRemoteSourceText;
	sleep?: (milliseconds: number) => Promise<void>;
	now?: () => number;
	discovery?: string;
	onPage?: (page: Page) => Promise<void>;
}
export interface DouglasElection {
	electionId: null;
	electionDate: string;
	pageUrl: string;
	douglasDocuments: { url: string; sha256: string }[];
}
export { douglasDiscoveryUrl };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
function reject(): never {
	throw new Error("The Douglas County collection contract requires review.");
}
export function douglasSource(electionDate: string): StateBallotSource {
	return { stateCode: "NE", id: electionDate === "2026-11-03" ? "ne-douglas-2026" : `ne-douglas-general-${electionDate}`, label: "Douglas County candidate filings", electionDate, url: douglasDiscoveryUrl, pageUrl: douglasDiscoveryUrl, format: "douglas-html", snapshotStorage: "external", countyName: "Douglas County", defaultPriority: -10, ballotPreview: false, scopeNotice: "Candidate filings, not a verified ballot." };
}
export function validateDouglasSource(source: StateBallotSource) {
	validateDouglasDate(source.electionDate);
	const expected = douglasSource(source.electionDate);
	if (source.stateCode !== "NE" || source.id !== expected.id || source.url !== douglasDiscoveryUrl || source.pageUrl !== douglasDiscoveryUrl || source.format !== "douglas-html" || source.countyName !== expected.countyName || source.snapshotStorage !== "external" || source.ballotPreview !== false || source.retrievalPolicy || source.postBody || source.delimiter || source.documentUrls || source.documentLinks || source.withheldDistrictScopes || source.withheldStatewideOffices) return reject();
}
export function validateDouglasElection(value: unknown): asserts value is DouglasElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "douglasDocuments"]) || value.electionId !== null || typeof value.electionDate !== "string" || value.pageUrl !== douglasDiscoveryUrl || !Array.isArray(value.douglasDocuments) || !value.douglasDocuments.length || value.douglasDocuments.length > 401) return reject();
	validateDouglasDate(value.electionDate);
	const urls = new Set<string>();
	for (const [index, item] of value.douglasDocuments.entries()) {
		if (!exact(item, ["url", "sha256"]) || typeof item.url !== "string" || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(item.sha256) || urls.has(item.url)) return reject();
		if (index === 0) {
			if (item.url !== douglasDiscoveryUrl) return reject();
		}
		else {
			validateDouglasProfileUrl(item.url, value.electionDate.slice(0, 4));
		}
		urls.add(item.url);
	}
}
export const douglasDocumentDigest = (documents: readonly { url: string; sha256: string }[]) => hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 }))));
export function readDouglasCandidateDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 20 * 1024 * 1024 || !Number.isFinite(now)) return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "robots", "home", "privacy", "index", "calendar", "collections"]) || value.schemaVersion !== 1 || value.type !== "douglas-candidate-discovery" || !Array.isArray(value.collections) || value.collections.length > 10) return reject();
	function page(input: unknown, url: string): Page {
		if (!exact(input, ["url", "body", "sha256", "retrievedAt"]) || input.url !== url || typeof input.body !== "string" || Buffer.byteLength(input.body) > 2 * 1024 * 1024 || input.sha256 !== hash(input.body) || typeof input.retrievedAt !== "string" || !Number.isFinite(Date.parse(input.retrievedAt)) || new Date(input.retrievedAt).toISOString() !== input.retrievedAt || Date.parse(input.retrievedAt) > now) return reject();
		return input as unknown as Page;
	}
	const robots = page(value.robots, `${douglasOrigin}/robots.txt`);
	const home = page(value.home, `${douglasOrigin}/`);
	const privacy = page(value.privacy, douglasPrivacyUrl);
	const index = page(value.index, douglasDiscoveryUrl);
	const calendar = page(value.calendar, douglasCalendarUrl);
	if (robots.sha256 !== douglasRobotsSha256 || [home, privacy, index, calendar].some(item => douglasPolicyFingerprint(item.body, "links") !== douglasLinksSha256) || douglasPolicyFingerprint(privacy.body, "privacy") !== douglasPrivacySha256) return reject();
	const form = readDouglasForm(index.body);
	if (form.selected !== "") return reject();
	const offered = readDouglasCalendar(calendar.body).filter(date => form.general.some(item => item.year === date.slice(0, 4)));
	if (value.collections.length !== offered.length) return reject();
	const collections = value.collections.map((input, position) => {
		if (!exact(input, ["electionDate", "selected", "profiles"]) || input.electionDate !== offered[position] || !Array.isArray(input.profiles) || input.profiles.length > 400) return reject();
		const electionDate = offered[position]!;
		const selected = page(input.selected, douglasDiscoveryUrl);
		if (Date.parse(selected.retrievedAt) < Math.max(...[robots, home, privacy, index, calendar].map(item => Date.parse(item.retrievedAt)))) return reject();
		if (douglasPolicyFingerprint(selected.body, "links") !== douglasLinksSha256) return reject();
		const roster = readDouglasRoster(selected.body, electionDate);
		const ordinary = roster.filings.filter(filing => filing.profileUrl);
		if (input.profiles.length !== ordinary.length) return reject();
		const profiles = ordinary.map((filing, index) => {
			const profile = page((input.profiles as unknown[])[index], filing.profileUrl!);
			if (Date.parse(profile.retrievedAt) < Date.parse(selected.retrievedAt) || douglasPolicyFingerprint(profile.body, "links") !== douglasLinksSha256) return reject();
			readDouglasProfile(profile.body, filing, electionDate.slice(0, 4));
			return profile;
		});
		return { electionDate, selected, profiles };
	});
	const elections = collections.map((collection) => {
		const election = { electionId: null, electionDate: collection.electionDate, pageUrl: douglasDiscoveryUrl, douglasDocuments: [collection.selected, ...collection.profiles].map(({ url, sha256 }) => ({ url, sha256 })) };
		validateDouglasElection(election);
		return election;
	});
	return { index, collections, elections };
}
export async function fetchDouglasCandidateDiscovery(options: Options = {}) {
	const request = options.requestText ?? fetchRemoteSourceText;
	const sleep = options.sleep ?? (milliseconds => wait(milliseconds));
	const now = options.now ?? Date.now;
	let first = true;
	let size = 0;
	async function capture(url: string, postBody?: string): Promise<Page> {
		if (!first) await sleep(1000);
		first = false;
		const body = await request(url, { allowedHosts: ["www.votedouglascounty-ne.gov"], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 30000, textEncoding: "utf-8-or-windows-1252", ...(postBody ? { postBody } : {}) });
		size += Buffer.byteLength(body);
		if (size > 16 * 1024 * 1024) return reject();
		const page = { url, body, sha256: hash(body), retrievedAt: new Date(now()).toISOString() };
		await options.onPage?.(page);
		return page;
	}
	const robots = await capture(`${douglasOrigin}/robots.txt`);
	if (robots.sha256 !== douglasRobotsSha256) return reject();
	const home = await capture(`${douglasOrigin}/`);
	if (douglasPolicyFingerprint(home.body, "links") !== douglasLinksSha256) return reject();
	const privacy = await capture(douglasPrivacyUrl);
	if (douglasPolicyFingerprint(privacy.body, "links") !== douglasLinksSha256 || douglasPolicyFingerprint(privacy.body, "privacy") !== douglasPrivacySha256) return reject();
	const index = await capture(douglasDiscoveryUrl);
	if (douglasPolicyFingerprint(index.body, "links") !== douglasLinksSha256) return reject();
	const calendar = await capture(douglasCalendarUrl);
	if (douglasPolicyFingerprint(calendar.body, "links") !== douglasLinksSha256) return reject();
	const form = readDouglasForm(index.body);
	const dates = readDouglasCalendar(calendar.body).filter(date => form.general.some(item => item.year === date.slice(0, 4)));
	const collections: Collection[] = [];
	for (const electionDate of dates) {
		const selected = await capture(douglasDiscoveryUrl, buildDouglasElectionForm(index.body, electionDate.slice(0, 4)));
		if (douglasPolicyFingerprint(selected.body, "links") !== douglasLinksSha256) return reject();
		const roster = readDouglasRoster(selected.body, electionDate);
		const profiles: Page[] = [];
		for (const filing of roster.filings.filter(item => item.profileUrl)) {
			const profile = await capture(filing.profileUrl!);
			if (douglasPolicyFingerprint(profile.body, "links") !== douglasLinksSha256) return reject();
			readDouglasProfile(profile.body, filing, electionDate.slice(0, 4));
			profiles.push(profile);
		}
		collections.push({ electionDate, selected, profiles });
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "douglas-candidate-discovery", robots, home, privacy, index, calendar, collections });
	readDouglasCandidateDiscovery(body, now());
	return body;
}
export async function fetchDouglasCandidateCapture(source: StateBallotSource, options: Options = {}) {
	validateDouglasSource(source);
	const discovery = options.discovery ?? await fetchDouglasCandidateDiscovery(options);
	const parsed = readDouglasCandidateDiscovery(discovery, (options.now ?? Date.now)());
	if (parsed.elections.length && !parsed.elections.some(item => item.electionDate === source.electionDate)) return reject();
	return JSON.stringify({ schemaVersion: 1, type: "douglas-candidate-capture", electionDate: source.electionDate, discovery: JSON.parse(discovery) });
}
export function parseDouglasCandidateCapture(source: StateBallotSource, body: string, now = Date.now(), previous: readonly StateCandidateRecord[] = []) {
	validateDouglasSource(source);
	if (Buffer.byteLength(body) > 20 * 1024 * 1024) return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "electionDate", "discovery"]) || value.schemaVersion !== 1 || value.type !== "douglas-candidate-capture" || value.electionDate !== source.electionDate) return reject();
	const discovery = readDouglasCandidateDiscovery(JSON.stringify(value.discovery), now);
	const collection = discovery.collections.find(item => item.electionDate === source.electionDate);
	if (!collection) {
		if (previous.length) return reject();
		throw new StateBallotAwaitingRecordsError(source.id);
	}
	const roster = readDouglasRoster(collection.selected.body, source.electionDate);
	if (!roster.filings.length) {
		if (previous.length) return reject();
		throw new StateBallotAwaitingRecordsError(source.id);
	}
	const claims = roster.filings.map((filing) => {
		const profile = collection.profiles.find(item => item.url === filing.profileUrl);
		const values = profile ? readDouglasProfile(profile.body, filing, source.electionDate.slice(0, 4)) : undefined;
		return { record: douglasRecord(source, filing, values?.party), filedDate: filing.filedDate, officeCategory: filing.office.category, personalAffiliation: values?.affiliation, personalAffiliationNotANomination: true, profileUrl: profile?.url, writeIn: filing.writeIn };
	});
	const records = claims.map(claim => claim.record);
	if (new Set(records.map(item => item.id)).size !== records.length || previous.some(record => !records.some(item => item.id === record.id))) return reject();
	const documents = [collection.selected, ...collection.profiles].map((page, index) => ({ url: page.url, sha256: page.sha256, retrievedAt: page.retrievedAt, includedRecordCount: index === 0 ? roster.filings.filter(item => item.writeIn).length : 1 }));
	const sha256 = douglasDocumentDigest(documents);
	return { records, claims, documents, sha256, collectionIndexSha256: sha256, retrievedAt: collection.selected.retrievedAt };
}
