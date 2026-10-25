import type { CensusGeographyItem } from "./census-geocoder.js";
import type { LocationDistrictMatch } from "./types/civic.js";
import { buildDistrictMatches } from "./census-geocoder.js";
import { currentCongress, currentCongressionalBoundarySession, isCongressionalDistrict, matchesCurrentCongress } from "./congressional-boundaries.js";
import { readProviderResponseJson } from "./fetch-response.js";
import { createFetchTimeoutSignal } from "./fetch-timeout.js";

interface DistrictContextOptions {
	benchmark: string;
	fetchImpl: typeof fetch;
	now?: () => number;
	timeoutMs: number;
}

interface CensusVintageResponse {
	vintages?: { vintageName?: string }[];
}

interface CensusCoordinatesResponse {
	result?: { geographies?: Record<string, CensusGeographyItem[] | undefined> };
}

export function createCensusDistrictContext({ benchmark, fetchImpl, now = Date.now, timeoutMs }: DistrictContextOptions) {
	let vintageCache: { expiresAt: number; names: string[] } | undefined;
	let pendingVintages: Promise<string[]> | undefined;

	async function offeredVintages() {
		if (vintageCache && vintageCache.expiresAt > now())
			return vintageCache.names;
		if (pendingVintages)
			return pendingVintages;
		pendingVintages = (async () => {
			const url = new URL("https://geocoding.geo.census.gov/geocoder/vintages");
			url.searchParams.set("benchmark", benchmark);
			url.searchParams.set("format", "json");
			const response = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: createFetchTimeoutSignal(timeoutMs) });
			if (!response.ok)
				throw new Error(`Census vintage discovery failed: ${response.status}`);
			const payload = await readProviderResponseJson<CensusVintageResponse>(response);
			if (!Array.isArray(payload.vintages) || payload.vintages.length > 64)
				throw new Error("Census vintage discovery has an unexpected layout.");
			const names = payload.vintages.map(item => item?.vintageName).filter((name): name is string => typeof name === "string" && /^ACS\d{4}_[A-Za-z0-9]+$/u.test(name));
			vintageCache = { expiresAt: now() + 86400000, names };
			return names;
		})();
		try {
			return await pendingVintages;
		}
		finally {
			pendingVintages = undefined;
		}
	}

	return async function resolveDistrictContext(
		geographies: Record<string, CensusGeographyItem[] | undefined> | undefined,
		latitude: number | undefined,
		longitude: number | undefined,
		vintage: string,
	) {
		const matches = buildDistrictMatches(geographies, vintage);
		const congress = currentCongress(now());
		const electionMatches = matches.filter(isCongressionalDistrict);
		const boundarySession = currentCongressionalBoundarySession(congress, electionMatches[0]?.stateFips);
		let currentMatches = electionMatches.filter(match => match.congressionalSession === boundarySession);
		if (currentMatches.length !== 1 && electionMatches.length && Number.isFinite(latitude) && Number.isFinite(longitude)) {
			currentMatches = [];
			try {
				const startYear = 1789 + (boundarySession - 1) * 2;
				const vintages = (await offeredVintages())
					.filter(name => [startYear, startYear - 1].includes(Number(name.slice(3, 7))))
					.sort((left, right) => right.localeCompare(left))
					.slice(0, 2);
				for (const candidate of vintages) {
					const url = new URL("https://geocoding.geo.census.gov/geocoder/geographies/coordinates");
					url.searchParams.set("x", String(longitude));
					url.searchParams.set("y", String(latitude));
					url.searchParams.set("benchmark", benchmark);
					url.searchParams.set("vintage", candidate);
					url.searchParams.set("format", "json");
					const response = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: createFetchTimeoutSignal(timeoutMs) });
					if (!response.ok)
						break;
					const payload = await readProviderResponseJson<CensusCoordinatesResponse>(response);
					const found = buildDistrictMatches(payload.result?.geographies, candidate)
						.filter(match => isCongressionalDistrict(match) && match.congressionalSession === boundarySession);
					if (found.length === 1 && found[0].stateFips && electionMatches.every(match => match.stateFips === found[0].stateFips)) {
						currentMatches = found;
						break;
					}
				}
			}
			catch {}
		}
		const ordered = matches.filter(match => !isCongressionalDistrict(match));
		const congressionalIndex = matches.findIndex(isCongressionalDistrict);
		if (currentMatches.length === 1)
			ordered.splice(congressionalIndex < 0 ? ordered.length : Math.min(congressionalIndex, ordered.length), 0, currentMatches[0]);
		return {
			districtContextCongress: currentMatches.length === 1 ? congress : undefined,
			districtMatches: ordered,
			electionDistrictMatches: electionMatches,
		};
	};
}

export function isCurrentCensusDistrictContext(
	lookup: { districtContextCongress?: number; districtMatches: LocationDistrictMatch[]; electionDistrictMatches?: LocationDistrictMatch[] },
	now = Date.now(),
) {
	return lookup.districtContextCongress === currentCongress(now)
		&& Array.isArray(lookup.electionDistrictMatches)
		&& lookup.districtMatches.filter(isCongressionalDistrict).every(match => matchesCurrentCongress(match, currentCongress(now), lookup.districtContextCongress));
}
