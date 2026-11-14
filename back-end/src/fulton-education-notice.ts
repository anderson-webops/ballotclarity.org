import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";

export const fultonEducationNoticeIndexUrl = "https://fultoncountyga.gov/inside-fulton-county/fulton-county-departments/registration-and-elections";
const months = "January February March April May June July August September October November December".split(" ");
const clean = (text: string) => text.replace(/\s+/gu, " ").trim();
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const amounts = "([1-9]\\d{0,2}(?:,\\d{3})*\\.\\d{2})";
function cents(text: string) {
	const [whole, fraction] = text.replaceAll(",", "").split(".");
	const value = Number(whole) * 100 + Number(fraction);
	if (!Number.isSafeInteger(value) || value <= 0) throw new Error("The education-notice amount exceeds its bounds.");
	return value;
}

function date(text: string) {
	const match = /^(January|February|March|April|May|June|July|August|September|October|November|December) ([1-9]\d?), (20\d{2})$/u.exec(text);
	if (!match) throw new Error("The education-notice date requires review.");
	const value = `${match[3]}-${String(months.indexOf(match[1]!) + 1).padStart(2, "0")}-${match[2]!.padStart(2, "0")}`;
	const instant = new Date(`${value}T00:00:00Z`);
	if (!Number.isFinite(instant.valueOf()) || instant.toISOString().slice(0, 10) !== value) throw new Error("The education-notice date is invalid.");
	return value;
}

export function discoverFultonEducationNotices(body: string) {
	if (!body.trim() || Buffer.byteLength(body) > 3 * 1024 * 1024 || body.includes("\uFFFD")) throw new Error("The education-notice index exceeds its bounds.");
	const tree = parseStateHtml(body);
	const pending = [{ node: tree, depth: 0 }];
	let count = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		if (++count > 60000 || depth > 64) throw new Error("The education-notice index structure exceeds its bounds.");
		for (const child of node.childNodes ?? []) pending.push({ node: child, depth: depth + 1 });
	}
	const mains = stateHtmlDescendants(tree, node => node.nodeName === "main");
	if (mains.length !== 1) throw new Error("The education-notice index main region changed.");
	const policies = stateHtmlDescendants(tree, node => node.nodeName === "a" && /privacy|terms of use|copyright|acceptable use|legal notice/iu.test(stateHtmlText(node))).map(node => new URL(stateHtmlAttribute(node, "href"), fultonEducationNoticeIndexUrl).href);
	if (policies.length !== 1 || policies[0] !== "https://fultoncountyga.gov/Privacy-Statement") throw new Error("The education-notice policy inventory changed.");
	const sections = stateHtmlDescendants(mains[0]!, node => stateHtmlAttribute(node, "class").split(/\s+/u).includes("accordion-container") && clean(stateHtmlText(node)).startsWith("Call for Election - ESPLOST "));
	if (!sections.length || sections.length > 10) throw new Error("The education-notice publication inventory requires review.");
	const notices = sections.map((section) => {
		const text = clean(stateHtmlText(section));
		const dates = [...text.matchAll(/NOTICE IS HEREBY GIVEN that on ([A-Za-z]+ [1-9]\d?, 20\d{2}), an election will be held in all of the election districts of Fulton County/gu)];
		const links = stateHtmlDescendants(section, node => node.nodeName === "a").map(node => new URL(stateHtmlAttribute(node, "href"), fultonEducationNoticeIndexUrl)).filter(url => url.pathname.endsWith(".pdf"));
		if (dates.length !== 1 || links.length !== 1) throw new Error("The education notice must have one explicit election and offered PDF.");
		const url = links[0]!;
		if (url.origin !== "https://fultoncountyga.gov" || url.href.length > 2048 || url.username || url.password || url.port || url.search || url.hash || !/^\/-\/media\/[\w/-]+\.pdf$/u.test(url.pathname)) throw new Error("The education notice must retain its exact public HTTPS address.");
		return { electionDate: date(dates[0]![1]!), url: url.href };
	});
	if (new Set(notices.map(notice => notice.electionDate)).size !== notices.length || new Set(notices.map(notice => notice.url)).size !== notices.length) throw new Error("The education-notice editions are ambiguous.");
	return notices.sort((first, second) => first.electionDate.localeCompare(second.electionDate));
}

