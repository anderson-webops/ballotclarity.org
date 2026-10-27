import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { createHash } from "node:crypto";
import { normalizePublicHref } from "./public-href.js";
import { validateBooneStoredSnapshot } from "./state-ballot-boone-discovery.js";
import { cassiaDocumentDigest, validateCassiaElection, validateCassiaSource } from "./state-ballot-cassia.js";
import { readChicagoSnapshotMetadata } from "./state-ballot-chicago-snapshot.js";
import { clarkIndexDigest, validateClarkDocumentUrl, validateClarkSource } from "./state-ballot-clark-discovery.js";
import { connecticutIndexDigest, validateConnecticutDocument, validateConnecticutSource } from "./state-ballot-connecticut-discovery.js";
import { daneDocumentDigest, validateDaneDocumentUrl, validateDaneSource } from "./state-ballot-dane-collection.js";
import { dcDocumentDigest, validateDcDocumentUrl, validateDcSource } from "./state-ballot-dc-collection.js";
import { validateDouglasStoredSnapshot } from "./state-ballot-douglas-snapshot.js";
import { eastGreenwichDocumentDigest, validateEastGreenwichDocumentUrl, validateEastGreenwichElection, validateEastGreenwichSource } from "./state-ballot-east-greenwich-collection.js";
import { franklinDocumentDigest, validateFranklinDocumentUrl, validateFranklinSource } from "./state-ballot-franklin-collection.js";
import { readGoffstownSnapshotMetadata } from "./state-ballot-goffstown-snapshot.js";
import { readHamiltonSnapshotMetadata } from "./state-ballot-hamilton-snapshot.js";
import { validateIowaJohnsonSource } from "./state-ballot-iowa-johnson.js";
import { iowaPolkDocumentDigest, validateIowaPolkDocumentUrl, validateIowaPolkSource } from "./state-ballot-iowa-polk.js";
import { validateMaineHouseSnapshot } from "./state-ballot-maine-house.js";
import { normalizeMichiganCandidateRecord } from "./state-ballot-michigan.js";
import { readNycSnapshotMetadata } from "./state-ballot-nyc-snapshot.js";
import { readOrangeSnapshotMetadata } from "./state-ballot-orange-snapshot.js";
import { readPimaSnapshotMetadata } from "./state-ballot-pima-snapshot.js";
import { pulaskiDocumentDigest, validatePulaskiDocumentUrl, validatePulaskiSource } from "./state-ballot-pulaski-collection.js";
import { tuscolaDocumentDigest, validateTuscolaDocumentUrl, validateTuscolaSource } from "./state-ballot-tuscola-collection.js";
import { validateWashoeSource } from "./state-ballot-washoe.js";
import { validateWinnebagoDocumentUrl, validateWinnebagoElection, validateWinnebagoSource, winnebagoDocumentDigest } from "./state-ballot-winnebago-collection.js";

const recordFields = new Set(["id", "name", "office", "party", "incumbent", "district", "scope", "status", "sourceStatus", "ballotDesignation", "jurisdiction", "candidateUrl", "sourceCandidateId", "sourceDistrictLabel", "sourceDivision", "sourceAreaLabel", "termYears", "termEnd", "seats", "voteLimit"]);
const snapshotFields = new Set(["schemaVersion", "stateCode", "sourceId", "electionDate", "sourceUrl", "retrievalPolicy", "retrievedAt", "sourceSha256", "recordCount", "records", "documents", "collectionIndexSha256", "ballotQuestions", "sourceAsOfDate", "sourceAsOf"]);
const documentFields = new Set(["url", "sha256", "retrievedAt", "includedRecordCount"]);
const scopes = ["statewide", "congressional", "state-senate", "state-house", "local"];
const statuses = ["listed", "filed", "qualified", "write-in", "withdrawn", "disqualified", "defeated", "elected", "unopposed", "inactive", "unrecognized"];

