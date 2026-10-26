import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import {
	stateHtmlAttribute as attribute,
	stateHtmlDescendants as descendants,
	parseStateHtml,
	stateHtmlText
} from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

interface Word {
	value: string;
	left: number;
	right: number;
	top: number;
	height: number;
}
interface Row {
	top: number;
	words: Word[];
}
interface Person {
	name: string;
	party: string;
	withdrawal: string;
	printedStatus: string;
	page: number;
	top: number;
}
interface Contest {
	office: string;
	term: string;
	people: Person[];
}
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const joined = (words: Word[]) => clean(words.map(word => word.value).join(" "));
function normalized(value: string) {
	return clean(value)
		.toLocaleLowerCase("en-US")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}
const partyNames: Record<string, string> = {
	DEM: "Democrat",
	REP: "Republican",
	LIB: "Libertarian",
	UST: "U.S. Taxpayers",
	GRN: "Green",
	NLP: "Natural Law",
	WCP: "Working Class",
	NP: "Nonpartisan",
	NPA: "No Party Affiliation"
};
const statewide = new Set([
	"GOVERNOR AND LIEUTENANT GOVERNOR",
	"SECRETARY OF STATE",
	"ATTORNEY GENERAL",
	"UNITED STATES SENATOR",
	"MEMBER OF THE STATE BOARD OF EDUCATION",
	"REGENT OF THE UNIVERSITY OF MICHIGAN",
	"TRUSTEE OF MICHIGAN STATE UNIVERSITY",
	"GOVERNOR OF WAYNE STATE UNIVERSITY",
	"JUSTICE SUPREME COURT"
]);
const nameFont = (word: Word) => word.height > 7.3 && word.height < 7.6;

