import { Buffer } from "node:buffer";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { nycGeneralDate } from "./state-ballot-nyc.js";
import { containsControlCharacters } from "./text-validation.js";

export const nycCandidateDiscoveryUrl = "https://www.vote.nyc/page/list-candidates";
export interface NycCandidatePublication { electionDate: string; pageUrl: string; pdfUrl: string; rtfUrl: string }
function reject(): never {
	throw new Error("The NYC offered candidate publication requires review.");
}

export function readNycCandidateIndex(body: string): NycCandidatePublication[] {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || body.includes("\uFFFD") || containsControlCharacters(body.replace(/[\r\n\t]/gu, ""))) return reject();
	const main = descendants(parseStateHtml(body), node => attribute(node, "id") === "block-basic-content");
	if (main.length !== 1) return reject();
	const groups = descendants(main[0]!, node => attribute(node, "class").split(/\s+/u).includes("group-right"));
	if (!groups.length || groups.length > 30) return reject();
	const results: NycCandidatePublication[] = [];
	let linksRead = 0;
	for (const group of groups) {
		const headings = descendants(group, node => node.nodeName === "h2");
		if (headings.length !== 1) return reject();
		const heading = stateHtmlText(headings[0]!).replace(/\s+/gu, " ").trim();
		if (!heading.includes("General Election Contest List")) continue;
		const date = /^November ([2-8]), (20\d{2}) General Election Contest List$/u.exec(heading);
		if (!date) return reject();
		const electionDate = nycGeneralDate(`${date[2]}-11-0${date[1]}`);
		if (results.some(value => value.electionDate === electionDate)) return reject();
		const links = descendants(group, node => node.nodeName === "a");
		if (links.length !== 2) return reject();
		const offered = new Map<string, string>();
		for (const link of links) {
			const label = stateHtmlText(link).replace(/\s+/gu, " ").trim();
			const format = ["PDF", "DOC"].find(value => label === `November ${date[1]}, ${date[2]} General Contest List - (${value})`);
			const target = new URL(attribute(link, "href"), nycCandidateDiscoveryUrl);
			let path: string;
			try {
				path = decodeURIComponent(target.pathname);
			}
			catch {
				return reject();
			}
			if (!format || offered.has(format) || target.origin !== "https://www.vote.nyc" || target.username || target.password || target.search || target.hash || !path.startsWith(`/sites/default/files/pdf/candidates/${date[2]}/`) || path.split("/").some(part => part === ".." || part === ".") || containsControlCharacters(path) || path.includes("\\") || !path.endsWith(format === "PDF" ? ".pdf" : ".rtf")) return reject();
			offered.set(format, target.href);
			linksRead++;
		}
		results.push({ electionDate, pageUrl: nycCandidateDiscoveryUrl, pdfUrl: offered.get("PDF")!, rtfUrl: offered.get("DOC")! });
	}
	if (descendants(main[0]!, node => node.nodeName === "a" && /General Contest List/u.test(stateHtmlText(node))).length !== linksRead) return reject();
	return results.sort((first, second) => first.electionDate.localeCompare(second.electionDate));
}
