import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { danePolicyReceipts } from "../../src/state-ballot-dane-collection.js";

const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const word = (text: string, left: number, top: number) => `<word xMin="${left}" xMax="${left + Math.max(2, text.length * 3.5)}" yMin="${top}" yMax="${top + 9}">${escape(text)}</word>`;
function line(text: string, left: number, top: number) {
	let position = left;
	const words = text.split(" ").map((text) => {
		const result = word(text, position, top);
		position += text.length * 3.5 + 2;
		return result;
	}).join("");
	return `<line xMin="${left}" xMax="${position}" yMin="${top}" yMax="${top + 9}">${words}</line>`;
}
const xml = (pages: string[]) => `<html><body><doc>${pages.map(page => `<page width="612" height="792">${page}</page>`).join("")}</doc></body></html>`;
const label = (date: string) => new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
function office(title: string, names: [string, string][], left: number, top: number, district = "") {
	return line(title, left, top) + (district ? line(`District ${district}`, left, top + 10) : "") + line("Vote for 1", left, top + (district ? 20 : 10)) + names.map(([name, party], index) => {
		const position = top + (district ? 35 : 25) + index * 28;
		return name.includes(" / ") ? line(`${name.split(" / ")[0]!} /`, left + 13, position) + line(name.split(" / ")[1]!, left + 13, position + 9) + line(`(${party})`, left + 13, position + 18) : line(name, left + 13, position) + line(`(${party})`, left + 13, position + 10);
	}).join("");
}
export function daneSample(style: "Lodi" | "Waunakee" | "Sauk", date = "2026-11-03") {
	const front = line("Official Ballot", 260, 46) + line(label(date), 260, 70) + line("Referendum", 420, 114)
		+ office("Governor / Lieutenant Governor", [["Avery Example / Jordan Sample", "Republican"], ["Casey Example / Riley Sample", "Democratic"]], 102, 315)
		+ office("Attorney General", [["Elliot Example", "Republican"], ["Robin Example", "Democratic"]], 102, 443)
		+ office("Secretary of State", [["Skyler Example", "Republican"], ["Morgan Example", "Democratic"], ["Taylor Example", "Wisconsin Green"]], 102, 542)
		+ office("State Treasurer", [["Reese Example", "Republican"], ["Jesse Example", "Democratic"]], 241, 131)
		+ office("Representative in Congress", [["Cameron Example", "Democratic"]], 241, 240, "2")
		+ office("State Senator", [["Drew Example", "Democratic"]], 241, 325, "27")
		+ office("Representative to the Assembly", [["Blake Example", "Republican"], ["Quinn Example", "Democratic"]], 241, 396, "81")
		+ office("Sheriff", [["Hayden Example", "Democratic"]], 241, 514)
		+ office("Clerk of Circuit Court", [["Parker Example", "Democratic"]], 241, 584)
		+ line(style === "Sauk" ? "Continue voting at top of next column." : "Page 1 of 2-sided ballot. Ballot continues on other side.", 130, 730);
	const reverse = line("Official Ballot", 260, 70) + line(label(date), 260, 100) + line("T Dane Wd 1", 260, 140)
		+ (style === "Sauk" ? "" : line(style === "Lodi" ? "School District of Lodi" : "Waunakee Community School District", 20, 180))
		+ line(style === "Sauk" ? "Initials of inspectors who remade ballot" : "Page 2 of 2-sided ballot. Ballot begins on other side.", 100, 730);
	return xml([front, reverse]);
}
export function daneNotice(date = "2026-11-03") {
	return xml([
		line("Notice of General Election and Sample Ballots", 40, 30) + line(label(date).replace(", ", ","), 200, 60) + line("Office of the Dane County Clerk", 40, 80),
		line("The sample ballots contain candidates for Assembly District 81 and State Senate District 27.", 36, 287)
		+ line("State Senator – District 27", 47, 317) + line("Drew Example (Democratic)", 47, 329)
		+ line("State Assembly – District 81", 314, 317) + line("Blake Example (Republican)", 314, 329) + line("Quinn Example (Democratic)", 314, 341)
	]);
}
export function daneFixture(date = "2026-11-03", missing: string[] = []) {
	const year = date.slice(0, 4);
	const day = Number(date.slice(8));
	const capturedAt = `${year}-10-24T12:00:00.000Z`;
	const now = Date.parse(capturedAt) + 60000;
	const footer = readFileSync(new URL("../fixtures/dane-policy-footer.html", import.meta.url), "utf8");
	const newsFooter = footer.replace(/<footer class="entry-footer">[\s\S]*?<\/footer>/u, "<footer class=\"entry-footer\"></footer>");
	const pageUrl = `https://townofdane.gov/${year}/09/16/november-${day}-${year}-general-election-information/`;
	const heading = `November ${day}, ${year} General Election Information`;
	const documentDefinitions = (["Lodi", "Waunakee", "Sauk", "notice"] as const).filter(kind => !missing.includes(kind)).map(kind => ({ kind, url: `https://cdn.townweb.com/townofdane.gov/wp-content/uploads/${year}/09/${kind === "notice" ? `Dane-County-Type-B-ToD-Notice-for-Fall-${year}.pdf` : `Sample-Nov-${day}-Ballot-${kind}.pdf`}`, text: kind === "notice" ? daneNotice(date) : daneSample(kind, date) }));
	const page = (url: string, body: string) => ({ url, body, sha256: createHash("sha256").update(body).digest("hex"), retrievedAt: capturedAt });
	const news = [page("https://townofdane.gov/news-notices/", `<html><h1>News &amp; Notices</h1><a href="${pageUrl}">${heading}</a>${newsFooter}</html>`)];
	const articles = [page(pageUrl, `<html><h2 class="entry-title">${heading}</h2>${documentDefinitions.map(item => `<a href="${item.url}">${item.url.split("/").at(-1)}</a>`).join("")}${footer}</html>`)];
	const documents = documentDefinitions.map(({ url, text }) => ({ url, text, sha256: createHash("sha256").update(text).digest("hex"), retrievedAt: capturedAt }));
	const discovery = { schemaVersion: 1, type: "dane-discovery", policies: danePolicyReceipts, news, articles, documents };
	return { discovery, capture: JSON.stringify({ schemaVersion: 1, type: "dane-candidate-capture", electionDate: date, discovery }), now, pageUrl };
}