export function readFultonEducationNotice(text: string, electionDate: string) {
	if (Buffer.byteLength(text) > 4 * 1024 * 1024 || /[^\P{Cc}\n\r\t\f]/u.test(text) || text.includes("\uFFFD")) throw new Error("The education-notice text requires review.");
	const pages = text.split("\f");
	if (!pages.at(-1)?.trim()) pages.pop();
	if (!pages.length || pages.length > 20) throw new Error("The education-notice page inventory exceeds its bounds.");
	const rows = pages.flatMap((page, index) => page.split(/\r?\n/u).map(value => ({ text: clean(value), page: index + 1 })).filter(row => row.text && row.text !== String(row.page)));
	const opening = clean(pages[0]!);
	const identity = /NOTICE IS HEREBY GIVEN that on ([A-Za-z]+ [1-9]\d?, 20\d{2}), an election will be held in all of the election districts of Fulton County/u.exec(opening);
	if (!opening.includes("NOTICE OF CALL FOR SPECIAL ELECTION TO THE QUALIFIED VOTERS OF FULTON COUNTY TO CONSIDER A SPECIAL ONE PERCENT SALES AND USE TAX") || !opening.includes("special one percent (1%)") || !identity || date(identity[1]!) !== electionDate) throw new Error("The education-notice identity or election date changed.");
	const fcs = rows.findIndex(row => /^For the Fulton County School District \(["“]FCS["”]\):$/u.test(row.text));
	const aps = rows.findIndex(row => row.text === "For the Atlanta Independent School System:");
	const debt = rows.findIndex(row => row.text.startsWith("Section 2. General Obligation Debt Authorized for Atlanta Independent School System."));
	const form = rows.findIndex(row => row.text.startsWith("Section 4. Form of Ballot."));
	if (fcs < 0 || aps <= fcs || debt <= aps || form <= debt) throw new Error("The education-notice section inventory changed.");
	const fcsRows = rows.slice(fcs, aps);
	const apsRows = rows.slice(aps, debt);
	const debtRows = rows.slice(debt, form);
	const required = (body: string, pattern: RegExp) => {
		const match = pattern.exec(body);
		if (!match) throw new Error("The education-notice fiscal wording requires review.");
		return match;
	};
	const total = required(opening, new RegExp(`raise not more than \\$${amounts}`, "u"))[1]!;
	const fcsMaximum = required(clean(fcsRows.map(row => row.text).join(" ")), new RegExp(`at a total maximum cost of \\$${amounts}`, "u"))[1]!;
	const apsMaximum = required(clean(apsRows.map(row => row.text).join(" ")), new RegExp(`at a total maximum cost of \\$${amounts}`, "u"))[1]!;
	const debtText = clean(debtRows.map(row => row.text).join(" "));
	const principal = required(debtText, new RegExp(`aggregate maximum principal amount not to exceed \\$${amounts}`, "u"))[1]!;
	const interest = required(debtText, /maximum rate or rates of interest on such debt shall not exceed ([a-z]+) percent (\d{1,2})% per annum/u);
	const words = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split(" ");
	if (words.indexOf(interest[1]!) !== Number(interest[2]) || !Number(interest[2])) throw new Error("The education-notice printed interest limits disagree.");
	const schedule = debtRows.flatMap((row) => {
		const match = new RegExp(`^(20\\d{2}) \\$${amounts}$`, "u").exec(row.text);
		return match ? [{ year: Number(match[1]), maximumPrincipalCents: cents(match[2]!), printedAmount: `$${match[2]}`, page: row.page }] : [];
	});
	if (!debtText.includes("Year: Principal Amount:") || !schedule.length || schedule.length > 20 || schedule.some((row, index) => index > 0 && row.year !== schedule[index - 1]!.year + 1) || schedule.reduce((sum, row) => sum + row.maximumPrincipalCents, 0) !== cents(principal) || cents(fcsMaximum) + cents(apsMaximum) !== cents(total)) throw new Error("The education-notice allocation or principal schedule does not reconcile.");
	const projects: { id: string; system: string; category: string; subject: string; condition: string; pages: number[]; fundingGuaranteed: false }[] = [];
	const project = (system: string, category: string, subject: string, condition: string, sourcePages: number[]) => {
		if (subject.length < 5 || subject.length > 250 || !/^\p{L}/u.test(subject)) throw new Error("The education-notice named project requires review.");
		projects.push({ id: hash(`${electionDate}\n${system}\n${category}\n${subject}`).slice(0, 24), system, category, subject, condition, pages: [...new Set(sourcePages)], fundingGuaranteed: false });
	};
	const list = (section: typeof rows, start: string, end: string) => {
		const first = section.findIndex(row => row.text.endsWith(start));
		const last = section.findIndex((row, index) => index > first && row.text.startsWith(end));
		if (first < 0 || last <= first + 1) throw new Error("The education-notice project-list boundaries changed.");
		return section.slice(first + 1, last);
	};
	for (const row of list(fcsRows, "programmatic needs; specifically:", "(ii)")) {
		if (!/^Replacement elementary school in Planning Region [A-Z]$/u.test(row.text)) throw new Error("The education-notice replacement-school format changed.");
		project("Fulton County School District", "replacement-school", row.text, "as needed", [row.page]);
	}
	for (const row of list(fcsRows, "and identified deficiencies:", "(iii)")) {
		if (!/^[\p{L} .’'-]+ (?:School|Academy|Campus|Facility)$/u.test(row.text)) throw new Error("The education-notice critical-school list requires review.");
		project("Fulton County School District", "critical-systems", row.text, "if and as needed, based on condition and identified deficiencies", [row.page]);
	}
	const priorities = list(apsRows, "programmatic needs; specifically:", "(ii)");
	const named: { subject: string; pages: number[] }[] = [];
	for (const row of priorities) {
		const numbered = /^\(([1-9]\d?)\) (.+)$/u.exec(row.text);
		if (numbered) {
			if (Number(numbered[1]) !== named.length + 1) throw new Error("The education-notice numbered project inventory changed.");
			named.push({ subject: numbered[2]!, pages: [row.page] });
		}
		else if (named.length) {
			named.at(-1)!.subject += ` ${row.text}`;
			named.at(-1)!.pages.push(row.page);
		}
		else {
			throw new Error("The education-notice project continuation is unrecognized.");
		}
	}
	for (const item of named) project("Atlanta Independent School System", "school-reconfiguration", item.subject, "as needed", item.pages);
	if (!named.length || projects.length > 200 || new Set(projects.map(row => row.id)).size !== projects.length) throw new Error("The education-notice project inventory exceeds its bounds or contains duplicates.");
	return { schemaVersion: 1, type: "fulton-education-notice-research", electionDate, taxRatePercent: 1, taxStartDate: date(required(opening, /beginning ([A-Za-z]+ [1-9]\d?, 20\d{2})/u)[1]!), maximumCalendarQuarters: Number(required(opening, /not to exceed ([1-9]\d?) calendar quarters/u)[1]), maximumCollectionsCents: cents(total), fcsMaximumProjectCostCents: cents(fcsMaximum), apsMaximumProjectCostCents: cents(apsMaximum), maximumBondPrincipalCents: cents(principal), maximumAnnualInterestPercent: Number(interest[2]), schedule, projects, principalScheduleReconciled: true, schoolProjectCostCapsReconciled: true, actualInterestRateKnown: false, projectInventoryComplete: false, electionOutcomeVerified: false, personalApplicabilityVerified: false, publicationApproved: false, automaticImportApproved: false };
}
