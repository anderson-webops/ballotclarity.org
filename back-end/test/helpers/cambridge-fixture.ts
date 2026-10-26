export function cambridgeFixture(year = 2026) {
	const date = year === 2028 ? `November 7, ${year}` : `November 3, ${year}`;
	const header = `${date} State Election\nCandidates in Cambridge Districts\n`;
	return `${header}Senator in Congress
        SAMPLE SENATOR, 1 Example Rd., Example, Democratic
Governor and Lieutenant Governor
        SAMPLE AND PARTNER, Independent
Representative in Congress
Fifth District
        SAMPLE REPRESENTATIVE, 2 Example Rd., Example, Republican
Councillor
Third District
        SAMPLE COUNCILLOR, 3 Example Rd., Example, Democratic
\f${header}Senator in General Court
Middlesex & Suffolk District
        FIRST SAMPLE, 4 Example Rd., Example, Democratic
Suffolk & Middlesex District
        SECOND SAMPLE, 5 Example Rd., Example, Unenrolled
Representative in General Court
Twenty-Fifth Middlesex District
        SAMPLE LEGISLATOR, 6 Example Rd., Example, Democratic
Register of Probate
Middlesex County
        SAMPLE CLERK, 7 Example Rd., Example, Justice for All
\f${header}Ballot Questions
Question 10: Example district-only question, not a candidate.
\f`;
}
