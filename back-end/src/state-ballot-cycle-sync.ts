import type { StateBallotCycleCatalog } from "./state-ballot-cycles.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { cassiaDocumentDigest, fetchCassiaCandidateCapture, fetchCassiaCycleDiscovery, readCassiaDiscovery } from "./state-ballot-cassia.js";
import { fetchCertifiedPdfCapture, fetchCertifiedPdfCycleDiscovery } from "./state-ballot-certified-pdf.js";
import { fetchClarkCandidateCapture } from "./state-ballot-clark-collection.js";
import { clarkIndexDigest, fetchClarkCycleDiscovery, readClarkDiscovery } from "./state-ballot-clark-discovery.js";
import { fetchConnecticutCandidateCapture } from "./state-ballot-connecticut-collection.js";
import { connecticutIndexDigest, fetchConnecticutCycleDiscovery, readConnecticutDiscovery } from "./state-ballot-connecticut-discovery.js";
import {
	discoverStateBallotElectionCycles,
	getStateBallotCycleFamily,
	readStateBallotCycleCatalog,
	stateBallotCycleSources,
	writeStateBallotCycleCatalog
} from "./state-ballot-cycles.js";
import { readDakotaElectionIndex } from "./state-ballot-dakota.js";
import { dcDocumentDigest, fetchDcCandidateCapture, fetchDcCycleDiscovery, readDcDiscovery } from "./state-ballot-dc-collection.js";
import { fetchFranklinCandidateCapture, fetchFranklinCycleDiscovery, franklinDocumentDigest, readFranklinDiscovery } from "./state-ballot-franklin-collection.js";
import { fetchFultonCandidateCapture, fetchFultonCycleDiscovery } from "./state-ballot-fulton.js";
import { fetchIowaJohnsonCandidateCapture, fetchIowaJohnsonCycleDiscovery, readIowaJohnsonDiscovery } from "./state-ballot-iowa-johnson.js";
import { fetchIowaPolkCandidateCapture, fetchIowaPolkCycleDiscovery, iowaPolkDocumentDigest, readIowaPolkDiscovery } from "./state-ballot-iowa-polk.js";
import { fetchKansasCandidateCapture, fetchKansasCycleDiscovery } from "./state-ballot-kansas.js";
import { fetchKentuckyCandidateCapture, fetchKentuckyCycleDiscovery } from "./state-ballot-kentucky.js";
import { fetchMarylandCycleDiscovery } from "./state-ballot-maryland.js";
import { fetchMichiganCycleDiscovery, michiganCandidateCapture } from "./state-ballot-michigan.js";
import { fetchNorthCarolinaCycleDiscovery, northCarolinaCandidateCapture } from "./state-ballot-north-carolina.js";
import { fetchOregonCandidateCapture, fetchOregonCycleDiscovery } from "./state-ballot-oregon-collection.js";
import { createStateBallotRepository } from "./state-ballot-repository.js";
import {
	readSouthCarolinaElectionYears,
	southCarolinaElectionsUrl,
	southCarolinaScriptUrl,
	southCarolinaYearsUrl,
	validateSouthCarolinaElectionIndex
} from "./state-ballot-southern.js";
import { assertExternalStateDataDirectory } from "./state-ballot-storage.js";
import { fetchTexasCandidateCapture, fetchTexasCycleDiscovery } from "./state-ballot-texas.js";
import { fetchUtahCycleDiscovery } from "./state-ballot-utah.js";
import { fetchVermontCandidateCapture, fetchVermontCycleDiscovery } from "./state-ballot-vermont.js";
import { fetchVirginiaCandidateCapture } from "./state-ballot-virginia.js";
import { fetchWashoeCandidateCapture, fetchWashoeCycleDiscovery, readWashoeDiscovery } from "./state-ballot-washoe.js";

interface StateBallotCycleSyncOptions {
	familyId?: string;
	catalogPath: string;
	dataDirectory: string;
	enabledSourceIds?: string[];
	fetchDiscovery?: () => Promise<string>;
	fetchCandidates?: (source: StateBallotSource) => Promise<string>;
	now?: () => number;
}

