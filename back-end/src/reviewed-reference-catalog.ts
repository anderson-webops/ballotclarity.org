import type { ElectionReferenceSource } from "./election-reference-sources.js";
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { normalizePublicHref } from "./public-href.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { containsControlCharacters } from "./text-validation.js";
import { usStates } from "./us-states.js";

const stateCodes: readonly string[] = usStates.map(([code]) => code);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, limit: number): value is string => typeof value === "string" && value.length > 0 && value.length <= limit && value.trim() === value && !containsControlCharacters(value);
const date = (value: unknown) => typeof value === "string" && /^20\d{2}-\d{2}-\d{2}$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const kinds = new Set([
	"official-biography",
	"public-dataset",
	"candidate-statement",
	"news-report"
]);

function reviewedDocument(value: unknown): value is ElectionReferenceSource["documents"][number] {
	return record(value) && Object.keys(value).every(key => [
		"url",
		"publisher",
		"title",
		"kind",
		"publishedDate",
		"isCampaignWebsite"
	].includes(key))
	&& text(value.url, 8192) && value.url.startsWith("https://") && normalizePublicHref(value.url) === value.url
	&& text(value.publisher, 250) && text(value.title, 500) && typeof value.kind === "string" && kinds.has(value.kind)
	&& (value.publishedDate === undefined || date(value.publishedDate))
	&& (value.isCampaignWebsite === undefined || (value.isCampaignWebsite === true && value.kind === "candidate-statement"));
}

export function parseReviewedReferenceCatalog(value: unknown, stateCode: string): ElectionReferenceSource[] {
	if (!stateCodes.includes(stateCode) || !record(value) || Object.keys(value).sort().join(",") !== "schemaVersion,sources,stateCode,type" || value.schemaVersion !== 1 || value.type !== "reviewed-election-references" || value.stateCode !== stateCode || !Array.isArray(value.sources) || value.sources.length > 64) throw new Error("Invalid reviewed reference catalog.");
	const sources: ElectionReferenceSource[] = [];
	const identifiers = new Set<string>();
	let documentCount = 0;
	for (const source of value.sources as unknown[]) {
		if (!record(source) || Object.keys(source).sort().join(",") !== "candidateMatching,documents,electionDate,id,optional,stateCode"
			|| typeof source.id !== "string" || !source.id.startsWith(`${stateCode.toLowerCase()}-`) || !/^[a-z0-9-]{3,101}$/u.test(source.id)
			|| source.id.startsWith("la-parish-") || identifiers.has(source.id) || source.stateCode !== stateCode || !date(source.electionDate)
			|| source.optional !== true || source.candidateMatching !== false || !Array.isArray(source.documents)
			|| !source.documents.length || source.documents.length > 32 || !source.documents.every(reviewedDocument)
			|| new Set(source.documents.map(document => document.url)).size !== source.documents.length) {
			throw new Error("Invalid reviewed reference source.");
		}
		identifiers.add(source.id);
		documentCount += source.documents.length;
		if (documentCount > 512) throw new Error("Reviewed reference document limit exceeded.");
		sources.push({
			id: source.id,
			stateCode,
			electionDate: String(source.electionDate),
			optional: true,
			candidateMatching: false,
			documents: source.documents
		});
	}
	return sources;
}

export async function addReviewedReferenceSources(existing: readonly ElectionReferenceSource[], directory: string | undefined, stateCode?: string) {
	if (!directory) return existing;
	if (!isAbsolute(directory)) throw new Error("Reviewed reference catalogs require an absolute directory.");
	const root = await realpath(directory);
	assertExternalStateDataDirectory(root);
	const metadata = await lstat(directory);
	if (!metadata.isDirectory() || (metadata.mode & 0o077) !== 0) throw new Error("Reviewed reference catalogs require an owner-private directory.");
	const additions: ElectionReferenceSource[] = [];
	for (const code of stateCode === undefined
		? stateCodes
		: [
				stateCode.toUpperCase()
			]) {
		if (!stateCodes.includes(code)) throw new Error("Unknown reviewed reference state.");
		const path = join(root, `${code}.json`);
		const file = await lstat(path).catch((error: NodeJS.ErrnoException) => {
			if (error.code === "ENOENT") return null;
			throw error;
		});
		if (!file) continue;
		if (!file.isFile() || (file.mode & 0o077) !== 0) throw new Error("Reviewed reference catalogs must be owner-private regular files.");
		const sources = parseReviewedReferenceCatalog(JSON.parse((await readBoundedStateDataBytes(path, 512 * 1024)).toString("utf8")), code);
		if (sources.some(source => existing.some(item => item.id === source.id))) throw new Error("Reviewed reference catalog conflicts with an existing source.");
		additions.push(...sources);
	}
	return [
		...existing,
		...additions
	];
}
