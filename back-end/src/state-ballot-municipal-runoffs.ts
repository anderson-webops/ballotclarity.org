import type { StateBallotSource } from "./state-ballot-sources.js";

function municipalRunoff(stateCode: string, electionDate: string, id: string, placeName: string, label: string, pageUrl: string, url: string, documentLabel: string): StateBallotSource {
	return {
		id,
		stateCode,
		placeName,
		label,
		electionDate,
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

const travisPage = "https://votetravis.gov/current-election-information/current-election/";
const travisBallot = "https://votetravis.gov/wp-content/uploads/GR26-Bedsheet-Ballot_FINAL_UPDATED.pdf";

export const reviewedMunicipalRunoffs: readonly StateBallotSource[] = [
	municipalRunoff("TX", "2026-12-12", "tx-corpus-christi-runoff-20261212", "Corpus Christi", "Corpus Christi municipal runoff", "https://www.corpuschristitx.gov/department-directory/city-secretary/elections/2026-election-central/", "https://www.corpuschristitx.gov/media/0web0tv2/2026-noe-runoff-election-english.pdf", "Runoff election ordinance"),
	municipalRunoff("TX", "2026-12-12", "tx-el-paso-runoff-20261212", "El Paso", "El Paso city representative runoff", "https://www2.elpasotexas.gov/municipal-clerk/CCElectionDocs/elections/election-2026-12-12.php", "https://www2.elpasotexas.gov/municipal-clerk/CCElectionDocs/elections/2026-11-03/runoff/docs/Runoff-Sample-Ballot.pdf?1795495771", "Official sample ballot"),
	...["Austin", "Manor", "Pflugerville"].map(city => municipalRunoff("TX", "2026-12-12", `tx-${city.toLowerCase()}-runoff-20261212`, city, `${city} City Council runoff`, travisPage, travisBallot, "Official sample ballot")),
	municipalRunoff("GA", "2026-12-01", "ga-doraville-runoff-20261201", "Doraville", "Doraville City Council special runoff", "https://dekalbcountyga.gov/departments/voter-registration-and-elections", "https://dekalbcountyga.gov/sites/default/files/2026-11/Doraville%20December%201%202026%20Runoff%20Sample%20Ballot.pdf", "Official sample ballot")
];
