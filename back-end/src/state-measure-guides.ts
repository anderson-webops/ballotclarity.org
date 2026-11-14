import type { AdditionalCoverageGuide, CoverageRepository, CoverageSnapshot } from "./coverage-repository.js";
import type { CountyAreaScope, Measure, Source } from "./types/civic.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { countyAreaIdentity, countyAreaLabel, isCountyAreaScope } from "./county-area-scope.js";
import { buildEmptyCoverageSnapshot, coverageElections, coverageJurisdictions, coverageSnapshotMetadataPath, isSupportedMeasureBallotOptions, isSupportedMeasureDecisionEffect, parseCoverageSnapshot } from "./coverage-repository.js";
import { validateCoverageSnapshotForPublication } from "./coverage-snapshot-validation.js";
import { buildDefaultGuidePackageSeed, buildGuidePackageRecord } from "./guide-packages.js";
import { getOfficialToolsForState } from "./official-election-tools.js";
import { resolveStateBallotConfiguration } from "./state-ballot-repository.js";
import { parseBundledStateSnapshot } from "./state-ballot-snapshot.js";
import { assertExternalStateDataDirectory, readBoundedStateData, readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { reconcileStateMeasureQuestions } from "./state-measure-question-reconciliation.js";
import { usStates } from "./us-states.js";

interface PinnedFile { path: string; sha256: string }
interface LocalJurisdiction { jurisdictionType: "county" | "county-area" | "city" | "town" | "township" | "village" | "school-district" | "intermediate-school-district" | "special-district" | "independent-city"; name: string; slug: string; countyAreaScope?: CountyAreaScope }
interface DocumentInput extends PinnedFile { key: string; url: string; capturedAt: string }
interface GuideInput extends PinnedFile { stateCode: string; electionDate: string; jurisdiction?: LocalJurisdiction; summaryAsExplanation: boolean; documents: DocumentInput[] }
interface FiscalSupplementTarget { electionSlug: string; jurisdictionSlug: string; measureSlug: string }
interface PreparationPlan { schemaVersion: 1; type: "state-measure-guide-preparation"; baseSnapshot: PinnedFile | null; inputs: GuideInput[]; outputDirectory: string; outputName: string; primaryAugmentation?: { electionSlug: string; jurisdictionSlug: string }; fiscalSupplement?: FiscalSupplementTarget; questionSnapshot?: PinnedFile & { sourceId: string; electionSlugs: string[] } }
interface DraftDocument { url: string; sha256: string; capturedAt: string; publicationDate?: string | null; reviewedPages?: number[] }
interface MeasureDraft { schemaVersion: 1; type: "state-measure-draft"; stateCode: string; electionDate: string; jurisdiction?: LocalJurisdiction; reviewedAt: string; publicationApproved: false; automaticImportApproved: false; measures: Measure[]; documents: Record<string, DraftDocument>; unresolvedFields?: unknown[]; unmappedQuestions?: unknown[] }

const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const byInstant = (left: string, right: string) => Date.parse(left) - Date.parse(right);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const slugPattern = /^[a-z0-9][a-z0-9-]{0,100}$/u;
const arrayFields = ["currentPractice", "proposedChanges", "yesHighlights", "noHighlights", "implementationTimeline", "fiscalSummary", "potentialImpacts", "supportArguments", "opposeArguments", "argumentsAndConsiderations", "whatWeKnow", "whatWeDoNotKnow", "sources"] as const;
const stringFields = ["slug", "contestSlug", "title", "location", "summary", "ballotSummary", "plainLanguageExplanation", "currentLawOverview", "yesMeaning", "noMeaning", "fiscalContextNote", "implementationOverview", "argumentsDisclaimer", "updatedAt"] as const;

function json(body: string): unknown {
	try {
		return JSON.parse(body);
	}
	catch { throw new Error("Preparation input must be valid JSON."); }
}

function pinned(value: unknown): value is PinnedFile {
	return record(value) && typeof value.path === "string" && isAbsolute(value.path) && typeof value.sha256 === "string" && /^[a-f0-9]{64}$/u.test(value.sha256);
}

function calendarDate(value: unknown): value is string {
	return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function pastInstant(value: unknown, now: number): value is string {
	return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/u.test(value) && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now;
}

function publicDocumentUrl(value: unknown): value is string {
	if (typeof value !== "string") return false;
	try {
		const url = new URL(value);
		return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash && value === url.href;
	}
	catch { return false; }
}

function localJurisdiction(value: unknown, stateCode: string): value is LocalJurisdiction {
	if (record(value) && value.jurisdictionType === "county-area") {
		return Object.keys(value).sort().join(",") === "countyAreaScope,jurisdictionType,name,slug"
			&& isCountyAreaScope(value.countyAreaScope, stateCode) && value.name === countyAreaLabel(value.countyAreaScope)
			&& typeof value.name === "string" && value.name.length <= 120
			&& typeof value.slug === "string" && slugPattern.test(value.slug) && value.slug.startsWith(`${stateCode.toLowerCase()}-`);
	}
	return record(value) && Object.keys(value).sort().join(",") === "jurisdictionType,name,slug"
		&& ["county", "city", "town", "township", "village", "school-district", "intermediate-school-district", "special-district", "independent-city"].includes(value.jurisdictionType as string)
		&& typeof value.name === "string" && value.name === value.name.trim() && value.name.length > 0 && value.name.length <= 120
		&& typeof value.slug === "string" && slugPattern.test(value.slug) && value.slug.startsWith(`${stateCode.toLowerCase()}-`);
}

function electionScope(stateCode: string, date: string, jurisdictionType: string, name: string, countyAreaScope?: CountyAreaScope) {
	const kind = jurisdictionType.trim().toLowerCase();
	if (kind === "county-area" && countyAreaScope) return `${stateCode}:${date}:${kind}:${countyAreaIdentity(countyAreaScope)}`;
	return `${stateCode}:${date}:${kind}:${kind === "state" ? "statewide" : name.toLowerCase().replace(/\s+/gu, " ").trim()}`;
}

function parsePlan(value: unknown): PreparationPlan {
	const keys = ["baseSnapshot", "inputs", "outputDirectory", "outputName", "schemaVersion", "type"];
	if (record(value) && Object.hasOwn(value, "primaryAugmentation")) keys.push("primaryAugmentation");
	if (record(value) && Object.hasOwn(value, "fiscalSupplement")) keys.push("fiscalSupplement");
	if (record(value) && Object.hasOwn(value, "questionSnapshot")) keys.push("questionSnapshot");
	if (!record(value) || Object.keys(value).sort().join(",") !== keys.sort().join(",") || value.schemaVersion !== 1 || value.type !== "state-measure-guide-preparation"
		|| (value.baseSnapshot !== null && !pinned(value.baseSnapshot)) || !Array.isArray(value.inputs) || !value.inputs.length || value.inputs.length > 250
		|| typeof value.outputDirectory !== "string" || !isAbsolute(value.outputDirectory) || typeof value.outputName !== "string" || !slugPattern.test(value.outputName)) {
		throw new Error("Provide a valid state-measure guide preparation plan.");
	}
	const primaryAugmentation = value.primaryAugmentation;
	const questionSnapshot = value.questionSnapshot;
	const fiscalSupplement = value.fiscalSupplement;
	if (Object.hasOwn(value, "fiscalSupplement") && (value.baseSnapshot === null || value.inputs.length !== 1 || Object.hasOwn(value, "primaryAugmentation") || !record(fiscalSupplement)
		|| Object.keys(fiscalSupplement).sort().join(",") !== "electionSlug,jurisdictionSlug,measureSlug"
		|| !["electionSlug", "jurisdictionSlug", "measureSlug"].every(key => typeof fiscalSupplement[key] === "string" && slugPattern.test(fiscalSupplement[key])))) {
		throw new Error("Fiscal supplementation requires a pinned base, one input and exact election, jurisdiction and measure identities.");
	}
	if (Object.hasOwn(value, "questionSnapshot") && (!pinned(questionSnapshot) || !record(questionSnapshot) || Object.keys(questionSnapshot).sort().join(",") !== "electionSlugs,path,sha256,sourceId"
		|| typeof questionSnapshot.sourceId !== "string" || !slugPattern.test(questionSnapshot.sourceId) || !Array.isArray(questionSnapshot.electionSlugs) || !questionSnapshot.electionSlugs.length || questionSnapshot.electionSlugs.length > 250
		|| questionSnapshot.electionSlugs.some(slug => typeof slug !== "string" || !slugPattern.test(slug)) || new Set(questionSnapshot.electionSlugs).size !== questionSnapshot.electionSlugs.length)) {
		throw new Error("Question reconciliation requires a pinned native snapshot, source and exact election selections.");
	}
	if (Object.hasOwn(value, "primaryAugmentation") && (value.baseSnapshot === null || value.inputs.length !== 1 || !record(primaryAugmentation)
		|| Object.keys(primaryAugmentation).sort().join(",") !== "electionSlug,jurisdictionSlug"
		|| !["electionSlug", "jurisdictionSlug"].every(key => typeof primaryAugmentation[key] === "string" && slugPattern.test(primaryAugmentation[key])))) {
		throw new Error("Primary augmentation requires one native input, a pinned base and exact primary identities.");
	}
	for (const input of value.inputs) {
		if (!pinned(input) || !record(input) || !usStates.some(state => state[0] === input.stateCode) || !calendarDate(input.electionDate) || typeof input.summaryAsExplanation !== "boolean"
			|| (input.jurisdiction !== undefined && !localJurisdiction(input.jurisdiction, input.stateCode as string))
			|| !Array.isArray(input.documents) || !input.documents.length || input.documents.length > 100
			|| !input.documents.every(document => pinned(document) && record(document) && typeof document.key === "string" && document.key.length > 0 && publicDocumentUrl(document.url) && typeof document.capturedAt === "string")) {
			throw new Error("Each guide input must pin a state, election, draft, document captures and explanation mapping.");
		}
	}
	return value as unknown as PreparationPlan;
}

function sourcesIn(value: unknown, officialOnly = true): Source[] {
	const sources = new Map<string, Source>();
	const pending = [{ value, depth: 0 }];
	while (pending.length) {
		const current = pending.pop()!;
		if (current.depth > 32) throw new Error("Measure draft nesting exceeds its limit.");
		if (Array.isArray(current.value)) {
			for (const child of current.value) pending.push({ value: child, depth: current.depth + 1 });
		}
		else if (record(current.value)) {
			for (const [key, child] of Object.entries(current.value)) {
				if (key === "sources") {
					if (!Array.isArray(child)) throw new Error("Measure citations must be source arrays.");
					for (const source of child) {
						if (!record(source) || typeof source.id !== "string" || !source.id.trim() || (officialOnly && (!["title", "publisher", "url", "sourceSystem"].every(field => typeof source[field] === "string" && source[field].trim()) || source.authority !== "official-government" || typeof source.date !== "string")))
							throw new Error("Every measure citation must identify its official source.");
						const previous = sources.get(source.id as string);
						if (previous && JSON.stringify(previous) !== JSON.stringify(source)) throw new Error("A source ID cannot identify conflicting citations.");
						sources.set(source.id as string, source as unknown as Source);
					}
				}
				pending.push({ value: child, depth: current.depth + 1 });
			}
		}
	}
	return [...sources.values()];
}

export function parseStateMeasureDraft(value: unknown, input: Pick<GuideInput, "stateCode" | "electionDate" | "jurisdiction">, now: number): MeasureDraft {
	if (!record(value) || value.schemaVersion !== 1 || value.type !== "state-measure-draft" || value.stateCode !== input.stateCode || value.electionDate !== input.electionDate
		|| !pastInstant(value.reviewedAt, now) || value.publicationApproved !== false || value.automaticImportApproved !== false || !record(value.documents)
		|| !Array.isArray(value.measures) || !value.measures.length || value.measures.length > 1000) {
		throw new Error("Guide input must be an unpublished native measure draft for its exact state and election.");
	}
	const stateName = usStates.find(state => state[0] === input.stateCode)![1];
	const draftJurisdiction = value.jurisdiction;
	if ((draftJurisdiction !== undefined && !localJurisdiction(draftJurisdiction, input.stateCode))
		|| Boolean(draftJurisdiction) !== Boolean(input.jurisdiction)
		|| (input.jurisdiction && !isDeepStrictEqual(draftJurisdiction, input.jurisdiction))) {
		throw new Error("Local draft and plan must bind the same exact jurisdiction; local content cannot be assigned statewide.");
	}
	const locationName = input.jurisdiction ? `${input.jurisdiction.name}, ${stateName}` : stateName;
	for (const measure of value.measures) {
		if (record(measure) && !isSupportedMeasureBallotOptions(measure.ballotOptions))
			throw new Error("Only supported binary ballot options can use the measure decision contract.");
		if (record(measure) && !isSupportedMeasureDecisionEffect(measure.decisionEffect, measure.ballotOptions))
			throw new Error("Advisory decisions require explicit supported binary choices; other decision effects are not inferred.");
		if (!record(measure) || !stringFields.every(field => typeof measure[field] === "string") || !arrayFields.every(field => Array.isArray(measure[field]))
			|| !slugPattern.test(measure.slug as string) || !slugPattern.test(measure.contestSlug as string) || measure.location !== locationName || !(measure.title as string).trim()
			|| !(measure.summary as string).trim() || !(measure.yesMeaning as string).trim() || !(measure.noMeaning as string).trim() || !Array.isArray(measure.sources) || !measure.sources.length
			|| !record(measure.freshness) || !pastInstant(measure.updatedAt, now) || !pastInstant(measure.freshness.contentLastVerifiedAt, now) || (measure.freshness.dataLastUpdatedAt !== undefined && !pastInstant(measure.freshness.dataLastUpdatedAt, now))
			|| typeof measure.freshness.nextReviewAt !== "string" || !Number.isFinite(Date.parse(measure.freshness.nextReviewAt))) {
			throw new Error("Native measure fields, binary vote meanings, citations and original freshness dates are required.");
		}
	}
	if ((value.unresolvedFields !== undefined && !Array.isArray(value.unresolvedFields)) || (value.unmappedQuestions !== undefined && !Array.isArray(value.unmappedQuestions)))
		throw new Error("Native draft review holds must remain arrays.");
	return value as unknown as MeasureDraft;
}

function reviewRepository(snapshot: CoverageSnapshot): CoverageRepository {
	const elections = coverageElections(snapshot);
	const candidates = [...snapshot.candidates, ...elections.flatMap(election => election.contests.flatMap(contest => contest.candidates ?? []))];
	const measures = [...snapshot.measures, ...elections.flatMap(election => election.contests.flatMap(contest => contest.measures ?? []))];
	return { data: snapshot, configuredSnapshotMissing: false, loadedAt: snapshot.updatedAt, mode: "snapshot", snapshotPath: ":prepared-review:", snapshotMetadata: { status: "unknown", sourceType: "unknown", sourceLabel: "Prepared guide review" }, getElectionBySlug: slug => elections.find(election => election.slug === slug) ?? null, getJurisdictionBySlug: slug => coverageJurisdictions(snapshot).find(jurisdiction => jurisdiction.slug === slug) ?? null, getCandidateBySlug: slug => candidates.find(candidate => candidate.slug === slug) ?? null, getCandidatesBySlugs: slugs => candidates.filter(candidate => slugs.includes(candidate.slug)), getMeasureBySlug: slug => measures.find(measure => measure.slug === slug) ?? null, getSourceById: id => snapshot.sources.find(source => source.id === id) ?? null };
}

function csvCell(value: string) {
	return `"${(/^[\t\r\n]|^\s*[=+\-@]/u.test(value) ? `'${value}` : value).replace(/"/gu, "\"\"")}"`;
}

function supplementFiscalMeasure(base: CoverageSnapshot, addition: AdditionalCoverageGuide, target: FiscalSupplementTarget) {
	const elections = coverageElections(base).filter(election => election.slug === target.electionSlug && election.jurisdictionSlug === target.jurisdictionSlug);
	const jurisdictions = coverageJurisdictions(base).filter(jurisdiction => jurisdiction.slug === target.jurisdictionSlug);
	const election = elections[0];
	const jurisdiction = jurisdictions[0];
	const location = base.election?.slug === target.electionSlug ? base.location : base.additionalGuides?.find(guide => guide.election.slug === target.electionSlug)?.location;
	const stateCode = usStates.find(state => state[0] === jurisdiction?.state || state[1] === jurisdiction?.state)?.[0];
	const inputState = usStates.find(state => state[0] === addition.jurisdiction.state || state[1] === addition.jurisdiction.state)?.[0];
	const matchingScopes = stateCode && jurisdiction && election
		? coverageElections(base).filter((item) => {
			const area = coverageJurisdictions(base).find(candidate => candidate.slug === item.jurisdictionSlug);
			const state = usStates.find(candidate => candidate[0] === area?.state || candidate[1] === area?.state)?.[0];
			return area && state && electionScope(state, item.date, area.jurisdictionType, area.name, area.countyAreaScope) === electionScope(stateCode, election.date, jurisdiction.jurisdictionType, jurisdiction.name, jurisdiction.countyAreaScope);
		}).length
		: 0;
	if (elections.length !== 1 || jurisdictions.length !== 1 || !election || !jurisdiction || !location || !stateCode || !inputState
		|| matchingScopes !== 1
		|| electionScope(stateCode, election.date, jurisdiction.jurisdictionType, jurisdiction.name, jurisdiction.countyAreaScope) !== electionScope(inputState, addition.election.date, addition.jurisdiction.jurisdictionType, addition.jurisdiction.name, addition.jurisdiction.countyAreaScope)
		|| addition.election.contests.length !== 1 || addition.election.contests[0]?.measures?.length !== 1) {
		throw new Error("Fiscal supplementation must retain one exact existing election and jurisdiction scope.");
	}
	const incoming = addition.election.contests[0].measures[0]!;
	const occurrences = coverageElections(base).flatMap(item => item.contests.flatMap(contest => (contest.measures ?? []).filter(measure => measure.slug === target.measureSlug).map(measure => ({ election: item, contest, measure }))));
	const previous = occurrences[0]?.measure;
	if (incoming.slug !== target.measureSlug || occurrences.length !== 1 || occurrences[0]!.election.slug !== target.electionSlug || occurrences[0]!.contest.slug !== incoming.contestSlug || !previous
		|| !Array.isArray(previous.fiscalSummary) || !Array.isArray(previous.sources)
		|| !isDeepStrictEqual({ ...previous, fiscalSummary: [], sources: [] }, { ...incoming, fiscalSummary: [], sources: [] })) {
		throw new Error("Fiscal supplementation must preserve all existing nonfiscal measure fields and identities.");
	}
	const roots = base.measures.filter(measure => measure.slug === target.measureSlug);
	if (roots.length > 1 || (roots.length && !isDeepStrictEqual(roots[0], previous))) throw new Error("Existing root and contest measure copies require reconciliation.");
	if (!incoming.fiscalSummary.length || incoming.fiscalSummary.length > 100 || (previous.fiscalSummary.length && !isDeepStrictEqual(previous.fiscalSummary, incoming.fiscalSummary))) throw new Error("Existing fiscal rows require a separate replacement review.");
	if (!isDeepStrictEqual(incoming.sources.slice(0, previous.sources.length), previous.sources) || !incoming.sources.every(source => record(source) && typeof source.id === "string") || new Set(incoming.sources.map(source => source.id)).size !== incoming.sources.length) throw new Error("Fiscal supplementation must preserve every original citation.");
	const fiscalIds = new Set<string>();
	for (const row of incoming.fiscalSummary) {
		if (!record(row) || Object.keys(row).sort().join(",") !== "horizon,id,label,note,scope,sources,value" || typeof row.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,200}$/u.test(row.id) || fiscalIds.has(row.id)
			|| !["label", "value", "scope", "horizon", "note"].every(key => typeof row[key] === "string" && String(row[key]).length <= 8192) || !row.label.trim() || !row.value.trim()
			|| !Array.isArray(row.sources) || !row.sources.length || row.sources.length > 20
			|| !row.sources.every(source => record(source) && source.authority === "official-government" && incoming.sources.some(existing => isDeepStrictEqual(existing, source)))) {
			throw new Error("Fiscal supplementation requires bounded, distinct fiscal rows with pinned official citations.");
		}
		fiscalIds.add(row.id);
	}
	const existingSources = new Map(sourcesIn(base, false).map(source => [source.id, source]));
	const newSources = sourcesIn(addition);
	for (const source of newSources) {
		const previousSource = existingSources.get(source.id);
		if (previousSource && !isDeepStrictEqual(previousSource, source)) throw new Error("Fiscal supplementation cannot change an existing source identity.");
	}
	const snapshot = structuredClone(base);
	const changedElection = coverageElections(snapshot).find(item => item.slug === target.electionSlug)!;
	for (const contest of changedElection.contests) {
		if (contest.measures?.some(measure => measure.slug === target.measureSlug)) contest.measures = contest.measures.map(measure => measure.slug === target.measureSlug ? structuredClone(incoming) : measure);
	}
	snapshot.measures = snapshot.measures.map(measure => measure.slug === target.measureSlug ? structuredClone(incoming) : measure);
	const rootSources = new Set(snapshot.sources.map(source => source.id));
	snapshot.sources.push(...newSources.filter(source => !rootSources.has(source.id)));
	const coverageLimits = base.additionalGuides?.find(guide => guide.election.slug === target.electionSlug)?.coverageLimits ?? ["Local races and ballot questions may be missing."];
	return { snapshot: parseCoverageSnapshot(snapshot), guides: [{ election: changedElection, jurisdiction: structuredClone(jurisdiction), location: structuredClone(location), coverageLimits: structuredClone(coverageLimits) }] };
}

export async function prepareStateMeasureGuideFiles(planPath: string, now = Date.now()) {
	const planBody = await readBoundedStateData(planPath);
	const plan = parsePlan(json(planBody));
	assertExternalStateDataDirectory(plan.outputDirectory);
	assertExternalStateDataDirectory(join(await realpath(dirname(plan.outputDirectory)), basename(plan.outputDirectory)));
	let bytes = Buffer.byteLength(planBody);
	async function readPinned(input: PinnedFile, document = false) {
		const body = await readBoundedStateDataBytes(input.path, document ? 32 * 1024 * 1024 : 12 * 1024 * 1024);
		if (body.byteLength > 12 * 1024 * 1024 && !body.subarray(0, 5).equals(Buffer.from("%PDF-")))
			throw new Error("Only pinned PDF documents may exceed the state data size limit.");
		bytes += body.byteLength;
		if (bytes > 64 * 1024 * 1024) throw new Error("Preparation inputs exceed their combined size limit.");
		if (hash(body) !== input.sha256) throw new Error("Preparation input digest does not match its reviewed file.");
		return body;
	}
	const base = plan.baseSnapshot ? parseCoverageSnapshot(json((await readPinned(plan.baseSnapshot)).toString("utf8"))) : null;
	const primaryElection = base?.election;
	const primaryJurisdiction = base?.jurisdiction;
	const primaryLocation = base?.location;
	const primaryState = primaryJurisdiction ? usStates.find(state => state[0] === primaryJurisdiction.state || state[1] === primaryJurisdiction.state)?.[0] : null;
	const primaryScope = primaryElection && primaryJurisdiction && primaryState ? electionScope(primaryState, primaryElection.date, primaryJurisdiction.jurisdictionType, primaryJurisdiction.name, primaryJurisdiction.countyAreaScope) : null;
	if (plan.primaryAugmentation && (!base || !primaryElection || !primaryJurisdiction || !primaryLocation || !primaryScope || primaryElection.slug !== plan.primaryAugmentation.electionSlug
		|| primaryJurisdiction.slug !== plan.primaryAugmentation.jurisdictionSlug || primaryElection.jurisdictionSlug !== primaryJurisdiction.slug
		|| coverageElections(base).filter((election) => {
			const jurisdiction = coverageJurisdictions(base).find(item => item.slug === election.jurisdictionSlug);
			return jurisdiction && electionScope(primaryState!, election.date, jurisdiction.jurisdictionType, jurisdiction.name, jurisdiction.countyAreaScope) === primaryScope
				&& (jurisdiction.state === primaryState || jurisdiction.state === primaryJurisdiction.state);
		}).length !== 1)) {
		throw new Error("Primary augmentation must identify one unambiguous primary election and jurisdiction in the pinned base.");
	}
	const existingScopes = new Set(base
		? coverageElections(base).flatMap((election) => {
				const jurisdiction = coverageJurisdictions(base).find(item => item.slug === election.jurisdictionSlug);
				const stateCode = usStates.find(state => state[0] === jurisdiction?.state || state[1] === jurisdiction?.state)?.[0];
				return jurisdiction && stateCode ? [electionScope(stateCode, election.date, jurisdiction.jurisdictionType, jurisdiction.name, jurisdiction.countyAreaScope)] : [];
			})
		: []);
	const additions: AdditionalCoverageGuide[] = [];
	const provenance: string[][] = [];
	const captures = [];
	const holds = [];
	const mappings = [];
	const pdfDocuments = new Set<string>();
	for (const input of plan.inputs) {
		const scope = electionScope(input.stateCode, input.electionDate, input.jurisdiction?.jurisdictionType ?? "state", input.jurisdiction?.name ?? "", input.jurisdiction?.countyAreaScope);
		if (!plan.fiscalSupplement && (plan.primaryAugmentation ? scope !== primaryScope : existingScopes.has(scope)))
			throw new Error(plan.primaryAugmentation ? "Primary augmentation must retain the exact primary state, date and jurisdiction scope." : "An existing election scope requires a separately reviewed replacement; preparation is append-only.");
		existingScopes.add(scope);
		const draft = parseStateMeasureDraft(json((await readPinned(input)).toString("utf8")), input, now);
		if (new Set(input.documents.map(document => document.key)).size !== input.documents.length || input.documents.length !== Object.keys(draft.documents).length)
			throw new Error("Provide exactly one pinned capture for every native draft document.");
		for (const document of input.documents) {
			const expected = draft.documents[document.key];
			if (!record(expected) || expected.url !== document.url || expected.sha256 !== document.sha256 || expected.capturedAt !== document.capturedAt || !pastInstant(document.capturedAt, now)
				|| (expected.publicationDate !== undefined && expected.publicationDate !== null && (!calendarDate(expected.publicationDate) || expected.publicationDate > document.capturedAt.slice(0, 10)))) {
				throw new Error("Document provenance must match the native draft, including original capture dates.");
			}
			const body = await readPinned(document, true);
			const isPdf = body.subarray(0, 5).equals(Buffer.from("%PDF-"));
			if (/\.pdf$/iu.test(new URL(document.url).pathname) && !isPdf)
				throw new Error("Pinned PDF captures must contain PDF bytes.");
			if (isPdf) pdfDocuments.add(document.url);
			captures.push({ stateCode: input.stateCode, key: document.key, url: document.url, sha256: document.sha256, capturedAt: document.capturedAt, bytes: body.byteLength, publicationDate: expected.publicationDate ?? null });
		}
		const allSources = sourcesIn(draft.measures);
		for (const source of allSources) {
			let url: URL;
			try {
				url = new URL(source.url);
			}
			catch { throw new Error("Native citations require valid document URLs."); }
			const fragment = url.hash;
			url.hash = "";
			const document = Object.values(draft.documents).find(item => item.url === url.href);
			if (!document || url.protocol !== "https:" || (source.date !== "" && source.date !== document.publicationDate)
				|| (pdfDocuments.has(url.href) && fragment && (!/^#page=[1-9]\d*$/u.test(fragment) || !document.reviewedPages?.includes(Number(fragment.slice(6)))))) {
				throw new Error("Citations must retain reviewed document/page identities and must not invent publication dates.");
			}
		}
		const stateName = usStates.find(state => state[0] === input.stateCode)![1];
		const areaScopeLabel = input.stateCode === "DC" ? "Districtwide" : "Statewide";
		const areaSlug = input.jurisdiction?.slug ?? `${input.stateCode.toLowerCase()}-${areaScopeLabel.toLowerCase()}`;
		const electionSlug = plan.fiscalSupplement?.electionSlug ?? plan.primaryAugmentation?.electionSlug ?? `${areaSlug}-measures-${input.electionDate}`;
		const jurisdictionSlug = plan.fiscalSupplement?.jurisdictionSlug ?? plan.primaryAugmentation?.jurisdictionSlug ?? `${areaSlug}-${input.electionDate}`;
		const areaName = input.jurisdiction?.name ?? stateName;
		const locationName = input.jurisdiction ? `${areaName}, ${stateName}` : stateName;
		const resources = structuredClone(getOfficialToolsForState(input.stateCode));
		const measures = structuredClone(draft.measures);
		for (const measure of measures) {
			if (input.summaryAsExplanation && !measure.plainLanguageExplanation.trim()) {
				measure.plainLanguageExplanation = measure.summary;
				mappings.push({ measureSlug: measure.slug, from: "summary", to: "plainLanguageExplanation", sourceDraftSha256: input.sha256 });
			}
			for (const source of sourcesIn(measure)) {
				const url = new URL(source.url);
				url.hash = "";
				const document = Object.values(draft.documents).find(item => item.url === url.href)!;
				provenance.push([input.stateCode, input.electionDate, electionSlug, jurisdictionSlug, measure.contestSlug, measure.slug, measure.title, measure.summary, measure.yesMeaning, measure.noMeaning, source.id, source.url, source.date, document.capturedAt, document.sha256, input.sha256, measure.ballotOptions?.yes ?? "Yes", measure.ballotOptions?.no ?? "No", measure.decisionEffect ?? ""]);
			}
		}
		const summary = { slug: electionSlug, name: input.jurisdiction ? `${areaName} ballot questions` : `${stateName} ${areaScopeLabel.toLowerCase()} measures`, date: input.electionDate, jurisdictionSlug, locationName, updatedAt: draft.reviewedAt };
		const dataTimes = measures.flatMap(measure => typeof measure.freshness.dataLastUpdatedAt === "string" ? [measure.freshness.dataLastUpdatedAt] : []);
		const freshness = { contentLastVerifiedAt: measures.map(measure => measure.freshness.contentLastVerifiedAt).sort(byInstant)[0]!, dataLastUpdatedAt: dataTimes.length === measures.length ? dataTimes.sort(byInstant).at(-1) : undefined, nextReviewAt: measures.map(measure => measure.freshness.nextReviewAt).sort(byInstant)[0]!, status: "incomplete" as const, statusLabel: "Partial sourced explanation", statusNote: "" };
		additions.push({ coverageLimits: [input.jurisdiction ? "Selected local questions only; other races and ballot questions are not included." : input.stateCode === "DC" ? "Districtwide measures only; candidate races are not included." : "Statewide measures only; local candidates and measures are not included."], election: { ...summary, description: "", keyDates: [], officialResources: resources, changeLog: [], freshness, contests: measures.map(measure => ({ slug: measure.contestSlug, title: measure.title, office: input.jurisdiction ? "Local ballot measure" : `${areaScopeLabel} ballot measure`, jurisdiction: "Ballot measure", type: "measure", description: "", roleGuide: { summary: "", whyItMatters: "", decisionAreas: [] }, measures: [measure] })) }, jurisdiction: { slug: jurisdictionSlug, name: areaName, displayName: locationName, state: stateName, jurisdictionType: input.jurisdiction?.jurisdictionType ?? "state", description: "", nextElectionName: summary.name, nextElectionSlug: electionSlug, updatedAt: draft.reviewedAt, officialOffice: { name: "", address: "", phone: "", email: "", hours: "", website: resources[0]?.url ?? "" }, officialResources: resources, votingMethods: [], upcomingElections: [summary], archivedGuides: [], coverageNotes: [] }, location: { slug: jurisdictionSlug, displayName: locationName, state: stateName, coverageLabel: input.jurisdiction ? "Selected local questions" : `${areaScopeLabel} measures`, lookupMode: "coverage-selection", requiresOfficialConfirmation: true } });
		if (input.jurisdiction?.countyAreaScope)
			additions.at(-1)!.jurisdiction.countyAreaScope = structuredClone(input.jurisdiction.countyAreaScope);
		holds.push({ stateCode: input.stateCode, jurisdiction: input.jurisdiction ?? null, sourceDraftSha256: input.sha256, unresolvedFields: draft.unresolvedFields ?? [], unmappedQuestions: draft.unmappedQuestions ?? [] });
	}
	const updatedAt = [...additions.map(guide => guide.election.updatedAt), ...(base ? [base.updatedAt] : [])].sort(byInstant).at(-1)!;
	let snapshot: CoverageSnapshot;
	let guides = additions;
	if (plan.fiscalSupplement && base) {
		({ snapshot, guides } = supplementFiscalMeasure(base, additions[0]!, plan.fiscalSupplement));
	}
	else if (plan.primaryAugmentation && base && primaryElection && primaryJurisdiction && primaryLocation) {
		const existingContests = coverageElections(base).flatMap(election => election.contests);
		const contestIds = new Set(existingContests.map(contest => contest.slug));
		const measureIds = new Set([...base.measures, ...existingContests.flatMap(contest => contest.measures ?? [])].map(measure => measure.slug));
		const newContests = additions.flatMap(guide => guide.election.contests);
		const newMeasures = newContests.flatMap(contest => contest.measures ?? []);
		for (const contest of newContests) {
			if (contestIds.has(contest.slug)) throw new Error("Primary augmentation cannot replace an existing contest or measure identity.");
			contestIds.add(contest.slug);
			for (const measure of contest.measures ?? []) {
				if (measureIds.has(measure.slug)) throw new Error("Primary augmentation cannot replace an existing contest or measure identity.");
				measureIds.add(measure.slug);
			}
		}
		const existingSources = new Map(sourcesIn(base, false).map(source => [source.id, source]));
		const newSources = sourcesIn(additions);
		for (const source of newSources) {
			const previous = existingSources.get(source.id);
			if (previous && JSON.stringify(previous) !== JSON.stringify(source)) throw new Error("Primary augmentation cannot change an existing source identity.");
		}
		const rootSources = new Set(base.sources.map(source => source.id));
		const election = { ...primaryElection, contests: [...primaryElection.contests, ...newContests] };
		snapshot = parseCoverageSnapshot({ ...base, election, measures: [...base.measures, ...newMeasures], sources: [...base.sources, ...newSources.filter(source => !rootSources.has(source.id))] });
		guides = [{ election, jurisdiction: primaryJurisdiction, location: primaryLocation, coverageLimits: ["Local races and ballot questions may be missing."] }];
	}
	else {
		snapshot = parseCoverageSnapshot({ ...(base ?? buildEmptyCoverageSnapshot(updatedAt)), additionalGuides: [...(base?.additionalGuides ?? []), ...additions], updatedAt });
	}
	let questionReconciliation;
	if (plan.questionSnapshot) {
		const source = resolveStateBallotConfiguration(process.env, now).sources.find(item => item.id === plan.questionSnapshot!.sourceId);
		if (!source) throw new Error("Question reconciliation requires an explicitly configured and enabled source.");
		const native = parseBundledStateSnapshot(source, (await readPinned(plan.questionSnapshot)).toString("utf8"), source.retrievalPolicy === "manual-snapshot" ? "manual-snapshot" : "automatic");
		if (!pastInstant(native.retrievedAt, now) || native.documents?.some(document => !pastInstant(document.retrievedAt, now))) throw new Error("Question reconciliation preserves original nonfuture capture clocks.");
		questionReconciliation = reconcileStateMeasureQuestions(native, snapshot, plan.questionSnapshot.electionSlugs);
		if (!questionReconciliation.wordingReconciled) throw new Error(`Measure/question reconciliation requires review: ${[...new Set(questionReconciliation.findings.map(finding => finding.code))].join(", ")}.`);
	}
	const repository = reviewRepository(snapshot);
	const workflowIds = new Set(guides.map(guide => guide.election.slug));
	const workflows = buildDefaultGuidePackageSeed(repository).filter(workflow => workflowIds.has(workflow.electionSlug)).map(workflow => plan.primaryAugmentation || plan.fiscalSupplement
		? {
				coverageLimits: [...(guides[0]!.coverageLimits ?? [])],
				coverageNotes: [],
				createdAt: new Date(now).toISOString(),
				draftedAt: new Date(now).toISOString(),
				electionSlug: workflow.electionSlug,
				id: workflow.id,
				jurisdictionSlug: workflow.jurisdictionSlug,
				status: "draft" as const,
				updatedAt: new Date(now).toISOString(),
			}
		: workflow);
	const metadata = { status: "unknown" as const, sourceType: "unknown" as const, sourceLabel: "Prepared state-measure draft assembly", note: "Not approved for publication, automatic import or replacement of the active primary guide." };
	const validation = validateCoverageSnapshotForPublication(snapshot, metadata);
	const prefix = plan.outputName;
	const includeBallotLabels = additions.some(guide => guide.election.contests.some(contest => contest.measures?.some(measure => measure.ballotOptions)));
	const includeDecisionEffects = additions.some(guide => guide.election.contests.some(contest => contest.measures?.some(measure => measure.decisionEffect)));
	const csvHeader = ["stateCode", "electionDate", "electionSlug", "jurisdictionSlug", "contestSlug", "measureSlug", "title", "summary", "yesMeaning", "noMeaning", "sourceId", "sourceUrl", "publicationDate", "capturedAt", "documentSha256", "draftSha256"];
	if (includeBallotLabels) csvHeader.push("yesLabel", "noLabel");
	if (includeDecisionEffects) csvHeader.push("decisionEffect");
	const csvRows = provenance.map(row => [...row.slice(0, includeBallotLabels ? 18 : 16), ...(includeDecisionEffects ? [row[18]] : [])]);
	const files = [
		{ name: `${prefix}-guides.json`, body: `${JSON.stringify({ schemaVersion: 1, type: "state-measure-guide-bundle", guides, publicationApproved: false, automaticImportApproved: false, primaryReplacementApproved: false }, null, 2)}\n` },
		{ name: `${prefix}-workflows.json`, body: `${JSON.stringify(workflows, null, 2)}\n` },
		{ name: `${prefix}-review.json`, body: `${JSON.stringify({ validation, guideDiagnostics: workflows.map(workflow => ({ electionSlug: workflow.electionSlug, ...buildGuidePackageRecord(workflow, repository, []).diagnostics })), holds, mappings, publicationApproved: false, automaticImportApproved: false }, null, 2)}\n` },
		{ name: `${prefix}-provenance.csv`, body: `${[csvHeader, ...csvRows].map(row => row.map(csvCell).join(",")).join("\n")}\n` },
	];
	if (questionReconciliation) {
		const result = { ...questionReconciliation, nativeSnapshotSha256: plan.questionSnapshot!.sha256, outputCoverageSha256: hash(`${JSON.stringify(snapshot, null, 2)}\n`) };
		const rows = [["stateCode", "electionDate", "questionId", "measureSlug", "electionSlug", "jurisdictionSlug", "jurisdictionType", "jurisdictionName", "yesLabel", "noLabel", "pages", "sourceUrl", "documentSha256", "capturedAt", "normalizedTextSha256", "officialText"], ...result.matches.map(match => [result.stateCode, result.electionDate, match.questionId, match.measureSlug, match.electionSlug, match.jurisdictionSlug, match.jurisdictionType, match.jurisdictionName, match.choices[0] ?? "", match.choices[1] ?? "", match.pages.join(";"), match.sourceUrl, match.documentSha256 ?? "", match.originalCapturedAt ?? "", match.normalizedTextSha256, match.officialText])];
		if (result.matches.some(match => match.publishedArea)) {
			rows[0]!.push("printedAreaKind", "printedArea", "excludedMunicipalities", "printedAreaEvidence");
			for (const [index, match] of result.matches.entries()) rows[index + 1]!.push(match.publishedArea?.kind ?? "", match.publishedArea?.name ?? "", match.publishedArea?.excludedMunicipalities?.join("; ") ?? "", match.publishedArea?.evidence ?? "");
		}
		files.push({ name: `${prefix}-question-reconciliation.json`, body: `${JSON.stringify(result, null, 2)}\n` }, { name: `${prefix}-question-reconciliation.csv`, body: `${rows.map(row => row.map(csvCell).join(",")).join("\n")}\n` });
	}
	if (base) {
		const name = `${prefix}-coverage.json`;
		const body = `${JSON.stringify(snapshot, null, 2)}\n`;
		files.push({ name, body }, { name: basename(coverageSnapshotMetadataPath(name)), body: `${JSON.stringify({ ...metadata, contentSha256: hash(body) }, null, 2)}\n` });
	}
	const manifest = { schemaVersion: 1, type: "state-measure-guide-preparation-result", preparedAt: new Date(now).toISOString(), mode: plan.fiscalSupplement ? "supplement-pinned-measure-fiscal-review-only" : plan.primaryAugmentation ? "augment-pinned-primary-review-only" : base ? "append-to-pinned-base-review-only" : "standalone-review-only", baseSnapshotSha256: plan.baseSnapshot?.sha256 ?? null, ...(plan.primaryAugmentation ? { primaryAugmentation: plan.primaryAugmentation, existingPrimaryMetadataPreserved: true, existingPrimaryContestsPreserved: true } : {}), ...(plan.fiscalSupplement ? { fiscalSupplement: plan.fiscalSupplement, existingNonfiscalMeasureFieldsPreserved: true, existingElectionMetadataPreserved: true } : {}), inputDrafts: plan.inputs.map(input => ({ stateCode: input.stateCode, electionDate: input.electionDate, jurisdiction: input.jurisdiction ?? null, sha256: input.sha256, summaryAsExplanation: input.summaryAsExplanation })), documents: captures, holds, mappings, guides: guides.length, measures: additions.reduce((total, guide) => total + guide.election.contests.length, 0), existingPrimaryPreserved: base ? !plan.primaryAugmentation && (!plan.fiscalSupplement || plan.fiscalSupplement.electionSlug !== base.election?.slug) : null, existingAdditionalGuidesPreserved: (base?.additionalGuides?.length ?? 0) - (base?.additionalGuides?.some(guide => guide.election.slug === plan.fiscalSupplement?.electionSlug) ? 1 : 0), files: files.map(file => ({ name: file.name, bytes: Buffer.byteLength(file.body), sha256: hash(file.body) })), publisherRequests: 0, imported: false, publicationApproved: false, automaticImportApproved: false, primaryReplacementApproved: false };
	files.push({ name: `${prefix}-manifest.json`, body: `${JSON.stringify(manifest, null, 2)}\n` });
	files.push({ name: `${prefix}-SHA256SUMS`, body: `${files.map(file => `${hash(file.body)}  ${file.name}`).join("\n")}\n` });
	if (files.some(file => Buffer.byteLength(file.body) > 12 * 1024 * 1024)) throw new Error("Prepared output exceeds the existing local data file bound.");
	await mkdir(plan.outputDirectory);
	assertExternalStateDataDirectory(await realpath(plan.outputDirectory));
	for (const file of files) await writeFile(join(plan.outputDirectory, file.name), file.body, { flag: "wx" });
	return { outputDirectory: plan.outputDirectory, files: files.length, guides: manifest.guides, measures: manifest.measures, mode: manifest.mode, publisherRequests: 0, imported: false, publicationApproved: false, automaticImportApproved: false };
}
