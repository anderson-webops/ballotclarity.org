export interface KentuckyRow { name: string; office: string; seat: string; party: string }
export interface KentuckyGroup { id: string; label: string; rows: KentuckyRow[]; inactive: KentuckyRow[] }
export const kentuckySelection = "ctl00$MainContent$ddlElection";
export const kentuckyFixtureDate = (year: string) => `${year}-11-${year === "2027" ? "02" : year === "2028" ? "07" : "03"}`;
export const kentuckyFixtureId = (year: string) => year === "2027" ? "90" : year === "2028" ? "93" : "87";
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;");

export function kentuckyFixtureGroups(empty = false): KentuckyGroup[] {
	const rows = (office: string, seat = "", name = "Synthetic Candidate", party = "Republican Party") => empty ? [] : [{ name, office, seat, party }];
	return [
		{ id: "3", label: "US Senator", rows: rows("US Senator"), inactive: [] },
		{ id: "4", label: "US Representative", rows: rows("US Representative", "1"), inactive: [] },
		{ id: "11", label: "State Senator", rows: rows("State Senator", "2"), inactive: [] },
		{ id: "12", label: "State Representative", rows: rows("State Representative", "3"), inactive: [] },
		{ id: "13", label: "Commonwealth's Attorney", rows: rows("Commonwealth's Attorney", "10"), inactive: [] },
		{ id: "14", label: "Justice of the Supreme Court", rows: rows("Justice of the Supreme Court", "1 Division 2"), inactive: [] },
		{ id: "15", label: "Judge of the Court of Appeals", rows: [], inactive: [] },
		{ id: "16", label: "Circuit Judge", rows: [...rows("Circuit Judge", "2 Division 1", "Sam Example"), ...rows("Circuit Judge", "2 Division 2", "Sam Example")], inactive: [] },
		{ id: "17", label: "District Judge", rows: rows("District Judge", "4 Division 2"), inactive: rows("District Judge", "4 Division 1", "Alex Inactive") },
		{ id: "20", label: "Circuit Judge Family Court", rows: rows("Circuit Judge", "2 Division 1", "Sam Example", "Write-In"), inactive: [] },
	];
}

export function kentuckyFixtureCalendar(years = ["2026", "2027"]) {
	return years.map(year => `<h2>${year} General Election Dates</h2><ul><li>November ${Number(kentuckyFixtureDate(year).slice(-2))}, ${year} - General Election Day</li></ul>`).join("");
}

function table(office: string, rows: KentuckyRow[], globalInactive = false) {
	const headers = [globalInactive ? "Name" : "Name / Running Mate", "POBox Address / Email", "Office", "District/Division", "Party", ...globalInactive ? [] : ["Date Filed"]];
	return `<details><summary>${escape(office)} (${rows.length})</summary><table><tr>${headers.map(header => `<th>${escape(header)}</th>`).join("")}</tr>${rows.map(row => `<tr>${[row.name, "PRIVATE-ADDRESS PRIVATE-PHONE PRIVATE-EMAIL", row.office, row.seat, row.party, ...globalInactive ? [] : ["PRIVATE-FILING-DATE"]].map(value => `<td>${escape(value)}</td>`).join("")}</tr>`).join("")}</table></details>`;
}

export function kentuckyFixturePortal(url: string, root: string, year = "2026", groups = kentuckyFixtureGroups()) {
	const inactive = url.endsWith("?withdrawn=1");
	const group = groups.find(group => url.endsWith(`?id=${group.id}`));
	const directory = `${groups.map(group => `<a href="${root}Default.aspx?id=${group.id}">${escape(group.label)} (${group.rows.length})</a>`).join("")
	}<a href="${root}Default.aspx?id=23">Constitutional Amendment 1 (2)</a><a href="${root}Default.aspx?withdrawn=1">Withdrawn/Deceased/Disqualified (16)</a>`;
	const results = inactive
		? `<div id="ctl00_MainContent_pnlResults"><div id="ctl00_MainContent_pnlWddResults">${groups.flatMap(group => group.inactive).map(row => table(row.office, [row], true)).join("")}</div></div>`
		: group ? `<div id="ctl00_MainContent_pOfficeResults">${group.rows.length ? table(group.rows[0]!.office, group.rows) : ""}<div id="ctl00_MainContent_pnlOfficeWddResults">${group.inactive.length ? table(group.inactive[0]!.office, group.inactive) : ""}</div></div>` : directory;
	return `<html><head><title>${inactive ? "Election Candidate Filings - Withdrawn/Deceased/Disqualified" : `Election: ${year} General Election`}</title></head><body><form id="aspnetForm" action="${escape(url)}" method="post"><input type="hidden" name="__VIEWSTATE" value="SYNTHETIC-STATE"><input type="hidden" name="__EVENTVALIDATION" value="SYNTHETIC-VALIDATION"><input type="hidden" name="ctl00$MainContent$hfLastResultsUrl" value="${group ? escape(new URL(url).pathname + new URL(url).search) : ""}"><select name="${kentuckySelection}">${["2026", "2027", "2028"].map(option => `<option value="${kentuckyFixtureId(option)}" ${option === year ? "selected" : ""}>${option} General Election</option>`).join("")}<option value="89">2027 Primary Election</option></select><select name="ctl00$MainContent$ddlParty"><option value="">All parties</option><option value="R">Republican Party</option></select>${["tFName", "tLName", "tDatefiled"].map(filter => `<input type="text" name="ctl00$MainContent$${filter}" value="">`).join("")}${results}</form></body></html>`;
}

export function kentuckyFixtureDiscovery(root: string, years = ["2026", "2027"], emptyFuture = false, supplied?: KentuckyGroup[]) {
	return JSON.stringify({ schemaVersion: 1, type: "kentucky-election-discovery", index: kentuckyFixturePortal(root, root), calendar: kentuckyFixtureCalendar(years), selections: years.map(year => ({ electionId: kentuckyFixtureId(year), body: kentuckyFixturePortal(root, root, year, supplied ?? kentuckyFixtureGroups(emptyFuture && year !== "2026")) })) });
}

export function kentuckyFixtureCapture(root: string, kind: "core" | "courts", year = "2026", empty = false, years = ["2026", "2027"], supplied?: KentuckyGroup[]) {
	const groups = supplied ?? kentuckyFixtureGroups(empty);
	const selected = groups.filter(group => (kind === "courts") === /\b(?:Judge|Justice)\b|^Commonwealth's Attorney$/u.test(group.label));
	const discovery = kentuckyFixtureDiscovery(root, years, empty && year !== "2026", supplied);
	const parsed = JSON.parse(discovery);
	parsed.selections.find((entry: { electionId: string }) => entry.electionId === kentuckyFixtureId(year)).body = kentuckyFixturePortal(root, root, year, groups);
	return JSON.stringify({ schemaVersion: 1, type: "kentucky-candidate-export", discovery: JSON.stringify(parsed), documents: selected.map(group => `${root}Default.aspx?id=${group.id}`).concat(`${root}Default.aspx?withdrawn=1`).map(url => ({ url, body: kentuckyFixturePortal(url, root, year, groups) })) });
}
