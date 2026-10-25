import type { AdditionalCoverageGuide, CoverageRepository, CoverageSnapshot } from "./coverage-repository.js";
import type { Measure, Source } from "./types/civic.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import { buildEmptyCoverageSnapshot, coverageElections, coverageJurisdictions, coverageSnapshotMetadataPath, isSupportedMeasureBallotOptions, isSupportedMeasureDecisionEffect, parseCoverageSnapshot } from "./coverage-repository.js";
import { validateCoverageSnapshotForPublication } from "./coverage-snapshot-validation.js";
import { buildDefaultGuidePackageSeed, buildGuidePackageRecord } from "./guide-packages.js";
import { getOfficialToolsForState } from "./official-election-tools.js";
import { assertExternalStateDataDirectory, readBoundedStateData, readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { usStates } from "./us-states.js";

interface PinnedFile { path: string; sha256: string }
interface LocalJurisdiction { jurisdictionType: "county" | "city" | "town" | "township" | "village" | "school-district" | "intermediate-school-district" | "special-district" | "independent-city"; name: string; slug: string }
interface DocumentInput extends PinnedFile { key: string; url: string; capturedAt: string }
interface GuideInput extends PinnedFile { stateCode: string; electionDate: string; jurisdiction?: LocalJurisdiction; summaryAsExplanation: boolean; documents: DocumentInput[] }
interface PreparationPlan { schemaVersion: 1; type: "state-measure-guide-preparation"; baseSnapshot: PinnedFile | null; inputs: GuideInput[]; outputDirectory: string; outputName: string; primaryAugmentation?: { electionSlug: string; jurisdictionSlug: string } }
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
	return record(value) && Object.keys(value).sort().join(",") === "jurisdictionType,name,slug"
		&& ["county", "city", "town", "township", "village", "school-district", "intermediate-school-district", "special-district", "independent-city"].includes(value.jurisdictionType as string)
		&& typeof value.name === "string" && value.name === value.name.trim() && value.name.length > 0 && value.name.length <= 120
		&& typeof value.slug === "string" && slugPattern.test(value.slug) && value.slug.startsWith(`${stateCode.toLowerCase()}-`);
}

function electionScope(stateCode: string, date: string, jurisdictionType: string, name: string) {
	const kind = jurisdictionType.trim().toLowerCase();
	return `${stateCode}:${date}:${kind}:${kind === "state" ? "statewide" : name.toLowerCase().replace(/\s+/gu, " ").trim()}`;
}

