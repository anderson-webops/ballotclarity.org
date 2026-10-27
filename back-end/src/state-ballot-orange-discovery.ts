import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";

export const orangeOrigin = "https://ocvote.gov";
export const orangeDiscoveryUrl = `${orangeOrigin}/candidates/candidate-filing-log-printable-version`;
export const orangeRobotsSha256 = "8e8cb58d810473a52cce903be5ffb73d948eef981bbd101cffbf8dc2c02fcf4e";
export const orangePolicySha256 = "b4653bce8b580615da2dbccd5a996652bac7585c8ae29e77d2f68ff32911b3b0";
const scriptSha256 = "67868f37c46c20d5525825f551c8d5465bf3270376ded79dc4809cabc863a29f";
export const orangeHash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export function rejectOrange(): never {
	throw new Error("The Orange County managed candidate publication requires review.");
}
function document(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || body.includes("\uFFFD")) return rejectOrange();
	const dom = parseStateHtml(body);
	const pending = [{ node: dom, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		if (++visited > 20000 || depth > 64) return rejectOrange();
		for (const child of node.childNodes ?? []) pending.push({ node: child, depth: depth + 1 });
	}
	return dom;
}
export function orangeGeneralDate(year: string) {
	if (!/^20\d{2}$/u.test(year)) return rejectOrange();
	return `${year}-11-${String(2 + (8 - new Date(`${year}-11-01T00:00:00Z`).getUTCDay()) % 7).padStart(2, "0")}`;
}
export function orangeSource(electionDate: string): StateBallotSource {
	if (electionDate < "2026-11-03" || orangeGeneralDate(electionDate.slice(0, 4)) !== electionDate) return rejectOrange();
	return { stateCode: "CA", id: electionDate === "2026-11-03" ? "ca-orange-2026" : `ca-orange-general-${electionDate}`, label: "Orange County Registrar of Voters", electionDate, url: orangeDiscoveryUrl, pageUrl: orangeDiscoveryUrl, format: "orange-pdf", snapshotStorage: "external", countyName: "Orange County", defaultPriority: -20 };
}
export function validateOrangeSource(source: StateBallotSource) {
	const expected = orangeSource(source.electionDate);
	if (Object.keys(source).sort().join(",") !== Object.keys(expected).sort().join(",") || Object.entries(expected).some(([key, value]) => source[key as keyof StateBallotSource] !== value)) return rejectOrange();
}
export function validateOrangeDocumentUrl(value: string, electionDate: string) {
	if (orangeGeneralDate(electionDate.slice(0, 4)) !== electionDate || value !== `${orangeOrigin}/fileadmin/user_upload/data/candlog/GEN${electionDate.slice(0, 4)}/candlog.pdf`) return rejectOrange();
}
export function orangePolicyFingerprint(body: string) {
	const dom = document(body);
	const footers = descendants(dom, node => node.nodeName === "footer");
	if (footers.length !== 1) return rejectOrange();
	const text = (node: Parameters<typeof stateHtmlText>[0]) => stateHtmlText(node).replace(/\s+/gu, " ").trim();
	const links = (node: Parameters<typeof stateHtmlText>[0]) => descendants(node, child => child.nodeName === "a").map(child => [text(child), new URL(attribute(child, "href"), orangeOrigin).href]);
	const legalLinks = descendants(dom, node => node.nodeName === "a" && /privacy|terms|copyright|licen[cs]e|disclaimer|polic(?:y|ies)/iu.test(`${text(node)} ${attribute(node, "href")}`)).map(node => [text(node), new URL(attribute(node, "href"), orangeOrigin).href]);
	return orangeHash(JSON.stringify({ footerTexts: footers.map(text), footerLinks: footers.map(links), legalLinks }));
}
export function readOrangeCandidateIndex(body: string) {
	const dom = document(body);
	const selects = descendants(dom, node => node.nodeName === "select" && attribute(node, "id") === "select-vbm-app");
	const scripts = descendants(dom, node => node.nodeName === "script").map(node => (node.childNodes ?? []).map(child => child.value ?? "").join("")).filter(value => value.includes("$('#select-vbm-app')"));
	if (selects.length !== 1 || scripts.length !== 1) return rejectOrange();
	const script = scripts[0]!;
	const mappings = [...script.matchAll(/\burls\s*=\s*\{([\s\S]*?)\};/gu)];
	if (mappings.length !== 1 || orangeHash(script.replace(mappings[0]![0], "urls = {__offered_elections__};").replace(/\s+/gu, " ").trim()) !== scriptSha256) return rejectOrange();
	const pairs = [...mappings[0]![1]!.matchAll(/'([1-9]\d?)'\s*:\s*'(GEN20\d{2})'/gu)];
	const mapping = mappings[0]![1]!.replace(/\s+/gu, "").replace(/,$/u, "");
	if (mapping !== pairs.map(pair => `'${pair[1]}':'${pair[2]}'`).join(",") || pairs.length > 32 || new Set(pairs.map(pair => pair[1])).size !== pairs.length || selects[0]!.attrs?.some(item => ["disabled", "hidden"].includes(item.name))) return rejectOrange();
	const options = descendants(selects[0]!, node => node.nodeName === "option");
	if (!options.length || options.length !== pairs.length + 1 || attribute(options[0]!, "value") !== "0" || stateHtmlText(options[0]!).trim() !== "Please select an election") return rejectOrange();
	const elections = options.slice(1).map((option) => {
		if (option.attrs?.some(item => ["disabled", "hidden"].includes(item.name))) return rejectOrange();
		const label = /^(20\d{2}) General Election$/u.exec(stateHtmlText(option).trim());
		const mapping = pairs.find(pair => pair[1] === attribute(option, "value"));
		if (!label || !mapping || mapping[2] !== `GEN${label[1]}`) return rejectOrange();
		const electionDate = orangeGeneralDate(label[1]!);
		const pdfUrl = `${orangeOrigin}/fileadmin/user_upload/data/candlog/${mapping[2]}/candlog.pdf`;
		validateOrangeDocumentUrl(pdfUrl, electionDate);
		return { electionDate, pdfUrl };
	});
	if (new Set(elections.map(item => item.electionDate)).size !== elections.length) return rejectOrange();
	return elections;
}
