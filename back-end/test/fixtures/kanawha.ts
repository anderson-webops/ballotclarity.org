import { Buffer } from "node:buffer";
import { kanawhaDiscoveryUrl, kanawhaHash, kanawhaOrigin, kanawhaPolicies, kanawhaSource } from "../../src/state-ballot-kanawha-discovery.js";

export const kanawhaRobots = "User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n\nSitemap: https://kanawha.us/sitemap.xml";
export const kanawhaFooter = `<a href="${kanawhaOrigin}/accessibility/">Accessibility</a><a href="/accessibility">Accessibility</a><a href="/notice-of-non-discrimination/">Notice of Non-Discrimination</a><a href="/privacy-policy">Privacy Policy</a><footer>Copyright © 2026 Kanawha County, West Virginia</footer>`;
export const kanawhaDocumentUrl = (year: string) => `${kanawhaOrigin}/wp-content/uploads/${year}/10/Zero-Test-${year}-General.pdf`;
export function kanawhaIndex(year = "2026", offered = true) {
	return `<html><head><title>Election Center - Kanawha County, West Virginia</title></head><body><article><section><h2>${year} General Election</h2>${offered ? `<a href="${kanawhaDocumentUrl(year)}">View Public Test Results</a>` : ""}</section></article>${kanawhaFooter}</body></html>`;
}
function escaped(value: string) {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;");
}
export function kanawhaFixture(year = "2026", empty = false, heading = "FOR U.S. SENATOR") {
	const day = year === "2026" ? "3" : "7";
	const rows = empty ? ["NO CANDIDATE(S) NOMINATED"] : ["REP ALEX EXAMPLE", "DEM BLAIR EXAMPLE"];
	const layout = ["Summary Results Report          UNOFFICIAL RESULTS", "General Election", `November ${day}, ${year}          Kanawha County, WV`, "TOTAL", "Statistics", "Election Day Precincts Reporting          0 of 183", "Absentee/ Early Precincts Reporting          0 of 183", "Registered Voters - Total          121,007", "Ballots Cast - Total          0", "Ballots Cast - Blank          0", "Voter Turnout - Total          0.00%", heading, "Vote For 1", "TOTAL VOTE %", ...rows.map(row => `${row}          0`), "Write-In Totals          0", "Total Votes Cast          0", "FOR MAGISTRATE DIV 6 UNEXP", "Vote For 1", "TOTAL VOTE %", `${empty ? "NO CANDIDATE(S) NOMINATED" : "CASEY EXAMPLE"}          0`, "Write-In Totals          0", "Total Votes Cast          0", "AMENDMENT NO. 1", "Vote For 1", "TOTAL VOTE %", "FOR          0", "AGAINST          0", "Total Votes Cast          0", `Election Summary - 10/14/${year} 09:49AM          Page 1 of 1`];
	const texts = layout.flatMap((line, lineIndex) => line.split(/\s{2,}/u).map((text, column) => ({ text, left: column ? 400 : 20, baseline: 760 - lineIndex * 14 })));
	const commands = `${["q", "BT", "36 756 Td", "ET", "Q", "2 J", ...texts.flatMap(field => ["BT", `1 0 0 1 ${field.left} ${field.baseline} Tm`, "/F1 8 Tf", "0 0 0 rg", `(${field.text.replace(/[()\\]/gu, value => `\\${value}`)})Tj`, "0 g", "ET"])].join("\n")}\n`;
	const words = texts.flatMap((field) => {
		let offset = 0;
		return field.text.split(" ").map((word) => {
			const left = field.left + offset;
			offset += (word.length + 1) * 4;
			const top = 792 - field.baseline - 8 * 0.718;
			return `<word xMin="${left}" yMin="${top}" xMax="${left + word.length * 4}" yMax="${top + 8 * 0.925}">${escaped(word)}</word>`;
		});
	}).join("");
	const objects = { pages: [{ object: "1 0 R" }], encrypt: { encrypted: false }, acroform: { needappearances: false, fields: [] }, attachments: {}, qpdf: [{ jsonversion: 2 }, {
		"obj:1 0 R": { value: { "/Type": "/Page", "/MediaBox": [0, 0, 612, 792], "/Resources": { "/Font": { "/F1": "2 0 R" } }, "/Contents": "3 0 R" } },
		"obj:2 0 R": { value: { "/BaseFont": "/Helvetica", "/Encoding": "/WinAnsiEncoding", "/Subtype": "/Type1", "/Type": "/Font" } },
		"obj:3 0 R": { stream: { dict: {}, data: Buffer.from(commands).toString("base64") } },
	}] };
	const evidence = { objects: JSON.stringify(objects), bbox: `<html><body><doc><page width="612.000000" height="792.000000">${words}</page></doc></body></html>`, text: `${layout.join("\n")}\n\f`, sha256: "a".repeat(64) };
	const now = Date.parse(`${year}-10-27T12:00:00.000Z`);
	const retrievedAt = new Date(now).toISOString();
	const capturedPage = (url: string, body: string) => ({ url, body, sha256: kanawhaHash(body), retrievedAt });
	const discovery = { schemaVersion: 1, type: "kanawha-candidate-discovery", robots: capturedPage(`${kanawhaOrigin}/robots.txt`, kanawhaRobots), home: capturedPage(`${kanawhaOrigin}/`, kanawhaIndex(year)), index: capturedPage(kanawhaDiscoveryUrl, kanawhaIndex(year)), policies: kanawhaPolicies.map(policy => ({ requestUrl: String(policy.requestUrl), url: String(policy.url), textSha256: String(policy.textSha256), sha256: "b".repeat(64), retrievedAt, ...(policy.requestUrl !== policy.url ? { redirectStatus: 301 as const } : {}) })), documents: [{ year, url: kanawhaDocumentUrl(year), status: 200, sha256: evidence.sha256, retrievedAt, evidence }] };
	const source = kanawhaSource(`${year}-11-${day.padStart(2, "0")}`);
	const capture = { schemaVersion: 1, type: "kanawha-candidate-capture", electionDate: source.electionDate, discovery };
	return { source, now, evidence, objects, commands, discovery, capture };
}
