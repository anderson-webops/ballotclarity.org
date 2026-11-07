import type { JohnsonBallotEvidence, JohnsonBallotResource } from "../../src/johnson-ballot-publications.js";
import type { StateBallotSource } from "../../src/state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { johnsonBallotFields, johnsonBallotHash, johnsonBallotMapUrl, johnsonQueryUrl } from "../../src/johnson-ballot-publications.js";
import { iowaJohnsonDiscoveryUrl, iowaJohnsonPolicyReceipts } from "../../src/state-ballot-iowa-johnson.js";
import { configuredStateBallotSources } from "../../src/state-ballot-registry.js";

export function johnsonBallotFixture(date = "2026-11-03", candidateOnly = false) {
	const original = configuredStateBallotSources.find(source => source.id === "ia-johnson-2026")!;
	const source: StateBallotSource = { ...original, id: date === "2026-11-03" ? original.id : `ia-johnson-general-${date}`, electionDate: date, pageUrl: `https://johnsoncountyiowa.gov/november-${Number(date.slice(-2))}-${date.slice(0, 4)}-general-election` };
	source.url = source.pageUrl;
	source.documentUrls = [source.pageUrl];
	const clock = `${date.slice(0, 4)}-10-26T03:00:00.000Z`;
	const now = Date.parse(clock) + 86400000;
	let county = readFileSync(new URL("../fixtures/iowa-johnson-candidates.html", import.meta.url), "utf8").replaceAll("2026", date.slice(0, 4)).replaceAll("November 3", `November ${Number(date.slice(-2))}`);
	const countyIndex = readFileSync(new URL("../fixtures/iowa-johnson-index.html", import.meta.url), "utf8").replaceAll("2026", date.slice(0, 4)).replaceAll("November 3", `November ${Number(date.slice(-2))}`).replaceAll("november-3-", `november-${Number(date.slice(-2))}-`);
	if (candidateOnly) county = county.replace(/(<dt>Ballot Issues<\/dt>\s*<dd>)[\s\S]*?(<\/dd>)/u, "$1<p>Additional issues may be added.</p>$2");
	county = county.replace("<main>", `<main><a href="${johnsonBallotMapUrl}">Polling Place and Sample Ballot Lookup</a>`);
	const page = (url: string, body: string) => ({ url, body, sha256: johnsonBallotHash(body), retrievedAt: clock });
	const discovery = { schemaVersion: 1, type: "iowa-johnson-candidate-capture", policies: iowaJohnsonPolicyReceipts, index: page(iowaJohnsonDiscoveryUrl, countyIndex), pages: [page(source.pageUrl, county)] };
	const layer = "https://gis.johnsoncountyiowa.gov/arcgis/rest/services/ElectionPollingPlaces/MapServer/0";
	const table = layer.replace(/0$/u, "1");
	const sampleUrl = `https://johnsoncountyiowa.gov/sites/default/files/Elections/${date.slice(0, 7)}SampleBallotStyle01.pdf`;
	const raw = `Official Ballot\n${date.slice(0, 4)} General Election\nNovember ${Number(date.slice(-2))}, ${date.slice(0, 4)}\nCounty of Johnson, State of Iowa\nBallot Style 1\nSynthetic candidate\fJudicial Ballot\nSynthetic Judge\nYES\nNO\n${candidateOnly ? "" : "Public Measures\n1\nShall the following amendment to the Constitution be adopted?\nSummary: Synthetic amendment summary.\nFull Text: Synthetic amendment text.\nYES\nNO\nLY\nShall the following public measure be adopted?\nShall the County of Johnson, State of Iowa, issue bonds for a synthetic facility?\nYES\nNO\nLZ\nShall the following public measure be adopted?\nShall the City of Hills, in Johnson County, State of Iowa, issue synthetic bonds?\nYES\nNO\nMA\nShall the following public measure be adopted?\nShall the Board of Directors of the Lone Tree Community School District in the Counties of Johnson and Louisa issue synthetic bonds?\nYES\nNO\nVF\nShall the following public measure be adopted?\nShall the Board of Directors of the Mid-Prairie Community School District in the Counties of Washington and Johnson issue synthetic bonds?\nYES\nNO\nNC\nShall the following public measure be adopted?\nShall Kirkwood Community College (Merged Area X) in the Counties of Johnson and Linn issue synthetic bonds?\nYES\nNO\n"}\f`;
	const bytes = Buffer.from("%PDF-synthetic-johnson-fixture");
	const attributes = Object.fromEntries(johnsonBallotFields.map(field => [field, field === "OBJECTID" ? 1 : field === "SampleBallotURL" ? sampleUrl : null]));
	const resources: JohnsonBallotResource[] = [
		{ ...page("https://johnsoncountyiowa.gov/robots.txt", readFileSync(new URL("../fixtures/iowa-johnson-robots.txt", import.meta.url), "utf8")), status: 200 },
		{ ...page("https://gis.johnsoncountyiowa.gov/robots.txt", ""), status: 404 },
		{ ...page(johnsonBallotMapUrl, "<html><head><base href=\"./cdn/11/\"></head><body><div id=\"app\"></div></body></html>"), status: 200 },
		{ ...page(`${johnsonBallotMapUrl}cdn/11/config.json`, JSON.stringify({ dataSources: { polling: { sourceLabel: "Polling Places", url: layer } } })), status: 200 },
		{ ...page(`${layer}?f=pjson`, JSON.stringify({ name: "Election Polling Place", description: "", copyrightText: "", capabilities: "Map,Query,Data", relationships: [{ name: "Precincts_All", relatedTableId: 1 }] })), status: 200 },
		{ ...page(`${table}?f=pjson`, JSON.stringify({ name: "Election Precinct", description: "", copyrightText: "", capabilities: "Map,Query,Data", fields: johnsonBallotFields.map(name => ({ name, type: name === "OBJECTID" ? "esriFieldTypeOID" : "esriFieldTypeString" })) })), status: 200 },
		{ ...page(johnsonQueryUrl(table, true), JSON.stringify({ objectIdFieldName: "OBJECTID", objectIds: [1] })), status: 200 },
		{ ...page(johnsonQueryUrl(table, false), JSON.stringify({ features: [{ attributes }] })), status: 200 },
	];
	const ballots: JohnsonBallotEvidence = { schemaVersion: 1, resources, documents: [{ url: sampleUrl, sha256: johnsonBallotHash(bytes), retrievedAt: clock, raw, layout: raw }] };
	const body = () => JSON.stringify({ schemaVersion: 2, type: "iowa-johnson-candidate-capture", discovery, ballots });
	return { source, now, clock, discovery, ballots, bytes, raw, sampleUrl, body };
}
