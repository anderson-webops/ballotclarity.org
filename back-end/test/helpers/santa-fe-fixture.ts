const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export const santaFeWord = (left: number, top: number, value: string) => `<word xMin="${left}" xMax="${Math.min(left + value.length * 4, 610)}" yMin="${top}">${escape(value)}</word>`;
export function santaFeFixture(year = "2026", day = "3") {
	const row = (top: number, values: [number, string][]) => values.map(([left, value]) => santaFeWord(left, top, value)).join("");
	const words = [
		row(100, [[42, "SANTA FE COUNTY CLERK’S OFFICE"]]),
		row(125, [[42, `${year} GENERAL ELECTION MASTER BALLOT LIST`]]),
		row(150, [[42, `ELECTION DAY- Tuesday November ${day}, ${year}`]]),
		row(177.4, [[42, "RACE"], [185.4, "CANDIDATE(S)"], [374.4, "BALLOT"], [464.4, "PRECINCTS"]]),
		row(194.5, [[374.4, "STYLE"]]),
		row(215, [[42, "UNITED STATES SENATOR"], [185.4, "EXAMPLE RIVERA (D)"], [374.4, "ALL"], [464.4, "ALL"]]),
		row(235, [[185.4, "EXAMPLE FORD (R)"]]),
		row(260, [[42, "GOVERNOR &"], [185.4, "EXAMPLE CHEN AND"]]),
		row(275, [[42, "LIEUTENANT GOVERNOR"], [185.4, "EXAMPLE ORTIZ (D)"]]),
		row(310, [[42, "STATE REPRESENTATIVE"], [185.4, "EXAMPLE LÓPEZ (R)"]]),
		row(325, [[42, "DISTRICT 41"]]),
		row(355, [[42, "COUNTY SHEIRFF"], [185.4, "EXAMPLE SENA (FWD)"], [374.4, "ALL"]]),
		row(390, [[42, "JUDICIAL RETENTION,"], [185.4, "EXAMPLE SHANNON"]]),
		row(404.5, [[42, "SUPREME COURT"]]),
		row(405, [[185.4, "YES/NO"]]),
		row(435, [[42, "Shall EXAMPLE SHANNON be retained as Justice of the Supreme Court?"]]),
		row(465, [[42, "iRetendremos a EXAMPLE SHANNON"]]),
		row(500, [[42, "CONSTITUTIONAL"], [185.4, "FOR/AGAINST"]]),
		row(515, [[42, "AMENDMENT 1,"]]),
	].join("");
	return `<html><body><doc><page width="612" height="792">${words}</page></doc></body></html>`;
}
