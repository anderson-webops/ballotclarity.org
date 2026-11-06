import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { everettAjaxUrl, everettHash, everettPolicyReceipts, everettTableRequest, readEverettLibrary } from "../../src/state-ballot-everett-collection.js";
import { everettAutomaticSource, everettIndexUrl } from "../../src/state-ballot-everett.js";
import { everettFixture } from "./everett-fixture.js";

const policies = JSON.parse(readFileSync(new URL("../fixtures/everett-policies.json", import.meta.url), "utf8")) as { robots: string; policyLinks: string[]; footers: string[] };

export function everettCollectionFixture(date = "2026-11-03", extraRows = 0) {
	const year = date.slice(0, 4);
	const epoch = Date.parse(`${year}-10-24T12:00:00.000Z`);
	const capturedAt = new Date(epoch).toISOString();
	const source = everettAutomaticSource(date);
	const fixtures = [everettFixture(date), everettFixture(date, "WD. 1 PCT. 3", "SECOND SUFFOLK DISTRICT"), everettFixture(date, "WDS. 3-6", "TWENTY-EIGHTH MIDDLESEX DISTRICT")];
	const catalog = Object.assign({}, ...fixtures.map(fixture => fixture.catalog));
	const urls = fixtures.map((_fixture, index) => `https://cityofeverett.com/wp-content/uploads/${year}/09/STATE-BALLOT-${index + 1}.pdf`);
	const columns = ["title", "date", "file_size", "link"].map(name => `<th data-data="${name}" data-name="${name}" data-searchable="${name === "link" ? "false" : "true"}" data-orderable="${["title", "date"].includes(name) ? "true" : "false"}"></th>`).join("");
	const indexBody = `<html><body>${policies.policyLinks.map(url => `<a href="${url}">License</a>`).join("")}<div id="ajax-content-wrap"><h1>Elections Department</h1><h2>Current Election Documents</h2><table id="dlp_0123456789abcdef_1" data-config='{"serverSide":true,"pageLength":5,"lengthMenu":[5,10,25,50,100]}'><thead><tr>${columns}</tr></thead></table><h2>Past Election Documents</h2></div><script id="document-library-pro-js-before">var posts_table_params = ${JSON.stringify({ ajax_url: everettAjaxUrl, ajax_action: "dlp_load_posts", ajax_nonce: "0123456789" })};\n//# sourceURL=document-library-pro-js-before\n</script></body></html>`;
	const rows = [...fixtures.map((_fixture, index) => ({ __attributes: { id: `post-row-${index + 1}`, class: "post-row" }, title: `Sample State Ballot Ward ${index + 1}`, date: `Sep 24, ${year} 8:12 am`, file_size: "1 MB", link: `<a href="${urls[index]}">Download</a>` })), ...Array.from({ length: extraRows }, (_value, index) => ({ __attributes: { id: `post-row-${index + 4}`, class: "post-row" }, title: `Polling locations ${index}`, date: `Sep 24, ${year} 8:12 am`, file_size: "1 MB", link: `<a href="https://cityofeverett.com/wp-content/uploads/${year}/09/NOTICE-${index}.pdf">Download</a>` }))];
	const bodyWithFooter = indexBody.replace("</body>", `${policies.footers.map(footer => `<footer>${footer.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</footer>`).join("")}</body>`);
	const library = readEverettLibrary(bodyWithFooter);
	const tables = Array.from({ length: Math.max(1, Math.ceil(rows.length / 100)) }, (_value, index) => {
		const start = index * 100;
		const draw = index + 1;
		const body = JSON.stringify({ draw, recordsTotal: rows.length, recordsFiltered: rows.length, data: rows.slice(start, start + 100) });
		return { url: everettAjaxUrl, body, sha256: everettHash(body), retrievedAt: capturedAt, start, draw, requestBodySha256: everettHash(everettTableRequest(library, start, draw)), successful2xx: true as const, jsonContentTypeValidated: true as const };
	});
	const pdfs = fixtures.map((_fixture, index) => Buffer.from(`%PDF-1.7 Synthetic public ballot ${index}`));
	const documents = fixtures.map((fixture, index) => ({ url: urls[index]!, sha256: everettHash(pdfs[index]!), retrievedAt: capturedAt, xml: fixture.xml, svg: fixture.svg }));
	const capture = { schemaVersion: 1, type: "everett-candidate-capture", policies: everettPolicyReceipts, index: { url: everettIndexUrl, body: bodyWithFooter, sha256: everettHash(bodyWithFooter), retrievedAt: capturedAt }, tables, documents };
	return { source, capture, epoch, capturedAt, fixtures, catalog, pdfs, robots: Buffer.from(policies.robots), urls, body: () => JSON.stringify(capture) };
}
