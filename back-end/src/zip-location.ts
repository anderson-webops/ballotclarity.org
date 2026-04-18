import process from "node:process";

interface ZipLocationApiPlace {
	latitude?: string;
	longitude?: string;
	state?: string;
}

interface ZipLocationApiPlaceLabels {
	"place name"?: string;
	"state abbreviation"?: string;
}

interface ZipLocationApiResponseBase {
	places?: Array<ZipLocationApiPlace & ZipLocationApiPlaceLabels>;
}

interface ZipLocationApiResponseLabels {
	"post code"?: string;
}

type ZipLocationApiResponse = ZipLocationApiResponseBase & ZipLocationApiResponseLabels;

interface CensusCoordinatesResponse {
	result?: {
		geographies?: {
			Counties?: Array<{
				COUNTY?: string;
				NAME?: string;
			}>;
			States?: Array<{
				NAME?: string;
				STUSAB?: string;
			}>;
		};
	};
}

export interface ZipLocationMatch {
	countyFips?: string;
	countyName?: string;
	latitude?: number;
	longitude?: number;
	locality?: string;
	postalCode: string;
	sourceSystem: string;
	stateAbbreviation?: string;
	stateName?: string;
}

export interface ZipLocationService {
	lookupZip: (zipCode: string) => Promise<ZipLocationMatch | null>;
}

interface ZipLocationServiceOptions {
	benchmark?: string;
	fetchImpl?: typeof fetch;
	vintage?: string;
}

const defaultBenchmark = "Public_AR_Current";
const defaultVintage = "Current_Current";
const zippopotamUrl = "https://api.zippopotam.us/us";
const censusCoordinatesUrl = "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";

function toNumber(value: string | undefined) {
	if (!value)
		return undefined;

	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

async function lookupCountyByCoordinates(
	fetchImpl: typeof fetch,
	latitude: number | undefined,
	longitude: number | undefined,
	benchmark: string,
	vintage: string
) {
	if (latitude === undefined || longitude === undefined)
		return null;

	const requestUrl = new URL(censusCoordinatesUrl);
	requestUrl.searchParams.set("x", String(longitude));
	requestUrl.searchParams.set("y", String(latitude));
	requestUrl.searchParams.set("benchmark", benchmark);
	requestUrl.searchParams.set("vintage", vintage);
	requestUrl.searchParams.set("format", "json");

	const response = await fetchImpl(requestUrl, {
		headers: {
			Accept: "application/json"
		}
	});

	if (!response.ok)
		throw new Error(`Census reverse-geography lookup failed: ${response.status} ${response.statusText}`);

	const payload = await response.json() as CensusCoordinatesResponse;
	const county = payload.result?.geographies?.Counties?.[0];
	const state = payload.result?.geographies?.States?.[0];

	return {
		countyFips: county?.COUNTY,
		countyName: county?.NAME,
		stateAbbreviation: state?.STUSAB,
		stateName: state?.NAME
	};
}

export function createZipLocationService({
	benchmark = process.env.CENSUS_GEOCODER_BENCHMARK?.trim() || defaultBenchmark,
	fetchImpl = fetch,
	vintage = process.env.CENSUS_GEOCODER_VINTAGE?.trim() || defaultVintage
}: ZipLocationServiceOptions = {}): ZipLocationService {
	return {
		async lookupZip(zipCode: string) {
			const response = await fetchImpl(`${zippopotamUrl}/${encodeURIComponent(zipCode)}`, {
				headers: {
					Accept: "application/json"
				}
			});

			if (response.status === 404)
				return null;

			if (!response.ok)
				throw new Error(`ZIP lookup failed: ${response.status} ${response.statusText}`);

			const payload = await response.json() as ZipLocationApiResponse;
			const place = payload.places?.[0];

			if (!payload["post code"] || !place)
				return null;

			const latitude = toNumber(place.latitude);
			const longitude = toNumber(place.longitude);
			const reverseGeo = await lookupCountyByCoordinates(fetchImpl, latitude, longitude, benchmark, vintage)
				.catch(() => null);

			return {
				countyFips: reverseGeo?.countyFips,
				countyName: reverseGeo?.countyName,
				latitude,
				longitude,
				locality: place["place name"]?.trim(),
				postalCode: payload["post code"],
				sourceSystem: "Zippopotam.us + U.S. Census Geocoder",
				stateAbbreviation: reverseGeo?.stateAbbreviation || place["state abbreviation"]?.trim(),
				stateName: reverseGeo?.stateName || place.state?.trim()
			};
		}
	};
}
