import type { ElectionReferenceSource } from "./election-reference-sources.js";
import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import process from "node:process";
import { electionReferenceSources } from "./election-reference-sources.js";
import { parishSampleParishes, resolveParishSampleDocument } from "./louisiana-parish-samples.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

export interface ParishReferencePublication {
	parish: string;
	url: string;
	pages: number[];
}

export interface ParishReferenceCatalog {
	schemaVersion: 1;
	type: "louisiana-parish-reference-catalog";
	editions: { electionDate: string; publications: ParishReferencePublication[] }[];
}

export function parishReferenceSource(electionDate: string, publication: ParishReferencePublication): ElectionReferenceSource {
	if (!/^20\d{2}-\d{2}-\d{2}$/u.test(electionDate) || !Number.isFinite(Date.parse(electionDate)) || new Date(electionDate).toISOString().slice(0, 10) !== electionDate || !publication || Object.keys(publication).sort().join(",") !== "pages,parish,url" || !parishSampleParishes.includes(publication.parish) || typeof publication.url !== "string" || !publication.url.startsWith("https:") || resolveParishSampleDocument(publication.url, electionDate, undefined, undefined) !== publication.url || !Array.isArray(publication.pages) || !publication.pages.length || publication.pages.length > 50 || publication.pages.some((page, index) => !Number.isSafeInteger(page) || page < 1 || page > 50 || (index > 0 && page <= publication.pages[index - 1]!))) throw new Error("Parish reference publication requires a dated, reviewed document and ordered pages.");
	return {
		id: `la-parish-${publication.parish.toLowerCase().replaceAll(" ", "-")}-${electionDate}`,
		stateCode: "LA",
		electionDate,
		optional: true,
		candidateMatching: false,
		documents: publication.pages.map(page => ({ url: `${publication.url}#page=${page}`, title: `${publication.parish} Parish unofficial sample`, publisher: "Power Coalition for Equity and Justice", kind: "public-dataset" })),
	};
}

export function parseParishReferenceCatalog(value: unknown) {
	const catalog = value as ParishReferenceCatalog;
	if (!catalog || typeof catalog !== "object" || Array.isArray(catalog) || Object.keys(catalog).sort().join(",") !== "editions,schemaVersion,type" || catalog.schemaVersion !== 1 || catalog.type !== "louisiana-parish-reference-catalog" || !Array.isArray(catalog.editions) || !catalog.editions.length || catalog.editions.length > 25) throw new Error("Provide a bounded parish reference catalog.");
	const sources: ElectionReferenceSource[] = [];
	for (const edition of catalog.editions) {
		if (!edition || typeof edition !== "object" || Array.isArray(edition) || Object.keys(edition).sort().join(",") !== "electionDate,publications" || typeof edition.electionDate !== "string" || !Array.isArray(edition.publications) || !edition.publications.length || edition.publications.length > 64) throw new Error("Parish reference edition requires its reviewed publication inventory.");
		for (const publication of edition.publications) sources.push(parishReferenceSource(edition.electionDate, publication));
	}
	if (new Set(catalog.editions.map(edition => edition.electionDate)).size !== catalog.editions.length || new Set(sources.map(source => source.id)).size !== sources.length || sources.flatMap(source => source.documents).length > 512) throw new Error("Parish reference catalog identities or page inventory are inconsistent.");
	return sources;
}

export async function configuredElectionReferenceSources(catalogPath: string | null | undefined = process.env.LOUISIANA_PARISH_REFERENCE_CATALOG_PATH, stateCode?: string) {
	if (!catalogPath || (stateCode && stateCode.toUpperCase() !== "LA")) return electionReferenceSources;
	if (!isAbsolute(catalogPath)) throw new Error("Parish reference catalogs require an absolute external path.");
	assertExternalStateDataDirectory(await realpath(dirname(catalogPath)));
	const metadata = await lstat(catalogPath);
	if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) throw new Error("Parish reference catalogs must be owner-private regular files.");
	const sources = parseParishReferenceCatalog(JSON.parse((await readBoundedStateDataBytes(catalogPath, 1024 * 1024)).toString("utf8")));
	if (sources.some(source => electionReferenceSources.some(existing => existing.id === source.id))) throw new Error("Parish reference catalog conflicts with an existing source.");
	return [...electionReferenceSources, ...sources];
}
