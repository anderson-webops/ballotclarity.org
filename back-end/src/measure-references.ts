import type { MeasureReferenceSource } from "./measure-reference-sources.js";
import type { Measure, MeasureReferencesResponse, Source } from "./types/civic.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { measureReferenceSources } from "./measure-reference-sources.js";
import { assertExternalStateDataDirectory, readBoundedStateData } from "./state-ballot-storage.js";
import { containsControlCharacters } from "./text-validation.js";

interface MeasureReferenceEntry {
	title: string;
	summary: string;
}

interface MeasureReferenceFiscalItem {
	label: string;
	value: string;
	scope: string;
	horizon: string;
	note: string;
}

export interface MeasureReferenceRecord {
	id: string;
	slug: string;
	designation: string;
	title: string;
	origin: "citizen-initiative" | "legislative-referral";
	lawChanged: "constitution" | "statutes" | "constitution-and-statutes";
	passage: "55-percent" | "majority";
	ballotTitle: string;
	yesMeaning: string;
	noMeaning: string;
	summary: string;
	explanation: string;
	currentLaw: string;
	proposedChanges: string[];
	fiscal: MeasureReferenceFiscalItem[];
	argumentsFor: MeasureReferenceEntry[];
	argumentsAgainst: MeasureReferenceEntry[];
	considerations: MeasureReferenceEntry[];
	pages: { guide: number; analysis: number; arguments: number; fiscal: number; text: number };
}

export interface MeasureReferenceSnapshot {
	schemaVersion: 1;
	type: "measure-references";
	stateCode: string;
	sourceId: string;
	electionDate: string;
	document: { url: string; sha256: string; bytes: number; capturedAt: string };
	recordCount: number;
	records: MeasureReferenceRecord[];
}

export interface MeasureReferenceRepository {
	listCollections: (stateCode: string) => Promise<{ source: MeasureReferenceSource; snapshot: MeasureReferenceSnapshot }[]>;
	getMeasure: (slug: string) => Promise<Measure | null>;
}

const maximumBytes = 4 * 1024 * 1024;
const recordKeys = ["id", "slug", "designation", "title", "origin", "lawChanged", "passage", "ballotTitle", "yesMeaning", "noMeaning", "summary", "explanation", "currentLaw", "proposedChanges", "fiscal", "argumentsFor", "argumentsAgainst", "considerations", "pages"] as const;
const pageKeys = ["guide", "analysis", "arguments", "fiscal", "text"] as const;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const validText = (value: unknown, maximum: number): value is string => typeof value === "string" && Boolean(value.trim()) && value === value.trim() && value.length <= maximum && !containsControlCharacters(value);
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: unknown, allowed: readonly string[]): value is Record<string, unknown> => isRecord(value) && Object.keys(value).length === allowed.length && Object.keys(value).every(key => allowed.includes(key));
const boundedList = (value: unknown, minimum: number, maximum: number): value is unknown[] => Array.isArray(value) && value.length >= minimum && value.length <= maximum;
const textList = (value: unknown, minimum: number, maximum: number, length: number) => boundedList(value, minimum, maximum) && value.every(item => validText(item, length));
const entryList = (value: unknown, minimum: number, maximum: number) => boundedList(value, minimum, maximum) && value.every(item => exactKeys(item, ["title", "summary"]) && validText(item.title, 120) && validText(item.summary, 600));
function validPages(value: unknown, pageCount: number) {
	return exactKeys(value, pageKeys) && pageKeys.every((key) => {
		const page = value[key];
		return typeof page === "number" && Number.isSafeInteger(page) && page >= 1 && page <= pageCount;
	});
}