export function parseBundledStateSnapshot(source: StateBallotSource, body: string, retrievalPolicy: "manual-snapshot" | "automatic" = "manual-snapshot"): StateBallotSnapshot {
	if (new TextEncoder().encode(body).length > 12 * 1024 * 1024)
		throw new Error("The bundled candidate snapshot exceeds its size limit.");
	const data = JSON.parse(body) as Record<string, unknown>;
	if (!data || data.schemaVersion !== 1 || data.stateCode !== source.stateCode || data.sourceId !== source.id || data.electionDate !== source.electionDate || data.sourceUrl !== source.pageUrl || data.retrievalPolicy !== retrievalPolicy || (retrievalPolicy === "automatic" && source.retrievalPolicy === "manual-snapshot"))
		throw new Error("The bundled candidate snapshot does not match its configured source.");
	if (Object.keys(data).some(key => !snapshotFields.has(key)))
		throw new Error("The bundled candidate snapshot has unexpected fields.");
	if (typeof data.retrievedAt !== "string" || !Number.isFinite(Date.parse(data.retrievedAt)) || typeof data.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(data.sourceSha256))
		throw new Error("The bundled candidate snapshot has invalid provenance.");
	if (!Array.isArray(data.records) || !data.records.length || data.records.length > 25_000 || data.recordCount !== data.records.length)
		throw new Error("The bundled candidate snapshot has an invalid record count.");
	let documents: StateBallotSnapshot["documents"];
	if (source.format === "maine-house-html") validateMaineHouseSnapshot(source, data);
	if (source.format === "douglas-html") validateDouglasStoredSnapshot(source, data);
	const metadata = source.format === "orange-pdf" ? readOrangeSnapshotMetadata(source, data) : source.format === "nyc-pdf" ? readNycSnapshotMetadata(source, data) : source.format === "hamilton-html" ? readHamiltonSnapshotMetadata(source, data) : source.format === "pima-pdf" ? readPimaSnapshotMetadata(source, data) : source.format === "goffstown-pdf" ? readGoffstownSnapshotMetadata(source, data) : source.format === "chicago-pdf" ? readChicagoSnapshotMetadata(source, data) : {};
	if (!["boone-xlsx", "orange-pdf", "maine-house-html", "nyc-pdf", "hamilton-html", "pima-pdf", "goffstown-pdf", "chicago-pdf"].includes(source.format) && ["ballotQuestions", "sourceAsOfDate", "sourceAsOf"].some(key => data[key] !== undefined)) throw new Error("This source does not support Chicago snapshot metadata.");
	if (["boone-xlsx", "orange-pdf", "maine-house-html", "nyc-pdf", "douglas-html", "hamilton-html", "pima-pdf", "goffstown-pdf", "chicago-pdf"].includes(source.format)) {
		if (!data.collectionIndexSha256) throw new Error("The Chicago publication fingerprint is missing.");
	}
	else if (source.format === "connecticut-pdf") {
		validateConnecticutSource(source);
		if (!Array.isArray(data.documents) || !data.documents.length || data.documents.length > 169) throw new Error("The Connecticut stored document set exceeds its bounds.");
		for (const item of data.documents) validateConnecticutDocument({ town: item?.town, url: item?.url }, source.electionDate);
		if (new Set(data.documents.map(item => item.town)).size !== data.documents.length || new Set(data.documents.map(item => item.url)).size !== data.documents.length || data.collectionIndexSha256 !== connecticutIndexDigest(data.documents)) throw new Error("The Connecticut stored town index is invalid.");
	}
	else if (source.format === "cassia-pdf") {
		validateCassiaSource(source);
		if (!Array.isArray(data.documents) || !data.documents.length || data.documents.length > 12) throw new Error("The Cassia stored publication set is invalid.");
		const publications = data.documents.map((document: unknown, index) => {
			if (!document || typeof document !== "object" || Array.isArray(document) || !("url" in document) || typeof document.url !== "string") throw new Error("The Cassia stored publication is invalid.");
			return { kind: index ? "supplement" as const : "general" as const, url: document.url };
		});
		validateCassiaElection({ electionId: null, electionDate: source.electionDate, cassiaDocuments: publications });
		if (data.collectionIndexSha256 !== cassiaDocumentDigest(publications) || data.documents.some((document, index) => document.includedRecordCount !== (index ? 0 : data.recordCount))) throw new Error("The Cassia stored publication index is invalid.");
	}
	else if (source.format === "winnebago-pdf") {
		validateWinnebagoSource(source);
		if (!Array.isArray(data.documents) || !data.documents.length || data.documents.length > 2) throw new Error("The stored Winnebago publication set is invalid.");
		const documents = data.documents.map((item: unknown, index) => {
			if (!item || typeof item !== "object" || Array.isArray(item) || !("url" in item) || typeof item.url !== "string" || !("sha256" in item) || typeof item.sha256 !== "string") throw new Error("The stored Winnebago publication is invalid.");
			validateWinnebagoDocumentUrl(item.url);
			return { kind: index ? "write-ins" as const : "candidates" as const, url: item.url, sha256: item.sha256 };
		});
		validateWinnebagoElection({ electionId: null, electionDate: source.electionDate, pageUrl: source.pageUrl, winnebagoDocuments: documents });
		if (data.collectionIndexSha256 !== winnebagoDocumentDigest(documents)) throw new Error("The stored Winnebago publication fingerprint is invalid.");
	}
	else if (source.format === "east-greenwich-pdf") {
		validateEastGreenwichSource(source);
		if (!Array.isArray(data.documents) || data.documents.length < 5 || data.documents.length > 20) throw new Error("The stored East Greenwich publication set is invalid.");
		const documents = data.documents.map((item: unknown) => {
			if (!item || typeof item !== "object" || Array.isArray(item) || !("url" in item) || typeof item.url !== "string" || !("sha256" in item) || typeof item.sha256 !== "string") throw new Error("The stored East Greenwich publication is invalid.");
			const precinct = /\/General-Election-Precinct-(09\d{2})-Sample-Ballot-PDF$/u.exec(item.url)?.[1] ?? "";
			validateEastGreenwichDocumentUrl(item.url, precinct);
			return { precinct, url: item.url, sha256: item.sha256 };
		});
		validateEastGreenwichElection({ electionId: null, electionDate: source.electionDate, pageUrl: source.pageUrl, eastGreenwichDocuments: documents });
		if (data.collectionIndexSha256 !== eastGreenwichDocumentDigest(documents)) throw new Error("The stored East Greenwich publication fingerprint is invalid.");
	}
	else if (source.format === "dane-pdf") {
		validateDaneSource(source);
		if (!Array.isArray(data.documents) || data.documents.length !== 4 || data.documents[3]?.includedRecordCount !== 0) throw new Error("The stored Dane publication set is invalid.");
		const documents = data.documents.map((item: unknown, index) => {
			if (!item || typeof item !== "object" || Array.isArray(item) || !("url" in item) || typeof item.url !== "string" || !("sha256" in item) || typeof item.sha256 !== "string") throw new Error("The stored Dane publication is invalid.");
			const kind = (["Lodi", "Waunakee", "Sauk", "notice"] as const)[index]!;
			validateDaneDocumentUrl(item.url, kind, source.electionDate);
			return { kind, url: item.url, sha256: item.sha256 };
		});
		if (data.collectionIndexSha256 !== daneDocumentDigest(documents)) throw new Error("The stored Dane publication fingerprint is invalid.");
	}
	else if (source.format === "pulaski-pdf") {
		validatePulaskiSource(source);
		if (!Array.isArray(data.documents) || data.documents.length !== 2 || data.documents[0]?.includedRecordCount !== data.recordCount || data.documents[1]?.includedRecordCount !== 0) throw new Error("The stored Pulaski publication set is invalid.");
		const documents = data.documents.map((item: unknown, index) => {
			if (!item || typeof item !== "object" || Array.isArray(item) || !("url" in item) || typeof item.url !== "string" || !("sha256" in item) || typeof item.sha256 !== "string") throw new Error("The stored Pulaski publication is invalid.");
			const kind = index ? "calendar" as const : "notice" as const;
			validatePulaskiDocumentUrl(item.url, kind, source.electionDate);
			return { kind, url: item.url, sha256: item.sha256 };
		});
		if (data.collectionIndexSha256 !== pulaskiDocumentDigest(documents)) throw new Error("The stored Pulaski publication fingerprint is invalid.");
	}
	else if (source.format === "tuscola-pdf") {
		validateTuscolaSource(source);
		if (!Array.isArray(data.documents) || data.documents.length !== 2 || data.documents[0]?.includedRecordCount !== data.recordCount || data.documents[1]?.includedRecordCount !== 0) throw new Error("The stored Tuscola publication set is invalid.");
		const documents = data.documents.map((item: unknown, index) => {
			if (!item || typeof item !== "object" || Array.isArray(item) || !("url" in item) || typeof item.url !== "string" || !("sha256" in item) || typeof item.sha256 !== "string") throw new Error("The stored Tuscola publication is invalid.");
			const kind = index ? "samples" as const : "candidates" as const;
			validateTuscolaDocumentUrl(item.url, kind, source.electionDate.slice(0, 4));
			return { kind, url: item.url, sha256: item.sha256 };
		});
		if (data.collectionIndexSha256 !== tuscolaDocumentDigest(documents)) throw new Error("The stored Tuscola publication fingerprint is invalid.");
	}
	else if (source.format === "dc-pdf") {
		validateDcSource(source);
		if (!Array.isArray(data.documents) || data.documents.length !== 3 || new Set(data.documents.map(document => document.url)).size !== 3) throw new Error("The stored D.C. publication set is invalid.");
		const documents = data.documents.map((item: unknown, index) => {
			if (!item || typeof item !== "object" || Array.isArray(item) || !("url" in item) || typeof item.url !== "string" || !("sha256" in item) || typeof item.sha256 !== "string") throw new Error("The stored D.C. publication is invalid.");
			validateDcDocumentUrl(item.url, source.electionDate.slice(0, 4));
			return { kind: (["general", "anc", "write-ins"] as const)[index]!, url: item.url, sha256: item.sha256 };
		});
		if (data.collectionIndexSha256 !== dcDocumentDigest(documents)) throw new Error("The stored D.C. publication fingerprint is invalid.");
	}
	else if (source.format === "franklin-pdf") {
		validateFranklinSource(source);
		if (!Array.isArray(data.documents) || data.documents.length !== 2) throw new Error("The stored Franklin County publication set is invalid.");
		const documents = data.documents.map((item: unknown, index) => {
			if (!item || typeof item !== "object" || Array.isArray(item) || !("url" in item) || typeof item.url !== "string" || !("sha256" in item) || typeof item.sha256 !== "string") throw new Error("The stored Franklin County publication is invalid.");
			validateFranklinDocumentUrl(item.url);
			return { kind: index ? "notice" as const : "candidates" as const, url: item.url, sha256: item.sha256 };
		});
		if (data.collectionIndexSha256 !== franklinDocumentDigest(documents)) throw new Error("The stored Franklin County publication fingerprint is invalid.");
	}
	else if (source.format === "iowa-polk-pdf") {
		validateIowaPolkSource(source);
		if (!Array.isArray(data.documents) || data.documents.length !== 2) throw new Error("The stored Polk County document set is invalid.");
		const documents = data.documents.map((document: unknown, index) => {
			if (!document || typeof document !== "object" || Array.isArray(document) || !("url" in document) || typeof document.url !== "string") throw new Error("The stored Polk County document is invalid.");
			validateIowaPolkDocumentUrl(document.url);
			return { kind: index ? "sample" as const : "candidates" as const, url: document.url };
		});
		const expected = iowaPolkDocumentDigest(documents);
		if (data.collectionIndexSha256 !== expected) throw new Error("The stored Polk County document index is invalid.");
	}
	else if (source.format === "iowa-johnson-html") {
		validateIowaJohnsonSource(source);
		if (!Array.isArray(data.documents) || data.documents.length !== 1 || data.documents[0]?.url !== source.pageUrl || data.collectionIndexSha256 !== data.documents[0]?.sha256 || data.sourceSha256 !== data.documents[0]?.sha256) throw new Error("The Johnson County stored publication index is invalid.");
	}
	else if (source.format === "washoe-html") {
		validateWashoeSource(source);
		if (!Array.isArray(data.documents) || data.documents.length !== 1 || data.documents[0]?.url !== source.pageUrl || data.collectionIndexSha256 !== data.documents[0]?.sha256 || data.sourceSha256 !== data.documents[0]?.sha256) throw new Error("The Washoe County stored publication index is invalid.");
	}
	else if (source.format === "clark-pdf") {
		validateClarkSource(source);
		if (!Array.isArray(data.documents) || data.documents.length !== 2 || new Set(data.documents.map(item => item?.url)).size !== 2 || data.collectionIndexSha256 !== clarkIndexDigest(data.documents)) throw new Error("The Clark County stored document index is invalid.");
		for (const document of data.documents) validateClarkDocumentUrl(document.url);
	}
	else if (data.collectionIndexSha256 !== undefined) {
		throw new Error("The stored source has an unexpected collection index.");
	}
	if (["boone-xlsx", "orange-pdf", "maine-house-html", "nyc-pdf", "douglas-html", "hamilton-html", "pima-pdf", "goffstown-pdf", "chicago-pdf", "winnebago-pdf", "east-greenwich-pdf", "dane-pdf", "pulaski-pdf", "tuscola-pdf", "dc-pdf", "franklin-pdf", "cassia-pdf", "iowa-polk-pdf", "iowa-johnson-html", "washoe-html", "clark-pdf", "connecticut-pdf", "reviewed-pdf", "reviewed-xlsx", "reviewed-image", "fulton-pdf", "certified-pdf", "oregon-pdf", "texas-certified-pdf", "vermont-xlsx", "pennsylvania-html", "west-virginia-json", "alaska-html", "connecticut-ballots", "oregon-ballots"].includes(source.format) || (["arkansas-html", "colorado-html"].includes(source.format) && source.retrievalPolicy === "manual-snapshot")) {
		if (!Array.isArray(data.documents) || (!["boone-xlsx", "orange-pdf", "maine-house-html", "nyc-pdf", "douglas-html", "hamilton-html", "pima-pdf", "goffstown-pdf", "chicago-pdf", "winnebago-pdf", "east-greenwich-pdf", "dane-pdf", "pulaski-pdf", "tuscola-pdf", "dc-pdf", "franklin-pdf", "cassia-pdf", "iowa-polk-pdf", "clark-pdf", "connecticut-pdf"].includes(source.format) && data.documents.length !== source.documentUrls?.length) || !data.documents.length)
			throw new Error("The bundled candidate snapshot has an invalid document set.");
		documents = data.documents.map((value: unknown, index: number) => {
			if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The bundled candidate document is invalid.");
			const item = value as Record<string, unknown>;
			if (Object.keys(item).some(key => !documentFields.has(key) && !(key === "town" && source.format === "connecticut-pdf")) || (!["boone-xlsx", "orange-pdf", "maine-house-html", "nyc-pdf", "douglas-html", "hamilton-html", "pima-pdf", "goffstown-pdf", "chicago-pdf", "winnebago-pdf", "east-greenwich-pdf", "dane-pdf", "pulaski-pdf", "tuscola-pdf", "dc-pdf", "franklin-pdf", "cassia-pdf", "iowa-polk-pdf", "clark-pdf", "connecticut-pdf"].includes(source.format) && item.url !== source.documentUrls?.[index]) || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(item.sha256) || typeof item.retrievedAt !== "string" || !Number.isFinite(Date.parse(item.retrievedAt)) || typeof item.includedRecordCount !== "number" || !Number.isSafeInteger(item.includedRecordCount) || item.includedRecordCount < 0)
				throw new Error("The bundled candidate document has invalid provenance.");
			return { url: item.url as string, sha256: item.sha256, retrievedAt: item.retrievedAt, includedRecordCount: item.includedRecordCount, ...(source.format === "connecticut-pdf" ? { town: item.town as string } : {}) };
		});
		const digest = createHash("sha256").update(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))).digest("hex");
		if ((!["iowa-johnson-html", "washoe-html"].includes(source.format) && digest !== data.sourceSha256) || documents.reduce((count, document) => count + document.includedRecordCount, 0) !== data.recordCount || new Date(Math.min(...documents.map(document => Date.parse(document.retrievedAt)))).toISOString() !== data.retrievedAt)
			throw new Error("The bundled candidate document set does not match its captured provenance.");
	}
	else if (data.documents !== undefined) {
		throw new Error("The bundled candidate snapshot has unexpected documents.");
	}
	if (source.format === "boone-xlsx") validateBooneStoredSnapshot(source, data);
	const records = data.records.map((value: unknown) => {
		if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The bundled candidate record is invalid.");
		const row = value as Record<string, unknown>;
		if (Object.keys(row).some(key => !recordFields.has(key)) || typeof row.id !== "string" || !/^[a-f0-9]{24}$/u.test(row.id) || typeof row.name !== "string" || !row.name.trim() || row.name.length > 250 || typeof row.office !== "string" || !row.office.trim() || row.office.length > 300 || typeof row.district !== "string" || row.district.length > 40 || !scopes.includes(row.scope as string) || !statuses.includes(row.status as string))
			throw new Error("The bundled candidate record has an invalid layout.");
		for (const key of ["party", "sourceStatus", "ballotDesignation", "jurisdiction", "sourceCandidateId", "sourceDistrictLabel", "sourceDivision", "sourceAreaLabel"]) {
			if (row[key] !== undefined && (typeof row[key] !== "string" || row[key].length > 300))
				throw new Error("The bundled candidate record has an invalid public field.");
		}
		if (row.candidateUrl !== undefined && (typeof row.candidateUrl !== "string" || !/^https?:\/\//u.test(row.candidateUrl) || normalizePublicHref(row.candidateUrl) !== row.candidateUrl))
			throw new Error("The bundled candidate campaign link is unsafe.");
		if (row.incumbent !== undefined && (row.incumbent !== true || !((source.stateCode === "ME" && source.format === "maine-house-html") || (source.stateCode === "MI" && source.format === "michigan-html" && (row.party === undefined || String(row.party).trim().toUpperCase() === "INCUMBENT"))))) throw new Error("The bundled candidate record has an invalid incumbency field.");
		for (const [key, maximum] of [["termYears", 12], ["seats", 99]] as const) {
			if (row[key] !== undefined && (!((key === "seats" && source.stateCode === "NY" && source.format === "nyc-pdf") || (key === "seats" && source.stateCode === "NH" && source.format === "goffstown-pdf" && row.scope === "state-house" && Number(row[key]) <= 10) || (source.stateCode === "IA" && source.format === "iowa-johnson-html") || (source.stateCode === "VA" && source.format === "virginia-local-html") || (key === "termYears" && ((source.stateCode === "IL" && source.format === "chicago-pdf" && [2, 6].includes(Number(row[key]))) || (source.stateCode === "VT" && source.format === "vermont-xlsx") || (source.stateCode === "NV" && source.format === "washoe-html")))) || typeof row[key] !== "number" || !Number.isSafeInteger(row[key]) || row[key] < 1 || row[key] > maximum)) throw new Error("The bundled candidate office metadata is invalid.");
		}
		if (row.voteLimit !== undefined && (!((source.stateCode === "CA" && source.format === "orange-pdf" && Number(row.voteLimit) <= 40) || (source.stateCode === "TN" && source.format === "hamilton-html" && Number(row.voteLimit) <= 10) || (source.stateCode === "AZ" && source.format === "pima-pdf" && Number(row.voteLimit) <= 10) || (source.stateCode === "IL" && source.format === "chicago-pdf" && Number(row.voteLimit) <= 3) || (source.stateCode === "IA" && ["cassia-pdf", "iowa-polk-pdf", "iowa-johnson-html"].includes(source.format)) || (source.stateCode === "VT" && source.format === "vermont-xlsx") || (source.stateCode === "NV" && ["washoe-html", "clark-pdf"].includes(source.format))) || typeof row.voteLimit !== "number" || !Number.isSafeInteger(row.voteLimit) || row.voteLimit < 1 || row.voteLimit > 50)) throw new Error("The bundled candidate vote limit is invalid.");
		if (row.termEnd !== undefined && (!((source.stateCode === "VA" && source.format === "virginia-local-html") || (source.stateCode === "AZ" && source.format === "pima-pdf" && row.scope === "local")) || typeof row.termEnd !== "string" || !/^20\d{2}-\d{2}-\d{2}$/u.test(row.termEnd) || !Number.isFinite(Date.parse(`${row.termEnd}T00:00:00Z`)) || new Date(`${row.termEnd}T00:00:00Z`).toISOString().slice(0, 10) !== row.termEnd || row.termEnd < source.electionDate)) throw new Error("The bundled candidate term end is invalid.");
		const record = row as unknown as StateCandidateRecord;
		return source.stateCode === "MI" && source.format === "michigan-html" ? normalizeMichiganCandidateRecord(record) : record;
	});
	if (new Set(records.map(record => record.id)).size !== records.length)
		throw new Error("The bundled candidate snapshot has duplicate identities.");
	return { source, retrievedAt: data.retrievedAt, sha256: data.sourceSha256, records, ...metadata, ...(documents ? { documents } : {}), ...(["boone-xlsx", "orange-pdf", "maine-house-html", "nyc-pdf", "douglas-html", "hamilton-html", "pima-pdf", "goffstown-pdf", "chicago-pdf", "winnebago-pdf", "east-greenwich-pdf", "dane-pdf", "pulaski-pdf", "tuscola-pdf", "dc-pdf", "franklin-pdf", "cassia-pdf", "iowa-polk-pdf", "iowa-johnson-html", "washoe-html", "clark-pdf", "connecticut-pdf"].includes(source.format) ? { collectionIndexSha256: data.collectionIndexSha256 as string } : {}) };
}

export async function loadBundledStateSnapshot(source: StateBallotSource) {
	throw new Error(`No bundled candidate snapshot is configured for ${source.id}; import reviewed external data.`);
}
