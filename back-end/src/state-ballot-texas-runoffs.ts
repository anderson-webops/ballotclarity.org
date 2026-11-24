import type { StateBallotSource } from "./state-ballot-sources.js";

function municipalRunoff(id: string, placeName: string, label: string, pageUrl: string, url: string, documentLabel: string): StateBallotSource {
	return {
		id,
		stateCode: "TX",
		placeName,
		label,
		electionDate: "2026-12-12",
		selection: "explicit",
		ballotPreview: false,
		format: "reviewed-pdf",
		retrievalPolicy: "manual-snapshot",
		snapshotStorage: "external",
		pageUrl,
		url,
		documentUrls: [url],
		documentLinks: [
			{ label: documentLabel, url }
		]
	};
}

export const texasMunicipalRunoffs: readonly StateBallotSource[] = [
	municipalRunoff("tx-corpus-christi-runoff-20261212", "Corpus Christi", "Corpus Christi municipal runoff", "https://www.corpuschristitx.gov/department-directory/city-secretary/elections/2026-election-central/", "https://www.corpuschristitx.gov/media/0web0tv2/2026-noe-runoff-election-english.pdf", "Runoff election ordinance"),
	municipalRunoff("tx-el-paso-runoff-20261212", "El Paso", "El Paso city representative runoff", "https://www2.elpasotexas.gov/municipal-clerk/CCElectionDocs/elections/election-2026-12-12.php", "https://www2.elpasotexas.gov/municipal-clerk/CCElectionDocs/elections/2026-11-03/runoff/docs/Runoff-Sample-Ballot.pdf?1795495771", "Official sample ballot")
];
