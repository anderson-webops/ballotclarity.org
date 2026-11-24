import type { StateBallotSource } from "./state-ballot-sources.js";

type LocalArea = { placeName: string } | { countyName: string };

function localDirectory(stateCode: string, electionDate: string, id: string, area: LocalArea, label: string, pageUrl: string, url: string, documentLabel: string): StateBallotSource {
	return {
		id,
		stateCode,
		...area,
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

const pulaskiNotice = "https://votepulaskiar.gov/wp-content/uploads/12012026_Notice-of-Election_v2.pdf";

export const reviewedLocalDirectories: readonly StateBallotSource[] = [
	localDirectory("TX", "2026-12-12", "tx-corpus-christi-runoff-20261212", { placeName: "Corpus Christi" }, "Corpus Christi municipal runoff", "https://www.corpuschristitx.gov/department-directory/city-secretary/elections/2026-election-central/", "https://www.corpuschristitx.gov/media/0web0tv2/2026-noe-runoff-election-english.pdf", "Runoff election ordinance"),
	localDirectory("TX", "2026-12-12", "tx-el-paso-runoff-20261212", { placeName: "El Paso" }, "El Paso city representative runoff", "https://www2.elpasotexas.gov/municipal-clerk/CCElectionDocs/elections/election-2026-12-12.php", "https://www2.elpasotexas.gov/municipal-clerk/CCElectionDocs/elections/2026-11-03/runoff/docs/Runoff-Sample-Ballot.pdf?1795495771", "Official sample ballot"),
	...["Austin", "Manor", "Pflugerville"].map(city => localDirectory("TX", "2026-12-12", `tx-${city.toLowerCase()}-runoff-20261212`, { placeName: city }, `${city} City Council runoff`, travisPage, travisBallot, "Official sample ballot")),
	localDirectory("GA", "2026-12-01", "ga-doraville-runoff-20261201", { placeName: "Doraville" }, "Doraville City Council special runoff", "https://dekalbcountyga.gov/departments/voter-registration-and-elections", "https://dekalbcountyga.gov/sites/default/files/2026-11/Doraville%20December%201%202026%20Runoff%20Sample%20Ballot.pdf", "Official sample ballot"),
	...["Alexander", "Jacksonville", "North Little Rock"].map(city => localDirectory("AR", "2026-12-01", `ar-${city.toLowerCase().replaceAll(" ", "-")}-runoff-20261201`, { placeName: city }, `${city} municipal runoff`, "https://votepulaskiar.gov/", pulaskiNotice, "County election notice")),
	localDirectory("AL", "2026-12-08", "al-tuscaloosa-council-special-20261208", { placeName: "Tuscaloosa" }, "Tuscaloosa City Council special election", "https://elections.tuscaloosa.com/", "https://assets.caboosecms.com/media/15592452_d5-sample-ballot-2026.pdf", "Official sample ballot"),
	localDirectory("TN", "2026-12-08", "tn-collierville-runoff-20261208", { placeName: "Collierville" }, "Collierville alderman runoff", "https://www.electionsshelbytn.gov/upcoming-elections/", "https://www.electionsshelbytn.gov/wp-content/uploads/2026/11/2026-Collierville-Runoff-Sample.pdf", "Official sample ballot"),
	localDirectory("WI", "2026-12-15", "wi-waukesha-executive-special-20261215", { countyName: "Waukesha County" }, "Waukesha County Executive special election", "https://www.waukeshacounty.gov/county-clerks-office/election-information/", "https://www.waukeshacounty.gov/media/wckmai0u/county-exec-candidate-contact-info.pdf", "County clerk's candidate roster")
];
