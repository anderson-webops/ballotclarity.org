import type { LocationDistrictMatch } from "./types/civic.js";

export function currentCongress(now = Date.now()) {
	const date = new Date(now);
	let year = date.getUTCFullYear();
	if (year % 2 === 1 && now < Date.UTC(year, 0, 3, 17))
		year -= 1;
	return Math.floor((year - 1789) / 2) + 1;
}

export function generalElectionCongress(electionDate: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(electionDate))
		return null;
	const year = Number(electionDate.slice(0, 4));
	if (year < 2024 || year % 2 !== 0)
		return null;
	const firstMonday = 1 + (8 - new Date(Date.UTC(year, 10, 1)).getUTCDay()) % 7;
	const generalDate = `${year}-11-${String(firstMonday + 1).padStart(2, "0")}`;
	return electionDate === generalDate ? Math.floor((year - 1789) / 2) + 2 : null;
}

export function isCongressionalDistrict(match: LocationDistrictMatch) {
	return ["congressional", "congressional-district", "cd"].includes(match.districtType.toLowerCase().replace(/[\s_]+/gu, "-"));
}

export function currentCongressionalBoundarySession(congress: number, stateFips?: string) {
	return congress === 120 && stateFips === "29" ? 119 : congress;
}

export function matchesCurrentCongress(match: LocationDistrictMatch, congress: number, contextCongress?: number) {
	const boundarySession = currentCongressionalBoundarySession(congress, match.stateFips);
	return match.congressionalSession === boundarySession && (boundarySession === congress || contextCongress === congress);
}

export function electionDistrictMatches(
	stateCode: string,
	electionDate: string,
	currentMatches: LocationDistrictMatch[],
	electionMatches?: LocationDistrictMatch[],
) {
	const congress = generalElectionCongress(electionDate);
	return [
		...currentMatches.filter(match => !isCongressionalDistrict(match)),
		...(stateCode === "MO" && congress === 120 ? currentMatches : electionMatches ?? currentMatches).filter((match) => {
			if (!isCongressionalDistrict(match) || congress === null || !Number.isInteger(match.congressionalSession))
				return false;
			if (stateCode === "MO" && congress === 120)
				return match.congressionalSession === 119;
			return match.congressionalSession === congress;
		}),
	];
}
