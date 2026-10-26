const encode = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export function eastGreenwichFixture(year = 2026, day = 3, precinct = "0901", house = "30") {
	const line = (text: string, left: number, top: number, width = 160, height = 10) => `<line xMin="${left}" xMax="${left + width}" yMin="${top}" yMax="${top + height}"><word xMin="${left}" xMax="${left + width}" yMin="${top}" yMax="${top + height}">${encode(text)}</word></line>`;
	const watermark = [["SA", -33.49, 667.797], ["M", 117.435, 573.553], ["PL", 211.678, 435.187], ["E", 350.045, 359.724]].map(([text, left, top]) => line(String(text), Number(left), Number(top), 100, 60)).join("");
	const office = (label: string[], left: number, top: number, term: string, vote: string, candidates: [string, string][]) => [...label, term, vote, ...candidates.flat(), "Write-in"].map((text, index) => line(text, left, top + index * 12)).join("");
	const header = ["State of Rhode Island Official Ballot", "General Election", `November ${day}, ${year}`, "East Greenwich"].map((text, index) => line(text, 141, 80 + index * 15, 300)).join("")
		+ [`Precinct ${precinct}`, "Congressional District 2", "Senate District 35", `Representative District ${house}`].map((text, index) => line(text, 483, 65 + index * 11, 150)).join("");
	const first = header
		+ office(["Senator in Congress"], 57, 217, "Six Year Term", "Vote for 1", [["Alex Sample", "REPUBLICAN"]])
		+ office(["Governor"], 57, 350, "Four Year Term", "Vote for 1", [["Blair Sample", "DEMOCRAT"]])
		+ office(["Representative in", "Congress", "District 2"], 57, 500, "Two Year Term", "Vote for 1", [["Casey Sample", "Independent"]])
		+ office(["General Treasurer"], 238, 217, "Four Year Term", "Vote for 1", [["Dana Sample", "REPUBLICAN"]])
		+ office(["Senator in", "General Assembly", "District 35"], 238, 350, "Two Year Term", "Vote for 1", [["Ellis Sample", "DEMOCRAT"]])
		+ office(["Representative in", "General Assembly", `District ${house}`], 238, 500, "Two Year Term", "Vote for 1", [["Finley Sample", "DEMOCRAT"]])
		+ office(["Town Council"], 420, 217, "Two Year Term", "Vote for up to 5", [["Gray Sample", "Independent"], ["Harper Sample", "DEMOCRAT"]])
		+ office(["School Committee"], 420, 500, "Four Year Term", "Vote for up to 4", [["Indigo Sample", "DEMOCRAT"]])
		+ line("Voting continues", 443, 1138, 100) + line("on back", 443, 1154, 100);
	const reverse = line("State Questions", 85, 63) + line("State Questions", 267, 63) + line("QUESTIONS 1 - 5", 57, 90) + line("Approve", 74, 300) + line("Reject", 74, 315) + line("East Greenwich", 498, 1178, 100);
	return `<!DOCTYPE html><html><body><doc><page width="648.000000" height="1260.000000">${first}${watermark}</page><page width="648.000000" height="1260.000000">${reverse}${watermark}</page></doc></body></html>`;
}