export async function fetchStateBallotCycleDiscovery(request: typeof fetchRemoteSourceText = fetchRemoteSourceText, familyId = "wa-general-2026") {
	const family = getStateBallotCycleFamily(familyId);
	if (family.format === "dc-pdf") return fetchDcCycleDiscovery({ requestText: request });
	if (family.format === "franklin-pdf") return fetchFranklinCycleDiscovery({ requestText: request });
	if (family.format === "cassia-pdf") return fetchCassiaCycleDiscovery({ requestText: request });
	if (family.format === "iowa-polk-pdf") return fetchIowaPolkCycleDiscovery({ requestText: request });
	if (family.format === "iowa-johnson-html") return fetchIowaJohnsonCycleDiscovery({ requestText: request });
	if (family.format === "washoe-html") return fetchWashoeCycleDiscovery({ requestText: request });
	if (family.format === "clark-pdf") return fetchClarkCycleDiscovery({ requestText: request });
	if (family.format === "connecticut-pdf") return fetchConnecticutCycleDiscovery({ requestText: request });
	if (family.format === "oregon-pdf") return fetchOregonCycleDiscovery({ requestText: request });
	if (family.format === "texas-certified-pdf") return fetchTexasCycleDiscovery({ requestText: request });
	if (family.format === "vermont-xlsx") return fetchVermontCycleDiscovery({ requestText: request });
	if (family.format === "certified-pdf") return fetchCertifiedPdfCycleDiscovery(family.source.stateCode as "MO" | "NJ", { requestText: request });
	if (family.source.stateCode === "GA") return fetchFultonCycleDiscovery(request);
	if (family.format === "kansas-html") return fetchKansasCycleDiscovery(request);
	if (family.source.stateCode === "MI") return fetchMichiganCycleDiscovery(request);
	if (family.source.stateCode === "UT") return fetchUtahCycleDiscovery(request);
	if (family.source.stateCode === "KY") return fetchKentuckyCycleDiscovery(request);
	if (family.source.stateCode === "NC") return fetchNorthCarolinaCycleDiscovery(request);
	if (family.source.stateCode === "MD") return fetchMarylandCycleDiscovery(request);
	if (family.format === "south-carolina-html") {
		const options = { allowedHosts: [new URL(family.discoveryUrl).hostname], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 12000 };
		const page = await request(family.discoveryUrl, options);
		const script = await request(southCarolinaScriptUrl, options);
		validateSouthCarolinaElectionIndex(page, script);
		const years = await request(southCarolinaYearsUrl, options);
		const elections = [];
		for (const year of readSouthCarolinaElectionYears(years, family.source.electionDate.slice(0, 4))) {
			const url = southCarolinaElectionsUrl(year);
			elections.push({ url, body: await request(url, options) });
			if (Buffer.byteLength(JSON.stringify({ page, script, years, elections })) > options.maxBytes) throw new Error("The combined South Carolina discovery exceeds its bounds.");
		}
		return JSON.stringify({ page, script, years, elections });
	}
	if (["south-dakota-csv", "north-dakota-html"].includes(family.format)) {
		const options = { allowedHosts: [new URL(family.discoveryUrl).hostname], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 12000 };
		const page = await request(family.discoveryUrl, options);
		const entries = readDakotaElectionIndex(family.format === "south-dakota-csv" ? "SD" : "ND", page, family.source.electionDate.slice(0, 4));
		const calendars = [];
		for (const url of new Set(entries.map(entry => entry.calendarUrl))) {
			calendars.push({ url, body: await request(url, options) });
			if (Buffer.byteLength(JSON.stringify({ page, calendars })) > options.maxBytes) throw new Error("The combined Dakota discovery exceeds its bounds.");
		}
		return JSON.stringify({ page, calendars });
	}
	return request(family.discoveryUrl, { allowedHosts: [new URL(family.discoveryUrl).hostname], maxBytes: 2 * 1024 * 1024, maxRedirects: ["csv", "florida-local-tsv", "delaware-html"].includes(family.format) ? 0 : 1, timeoutMs: 12000 });
}

