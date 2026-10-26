const escape = (value: string) => value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
function words(value: string, left: number, top: number) {
	let position = left;
	return value.split(" ").filter(Boolean).map((token) => {
		const width = token.length * 2.6;
		const result = `<word xMin="${position}" xMax="${position + width}" yMin="${top}" yMax="${top + 9}">${escape(token)}</word>`;
		position += width + 2;
		return result;
	}).join("");
}
export const franklinFixtureRows = [
	{ name: "Alex One and Blair Two", office: "GOVERNOR AND LIEUTENANT GOVERNOR", party: "Democratic", term: "Full Term", date: "", writeIn: "", website: "www.alexexample.org", noticeParty: "Democratic", noticeWriteIn: false },
	{ name: "Casey Three", office: "U.S. SENATOR", party: "Other-party c", term: "Unexpired Term Ending", date: "1-3-2029", writeIn: "", website: "", noticeParty: "Other-party", noticeWriteIn: false },
	{ name: "Drew Four", office: "REPRESENTATIVE TO CONGRESS 15TH CONGRESSIONAL DISTRICT", party: "N/A", term: "Full Term", date: "", writeIn: "", website: "", noticeParty: "", noticeWriteIn: true },
	{ name: "Emery Five", office: "STATE REPRESENTATIVE OHIO HOUSE DISTRICT 05", party: "N/A", term: "Full Term", date: "", writeIn: "Yes", website: "", noticeParty: "N/A", noticeWriteIn: true },
	{ name: "Finley Six", office: "JUDGE OF COURT OF APPEALS 10TH DISTRICT", party: "", term: "Full Term Commencing", date: "02/09/2027", writeIn: "", website: "", noticeParty: "", noticeWriteIn: false }
];
export function franklinFixture(options: { year?: number; continuation?: boolean; alias?: boolean; questionMarker?: boolean } = {}) {
	const year = options.year ?? 2026;
	const heading = () => words(`${year} General Election Candidates`, 51, 24) + words(`Revised October 16, ${year}`, 1073, 24);
	const header = () => words("Name on Ballot", 52, 56) + words("Party", 170, 56) + words("Office", 223, 56) + words("Full Or Unexpired Term", 530, 56) + words("Term Commencing", 635, 56) + words("DWrite-In", 711, 56);
	const candidateRows = franklinFixtureRows.map((row, index) => {
		const top = 81 + index * 28;
		const wrapped = index ? words(row.name, 52, top) : words("Alex One and", 52, top - 12) + words("Blair Two", 52, top);
		return wrapped + words(row.party, 170, top) + words(row.office, 223, top) + words(row.term, 530, top) + words(row.date, 635, top) + words(row.writeIn, 715, top) + words("private@example.org", 760, top) + words("555-555-0100", 950, top) + words(row.website, 1025, top);
	});
	const candidates = `<html><body><page width="792" height="1224">${heading()}${header()}${candidateRows.slice(0, options.continuation ? 3 : 5).join("")}</page>${options.continuation ? `<page width="792" height="1224">${heading()}${candidateRows.slice(3).join("")}</page>` : ""}</body></html>`;
	const notices = franklinFixtureRows.map((row, index) => {
		const top = 400 + index * 30;
		return words(options.alias && index === 3 ? "Emory Five" : row.name, 42, top) + words(row.noticeParty, 309, top) + (row.noticeWriteIn ? words("(write-in)", 42, top + 13) : "");
	});
	const notice = `<html><body><page width="612" height="792">${words("Election Notice for use with the Federal Write-In Absentee Ballot", 36, 50)}${words("Issued by the Franklin County Board of Elections", 36, 100)}${words(`November ${year === 2028 ? 7 : 3}, ${year} GENERAL ELECTION`, 36, 200)}${words("Name of Candidate", 42, 359)}${words("Office", 180, 359)}${words("Party", 309, 359)}${notices.join("")}${options.questionMarker ? words("Number", 42, 600) + words("(write-in)", 42, 620) : ""}</page></body></html>`;
	return { candidates, notice };
}
