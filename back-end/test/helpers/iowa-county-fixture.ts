import type { IowaSampleCounty } from "../../src/state-ballot-iowa-county-native.js";
import { createHash } from "node:crypto";
import { readIowaCountySample } from "../../src/state-ballot-iowa-county-native.js";
import { inspectIowaSampleGeometry, verifyIowaSampleNative } from "../../src/state-ballot-iowa-county-proof.js";
import { iowaCountyDiscoveryUrls, iowaCountyOrigins, iowaCountyPolicyReceipts, iowaCountySource } from "../../src/state-ballot-iowa-county.js";
import { iowaCountyNativeFixture } from "./iowa-county-native-fixture.js";

export const iowaFixtureHash = (value: string) => createHash("sha256").update(value).digest("hex");
export function iowaCountyFixture(county: IowaSampleCounty = "Monona", date = "2026-11-03", pending = false) {
	const instant = `${date.slice(0, 4)}-10-26T12:00:00.000Z`;
	const now = Date.parse(instant) + 3600000;
	const origin = iowaCountyOrigins[county];
	const url = `${origin}/elections/${county === "Woodbury" ? "info/" : ""}${date.slice(0, 4)}_general_election_${date.replaceAll("-", "_")}/`;
	const source = iowaCountySource(county, date, url);
	const link = { url: `${origin}/files/sample_ballots/example_style_1.pdf`, styles: ["Example township style", "Second precinct alias"] };
	const page = (target: string, body: string) => ({ url: target, body, sha256: iowaFixtureHash(body), retrievedAt: instant });
	const anchor = `<a href="${url}">${date.slice(0, 4)} General Election</a>`;
	const navigation = county === "Monona" ? ["/auditor/upcoming_elections/", "/auditor/election_results/"] : ["/elections/past/"];
	const index = page(iowaCountyDiscoveryUrls[county], `<h1>${county === "Monona" ? "Elections &amp; Voting" : "Elections Upcoming Elections"}</h1>${navigation.map(target => `<a href="${target}">Election archive</a>`).join("")}`);
	const indexes = navigation.map((target, index) => page(`${origin}${target}`, `<h1>${county === "Woodbury" ? "Elections Past Elections" : index ? "Election Results" : "Upcoming Elections"}</h1>${index || county === "Woodbury" ? anchor : ""}`));
	const publication = page(url, `<h1>${county === "Woodbury" ? "Elections " : ""}${date.slice(0, 4)} General Election</h1><h3>November ${Number(date.slice(-2))}, ${date.slice(0, 4)}</h3>${pending ? "" : link.styles.map(style => `<a href="${link.url}">${style}</a>`).join("")}`);
	const discovery = { schemaVersion: 1, type: "iowa-county-discovery", county, policies: iowaCountyPolicyReceipts[county], index, indexes, pages: [publication] };
	const native = iowaCountyNativeFixture(county, date);
	const objects = JSON.stringify({ pages: [{ object: "1 0 R" }, { object: "2 0 R" }], qpdf: [{ jsonversion: 2 }, Object.fromEntries([1, 2].map(number => [`obj:${number} 0 R`, { value: { "/Type": "/Page", "/MediaBox": [0, 0, 612, 1008], "/CropBox": county === "Monona" ? [18.573, 66.596, 593.28, 974.929] : [0, 0, 612, 1008] } }]))] });
	const visible = native.bbox.replace("<doc>", "<pdf2xml><fontspec id=\"0\" size=\"10\" color=\"#000000\"/>").replace("</doc>", "</pdf2xml>").replace(/<word xMin="([\d.]+)" xMax="([\d.]+)" yMin="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/word>/gu, (_match, left: string, right: string, top: string, bottom: string, text: string) => `<text left="${left}" width="${Number(right) - Number(left)}" top="${top}" height="${Number(bottom) - Number(top)}" font="0">${text}</text>`);
	const geometry = inspectIowaSampleGeometry(objects, county);
	const proof = verifyIowaSampleNative(readIowaCountySample(native.bbox, native.layout, native.context), visible, geometry, iowaFixtureHash(objects), native.context);
	const document = { ...native.document, url: link.url, retrievedAt: instant, visible, geometry, objectsSha256: iowaFixtureHash(objects), proof };
	const capture = { schemaVersion: 1, type: "iowa-county-candidate-capture", discovery, documents: pending ? [] : [document] };
	return { county, source, link, instant, now, discovery, capture, native: { layout: native.layout, bbox: native.bbox, visible, objects } };
}
