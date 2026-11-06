import type { IowaSampleContext, IowaSampleDocument } from "../../src/state-ballot-iowa-county-native.js";
import { createHash } from "node:crypto";

export function iowaCountyNativeFixture(
	county: IowaSampleContext["county"] = "Monona",
	electionDate = "2026-11-03",
	style = "Example township style"
) {
	const context: IowaSampleContext = { county, electionDate, style };
	const title = `${electionDate.slice(0, 4)} General Election November ${Number(electionDate.slice(-2))}, ${electionDate.slice(0, 4)} County of ${county}`;
	const columns = [
		[
			[
				"Federal Offices",
				"For United States Senator",
				"Vote for no more than One",
				"Avery Example REP",
				"(Write-in vote, if any)",
				"For United States Representative",
				"District 4",
				"Vote for no more than One",
				"Morgan Sample DEM",
				"(Write-in vote, if any)"
			],
			[
				"State Offices",
				"For Governor / Lieutenant Governor",
				"Vote for no more than One Team",
				"Jordan Example REP",
				"Casey Sample",
				"(Write-in vote, if any)",
				"For State Representative",
				"District 13",
				"Vote for no more than One",
				"Riley Example DEM",
				"(Write-in vote, if any)"
			],
			[
				"County Offices",
				"For County Supervisor",
				"District 3",
				"Vote for no more than One",
				"Taylor Example REP",
				"Harper Sample",
				"(Write-in vote, if any)",
				"For County Treasurer",
				"Vote for no more than One",
				"Drew Example DEM",
				"(Write-in vote, if any)"
			]
		],
		[
			[
				"Nonpartisan Offices",
				"For Township Trustee Concord",
				"Vote for no more than Two",
				"Quinn Example",
				"(Write-in vote, if any)",
				"For County Agricultural Extension",
				"To Fill Vacancy",
				"Vote for no more than One",
				"Parker Sample",
				"(Write-in vote, if any)",
				"For Township Clerk Concord",
				"Vote for no more than One",
				"(Write-in vote, if any)"
			],
			[
				"Judicial Ballot",
				"Notice to Voters: Vote on all names",
				"by filling in the appropriate oval below each name.",
				"Court of Appeals Judge",
				"Rowan Example",
				"YES",
				"NO",
				"District 3B Associate Judge",
				"Sage Sample",
				"YES",
				"NO"
			],
			["Public Measures", "Constitutional Amendment 1", "Shall the following amendment be adopted?", "YES", "NO"]
		]
	];
	if (county === "Woodbury") {
		const printedParties: Record<string, string> = { REP: "Republican Party", DEM: "Democratic Party" };
		for (const page of columns) {
			for (const [index, column] of page.entries()) {
				page[index] = column.flatMap((line) => {
					if (line === "For Governor / Lieutenant Governor") return ["For Governor and Lt Governor"];
					if (line === "Jordan Example REP") return ["Jordan Example"];
					if (line === "Casey Sample") return [line, "Republican Party"];
					const partisan = /^(.+) (REP|DEM)$/u.exec(line);
					return partisan ? [partisan[1]!, printedParties[partisan[2]!]!] : [line];
				});
			}
		}
	}
	const escape = (value: string) =>
		value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");
	const starts = county === "Monona" ? [24, 216, 408] : [38, 220, 400];
	const word = (value: string, left: number, top: number, width = 160) =>
		`<word xMin="${left}" xMax="${left + width}" yMin="${top}" yMax="${top + 10}">${escape(value)}</word>`;
	const bbox = `<doc>${columns.map((page, pageIndex) => `<page width="612" height="1008">${pageIndex === 0 ? word(title, 24, 60) : ""}${page.map((column, columnIndex) => column.map((line, lineIndex) => word(line, starts[columnIndex]!, 300 + lineIndex * 24)).join("")).join("")}</page>`).join("")}</doc>`;
	const layout = `${title}\n${columns.flat(2).join("\n")}`;
	const document: IowaSampleDocument = {
		url: `https://${county === "Monona" ? "mononacountyiowa.gov" : "elections.woodburycountyiowa.gov"}/files/sample_ballots/example_style_1.pdf`,
		style,
		sha256: createHash("sha256").update("synthetic PDF fixture").digest("hex"),
		retrievedAt: "2026-11-06T20:00:00.000Z",
		bbox,
		layout
	};
	return { context, document, bbox, layout };
}