export async function syncStateBallotCycles(options: StateBallotCycleSyncOptions) {
	assertExternalStateDataDirectory(options.dataDirectory);
	const now = options.now ?? Date.now;
	const family = getStateBallotCycleFamily(options.familyId ?? "wa-general-2026");
	const previous = readStateBallotCycleCatalog(options.catalogPath, now());
	if (previous && previous.familyId !== family.source.id) throw new Error("The configured catalog belongs to a different election family.");
	const body = await (options.fetchDiscovery ?? (() => fetchStateBallotCycleDiscovery(undefined, family.source.id)))();
	const discovered = discoverStateBallotElectionCycles(body, family.source.id, now());
	if (family.format === "cassia-pdf" && previous?.elections.some(election => Date.parse(`${election.electionDate}T00:00:00Z`) + 2 * 86400000 > now() && election.cassiaDocuments?.length && !discovered.elections.find(item => item.electionDate === election.electionDate)?.cassiaDocuments?.length)) throw new Error("The accepted Cassia publications disappeared; retain them for review.");
	if (family.format === "dc-pdf" && previous?.elections.some(election => Date.parse(`${election.electionDate}T00:00:00Z`) + 2 * 86400000 > now() && election.dcDocuments?.length && !discovered.elections.find(item => item.electionDate === election.electionDate)?.dcDocuments?.length)) throw new Error("The accepted D.C. publications disappeared; retain them for review.");
	if (family.format === "franklin-pdf" && previous?.elections.some(election => Date.parse(`${election.electionDate}T00:00:00Z`) + 2 * 86400000 > now() && election.franklinDocuments?.length && !discovered.elections.find(item => item.electionDate === election.electionDate)?.franklinDocuments?.length)) throw new Error("The accepted Franklin County publications disappeared; retain them for review.");
	if (family.format === "iowa-polk-pdf" && previous?.elections.some(election => Date.parse(`${election.electionDate}T00:00:00Z`) + 2 * 86400000 > now() && election.polkDocuments?.length && !discovered.elections.find(item => item.electionDate === election.electionDate)?.polkDocuments?.length)) throw new Error("The accepted Polk County publications disappeared; retain them for review.");
	if (previous?.elections.some(election => Date.parse(`${election.electionDate}T00:00:00Z`) + 2 * 86400000 > now() && !discovered.elections.some(item => item.electionDate === election.electionDate && item.electionId === election.electionId && (!["CT", "VA", "GA", "MO", "NJ", "VT", "TX", "OR"].includes(family.source.stateCode) || JSON.stringify(item) === JSON.stringify(election)))))
		throw new Error("An unexpired official election disappeared or changed identity; retain the accepted catalog for review.");
	const catalog: StateBallotCycleCatalog = previous?.discovery.sha256 === discovered.discovery.sha256 ? previous : discovered;
	const catalogChanged = await writeStateBallotCycleCatalog(options.catalogPath, catalog, now());
	const original = family.source;
	const sources = [...(catalog.elections.some(election => election.electionDate === original.electionDate) ? [original] : []), ...stateBallotCycleSources(catalog, now())]
		.filter(source => !options.enabledSourceIds || options.enabledSourceIds.includes(source.id));
	let persistenceFailed = false;
	const fetchCandidates = options.fetchCandidates ?? (family.format === "dc-pdf" ? async (source: StateBallotSource) => fetchDcCandidateCapture(source, { discovery: body, now }) : family.format === "franklin-pdf" ? async (source: StateBallotSource) => fetchFranklinCandidateCapture(source, { discovery: body, now }) : family.format === "cassia-pdf" ? async (source: StateBallotSource) => fetchCassiaCandidateCapture(source, { discovery: body, now }) : family.format === "iowa-polk-pdf" ? async (source: StateBallotSource) => fetchIowaPolkCandidateCapture(source, { discovery: body, now }) : family.format === "iowa-johnson-html" ? async (source: StateBallotSource) => fetchIowaJohnsonCandidateCapture(source, { discovery: body, now }) : family.format === "washoe-html" ? async (source: StateBallotSource) => fetchWashoeCandidateCapture(source, { discovery: body, now }) : family.format === "clark-pdf" ? async (source: StateBallotSource) => fetchClarkCandidateCapture(source, { discovery: body }) : family.format === "connecticut-pdf" ? async (source: StateBallotSource) => fetchConnecticutCandidateCapture(source, { discovery: body }) : family.format === "oregon-pdf" ? async (source: StateBallotSource) => fetchOregonCandidateCapture(source, { discovery: body }) : family.format === "texas-certified-pdf" ? async (source: StateBallotSource) => fetchTexasCandidateCapture(source, body) : family.format === "vermont-xlsx" ? async (source: StateBallotSource) => fetchVermontCandidateCapture(source, body) : family.format === "certified-pdf" ? async (source: StateBallotSource) => fetchCertifiedPdfCapture(source, body) : family.source.stateCode === "GA" ? async (source: StateBallotSource) => fetchFultonCandidateCapture(source, { discovery: body }) : family.source.stateCode === "VA" ? async (source: StateBallotSource) => fetchVirginiaCandidateCapture(source, fetchRemoteSourceText, body) : family.format === "kansas-html" ? async (source: StateBallotSource) => fetchKansasCandidateCapture(source, fetchRemoteSourceText, body) : undefined);
	const repository = createStateBallotRepository({ collectionIndexSha256: family.format === "dc-pdf" ? Object.fromEntries(sources.map(source => [source.id, dcDocumentDigest(readDcDiscovery(body, now()).elections.find(election => election.electionDate === source.electionDate)!.dcDocuments)])) : family.format === "franklin-pdf" ? Object.fromEntries(sources.map(source => [source.id, franklinDocumentDigest(readFranklinDiscovery(body, now()).elections.find(election => election.electionDate === source.electionDate)!.franklinDocuments)])) : family.format === "cassia-pdf" ? Object.fromEntries(sources.map(source => [source.id, cassiaDocumentDigest(readCassiaDiscovery(body, now()).elections.find(election => election.electionDate === source.electionDate)!.cassiaDocuments)])) : family.format === "iowa-polk-pdf" ? Object.fromEntries(sources.map(source => [source.id, iowaPolkDocumentDigest(readIowaPolkDiscovery(body, now()).elections.find(election => election.electionDate === source.electionDate)!.polkDocuments)])) : family.format === "iowa-johnson-html" ? Object.fromEntries(sources.map(source => [source.id, readIowaJohnsonDiscovery(body, now()).pages.find(page => page.url === source.pageUrl)!.sha256])) : family.format === "washoe-html" ? Object.fromEntries(sources.map(source => [source.id, readWashoeDiscovery(body, now()).page.sha256])) : family.format === "clark-pdf" ? Object.fromEntries(sources.map(source => [source.id, clarkIndexDigest(readClarkDiscovery(body).documents)])) : family.format === "connecticut-pdf" ? Object.fromEntries(sources.map(source => [source.id, connecticutIndexDigest(readConnecticutDiscovery(body).find(item => item.election.electionDate === source.electionDate)!.documents)])) : undefined, refreshReviewedLegacy: true, sources, dataDirectory: options.dataDirectory, now, fetchText: fetchCandidates ?? (family.source.stateCode === "MI" ? async source => michiganCandidateCapture(source, body) : family.source.stateCode === "NC" ? async source => northCarolinaCandidateCapture(source, body) : family.source.stateCode === "KY" ? async source => fetchKentuckyCandidateCapture(source, fetchRemoteSourceText, body) : undefined), onPersistenceError: () => {
		persistenceFailed = true;
	} });
	const results: { sourceId: string; electionDate: string; status: "available" | "awaiting-records" | "unavailable" | "persistence-failed" | "expired"; records: number; retrievedAt: string | null; imported: boolean }[] = [];
	for (const source of sources) {
		const expired = Date.parse(`${source.electionDate}T00:00:00Z`) + 2 * 86400000 <= now();
		persistenceFailed = false;
		const snapshot = expired ? null : await repository.getSnapshot(source.stateCode, source.id);
		results.push({ sourceId: source.id, electionDate: source.electionDate, status: expired ? "expired" : persistenceFailed ? "persistence-failed" : snapshot ? "available" : repository.isAwaitingRecords!(source.id) ? "awaiting-records" : "unavailable", records: snapshot?.records.length ?? 0, retrievedAt: snapshot?.retrievedAt ?? null, imported: false });
	}
	const observations = await repository.inspectSources!();
	for (const result of results) {
		const observation = observations.find(source => source.id === result.sourceId);
		result.imported = Boolean(observation?.lastImportAt);
		if (observation?.failure && result.status !== "expired" && result.status !== "persistence-failed") result.status = "unavailable";
	}
	return { familyId: catalog.familyId, catalogChanged, discovery: catalog.discovery, checkedAt: new Date(now()).toISOString(), results };
}

export async function syncStateBallotCycleFamilies(options: StateBallotCycleSyncOptions[]) {
	const results = [];
	for (const configuration of options) {
		try {
			results.push({ status: "completed" as const, ...await syncStateBallotCycles(configuration) });
		}
		catch (error) {
			results.push({ status: "failed" as const, familyId: configuration.familyId ?? "wa-general-2026", error: error instanceof Error ? error.message : "Election-cycle synchronization failed." });
		}
	}
	return results;
}
