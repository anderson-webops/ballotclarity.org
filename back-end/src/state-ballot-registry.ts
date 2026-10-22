import type { StateBallotSource } from "./state-ballot-sources.js";
import { stateBallotSources } from "./state-ballot-sources.js";

export const additionalStateBallotSources: readonly StateBallotSource[] = [
	{
		stateCode: "NC",
		id: "nc-brunswick-samples-2026",
		label: "Brunswick County general-election samples",
		electionDate: "2026-11-03",
		url: "https://brunswickcountync.gov/DocumentCenter/View/7771/House-District-17-PDF?bidId=",
		pageUrl: "https://brunswickcountync.gov/1053/2026-Elections",
		format: "reviewed-pdf",
		retrievalPolicy: "manual-snapshot",
		snapshotStorage: "external",
		documentUrls: [
			"https://brunswickcountync.gov/DocumentCenter/View/7771/House-District-17-PDF?bidId=",
			"https://brunswickcountync.gov/DocumentCenter/View/7772/House-District-19-PDF?bidId=",
		],
		documentLinks: [
			{ label: "House District 17 sample", url: "https://brunswickcountync.gov/DocumentCenter/View/7771/House-District-17-PDF?bidId=" },
			{ label: "House District 19 sample", url: "https://brunswickcountync.gov/DocumentCenter/View/7772/House-District-19-PDF?bidId=" },
		],
		withheldDistrictScopes: ["congressional", "state-senate", "state-house"],
		scopeNotice: "Brunswick County samples only; other North Carolina races may be missing. District-based ballot matching is not verified.",
	},
	{
		stateCode: "NM",
		id: "nm-santa-fe-samples-2026",
		label: "Santa Fe County general-election publications",
		electionDate: "2026-11-03",
		url: "https://www.santafecountynm.gov/uploads/documents/GENERAL_2026-Master_Ballot_List.pdf",
		pageUrl: "https://www.santafecountynm.gov/clerk/elections/sample-ballots",
		format: "reviewed-pdf",
		retrievalPolicy: "manual-snapshot",
		snapshotStorage: "external",
		documentUrls: [
			"https://www.santafecountynm.gov/uploads/documents/GENERAL_2026-Master_Ballot_List.pdf",
			"https://www.santafecountynm.gov/uploads/documents/Sample-SANT_PCT001.pdf",
		],
		documentLinks: [
			{ label: "County master ballot", url: "https://www.santafecountynm.gov/uploads/documents/GENERAL_2026-Master_Ballot_List.pdf" },
			{ label: "Ballot style 1", url: "https://www.santafecountynm.gov/uploads/documents/Sample-SANT_PCT001.pdf" },
		],
		withheldDistrictScopes: ["congressional", "state-senate", "state-house"],
		scopeNotice: "Santa Fe County publications only; other New Mexico races may be missing. District-based ballot matching is not verified.",
	},
];

export const configuredStateBallotSources: readonly StateBallotSource[] = [...stateBallotSources, ...additionalStateBallotSources];