export function parseMeasureReferenceSnapshot(source: MeasureReferenceSource, body: string, now = Date.now()): MeasureReferenceSnapshot {
	if (Buffer.byteLength(body) > maximumBytes) throw new Error("Measure reference data exceeds its size limit.");
	const data: unknown = JSON.parse(body);
	if (!exactKeys(data, ["schemaVersion", "type", "stateCode", "sourceId", "electionDate", "document", "recordCount", "records"]) || data.schemaVersion !== 1 || data.type !== "measure-references" || data.stateCode !== source.stateCode || data.sourceId !== source.id || data.electionDate !== source.electionDate)
		throw new Error("Measure references do not match their configured collection.");
	const document = data.document;
	if (!exactKeys(document, ["url", "sha256", "bytes", "capturedAt"]) || document.url !== source.document.url || typeof document.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(document.sha256) || !Number.isSafeInteger(document.bytes) || (document.bytes as number) <= 0 || typeof document.capturedAt !== "string" || !Number.isFinite(Date.parse(document.capturedAt)) || Date.parse(document.capturedAt) > now || Date.parse(document.capturedAt) < Date.parse(source.document.publishedDate))
		throw new Error("Measure reference document provenance is invalid.");
	const records = data.records;
	if (!Array.isArray(records) || !records.length || records.length > 200 || data.recordCount !== records.length)
		throw new Error("Measure references have an invalid record count.");
	const slugPrefix = `${source.stateCode.toLowerCase()}-${source.electionDate.slice(0, 4)}-`;
	for (const record of records) {
		if (!exactKeys(record, recordKeys) || typeof record.id !== "string" || !/^[a-f0-9]{24}$/u.test(record.id) || typeof record.slug !== "string" || !record.slug.startsWith(slugPrefix) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(record.slug) || record.slug.length > 80
			|| !validText(record.designation, 40) || !validText(record.title, 160) || !["citizen-initiative", "legislative-referral"].includes(record.origin as string) || !["constitution", "statutes", "constitution-and-statutes"].includes(record.lawChanged as string) || !["55-percent", "majority"].includes(record.passage as string)
			|| !validText(record.ballotTitle, 2500) || !validText(record.yesMeaning, 600) || !validText(record.noMeaning, 600) || !validText(record.summary, 400) || !validText(record.explanation, 1200) || !validText(record.currentLaw, 1200)
			|| !textList(record.proposedChanges, 1, 6, 300) || !entryList(record.argumentsFor, 1, 4) || !entryList(record.argumentsAgainst, 1, 4) || !entryList(record.considerations, 0, 4)
			|| !boundedList(record.fiscal, 1, 6) || !record.fiscal.every(item => exactKeys(item, ["label", "value", "scope", "horizon", "note"]) && validText(item.label, 100) && validText(item.value, 120) && validText(item.scope, 80) && validText(item.horizon, 120) && validText(item.note, 400))
			|| !validPages(record.pages, source.document.pageCount)) {
			throw new Error("Measure reference fields are invalid.");
		}
	}
	const typed = records as MeasureReferenceRecord[];
	for (const key of ["id", "slug", "designation"] as const) {
		if (new Set(typed.map(record => record[key])).size !== typed.length)
			throw new Error("Measure reference identities are not unique.");
	}
	return data as unknown as MeasureReferenceSnapshot;
}

export function createMeasureReferenceStorage(directory: string) {
	assertExternalStateDataDirectory(directory);
	async function location(source: MeasureReferenceSource, create: boolean) {
		if (!/^[a-z0-9][a-z0-9-]{0,100}$/u.test(source.id)) throw new Error("Invalid measure reference storage identifier.");
		if (create) await mkdir(directory, { recursive: true });
		const canonical = await realpath(directory);
		assertExternalStateDataDirectory(canonical);
		return join(canonical, `measures-${source.id}.json`);
	}
	return {
		async read(source: MeasureReferenceSource, now = Date.now()) {
			try {
				const envelope: unknown = JSON.parse(await readBoundedStateData(await location(source, false)));
				if (!exactKeys(envelope, ["snapshot", "sourceConfigurationSha256"]) || envelope.sourceConfigurationSha256 !== digest(JSON.stringify(source)) || typeof envelope.snapshot !== "string") throw new Error("Stored measure references do not match their configured collection.");
				return parseMeasureReferenceSnapshot(source, envelope.snapshot, now);
			}
			catch (error) {
				if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
				throw error;
			}
		},
		async write(source: MeasureReferenceSource, snapshot: MeasureReferenceSnapshot) {
			const snapshotBody = JSON.stringify(snapshot);
			parseMeasureReferenceSnapshot(source, snapshotBody);
			const body = JSON.stringify({ sourceConfigurationSha256: digest(JSON.stringify(source)), snapshot: snapshotBody });
			const target = await location(source, true);
			const temporary = `${target}.${randomUUID()}.tmp`;
			try {
				const handle = await open(temporary, "wx");
				try {
					await handle.writeFile(body);
					await handle.sync();
				}
				finally {
					await handle.close();
				}
				await rename(temporary, target);
			}
			finally {
				await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
					if (error.code !== "ENOENT") throw error;
				});
			}
		},
	};
}

// Collections stay public until two days after their election, matching candidate references.
export function selectMeasureReferenceSources(sources: readonly MeasureReferenceSource[], stateCode: string | null, now = Date.now()) {
	return sources.filter(source => (stateCode === null || source.stateCode === stateCode.toUpperCase()) && now < Date.parse(`${source.electionDate}T00:00:00Z`) + 2 * 24 * 60 * 60 * 1000);
}