function parsePlan(value: unknown): PreparationPlan {
	const keys = ["baseSnapshot", "inputs", "outputDirectory", "outputName", "schemaVersion", "type"];
	if (record(value) && Object.hasOwn(value, "primaryAugmentation")) keys.push("primaryAugmentation");
	if (!record(value) || Object.keys(value).sort().join(",") !== keys.sort().join(",") || value.schemaVersion !== 1 || value.type !== "state-measure-guide-preparation"
		|| (value.baseSnapshot !== null && !pinned(value.baseSnapshot)) || !Array.isArray(value.inputs) || !value.inputs.length || value.inputs.length > 250
		|| typeof value.outputDirectory !== "string" || !isAbsolute(value.outputDirectory) || typeof value.outputName !== "string" || !slugPattern.test(value.outputName)) {
		throw new Error("Provide a valid state-measure guide preparation plan.");
	}
	const primaryAugmentation = value.primaryAugmentation;
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

function parseDraft(value: unknown, input: GuideInput, now: number): MeasureDraft {
	if (!record(value) || value.schemaVersion !== 1 || value.type !== "state-measure-draft" || value.stateCode !== input.stateCode || value.electionDate !== input.electionDate
		|| !pastInstant(value.reviewedAt, now) || value.publicationApproved !== false || value.automaticImportApproved !== false || !record(value.documents)
		|| !Array.isArray(value.measures) || !value.measures.length || value.measures.length > 1000) {
		throw new Error("Guide input must be an unpublished native measure draft for its exact state and election.");
	}
	const stateName = usStates.find(state => state[0] === input.stateCode)![1];
	const draftJurisdiction = value.jurisdiction;
	if ((draftJurisdiction !== undefined && !localJurisdiction(draftJurisdiction, input.stateCode))
		|| Boolean(draftJurisdiction) !== Boolean(input.jurisdiction)
		|| (input.jurisdiction && (!record(draftJurisdiction) || (["jurisdictionType", "name", "slug"] as const).some(field => draftJurisdiction[field] !== input.jurisdiction![field])))) {
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
	const primaryScope = primaryElection && primaryJurisdiction && primaryState ? electionScope(primaryState, primaryElection.date, primaryJurisdiction.jurisdictionType, primaryJurisdiction.name) : null;
	if (plan.primaryAugmentation && (!base || !primaryElection || !primaryJurisdiction || !primaryLocation || !primaryScope || primaryElection.slug !== plan.primaryAugmentation.electionSlug
		|| primaryJurisdiction.slug !== plan.primaryAugmentation.jurisdictionSlug || primaryElection.jurisdictionSlug !== primaryJurisdiction.slug
		|| coverageElections(base).filter((election) => {
			const jurisdiction = coverageJurisdictions(base).find(item => item.slug === election.jurisdictionSlug);
			return jurisdiction && electionScope(primaryState!, election.date, jurisdiction.jurisdictionType, jurisdiction.name) === primaryScope
				&& (jurisdiction.state === primaryState || jurisdiction.state === primaryJurisdiction.state);
		}).length !== 1)) {
		throw new Error("Primary augmentation must identify one unambiguous primary election and jurisdiction in the pinned base.");
	}
	const existingScopes = new Set(base
		? coverageElections(base).flatMap((election) => {
				const jurisdiction = coverageJurisdictions(base).find(item => item.slug === election.jurisdictionSlug);
				const stateCode = usStates.find(state => state[0] === jurisdiction?.state || state[1] === jurisdiction?.state)?.[0];
				return jurisdiction && stateCode ? [electionScope(stateCode, election.date, jurisdiction.jurisdictionType, jurisdiction.name)] : [];
			})
		: []);
	const additions: AdditionalCoverageGuide[] = [];
	const provenance: string[][] = [];
	const captures = [];
	const holds = [];
	const mappings = [];
	const pdfDocuments = new Set<string>();
	for (const input of plan.inputs) {
		const scope = electionScope(input.stateCode, input.electionDate, input.jurisdiction?.jurisdictionType ?? "state", input.jurisdiction?.name ?? "");
		if (plan.primaryAugmentation ? scope !== primaryScope : existingScopes.has(scope))
			throw new Error(plan.primaryAugmentation ? "Primary augmentation must retain the exact primary state, date and jurisdiction scope." : "An existing election scope requires a separately reviewed replacement; preparation is append-only.");
		existingScopes.add(scope);
		const draft = parseDraft(json((await readPinned(input)).toString("utf8")), input, now);
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
		const electionSlug = plan.primaryAugmentation?.electionSlug ?? `${areaSlug}-measures-${input.electionDate}`;
		const jurisdictionSlug = plan.primaryAugmentation?.jurisdictionSlug ?? `${areaSlug}-${input.electionDate}`;
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
		holds.push({ stateCode: input.stateCode, jurisdiction: input.jurisdiction ?? null, sourceDraftSha256: input.sha256, unresolvedFields: draft.unresolvedFields ?? [], unmappedQuestions: draft.unmappedQuestions ?? [] });
	}
	const updatedAt = [...additions.map(guide => guide.election.updatedAt), ...(base ? [base.updatedAt] : [])].sort(byInstant).at(-1)!;
	let snapshot: CoverageSnapshot;
	let guides = additions;
	if (plan.primaryAugmentation && base && primaryElection && primaryJurisdiction && primaryLocation) {
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
	const repository = reviewRepository(snapshot);
	const workflowIds = new Set(guides.map(guide => guide.election.slug));
	const workflows = buildDefaultGuidePackageSeed(repository).filter(workflow => workflowIds.has(workflow.electionSlug)).map(workflow => plan.primaryAugmentation
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
	if (base) {
		const name = `${prefix}-coverage.json`;
		const body = `${JSON.stringify(snapshot, null, 2)}\n`;
		files.push({ name, body }, { name: basename(coverageSnapshotMetadataPath(name)), body: `${JSON.stringify({ ...metadata, contentSha256: hash(body) }, null, 2)}\n` });
	}
	const manifest = { schemaVersion: 1, type: "state-measure-guide-preparation-result", preparedAt: new Date(now).toISOString(), mode: plan.primaryAugmentation ? "augment-pinned-primary-review-only" : base ? "append-to-pinned-base-review-only" : "standalone-review-only", baseSnapshotSha256: plan.baseSnapshot?.sha256 ?? null, ...(plan.primaryAugmentation ? { primaryAugmentation: plan.primaryAugmentation, existingPrimaryMetadataPreserved: true, existingPrimaryContestsPreserved: true } : {}), inputDrafts: plan.inputs.map(input => ({ stateCode: input.stateCode, electionDate: input.electionDate, jurisdiction: input.jurisdiction ?? null, sha256: input.sha256, summaryAsExplanation: input.summaryAsExplanation })), documents: captures, holds, mappings, guides: guides.length, measures: additions.reduce((total, guide) => total + guide.election.contests.length, 0), existingPrimaryPreserved: base ? !plan.primaryAugmentation : null, existingAdditionalGuidesPreserved: base?.additionalGuides?.length ?? 0, files: files.map(file => ({ name: file.name, bytes: Buffer.byteLength(file.body), sha256: hash(file.body) })), publisherRequests: 0, imported: false, publicationApproved: false, automaticImportApproved: false, primaryReplacementApproved: false };
	files.push({ name: `${prefix}-manifest.json`, body: `${JSON.stringify(manifest, null, 2)}\n` });
	files.push({ name: `${prefix}-SHA256SUMS`, body: `${files.map(file => `${hash(file.body)}  ${file.name}`).join("\n")}\n` });
	if (files.some(file => Buffer.byteLength(file.body) > 12 * 1024 * 1024)) throw new Error("Prepared output exceeds the existing local data file bound.");
	await mkdir(plan.outputDirectory);
	assertExternalStateDataDirectory(await realpath(plan.outputDirectory));
	for (const file of files) await writeFile(join(plan.outputDirectory, file.name), file.body, { flag: "wx" });
	return { outputDirectory: plan.outputDirectory, files: files.length, guides: manifest.guides, measures: manifest.measures, mode: manifest.mode, publisherRequests: 0, imported: false, publicationApproved: false, automaticImportApproved: false };
}
