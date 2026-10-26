import type { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { eastGreenwichDiscoveryUrl, eastGreenwichPolicyReceipts } from "../../src/state-ballot-east-greenwich-collection.js";
import { eastGreenwichImages } from "../../src/state-ballot-east-greenwich-visual.js";
import { stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "../../src/state-ballot-html.js";
import { stateBallotSources } from "../../src/state-ballot-sources.js";
import { eastGreenwichFixture } from "./east-greenwich-fixture.js";

export const eastGreenwichFixtureTime = Date.parse("2026-10-26T12:00:00.000Z");
export const eastGreenwichFixtureHash = (body: string | Buffer) => createHash("sha256").update(body).digest("hex");
const footer = readFileSync(new URL("../fixtures/east-greenwich-footer.html", import.meta.url), "utf8");
const legacy = stateBallotSources.find(source => source.id === "ri-east-greenwich-2026")!;
export function eastGreenwichVisualFixture(text: string, pdfSha256: string, records = 9) {
	const pages = descendants(parseStateHtml(text), node => node.nodeName === "page");
	return { textSha256: eastGreenwichFixtureHash(text), pdfSha256, pages: pages.map((page, index) => {
		const words = descendants(page, node => node.nodeName === "word");
		return { svgSha256: eastGreenwichFixtureHash(text + index), wordCount: words.length, glyphCount: words.length * 2, choiceMarks: index ? words.filter(word => ["Approve", "Reject"].includes(stateHtmlText(word))).length : records + words.filter(word => stateHtmlText(word) === "Write-in").length, images: index ? [] : eastGreenwichImages.map(image => ({ ...image, sha256: String(image.sha256), bounds: image.bounds.map(Number) })) };
	}) };
}
export function eastGreenwichDiscoveryFixture(dates = ["2026-11-03"], count = 5, revision = "first") {
	const documents: { url: string; text: string; sha256: string; retrievedAt: string; visual: ReturnType<typeof eastGreenwichVisualFixture> }[] = [];
	const sections = dates.map((date) => {
		const year = Number(date.slice(0, 4));
		const day = Number(date.slice(8));
		const links = Array.from({ length: count }, (_, index) => {
			const precinct = String(901 + index).padStart(4, "0");
			const url = date === "2026-11-03" && legacy.documentUrls?.[index] ? legacy.documentUrls[index]! : `https://www.eastgreenwichri.gov/DocumentCenter/View/${year * 10 + 901 + index}/General-Election-Precinct-${precinct}-Sample-Ballot-PDF`;
			const text = eastGreenwichFixture(year, day, precinct, precinct === "0903" ? "24" : "30").replace(">Finley Sample<", precinct === "0903" ? ">Jordan Sample<" : ">Finley Sample<");
			const sha256 = eastGreenwichFixtureHash(`${date}:${precinct}:${revision}`);
			if (count >= 5) documents.push({ url, text, sha256, retrievedAt: new Date(eastGreenwichFixtureTime).toISOString(), visual: eastGreenwichVisualFixture(text, sha256) });
			return `<a href="${url}">General Election Precinct ${precinct} Sample Ballot (PDF)</a>`;
		}).join("");
		return `<div class="relatedDocumentsSection selfClear"><h3>Sample Ballots General Election November ${day}, ${year}</h3>${links}</div>`;
	}).join("");
	const body = `<html><body><nav><a href="/187/Marriage-Licenses">Marriage Licenses</a></nav>${sections}${footer}</body></html>`;
	return { schemaVersion: 1, type: "east-greenwich-discovery", policies: eastGreenwichPolicyReceipts, index: { url: eastGreenwichDiscoveryUrl, body, sha256: eastGreenwichFixtureHash(body), retrievedAt: new Date(eastGreenwichFixtureTime).toISOString() }, documents };
}
