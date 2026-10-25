import type { ElectionReferenceSource } from "./election-reference-sources.js";
import type { ElectionReferenceSnapshot } from "./election-references.js";
import type { OpenStatesProfileMember } from "./openstates-profile-evidence.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { extract } from "tar-stream";
import { parseDocument } from "yaml";
import { electionReferenceDocumentDigest, parseElectionReferenceSnapshot } from "./election-references.js";
import { openStatesProfileLinks, openStatesProfilePolicySha256, openStatesProfileRecordId, supportsOpenStatesProfileMembers } from "./openstates-profile-evidence.js";
import { containsControlCharacters } from "./text-validation.js";

export const openStatesProfileArchiveLimits = { compressedBytes: 32 * 1024 * 1024, expandedBytes: 128 * 1024 * 1024, members: 50_000, selectedMemberBytes: 256 * 1024 };

export interface OpenStatesProfileCapture {
	commit: string;
	sha256: string;
	capturedAt: string;
}

export interface OpenStatesProfileCollection {
	source: ElectionReferenceSource;
	snapshot: ElectionReferenceSnapshot;
}

interface ProfileHold {
	sourceId: string;
	recordId: string;
	field: string;
	reason: string;
}

type ReferenceRecord = ElectionReferenceSnapshot["records"][number];
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const normalizeName = (value: string) => value.normalize("NFC").toLocaleUpperCase("en-US").replace(/\./gu, "").replace(/’/gu, "'").replace(/\s+/gu, " ").trim();
const normalizeDistrict = (value: string) => value.normalize("NFC").toLocaleUpperCase("en-US").trim();
const objectValue = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

