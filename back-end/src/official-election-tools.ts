import type { OfficialResource } from "./types/civic.js";

interface StateOfficialToolSet {
	stateAbbreviation: string;
	stateName: string;
	resources: OfficialResource[];
}

const stateOfficialToolSets: StateOfficialToolSet[] = [
	{
		stateAbbreviation: "GA",
		stateName: "Georgia",
		resources: [
			{
				authority: "official-government",
				label: "Georgia My Voter Page",
				note: "Official statewide voter portal for registration status, sample ballot, precinct lookup, absentee status, and election-day details.",
				sourceLabel: "Georgia Secretary of State official voter portal",
				sourceSystem: "Georgia My Voter Page",
				url: "https://mvp.sos.ga.gov/s/"
			}
		]
	},
	{
		stateAbbreviation: "UT",
		stateName: "Utah",
		resources: [
			{
				authority: "official-government",
				label: "Utah voter registration portal",
				note: "Official Utah voter portal for registration status, address updates, polling location lookup, and related voter tools.",
				sourceLabel: "Utah Lieutenant Governor official voter portal",
				sourceSystem: "Utah Voter Information",
				url: "https://vote.utah.gov/voter-registration-portal/"
			},
			{
				authority: "official-government",
				label: "Utah county election officials",
				note: "Official directory for county clerks and local election contacts across Utah.",
				sourceLabel: "Utah Lieutenant Governor county election officials directory",
				sourceSystem: "Utah Voter Information",
				url: "https://vote.utah.gov/contact-your-county-election-officials/"
			}
		]
	}
];

export function getOfficialToolsForState(stateAbbreviation?: string) {
	if (!stateAbbreviation)
		return [];

	return stateOfficialToolSets.find(item => item.stateAbbreviation === stateAbbreviation.toUpperCase())?.resources ?? [];
}

export function getStateNameForAbbreviation(stateAbbreviation?: string) {
	if (!stateAbbreviation)
		return undefined;

	return stateOfficialToolSets.find(item => item.stateAbbreviation === stateAbbreviation.toUpperCase())?.stateName;
}

export function getStateAbbreviationForName(stateName?: string) {
	if (!stateName)
		return undefined;

	const normalizedName = stateName.trim().toLowerCase();
	return stateOfficialToolSets.find(item => item.stateName.toLowerCase() === normalizedName)?.stateAbbreviation;
}
