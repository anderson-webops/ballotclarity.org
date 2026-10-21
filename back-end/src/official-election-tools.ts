import type { OfficialResource } from "./types/civic.js";
import { usStates } from "./us-states.js";

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

	const abbreviation = stateAbbreviation.trim().toUpperCase();
	const existing = stateOfficialToolSets.find(item => item.stateAbbreviation === abbreviation);
	if (existing) return existing.resources;
	const state = usStates.find(item => item[0] === abbreviation);
	return state
		? [{
				authority: "official-government" as const,
				label: `${state[1]} election offices`,
				sourceLabel: "U.S. Election Assistance Commission",
				sourceSystem: "EAC state and local election office directory",
				url: `https://www.eac.gov/voters/register-and-vote-in-your-state?field_state_target_id=${state[2]}`,
			}]
		: [];
}

export function getStateNameForAbbreviation(stateAbbreviation?: string) {
	if (!stateAbbreviation)
		return undefined;

	return usStates.find(item => item[0] === stateAbbreviation.trim().toUpperCase())?.[1];
}

export function getStateAbbreviationForName(stateName?: string) {
	if (!stateName)
		return undefined;

	const normalizedName = stateName.trim().toLowerCase();
	return usStates.find(item => item[1].toLowerCase() === normalizedName)?.[0];
}