function profileFacts(body: string, personId: string, source: ElectionReferenceSource, record: ReferenceRecord, capturedAt: string) {
	const document = parseDocument(body, { version: "1.2", schema: "core", uniqueKeys: true, stringKeys: true, strict: true });
	if (document.errors.length || document.warnings.length) throw new Error("invalid-yaml");
	const person: unknown = document.toJS({ maxAliasCount: 0 });
	if (!objectValue(person) || person.id !== personId || typeof person.name !== "string" || normalizeName(person.name) !== normalizeName(record.name) || !Array.isArray(person.roles) || person.roles.length > 100)
		throw new Error("identity-or-role-format-conflict");
	const district = record.jurisdiction?.startsWith("District ") ? record.jurisdiction.slice("District ".length) : "";
	if (!district || !["state-house", "state-senate"].includes(record.scope)) throw new Error("invalid-reference-role");
	const chamber = record.scope === "state-senate" ? "upper" : "lower";
	const relevant = person.roles.filter((role: unknown): role is Record<string, unknown> => objectValue(role) && role.type === chamber && role.jurisdiction === `ocd-jurisdiction/country:us/state:${source.stateCode.toLowerCase()}/government` && typeof role.district === "string" && normalizeDistrict(role.district) === normalizeDistrict(district));
	if (relevant.some(role => (role.start_date !== undefined && !validDate(role.start_date)) || (role.end_date !== undefined && !validDate(role.end_date)) || (typeof role.start_date === "string" && typeof role.end_date === "string" && role.start_date >= role.end_date)))
		throw new Error("invalid-current-role-dates");
	const asOf = capturedAt.slice(0, 10);
	const current = relevant.filter(role => (!role.start_date || (role.start_date as string) <= asOf) && (!role.end_date || (role.end_date as string) > asOf));
	if (current.length !== 1) throw new Error(current.length ? "ambiguous-current-role" : "no-matching-current-role");
	const holds: { field: string; reason: string }[] = [];
	const facts = [`Listed by Open States as a serving state legislator for District ${district}.`];
	const start = current[0]!.start_date;
	if (typeof start === "string") {
		const date = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${start}T12:00:00Z`));
		facts.push(`Recorded role start: ${date}.`);
	}
	else { holds.push({ field: "currentRoleStartDate", reason: "not-provided" }); }
	let professionalFacts = 0;
	const extras = objectValue(person.extras) ? person.extras : {};
	const professionalFields = new Set<string>();
	for (const [field, value] of Object.entries(extras)) {
		const label = field.toLowerCase();
		if (!["occupation", "profession", "education"].includes(label)) continue;
		if (professionalFields.has(label)) throw new Error("ambiguous-professional-field");
		professionalFields.add(label);
		if (typeof value !== "string" || !value.trim() || value.length > 540 || containsControlCharacters(value)) {
			holds.push({ field: label, reason: value === null || value === "" ? "not-provided" : "invalid-professional-value" });
			continue;
		}
		if (facts.length >= 6) throw new Error("too-many-professional-fields");
		facts.push(`Listed ${label}: ${value.trim()}`);
		professionalFacts++;
	}
	for (const role of person.roles) {
		if (objectValue(role) && validDate(role.end_date) && role.end_date <= asOf)
			holds.push({ field: "historicalRole", reason: "historical-role-labels-require-independent-review" });
	}
	return { facts, holds, roleStartDates: typeof start === "string" ? 1 : 0, professionalFacts };
}

export async function enrichOpenStatesProfiles(body: Uint8Array, capture: OpenStatesProfileCapture, collections: readonly OpenStatesProfileCollection[], now = Date.now()) {
	if (!body.byteLength || body.byteLength > openStatesProfileArchiveLimits.compressedBytes || !/^[a-f0-9]{40}$/u.test(capture.commit) || !/^[a-f0-9]{64}$/u.test(capture.sha256) || digest(body) !== capture.sha256 || typeof capture.capturedAt !== "string" || !Number.isFinite(Date.parse(capture.capturedAt)) || Date.parse(capture.capturedAt) > now || new Date(capture.capturedAt).toISOString() !== capture.capturedAt || !collections.length || collections.length > 51 || new Set(collections.map(collection => collection.source.id)).size !== collections.length || new Set(collections.map(collection => collection.source.stateCode)).size !== collections.length || new Set(collections.map(collection => collection.source.electionDate)).size !== 1)
		throw new Error("Provide a pinned Open States archive with exact capture provenance and unique reviewed collections.");
	const selected = new Map<string, { source: ElectionReferenceSource; record: ReferenceRecord }>();
	for (const { source, snapshot } of collections) {
		if (!supportsOpenStatesProfileMembers(source) || snapshot.documents.length !== source.documents.length) throw new Error("Profile enrichment requires fresh CSV-only Open States collections.");
		parseElectionReferenceSnapshot(source, JSON.stringify(snapshot), now);
		for (const record of snapshot.records) selected.set(`${source.stateCode}/${record.id}`, { source, record });
	}
	const matches = new Map<string, { facts: string[]; document: ElectionReferenceSnapshot["documents"][number] }>();
	const holds: ProfileHold[] = [];
	const seen = new Set<string>();
	const selectedMembers = new Set<string>();
	let expandedBytes = 0;
	let members = 0;
	let readmeSha256: string | null = null;
	let roleStartDates = 0;
	let professionalFacts = 0;
	let professionalProfiles = 0;
	const prefix = `openstates-people-${capture.commit.slice(0, 7)}`;
	const archive = extract();
	const pump = pipeline(Readable.from([body]), createGunzip(), new Transform({ transform(chunk: Buffer, _encoding, callback) {
		expandedBytes += chunk.length;
		callback(expandedBytes > openStatesProfileArchiveLimits.expandedBytes ? new Error("Open States archive exceeds its expanded size limit.") : null, chunk);
	} }), archive);
	void pump.catch(() => {});
	try {
		for await (const entry of archive) {
			const header = entry.header;
			const parts = header.name.replace(/\/$/u, "").split("/");
			members++;
			if (members > openStatesProfileArchiveLimits.members || header.name.length > 600 || !["file", "directory"].includes(header.type ?? "") || header.linkname || parts[0] !== prefix || containsControlCharacters(header.name) || header.name.includes("\\") || parts.some(part => !part || part === "." || part === "..") || seen.has(header.name))
				throw new Error("Open States archive contains an invalid, duplicate or unsupported member.");
			seen.add(header.name);
			const readme = parts.length === 2 && parts[1] === "README.md";
			const personUuid = parts.length === 5 && parts[1] === "data" && parts[3] === "legislature" ? parts[4]!.match(/-([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\.yml$/u)?.[1] : undefined;
			const source = personUuid ? collections.find(collection => collection.source.stateCode.toLowerCase() === parts[2])?.source : undefined;
			const personId = personUuid ? `ocd-person/${personUuid}` : "";
			const member: OpenStatesProfileMember = { policySha256: openStatesProfilePolicySha256, commit: capture.commit, personId, memberPath: parts.slice(1).join("/"), archiveSha256: capture.sha256 };
			const key = source ? `${source.stateCode}/${openStatesProfileRecordId(source, member)}` : "";
			const selectedPerson = selected.get(key);
			if (!readme && !selectedPerson) {
				entry.resume();
				continue;
			}
			if (header.type !== "file" || !Number.isSafeInteger(header.size) || header.size! > openStatesProfileArchiveLimits.selectedMemberBytes)
				throw new Error("Open States selected archive member exceeds its size limit.");
			const chunks: Buffer[] = [];
			let bytes = 0;
			for await (const chunk of entry) {
				const buffer = Buffer.from(chunk as Uint8Array);
				bytes += buffer.length;
				if (bytes > openStatesProfileArchiveLimits.selectedMemberBytes) throw new Error("Open States selected archive member exceeds its size limit.");
				chunks.push(buffer);
			}
			const content = Buffer.concat(chunks);
			if (readme) {
				if (!content.includes("CC0") || !content.includes("all copyright waived")) throw new Error("The pinned Open States archive does not contain the reviewed public-domain dedication.");
				readmeSha256 = digest(content);
				continue;
			}
			if (selectedMembers.has(key)) throw new Error("Open States archive contains ambiguous person members.");
			selectedMembers.add(key);
			const { record, source: collectionSource } = selectedPerson!;
			let prepared: ReturnType<typeof profileFacts>;
			try {
				prepared = profileFacts(new TextDecoder("utf-8", { fatal: true }).decode(content), personId, collectionSource, record, new Date(now).toISOString());
			}
			catch {
				holds.push({ sourceId: collectionSource.id, recordId: record.id, field: "profile", reason: "invalid-or-conflicting-profile-member" });
				continue;
			}
			roleStartDates += prepared.roleStartDates;
			professionalFacts += prepared.professionalFacts;
			if (prepared.professionalFacts) professionalProfiles++;
			holds.push(...prepared.holds.map(hold => ({ sourceId: collectionSource.id, recordId: record.id, ...hold })));
			matches.set(key, { facts: prepared.facts, document: { url: openStatesProfileLinks(member).url, sha256: digest(content), capturedAt: capture.capturedAt, includedRecordCount: 1, member } });
		}
		await pump;
	}
	catch (error) {
		archive.destroy();
		await pump.catch(() => {});
		throw error;
	}
	if (!readmeSha256) throw new Error("The pinned Open States archive is missing its public-domain dedication.");
	const snapshots: OpenStatesProfileCollection[] = [];
	for (const { source, snapshot } of collections) {
		const documents: ElectionReferenceSnapshot["documents"] = snapshot.documents.map(document => ({ ...document, includedRecordCount: 0 }));
		const records: ReferenceRecord[] = [];
		for (const record of snapshot.records) {
			const match = matches.get(`${source.stateCode}/${record.id}`);
			if (!match) {
				if (!holds.some(hold => hold.recordId === record.id && hold.sourceId === source.id && hold.field === "profile")) holds.push({ sourceId: source.id, recordId: record.id, field: "profile", reason: "profile-member-not-found" });
				continue;
			}
			records.push({ ...record, facts: match.facts, sourceDocumentIndex: documents.length });
			documents.push(match.document);
		}
		if (!records.length) continue;
		const enriched = { ...snapshot, records, recordCount: records.length, documents, sourceSha256: electionReferenceDocumentDigest(documents), retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.capturedAt)))).toISOString() };
		parseElectionReferenceSnapshot(source, JSON.stringify(enriched), now);
		snapshots.push({ source, snapshot: enriched });
	}
	if (!snapshots.length) throw new Error("No valid profile members matched the reviewed Open States records.");
	return { snapshots, holds, roleStartDates, professionalFacts, professionalProfiles, archiveMembers: members, archiveExpandedBytes: expandedBytes, readmeSha256, excludedProfiles: selected.size - matches.size };
}
