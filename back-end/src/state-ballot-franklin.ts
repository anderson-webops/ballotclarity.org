import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { normalizePublicHref } from "./public-href.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

interface Word {
	text: string;
	left: number;
	right: number;
	top: number;
	bottom: number;
}
interface Line {
	top: number;
	words: Word[];
}
interface CandidateRow {
	name: string;
	party: string;
	office: string;
	term: string;
	termDate: string;
	writeIn: boolean;
	website: string;
}
type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const joined = (words: Word[]) => clean(words.map(word => word.text).join(" "));
const parties = ["Democratic", "Republican", "Libertarian", "N/A", "Other-party c", "Other-party", "\"nonparty\"", ""];

function pages(body: string, kind: "candidates" | "notice") {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024 || containsControlCharacters(body.replace(/[\n\r\t\f]/gu, "")))
		throw new Error("The Franklin County PDF text exceeds its bounds.");
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++visited > 100000 || item.depth > 64) throw new Error("The Franklin County PDF structure exceeds its bounds.");
		for (const child of item.node.childNodes ?? []) pending.push({ node: child, depth: item.depth + 1 });
	}
	const pageNodes = descendants(document, node => node.nodeName === "page");
	if (!pageNodes.length || pageNodes.length > (kind === "candidates" ? 12 : 50))
		throw new Error("The Franklin County PDF page count requires review.");
	let total = 0;
	return pageNodes.map((page) => {
		const width = Number(attribute(page, "width"));
		const height = Number(attribute(page, "height"));
		if (kind === "candidates" ? !((width === 792 && height === 1224) || (width === 1224 && height === 792)) : width !== 612 || height !== 792)
			throw new Error("The Franklin County PDF dimensions require review.");
		const words = descendants(page, node => node.nodeName === "word").map(node => ({ text: clean(stateHtmlText(node)), left: Number(attribute(node, "xmin")), right: Number(attribute(node, "xmax")), top: Number(attribute(node, "ymin")), bottom: Number(attribute(node, "ymax")) }));
		total += words.length;
		if (!words.length || total > 60000 || words.some(word => !word.text || word.text.length > 500 || containsControlCharacters(word.text) || [word.left, word.right, word.top, word.bottom].some(value => !Number.isFinite(value)) || word.left < 0 || word.top < 0 || word.right > (kind === "candidates" ? 1224 : 612) + 1 || word.bottom > 793 || word.right <= word.left || word.bottom <= word.top || word.bottom - word.top > 35))
			throw new Error("The Franklin County PDF word geometry requires review.");
		return words;
	});
}
function lines(words: Word[]) {
	const result: Line[] = [];
	for (const word of [...words].sort((first, second) => first.top - second.top || first.left - second.left)) {
		let line = result.at(-1);
		if (!line || word.top - line.top > 0.6) result.push(line = { top: word.top, words: [] });
		line.words.push(word);
	}
	for (const line of result) line.words.sort((first, second) => first.left - second.left);
	return result;
}
function name(value: string) {
	if (value.length < 4 || value.length > 180 || !value.includes(" ") || !/^[\p{L}\p{M} .,'’“”\u0022-]+$/u.test(value) || /\b(?:write-in|withdrawn|candidate|vacancy)\b/iu.test(value))
		throw new Error("The Franklin County candidate name requires review.");
	return value;
}
function date(value: string) {
	const match = /^(\d{1,2})[-/](\d{1,2})[-/](20\d{2})$/u.exec(value);
	if (!match) throw new Error("The Franklin County term date requires review.");
	const result = `${match[3]}-${match[1]!.padStart(2, "0")}-${match[2]!.padStart(2, "0")}`;
	if (new Date(`${result}T00:00:00Z`).toISOString().slice(0, 10) !== result)
		throw new Error("The Franklin County term date is invalid.");
	return result;
}
function readRows(body: string, electionDate: string) {
	const rows: CandidateRow[] = [];
	const revisions = new Set<string>();
	for (const [pageIndex, words] of pages(body, "candidates").entries()) {
		const grouped = lines(words);
		if (grouped.filter(line => joined(line.words.filter(word => word.left < 500)) === `${electionDate.slice(0, 4)} General Election Candidates`).length !== 1)
			throw new Error("The Franklin County candidate election heading requires review.");
		const revision = grouped.map(line => joined(line.words.filter(word => word.left >= 1000 && word.top < 50))).filter(Boolean);
		const revised = revision.length === 1 ? /^Revised (January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (20\d{2})$/u.exec(revision[0]!) : null;
		const month = revised ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(revised[1]!) : -1;
		const revisionDate = revised ? new Date(Date.UTC(Number(revised[3]), month, Number(revised[2]))) : null;
		if (!revised || revisionDate!.getUTCMonth() !== month || revisionDate!.getUTCDate() !== Number(revised[2]) || revised[3] !== electionDate.slice(0, 4) || revisionDate!.getTime() > Date.parse(`${electionDate}T23:59:59Z`))
			throw new Error("The Franklin County candidate revision requires review.");
		revisions.add(revision[0]!);
		const headers = grouped.filter(line => joined(line.words.filter(word => word.left < 529)) === "Name on Ballot Party Office");
		if ((!pageIndex && headers.length !== 1) || headers.length > 1 || (headers.length === 1 && (joined(headers[0]!.words.filter(word => word.left >= 529 && word.left < 711)) !== "Full Or Unexpired Term Term Commencing" || !["Write-In", "DWrite-In"].includes(joined(headers[0]!.words.filter(word => word.left >= 711 && word.left < 757))))))
			throw new Error("The Franklin County candidate columns require review.");
		let pendingName = "";
		let count = 0;
		for (const line of grouped.filter(line => line.top > (headers.length ? headers[0]!.top + 1 : 50))) {
			const column = (left: number, right: number) => joined(line.words.filter(word => word.left >= left && word.left < right));
			const candidate = column(50, 169);
			const party = column(169, 222);
			const office = column(222, 529);
			const term = column(529, 634);
			const termDate = column(634, 711);
			const writeIn = column(711, 757);
			const website = column(1024, 1210);
			if (!office) {
				if (!candidate || !/\band$/u.test(candidate) || pendingName || party || term || termDate || writeIn || website)
					throw new Error("The Franklin County wrapped candidate row requires review.");
				pendingName = candidate;
				continue;
			}
			if (!parties.includes(party) || !["Full Term", "Full Term Commencing", "Unexpired Term Ending"].includes(term) || !["", "Yes"].includes(writeIn) || Boolean(termDate) !== (term !== "Full Term"))
				throw new Error("The Franklin County candidate row requires review.");
			if (termDate) date(termDate);
			if (website && !/^www\.[a-z\d.-]+(?:\/[\w./-]*)?$/iu.test(website))
				throw new Error("The Franklin County website field requires review.");
			rows.push({ name: name(clean(`${pendingName} ${candidate}`)), party, office, term, termDate, writeIn: writeIn === "Yes", website });
			pendingName = "";
			count++;
		}
		if (pendingName || !count) throw new Error("The Franklin County candidate page is incomplete.");
	}
	if (revisions.size !== 1 || !rows.length || rows.length > 2000 || new Set(rows.map(row => row.name)).size !== rows.length)
		throw new Error("The Franklin County candidate set requires review.");
	return { rows, revision: [...revisions][0]! };
}
export interface FranklinNoticeAlias {
	electionDate: string;
	name: string;
	noticeName: string;
	office: string;
}
function noticeKey(value: string) {
	return value.normalize("NFKC").replace(/[’‘]/gu, "'").replace(/[“”]/gu, "\u0022");
}
function noticeFacts(body: string, electionDate: string, rows: CandidateRow[], aliases: FranklinNoticeAlias[]) {
	const wordPages = pages(body, "notice");
	const content = wordPages.map(words => joined(words)).join(" ");
	const dates = [...content.matchAll(/November ([2-8]), (20\d{2}) GENERAL ELECTION/gu)];
	if (dates.length !== 1 || `${dates[0]![2]}-11-0${dates[0]![1]}` !== electionDate || !content.includes("Issued by the Franklin County Board of Elections") || !content.includes("Election Notice for use with the Federal Write-In Absentee Ballot"))
		throw new Error("The Franklin County FWAB election identity requires review.");
	if (aliases.length > 20 || new Set(aliases.map(alias => noticeKey(alias.name))).size !== aliases.length || aliases.some(alias => alias.electionDate !== electionDate || alias.name === alias.noticeName || (rows.some(row => row.name === alias.name) && !rows.some(row => row.name === alias.name && row.office === alias.office))))
		throw new Error("The reviewed Franklin County spelling evidence does not match this election and office.");
	for (const alias of aliases) name(alias.noticeName);
	const entries: { name: string; party: string; writeIn: boolean; withdrawn: boolean; page: number }[] = [];
	let questionSection = false;
	let started = false;
	for (const [pageIndex, words] of wordPages.entries()) {
		const question = words.find(word => word.text === "Number" && word.left < 100);
		const end = questionSection ? 0 : question?.top ?? 792;
		if (question) questionSection = true;
		const header = words.find(word => word.text === "Candidate" && word.left < 100);
		if (!started && !header) continue;
		if (questionSection && header && end === 0) throw new Error("The Franklin County notice sections are out of order.");
		const top = started ? 0 : header!.top + 1;
		started = true;
		let current: { name: string; party: string; writeIn: boolean; withdrawn: boolean; page: number; lastTop: number } | undefined;
		const finish = () => {
			if (!current) return;
			const { lastTop: _lastTop, ...entry } = current;
			name(entry.name);
			entries.push(entry);
			current = undefined;
		};
		for (const line of lines(words.filter(word => word.left >= 40 && word.left < 179 && word.top >= top && word.top < end))) {
			const value = joined(line.words);
			const left = line.words[0]!.left;
			if (value === "Name of Candidate") {
				finish();
				continue;
			}
			if (/^\(write-in\)$|^withdrawn$/iu.test(value)) {
				if (!current || line.top < current.lastTop - 1 || line.top > current.lastTop + 18 || (/write-in/iu.test(value) ? current.writeIn : current.withdrawn)) throw new Error("The Franklin County notice status is detached or duplicated.");
				if (/write-in/iu.test(value)) current.writeIn = true;
				else current.withdrawn = true;
			}
			else if (left >= 42 && left < 43) {
				if (current && line.top - current.lastTop < 18) {
					current.name += ` ${value}`;
					current.lastTop = line.top;
				}
				else {
					finish();
					const party = joined(words.filter(word => word.left >= 307 && word.left < 365 && Math.abs(word.top - line.top) < 1).sort((first, second) => first.left - second.left));
					if (!parties.includes(party) && party !== "nonparty") throw new Error("The Franklin County notice party requires review.");
					current = { name: value, party, writeIn: false, withdrawn: false, page: pageIndex + 1, lastTop: line.top };
				}
			}
			else if (left >= 45 && left < 48 && current && line.top - current.lastTop < 18) {
				current.name += ` ${value}`;
				current.lastTop = line.top;
			}
			else if (/write.in|withdrawn/iu.test(value)) {
				throw new Error("The Franklin County notice status requires review.");
			}
		}
		finish();
	}
	if (!entries.length || entries.length > 2500 || new Set(entries.map(entry => noticeKey(entry.name))).size !== entries.length)
		throw new Error("The Franklin County notice inventory is empty, excessive or duplicated.");
	const printed = new Set(entries.map(entry => noticeKey(entry.name)));
	const applicable = aliases.filter(alias => rows.some(row => row.name === alias.name && row.office === alias.office) && !printed.has(noticeKey(alias.name)) && printed.has(noticeKey(alias.noticeName)));
	const identities = new Map(rows.map(row => [noticeKey(applicable.find(alias => alias.name === row.name)?.noticeName ?? row.name), row]));
	if (identities.size !== rows.length) throw new Error("The Franklin County notice names are ambiguous.");
	const facts = new Map<string, { party: string; writeIn: boolean }>();
	for (const entry of entries) {
		const row = identities.get(noticeKey(entry.name));
		if (entry.withdrawn) {
			if (row || entry.writeIn) throw new Error("The Franklin County candidate and withdrawal sources disagree.");
			continue;
		}
		if (!row || facts.has(row.name)) throw new Error("The Franklin County FWAB inventory cannot be reconciled to the candidate list.");
		facts.set(row.name, { party: entry.party, writeIn: entry.writeIn });
	}
	if (facts.size !== rows.length) throw new Error("The Franklin County candidate list and notice are incomplete.");
	return { facts, audit: { namedClaims: entries.length, activeClaims: facts.size, writeIns: entries.filter(entry => entry.writeIn).length, withdrawn: entries.filter(entry => entry.withdrawn), reviewedSpelling: applicable } };
}
function officeValues(row: CandidateRow): Omit<StateCandidateValues, "name" | "party"> {
	const office = row.office;
	const congressional = /^REPRESENTATIVE TO CONGRESS (\d+)(?:ST|ND|RD|TH) CONGRESSIONAL DISTRICT$/u.exec(office);
	const senate = /^STATE SENATOR OHIO SENATE DISTRICT (\d+)$/u.exec(office);
	const house = /^STATE REPRESENTATIVE OHIO HOUSE DISTRICT (\d+)$/u.exec(office);
	const statewide = ["GOVERNOR AND LIEUTENANT GOVERNOR", "ATTORNEY GENERAL", "AUDITOR OF STATE", "SECRETARY OF STATE", "TREASURER OF STATE", "JUSTICE OF THE SUPREME COURT", "U.S. SENATOR"].includes(office);
	const appeals = office === "JUDGE OF COURT OF APPEALS 10TH DISTRICT";
	const local = ["COUNTY AUDITOR", "COUNTY COMMISSIONER", "JUDGE OF THE COURT OF COMMON PLEAS (General Division)", "JUDGE OF THE COURT OF COMMON PLEAS (Domestic Relations Division)", "JUDGE OF THE COURT OF COMMON PLEAS-Probate"].includes(office);
	if (!congressional && !senate && !house && !statewide && !appeals && !local)
		throw new Error("The Franklin County office requires review.");
	const match = congressional ?? senate ?? house;
	return { office: office + (row.termDate ? ` (${row.term.toLowerCase()} ${row.termDate})` : ""), scope: congressional ? "congressional" : senate ? "state-senate" : house ? "state-house" : statewide ? "statewide" : "local", district: match ? String(Number(match[1])) : "", ...(match ? { sourceDistrictLabel: office } : {}), ...(!match && !statewide ? { jurisdiction: appeals ? "Ohio Court of Appeals, 10th District" : "Franklin County" } : {}) };
}
export function readFranklinCandidateDocuments(source: StateBallotSource, candidateWords: string, noticeWords: string, factory: Factory, reviewedAliases: FranklinNoticeAlias[] = []) {
	if (source.stateCode !== "OH" || !/^20\d{2}-11-0[2-8]$/u.test(source.electionDate) || new Date(`${source.electionDate}T00:00:00Z`).getUTCDay() !== 2)
		throw new Error("The Franklin County source election is invalid.");
	const parsed = readRows(candidateWords, source.electionDate);
	const { facts: evidence, audit } = noticeFacts(noticeWords, source.electionDate, parsed.rows, reviewedAliases);
	const records = parsed.rows.map((row) => {
		const supplemental = evidence.get(row.name);
		if (row.writeIn && !supplemental?.writeIn) throw new Error("The Franklin County write-in sources disagree.");
		if (supplemental?.party && !["", "Other-party c", "\"nonparty\""].includes(row.party) && row.party !== supplemental.party)
			throw new Error("The Franklin County party sources disagree.");
		if (row.party === "Other-party c" && supplemental?.party !== "Other-party")
			throw new Error("The clipped Franklin County party needs explicit FWAB evidence.");
		const writeIn = row.writeIn || Boolean(supplemental?.writeIn);
		const candidateUrl = row.website ? normalizePublicHref(`https://${row.website}`) : undefined;
		if (row.website && !candidateUrl) throw new Error("The Franklin County campaign link is unsafe.");
		const record = factory(source, { ...officeValues(row), name: row.name, party: row.party === "Other-party c" ? "Other-party" : row.party, status: writeIn ? "write-in" : "listed", ...(candidateUrl ? { candidateUrl } : {}) });
		if (!record) throw new Error("The Franklin County candidate normalization failed.");
		record.sourceStatus = supplemental?.writeIn && !row.writeIn ? "Registered write-in in county FWAB notice" : writeIn ? "Registered write-in" : "Published general-election candidate";
		return record;
	});
	if (new Set(records.map(record => record.id)).size !== records.length) throw new Error("The Franklin County candidate identities are duplicated.");
	return { records, revision: parsed.revision, noticeAudit: { ...audit, supplementedNames: parsed.rows.filter(row => row.party === "Other-party c" || (!row.writeIn && evidence.get(row.name)?.writeIn)).map(row => row.name) } };
}