function lines(words: Word[]) {
	const rows: Row[] = [];
	for (const word of [...words].sort((first, second) => first.top - second.top || first.left - second.left)) {
		let row = rows.at(-1);
		if (!row || word.top - row.top >= 0.4) rows.push((row = { top: word.top, words: [] }));
		row.words.push(word);
	}
	for (const row of rows) row.words.sort((first, second) => first.left - second.left);
	return rows;
}
function pages(body: string, electionDate: string) {
	if (
		Buffer.byteLength(body) > 4 * 1024 * 1024
		|| /<!ENTITY|<!DOCTYPE[^>]*\[/iu.test(body)
		|| !body.trimEnd().endsWith("</html>")
		|| [...body.matchAll(/<page\b/gu)].length !== [...body.matchAll(/<\/page>/gu)].length
	) {
		throw new Error("The Tuscola listing is incomplete or exceeds its bounds.");
	}
	const parsed = descendants(parseStateHtml(body), node => node.nodeName === "page");
	if (!parsed.length || parsed.length > 100) throw new Error("The Tuscola listing page count requires review.");
	return parsed.map((page, index) => {
		if (Number(attribute(page, "width")) !== 792 || Number(attribute(page, "height")) !== 612)
			throw new Error("The Tuscola listing page dimensions changed.");
		const words = descendants(page, node => node.nodeName === "word").map((node) => {
			if (["xmin", "xmax", "ymin", "ymax"].some(key => !/^\d+(?:\.\d+)?$/u.test(attribute(node, key))))
				throw new Error("The Tuscola word coordinates require review.");
			return {
				value: stateHtmlText(node),
				left: Number(attribute(node, "xmin")),
				right: Number(attribute(node, "xmax")),
				top: Number(attribute(node, "ymin")),
				height: Number(attribute(node, "ymax")) - Number(attribute(node, "ymin"))
			};
		});
		if (
			!words.length
			|| words.length > 15000
			|| words.some(
				word =>
					word.left < 0
					|| word.right <= word.left
					|| word.right > 793
					|| word.top < 0
					|| word.top + word.height > 613
					|| word.height <= 0
					|| containsControlCharacters(word.value)
			)
		) {
			throw new Error("The Tuscola word geometry requires review.");
		}
		const rows = lines(words);
		const header = joined(
			rows.filter(row => row.top < 72).flatMap(row => row.words.filter(word => word.height < 20))
		);
		const printedDate = `${electionDate.slice(5, 7)}/${electionDate.slice(8)}/${electionDate.slice(0, 4)} - STATE GENERAL TUSCOLA (79)`;
		if (
			!header.includes("OFFICIAL CANDIDATE LIST")
			|| !header.endsWith(printedDate)
			|| joined(words.filter(word => word.left > 720 && word.top < 35)) !== `Page ${index + 1}`
		) {
			throw new Error("The Tuscola listing date, publisher or sequential pages changed.");
		}
		return rows;
	});
}
function person(value: string) {
	if (
		value.length < 3
		|| value.length > 250
		|| !/^[\p{L}\p{M} .,'’“”\u0022-]+(?: \(I\))?$/u.test(value)
		|| /\b(?:candidate|vacant|withdrawn|write-in)\b/iu.test(value)
	) {
		throw new Error("The Tuscola candidate name requires review.");
	}
	return value;
}
function status(entry: Person, electionDate: string) {
	if (!entry.withdrawal && !entry.printedStatus)
		return { status: "listed" as const, sourceStatus: "Official candidate list" };
	const match = /^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/u.exec(entry.withdrawal);
	if (match) {
		const date = `${match[3]}-${match[1]!.padStart(2, "0")}-${match[2]!.padStart(2, "0")}`;
		if (
			!Number.isFinite(Date.parse(date))
			|| new Date(date).toISOString().slice(0, 10) !== date
			|| date > electionDate
			|| (entry.printedStatus && !/^withdrawn$/iu.test(entry.printedStatus))
		) {
			throw new Error("The Tuscola withdrawal fields require review.");
		}
		return {
			status: "withdrawn" as const,
			sourceStatus: `Withdrawal date: ${entry.withdrawal}${entry.printedStatus ? `; ${entry.printedStatus}` : ""}`
		};
	}
	if (entry.withdrawal || !/^(?:withdrawn|disqualified|inactive)$/iu.test(entry.printedStatus))
		throw new Error("The Tuscola candidate status requires review.");
	return {
		status: entry.printedStatus.toLowerCase() as "withdrawn" | "disqualified" | "inactive",
		sourceStatus: entry.printedStatus
	};
}
function geography(office: string) {
	const district
		= /\b(\d+)(?:ST|ND|RD|TH) DISTRICT\b/u.exec(office)?.[1] ?? /\((\d+[A-Z]?) DISTRICT\)/u.exec(office)?.[1] ?? "";
	const scope = statewide.has(office)
		? "statewide"
		: /^REPRESENTATIVE IN CONGRESS \(\d+(?:ST|ND|RD|TH) DISTRICT\)$/u.test(office)
			? "congressional"
			: /^ST SENATOR \(\d+(?:ST|ND|RD|TH) DISTRICT\)$/u.test(office)
				? "state-senate"
				: /^REPRESENTATIVE \(\d+(?:ST|ND|RD|TH) DISTRICT\)$/u.test(office)
					? "state-house"
					: "local";
	if (
		scope === "local"
		&& office !== "ROAD COMMISSIONER"
		&& !/^(?:COUNTY COMM|CLERK|TREASURER|TRUSTEE|JUDGE CT APPEALS|JUDGE DISTRICT CT|MAYOR|COUNCIL MEMBER|VIL PRESIDENT|VIL TRUSTEE|SCH BRD|BOARD MEMBER|LSD BRD MEMBER|SCHOOL BOARD MEMBER|DIST LIB BRD MEMBER) \([A-Z0-9 .,'&/\-]+\)(?: - INCUMBENT POSITION)?$/u.test(
			office
		)
	) {
		throw new Error("The Tuscola office scope requires review.");
	}
	const area = /\(([^)]+)\)/u.exec(office)?.[1] ?? "";
	return {
		district: scope === "statewide" ? "" : district,
		scope,
		jurisdiction:
			scope !== "local"
				? ""
				: office.startsWith("COUNTY COMM") || office === "ROAD COMMISSIONER"
					? "Tuscola County"
					: area,
		area
	} as const;
}

export function readTuscolaCandidateDocuments(source: StateBallotSource, listing: string, ballot: string) {
	if (
		source.stateCode !== "MI"
		|| !/^20\d{2}-11-0[2-8]$/u.test(source.electionDate)
		|| new Date(`${source.electionDate}T00:00:00Z`).getUTCDay() !== 2
	) {
		throw new Error("The Tuscola general-election source requires review.");
	}
	const wordPages = pages(listing, source.electionDate);
	const contests: Contest[] = [];
	const printedCounts: number[] = [];
	let current: Contest | undefined;
	let tableOpen = false;
	let proposals = false;
	for (const [pageIndex, rows] of wordPages.entries()) {
		let counted = 0;
		for (const row of rows.filter(row => row.top >= 72)) {
			if (joined(row.words) === "PROPOSAL" && row.words[0]!.left < 45) {
				proposals = true;
				tableOpen = false;
				continue;
			}
			if (joined(row.words) === "No candidates on ballot") {
				if (!tableOpen || current?.people.length || proposals)
					throw new Error("The Tuscola empty-office marker requires review.");
				tableOpen = false;
				continue;
			}
			const headings = row.words.filter(word => Math.abs(word.height - 8.9991) < 0.03);
			if (headings.length && headings[0]!.left < 45) {
				const title = joined(headings);
				if (title === "PROPOSAL") {
					proposals = true;
					tableOpen = false;
					continue;
				}
				if (proposals) {
					if (!title.endsWith("PROPOSAL"))
						throw new Error("The Tuscola proposal section contains an unfamiliar heading.");
					continue;
				}
				if (current && !current.term && !tableOpen) current.office += ` ${title}`;
				else contests.push((current = { office: title, term: "", people: [] }));
				tableOpen = false;
				continue;
			}
			const left = joined(row.words.filter(word => word.left < 330));
			if (row.words[0]!.left < 45 && /^(?:\d+ Year Term|Partial Term|Unexpired Term)/u.test(left)) {
				if (
					!current
					|| current.term
					|| proposals
					|| !/^(?:[1-9]\d? Year Term|(?:Partial|Unexpired) Term Ending \d{2}\/\d{2}\/20\d{2}) - Vote for not more than -?\d{1,2}$/u.test(
						left
					)
				) {
					throw new Error("The Tuscola office term requires review.");
				}
				current.term = left;
				continue;
			}
			if (
				row.words.some(
					word => word.value === "CANDIDATE" && word.left > 140 && word.left < 145 && word.height < 7
				)
			) {
				if (
					!current?.term
					|| proposals
					|| !row.words.some(word => word.value === "PARTY" && word.left > 35 && word.left < 45)
					|| !row.words.some(word => word.value === "STATUS" && word.left > 680 && word.left < 700)
				) {
					throw new Error("The Tuscola candidate columns changed.");
				}
				tableOpen = true;
				continue;
			}
			const party = joined(row.words.filter(word => word.left < 65 && nameFont(word)));
			const names = row.words.filter(word => word.left > 140 && word.left < 230 && nameFont(word));
			if (Object.hasOwn(partyNames, party)) counted++;
			if (proposals) continue;
			if (!tableOpen) {
				if (party || names.length) throw new Error("The Tuscola person appears outside a candidate table.");
				continue;
			}
			if (!names.length) {
				if (party) throw new Error("The Tuscola party row is missing a name.");
				continue;
			}
			if (names.some(word => word.right >= 230))
				throw new Error("The Tuscola name column overflows its boundary.");
			const name = joined(names);
			const withdrawal = joined(row.words.filter(word => word.left >= 65 && word.left < 130 && nameFont(word)));
			const printedStatus = joined(row.words.filter(word => word.left >= 685 && nameFont(word)));
			const previous = current!.people.at(-1);
			if (!party && previous?.page === pageIndex + 1 && row.top - previous.top < 11) {
				if (withdrawal || printedStatus)
					throw new Error("The Tuscola wrapped name has unexpected status fields.");
				previous.name += ` ${name}`;
				previous.top = row.top;
			}
			else {
				if (!Object.hasOwn(partyNames, party)) throw new Error("The Tuscola candidate party requires review.");
				current!.people.push({ name, party, withdrawal, printedStatus, page: pageIndex + 1, top: row.top });
			}
		}
		printedCounts.push(counted);
	}
	if (
		!proposals
		|| !contests.length
		|| contests.some(contest => !contest.term)
		|| printedCounts.some(
			(count, index) =>
				count !== contests.flatMap(contest => contest.people).filter(entry => entry.page === index + 1).length
		)
	) {
		throw new Error("The Tuscola complete party/name inventory or proposal boundary requires review.");
	}
	if (Buffer.byteLength(ballot) > 4 * 1024 * 1024 || containsControlCharacters(ballot.replace(/[\r\n\t\f]/gu, "")))
		throw new Error("The Tuscola sample text exceeds its bounds.");
	const ballotPages = ballot.split("\f").filter(page => page.trim());
	const sampleDate = normalized(
		`OFFICIAL BALLOT General Election Tuesday, November ${Number(source.electionDate.slice(8))}, ${source.electionDate.slice(0, 4)} Tuscola County, Michigan`
	);
	if (
		!ballotPages.length
		|| ballotPages.length > 200
		|| ballotPages.length % 2
		|| ballotPages.some(
			(page, index) =>
				!page.includes("VOTE BOTH FRONT AND BACK OF BALLOT")
				|| (index % 2 === 0 ? !normalized(page).includes(sampleDate) : page.includes("OFFICIAL BALLOT"))
		)
	) {
		throw new Error("The Tuscola sample election identity or paired page set requires review.");
	}
	const sampleNames = ` ${normalized(ballot)} `;
	for (const entry of contests.flatMap(contest => contest.people)) {
		if (!sampleNames.includes(` ${normalized(person(entry.name).replace(/ \(I\)$/u, ""))} `))
			throw new Error("A Tuscola listing name is not present in the complete sample.");
	}
	const first = ballotPages[0]!
		.split(/\r?\n/u)
		.map(line => clean(line))
		.filter(Boolean);
	const tickets: string[] = [];
	const records: StateCandidateRecord[] = [];
	const governor = contests.find(contest => contest.office === "GOVERNOR AND LIEUTENANT GOVERNOR");
	if (governor) {
		const begin = first.indexOf("Governor and");
		const end = first.indexOf("Secretary of State", begin);
		if (
			begin < 0
			|| first[begin + 1] !== "Lieutenant Governor"
			|| first[begin + 2] !== "Vote for not more than 1"
			|| end < 0
		) {
			throw new Error("The Tuscola joint-ticket sample block requires review.");
		}
		let members: string[] = [];
		for (const line of first.slice(begin + 3, end)) {
			if (Object.values(partyNames).includes(line)) {
				tickets.push(normalized(`${members.join(" ")} ${line}`));
				members = [];
			}
			else {
				members.push(line);
			}
		}
		if (
			members.length
			|| !governor.people.length
			|| governor.people.length % 2
			|| tickets.length !== governor.people.length / 2
		) {
			throw new Error("The Tuscola joint-ticket inventory disagrees with its listing.");
		}
	}
	for (const contest of contests) {
		const fields = geography(contest.office);
		if (
			contest.term.includes("than -")
			&& (contest.people.length
				|| source.electionDate !== "2026-11-03"
				|| contest.office !== "VIL TRUSTEE (VILLAGE OF AKRON)"
				|| contest.term !== "Partial Term Ending 12/01/2028 - Vote for not more than -1")
		) {
			throw new Error("The Tuscola negative vote limit requires review.");
		}
		for (let index = 0; index < contest.people.length; index += governor === contest ? 2 : 1) {
			const entry = contest.people[index]!;
			let name = person(entry.name);
			if (governor === contest) {
				const mate = contest.people[index + 1]!;
				if (
					entry.party !== mate.party
					|| entry.page !== mate.page
					|| entry.withdrawal !== mate.withdrawal
					|| entry.printedStatus !== mate.printedStatus
					|| !tickets.includes(normalized(`${entry.name} ${person(mate.name)} ${partyNames[entry.party]}`))
				) {
					throw new Error("The Tuscola joint-ticket members disagree with their sample.");
				}
				name += ` / ${mate.name}`;
			}
			const marker = / \(I\)$/u.test(name) ? "; (I)" : "";
			name = name.replace(/ \(I\)$/u, "");
			const ballotDesignation = contest.term + marker;
			const identity = [
				source.id,
				source.stateCode,
				source.electionDate,
				...[
					name,
					contest.office,
					entry.party,
					fields.district,
					fields.scope,
					fields.jurisdiction,
					ballotDesignation
				].map(value => value.toLocaleLowerCase("en-US"))
			];
			records.push({
				id: createHash("sha256").update(JSON.stringify(identity)).digest("hex").slice(0, 24),
				name,
				office: contest.office,
				party: entry.party,
				district: fields.district,
				scope: fields.scope,
				...(fields.jurisdiction ? { jurisdiction: fields.jurisdiction } : {}),
				ballotDesignation,
				...status(entry, source.electionDate),
				sourceDistrictLabel: contest.office,
				sourceAreaLabel: fields.area || "Tuscola County publication"
			});
		}
	}
	if (!records.length || records.length > 5000 || new Set(records.map(record => record.id)).size !== records.length)
		throw new Error("The Tuscola candidate identity set is empty or duplicated.");
	return {
		records,
		listingPages: wordPages.length,
		samplePages: ballotPages.length,
		printedNames: printedCounts.reduce((sum, count) => sum + count, 0),
		populatedContests: contests.filter(contest => contest.people.length).length,
		emptyContests: contests
			.filter(contest => !contest.people.length)
			.map(contest => ({ office: contest.office, term: contest.term })),
		tickets: tickets.length
	};
}
