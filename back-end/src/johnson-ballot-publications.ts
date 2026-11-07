import type { JohnsonSampleText } from "./johnson-ballot-questions.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { johnsonSampleStyle } from "./johnson-ballot-questions.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

export const johnsonBallotMapUrl = "https://gis.johnsoncountyiowa.gov/pollingplaces/";
export const johnsonBallotFields = ["OBJECTID", "NAME", "COMBINED_REG_PRECINCT_NAME", "COMB_REG_PREC_ABBREV", "PRECINCT_SPLIT", "BallotStyle", "SchoolDistrict", "CityTwp", "HOUSE_DISTRICT", "SENATE_DISTRICT", "BOS_Districts", "KIRKWOOD_DIR_DISTRICT", "SampleBallotURL", "SampleBallotURL2", "SampleBallotURL3"] as const;
export interface JohnsonBallotResource { url: string; status: number; body: string; sha256: string; retrievedAt: string }
export interface JohnsonBallotEvidence { schemaVersion: 1; resources: JohnsonBallotResource[]; documents: JohnsonSampleText[] }
type Attributes = Record<typeof johnsonBallotFields[number], string | number | null>;
export const johnsonBallotHash = (body: string | Buffer) => createHash("sha256").update(body).digest("hex");
const exact = (value: unknown, fields: string): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === fields);
function requireValue(value: unknown, detail: string): asserts value {
	if (!value) throw new Error(`The Johnson County ballot publications require review: ${detail}.`);
}
export function offeredJohnsonMap(body: string) {
	const urls = descendants(parseStateHtml(body), node => node.nodeName === "a" && /polling place|sample ballot/iu.test(stateHtmlText(node))).map(node => new URL(attribute(node, "href"), "https://johnsoncountyiowa.gov").href).filter(url => url === johnsonBallotMapUrl);
	return urls.length ? johnsonBallotMapUrl : undefined;
}
export function johnsonAppConfigUrl(body: string) {
	requireValue(Buffer.byteLength(body) <= 2 * 1024 * 1024 && !/<(?:form|iframe)\b/iu.test(body), "public app shell");
	const document = parseStateHtml(body);
	const bases = descendants(document, node => node.nodeName === "base");
	requireValue(bases.length === 1 && /^\.\/cdn\/[1-9]\d{0,5}\/$/u.test(attribute(bases[0]!, "href")), "published app build base");
	requireValue(!descendants(document, node => node.nodeName === "a" && /privacy|copyright|licen[cs]e|terms|polic(?:y|ies)/iu.test(stateHtmlText(node) + attribute(node, "href"))).length, "changed app legal-link inventory");
	return new URL("config.json", new URL(attribute(bases[0]!, "href"), johnsonBallotMapUrl)).href;
}
function layerUrl(url: unknown): asserts url is string {
	requireValue(typeof url === "string" && /^https:\/\/gis\.johnsoncountyiowa\.gov\/arcgis\/rest\/services\/ElectionPollingPlaces\/MapServer\/\d{1,3}$/u.test(url), "same-host offered polling layer");
}
export function johnsonPollingLayer(body: string) {
	const config = JSON.parse(body);
	requireValue(config && typeof config === "object" && !Array.isArray(config) && config.dataSources && typeof config.dataSources === "object", "published data-source configuration");
	const found: string[] = [];
	let visited = 0;
	const visit = (value: unknown, depth: number) => {
		requireValue(++visited <= 30000 && depth <= 32, "bounded data-source tree");
		if (!value || typeof value !== "object") return;
		const node = value as Record<string, unknown>;
		if (node.sourceLabel === "Polling Places") {
			layerUrl(node.url);
			found.push(node.url);
		}
		for (const child of Object.values(node)) {
			if (child && typeof child === "object") visit(child, depth + 1);
		}
	};
	visit(config.dataSources, 0);
	requireValue(found.length === 1, "unique published polling-place layer");
	return found[0]!;
}
export function johnsonPrecinctTable(body: string, url: string) {
	layerUrl(url);
	const layer = JSON.parse(body);
	requireValue(layer.name === "Election Polling Place" && layer.description === "" && layer.copyrightText === "" && typeof layer.capabilities === "string" && layer.capabilities.split(",").includes("Query") && Array.isArray(layer.relationships), "polling-layer publication and terms");
	const relations = layer.relationships.filter((relation: { name?: string }) => relation.name === "Precincts_All");
	requireValue(relations.length === 1 && Number.isSafeInteger(relations[0].relatedTableId) && relations[0].relatedTableId >= 0 && relations[0].relatedTableId <= 999, "actual related precinct table");
	return url.replace(/\d+$/u, String(relations[0].relatedTableId));
}
export function validateJohnsonTable(body: string) {
	const table = JSON.parse(body);
	requireValue(table.name === "Election Precinct" && table.description === "" && table.copyrightText === "" && typeof table.capabilities === "string" && table.capabilities.split(",").includes("Query") && Array.isArray(table.fields), "precinct-table publication and terms");
	for (const field of johnsonBallotFields) requireValue(table.fields.filter((item: { name?: string; type?: string }) => item.name === field && (field === "OBJECTID" ? item.type === "esriFieldTypeOID" : ["esriFieldTypeString", "esriFieldTypeSmallInteger", "esriFieldTypeInteger"].includes(item.type ?? ""))).length === 1, "reviewed aggregate fields");
}
export function johnsonQueryUrl(table: string, ids: boolean) {
	layerUrl(table);
	const query = new URLSearchParams({ f: "pjson", where: "1=1", ...(ids ? { returnIdsOnly: "true" } : { outFields: johnsonBallotFields.join(","), returnGeometry: "false", orderByFields: "OBJECTID", resultOffset: "0", resultRecordCount: "500" }) });
	return `${table}/query?${query}`;
}
export function johnsonSampleInventory(source: StateBallotSource, idsBody: string, recordsBody: string) {
	const ids = JSON.parse(idsBody);
	const records = JSON.parse(recordsBody);
	requireValue(ids.objectIdFieldName === "OBJECTID" && Array.isArray(ids.objectIds) && ids.objectIds.length > 0 && ids.objectIds.length <= 500 && ids.objectIds.every((id: unknown) => Number.isSafeInteger(id) && Number(id) > 0) && new Set(ids.objectIds).size === ids.objectIds.length, "complete public object-ID inventory");
	requireValue(Array.isArray(records.features) && !records.exceededTransferLimit && records.features.length === ids.objectIds.length, "complete nontruncated precinct inventory");
	const attributes = records.features.map((feature: unknown): Attributes => {
		requireValue(exact(feature, "attributes") && exact(feature.attributes, [...johnsonBallotFields].sort().join(",")), "aggregate-only response fields");
		const row = feature.attributes as Attributes;
		requireValue(Object.values(row).every(value => value === null || (typeof value === "number" && Number.isSafeInteger(value)) || (typeof value === "string" && value.length <= 1000 && !containsControlCharacters(value.replace(/[\r\n\t]/gu, "")))), "bounded aggregate attribute values");
		return row;
	});
	requireValue(isDeepStrictEqual(attributes.map((row: Attributes) => row.OBJECTID).toSorted((first: number, second: number) => first - second), ids.objectIds.toSorted((first: number, second: number) => first - second)), "exact precinct object-ID agreement");
	const offered = attributes.flatMap((row: Attributes) => [row.SampleBallotURL, row.SampleBallotURL2, row.SampleBallotURL3].flatMap((value) => {
		if (value == null || value === "") return [];
		requireValue(typeof value === "string", "offered sample URL value");
		const url = value.replace(/^[\r\n\t ]+|[\r\n\t ]+$/gu, "");
		requireValue(/^https:\/\/johnsoncountyiowa\.gov\/sites\/default\/files\/Elections\/20\d{2}-\d{2}SampleBallotStyle\d{1,3}\.pdf$/u.test(url), "literal public sample link");
		if (!url.includes(`/Elections/${source.electionDate.slice(0, 7)}SampleBallotStyle`)) return [];
		johnsonSampleStyle(url, source.electionDate);
		return [url];
	}));
	const urls = [...new Set<string>(offered)].sort((first, second) => first.localeCompare(second, "en-US", { numeric: true }));
	requireValue(urls.length <= 500 && new Set(urls.map(url => johnsonSampleStyle(url, source.electionDate))).size === urls.length, "unique complete printed-style destinations");
	return { attributes: attributes as Attributes[], urls };
}
export function readJohnsonBallotEvidence(source: StateBallotSource, value: unknown, countyBody: string, now: number) {
	requireValue(exact(value, "documents,resources,schemaVersion") && value.schemaVersion === 1 && Array.isArray(value.resources) && value.resources.length === 8 && Array.isArray(value.documents) && value.documents.length > 0 && value.documents.length <= 500, "native capture contract");
	for (const resource of value.resources) requireValue(exact(resource, "body,retrievedAt,sha256,status,url") && typeof resource.url === "string" && typeof resource.body === "string" && Buffer.byteLength(resource.body) <= 2 * 1024 * 1024 && resource.sha256 === johnsonBallotHash(resource.body) && typeof resource.retrievedAt === "string" && Number.isFinite(Date.parse(resource.retrievedAt)) && new Date(resource.retrievedAt).toISOString() === resource.retrievedAt && Date.parse(resource.retrievedAt) <= now && (resource.status === 200 || (resource.url === "https://gis.johnsoncountyiowa.gov/robots.txt" && resource.status === 404 && resource.body === "")), "resource provenance and status");
	const evidence = value as unknown as JohnsonBallotEvidence;
	const resources = evidence.resources;
	requireValue(resources[0]!.url === "https://johnsoncountyiowa.gov/robots.txt" && resources[0]!.status === 200 && electionDocumentPolicyFingerprint(Buffer.from(resources[0]!.body), "robots", resources[0]!.url) === "fbb9e50dc760db7ccf06a498c56f78f170ae0e5cf51d576c0dd2b54831714ede", "county access policy");
	requireValue(resources[1]!.url === "https://gis.johnsoncountyiowa.gov/robots.txt" && resources[1]!.status === 404 && resources[1]!.body === "", "GIS policy absence receipt");
	requireValue(resources[2]!.url === offeredJohnsonMap(countyBody) && resources[3]!.url === johnsonAppConfigUrl(resources[2]!.body), "offered public app and published config");
	const layer = johnsonPollingLayer(resources[3]!.body);
	requireValue(resources[4]!.url === `${layer}?f=pjson`, "offered layer metadata");
	const table = johnsonPrecinctTable(resources[4]!.body, layer);
	requireValue(resources[5]!.url === `${table}?f=pjson`, "related table metadata");
	validateJohnsonTable(resources[5]!.body);
	requireValue(resources[6]!.url === johnsonQueryUrl(table, true) && resources[7]!.url === johnsonQueryUrl(table, false), "read-only bounded inventory queries");
	const inventory = johnsonSampleInventory(source, resources[6]!.body, resources[7]!.body);
	requireValue(isDeepStrictEqual(evidence.documents.map(document => document?.url), inventory.urls), "every current offered sample exactly once");
	const robots = electionDocumentRobotsPolicy(Buffer.from(resources[0]!.body));
	for (const document of evidence.documents) requireValue(exact(document, "layout,raw,retrievedAt,sha256,url") && /^[a-f\d]{64}$/u.test(document.sha256) && typeof document.raw === "string" && typeof document.layout === "string" && typeof document.retrievedAt === "string" && Number.isFinite(Date.parse(document.retrievedAt)) && new Date(document.retrievedAt).toISOString() === document.retrievedAt && Date.parse(document.retrievedAt) <= now && robots.allowed(document.url), "original sample provenance and access");
	return evidence;
}
export function johnsonDocumentDigest(documents: readonly { url: string; sha256: string }[]) {
	return johnsonBallotHash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 }))));
}
export function validateJohnsonStoredDocuments(source: StateBallotSource, data: Record<string, unknown>) {
	requireValue(Array.isArray(data.documents) && data.documents.length >= 1, "stored publication set");
	const documents = data.documents as { url: string; sha256: string; includedRecordCount: number }[];
	requireValue(documents[0]?.url === source.pageUrl, "candidate page identity");
	if (documents.length === 1) {
		requireValue(data.ballotQuestions === undefined && data.sourceSha256 === documents[0].sha256 && data.collectionIndexSha256 === documents[0].sha256, "legacy candidate-only provenance");
		return;
	}
	requireValue(documents.length >= 10 && documents.length <= 509 && data.ballotQuestions !== undefined && documents.slice(1).every(document => document.includedRecordCount === 0) && new Set(documents.map(document => document.url)).size === documents.length, "native publication set and counts");
	requireValue(documents[1]?.url === "https://johnsoncountyiowa.gov/robots.txt" && documents[2]?.url === "https://gis.johnsoncountyiowa.gov/robots.txt" && documents[3]?.url === johnsonBallotMapUrl && /^https:\/\/gis\.johnsoncountyiowa\.gov\/pollingplaces\/cdn\/[1-9]\d{0,5}\/config\.json$/u.test(documents[4]?.url ?? ""), "stored app/policy provenance");
	const layer = documents[5]!.url.replace(/\?f=pjson$/u, "");
	const table = documents[6]!.url.replace(/\?f=pjson$/u, "");
	layerUrl(layer);
	layerUrl(table);
	requireValue(documents[5]!.url === `${layer}?f=pjson` && documents[6]!.url === `${table}?f=pjson` && documents[7]!.url === johnsonQueryUrl(table, true) && documents[8]!.url === johnsonQueryUrl(table, false), "stored layer/table/query provenance");
	for (const document of documents.slice(9)) johnsonSampleStyle(document.url, source.electionDate);
	requireValue(data.sourceSha256 === johnsonDocumentDigest(documents) && data.collectionIndexSha256 === data.sourceSha256, "complete GIS and PDF content fingerprint");
}
