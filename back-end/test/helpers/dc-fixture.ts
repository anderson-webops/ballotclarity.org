const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export function dcWord(left: number, top: number, value: string, right = left + 20) {
	return `<word xMin="${left}" xMax="${right}" yMin="${top}">${escape(value)}</word>`;
}
export function dcPage(body: string) {
	return `<page width="792" height="612">${body}</page>`;
}
export function dcDocument(body: string) {
	return `<html><doc>${body}</doc></html>`;
}
export function dcFixture(year = 2026) {
	const day = year === 2026 ? "3" : "7";
	const heading = `District of Columbia Board of Elections - November ${day}, ${year} General Election`;
	const general = dcDocument(dcPage([
		dcWord(274, 53, heading, 750),
		dcWord(109, 62, "Candidate's Name", 155),
		dcWord(52, 70, "Mayor of the District of Columbia", 210),
		dcWord(52, 82, "Sample Mayor - Independent", 210),
		dcWord(52, 94, "Write-In, if any", 110),
		dcWord(52, 106, "Ward 3 Member of the State Board of Education", 210),
		dcWord(52, 118, "Sample Educator", 120),
		dcWord(52, 130, "Write-In, if any", 110)
	].join("")));
	const anc = dcDocument(dcPage([
		dcWord(269, 20, "List of Advisory Neighborhood Commissioner Candidates", 750),
		dcWord(340, 38, `November ${day}, ${year}`, 470),
		dcWord(340, 52, "General Election", 470),
		dcWord(25, 63, "ANC-SMD Name", 155),
		dcWord(34, 81, "1A01", 51),
		dcWord(66, 81, "Sample Commissioner", 210),
		dcWord(34, 100, "1A02", 51),
		dcWord(34, 120, "2E01", 51),
		dcWord(66, 120, `Former Commissioner (withdrew 10/5/${String(year).slice(-2)})`, 218),
		dcWord(376, 561, `10/14/${year}`, 420),
		dcWord(383, 580, "Page", 401),
		dcWord(404, 580, "1", 410)
	].join("")));
	const writeIns = dcDocument(dcPage([
		dcWord(274, 54, heading, 750),
		dcWord(82, 73.5, "Candidate's", 109),
		dcWord(111, 73.5, "Name", 125),
		dcWord(197, 73.5, "Office Sought", 230),
		dcWord(292, 73.5, "Party", 305),
		dcWord(52, 80.7, "Early Row", 130),
		dcWord(158, 80.7, "Mayor of the District of Columbia", 255),
		dcWord(270, 80.7, "Independent", 310),
		dcWord(52, 94, `Former Writein (withdrew 10/22/${String(year).slice(-2)})`, 140),
		dcWord(158, 94, "ANC 6/8F01", 250),
		dcWord(270, 94, "N/A", 300),
		dcWord(371, 581, `10/23/${year}`, 420)
	].join("")));
	return [general, anc, writeIns];
}
