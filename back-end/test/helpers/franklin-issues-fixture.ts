const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export function franklinIssuesFixture(year = 2026) {
	const words: string[] = [];
	const printed: string[] = [];
	const line = (text: string, left: number, top: number) => {
		printed.push(text);
		let position = left;
		for (const token of text.split(" ")) {
			const width = token.length * 3;
			words.push(`<word xMin="${position}" xMax="${position + width}" yMin="${top}" yMax="${top + 16}">${escape(token)}</word>`);
			position += width + 3;
		}
	};
	line("CERTIFIED QUESTIONS AND ISSUES", 180, 34);
	line(`NOVEMBER ${year === 2026 ? 3 : 7}, ${year} GENERAL ELECTION`, 160, 51);
	line(`Revised 9/4/${year}`, 270, 67);
	for (const [index, label] of ["#", "Subdivision", "Purpose", "Rate"].entries()) line(label, [48, 120, 300, 480][index]!, 79);
	line("#5", 45, 94);
	line("Example School District", 77, 94);
	line("Proposed Tax Levy", 77, 108);
	line("Current Expenses", 252, 108);
	line("2 mills, 5 years", 420, 108);
	line("Proposed Bond Issue", 77, 136);
	line("School Construction", 252, 136);
	line("$10,000,000; 20 years", 420, 136);
	line("Other Public Library", 77, 164);
	line("Proposed Tax Levy", 77, 178);
	line("Current Expenses", 252, 164);
	line("1 mill, continuing", 420, 164);
	line("Page 1", 36, 741);
	const rectangle = (left: number, top: number, right: number, bottom: number) => `<path d="M ${left} ${bottom} L ${right} ${bottom} L ${right} ${top} L ${left} ${top} Z M ${left} ${bottom}"/>`;
	const svg = `<svg viewBox="0 0 612 792">${[30, 72, 247, 414, 586].map(left => rectangle(left - 0.25, 80, left + 0.25, 194)).join("")}${[80, 94, 164, 194].flatMap(top => [[30.25, 71.75], [72.25, 246.75], [247.25, 413.75], [414.25, 585.75]].map(([left, right]) => rectangle(left!, top - 0.25, right!, top + 0.25))).join("")}</svg>`;
	return { schemaVersion: 1, type: "franklin-certified-issue-grid", bbox: `<html><doc><page width="612.000000" height="792.000000">${words.join("")}</page></doc></html>`, layout: `${printed.join("\n")}\f`, svg: [svg] };
}