export function buildMeasureFromReference(source: MeasureReferenceSource, snapshot: MeasureReferenceSnapshot, record: MeasureReferenceRecord): Measure {
	const page = (key: keyof MeasureReferenceRecord["pages"], label: string): Source => ({
		id: `${source.id}-${record.slug}-${key}`,
		title: `${record.designation}: ${label}`,
		publisher: source.document.publisher,
		type: "voter guide",
		authority: "official-government",
		sourceSystem: source.document.title,
		date: source.document.publishedDate,
		url: `${source.document.url}#page=${record.pages[key]}`,
	});
	const guide = page("guide", "ballot title and what your vote means");
	const analysis = page("analysis", "summary and analysis");
	const argumentsPage = page("arguments", "arguments for and against");
	const fiscal = page("fiscal", "fiscal impact");
	const text = page("text", "title and text");
	const argument = (side: string) => (item: MeasureReferenceEntry, index: number) => ({ id: `${record.slug}-${side}-${index + 1}`, title: item.title, summary: item.summary, attribution: source.document.publisher, sources: [argumentsPage] });
	return {
		slug: record.slug,
		title: `${record.designation}: ${record.title}`,
		contestSlug: "",
		location: source.jurisdiction,
		summary: record.summary,
		ballotSummary: record.ballotTitle,
		plainLanguageExplanation: record.explanation,
		currentLawOverview: record.currentLaw,
		currentPractice: [],
		proposedChanges: record.proposedChanges.map((change, index) => ({ id: `${record.slug}-change-${index + 1}`, text: change, sources: [analysis] })),
		yesMeaning: record.yesMeaning,
		noMeaning: record.noMeaning,
		yesHighlights: [],
		noHighlights: [],
		fiscalContextNote: "",
		implementationOverview: "",
		implementationTimeline: [],
		fiscalSummary: record.fiscal.map((item, index) => ({ id: `${record.slug}-fiscal-${index + 1}`, ...item, sources: [fiscal] })),
		potentialImpacts: [],
		supportArguments: record.argumentsFor.map(argument("for")),
		opposeArguments: record.argumentsAgainst.map(argument("against")),
		argumentsDisclaimer: source.argumentsNote,
		argumentsAndConsiderations: record.considerations.map((item, index) => ({ id: `${record.slug}-consideration-${index + 1}`, title: item.title, summary: item.summary, sources: [analysis] })),
		freshness: {
			contentLastVerifiedAt: snapshot.document.capturedAt,
			nextReviewAt: `${source.electionDate}T00:00:00.000Z`,
			status: "up-to-date",
			statusLabel: "Official voter guide",
			statusNote: `${source.document.title}, ${source.document.publisher}.`,
		},
		whatWeKnow: [],
		whatWeDoNotKnow: [],
		sources: [guide, analysis, argumentsPage, fiscal, text],
		updatedAt: snapshot.document.capturedAt,
	};
}

export function buildMeasureReferencesResponse(stateCode: string, collections: readonly { source: MeasureReferenceSource; snapshot: MeasureReferenceSnapshot }[]): MeasureReferencesResponse {
	const first = collections[0];
	return {
		available: Boolean(first),
		stateCode,
		electionDate: first?.source.electionDate,
		source: first ? { title: first.source.document.title, publisher: first.source.document.publisher, url: first.source.document.pageUrl, publishedDate: first.source.document.publishedDate } : undefined,
		measures: collections.flatMap(({ snapshot }) => snapshot.records.map(record => ({ slug: record.slug, designation: record.designation, title: record.title, summary: record.summary, passage: record.passage }))),
	};
}

export function createMeasureReferenceRepository(options: { dataDirectory?: string | null; now?: () => number; sources?: readonly MeasureReferenceSource[] } = {}): MeasureReferenceRepository {
	const directory = options.dataDirectory === undefined ? process.env.STATE_BALLOT_DATA_DIR || null : options.dataDirectory;
	const storage = directory ? createMeasureReferenceStorage(directory) : null;
	const now = options.now ?? Date.now;
	const sources = options.sources ?? measureReferenceSources;
	async function collections(stateCode: string | null) {
		if (!storage) return [];
		const captureTime = now();
		const loaded: { source: MeasureReferenceSource; snapshot: MeasureReferenceSnapshot }[] = [];
		for (const source of selectMeasureReferenceSources(sources, stateCode, captureTime)) {
			const snapshot = await storage.read(source, captureTime);
			if (snapshot) loaded.push({ source, snapshot });
		}
		return loaded;
	}
	return {
		listCollections: async stateCode => collections(stateCode),
		async getMeasure(slug) {
			for (const { source, snapshot } of await collections(null)) {
				const record = snapshot.records.find(item => item.slug === slug);
				if (record) return buildMeasureFromReference(source, snapshot, record);
			}
			return null;
		},
	};
}
