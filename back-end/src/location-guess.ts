import type { Request } from "express";
import type { LocationGuessCapability, LocationGuessMode } from "./types/civic.js";
import process from "node:process";

export interface LocationGuessInput {
	city?: string;
	country?: string;
	postalCode?: string;
	region?: string;
	rawQuery: string;
}

interface ProxyHeaderConfig {
	cityHeaders: string[];
	countryHeaders: string[];
	postalCodeHeaders: string[];
	regionHeaders: string[];
}

export interface LocationGuessServiceOptions {
	mode?: LocationGuessMode | null;
	proxyHeaders?: Partial<ProxyHeaderConfig>;
}

export interface LocationGuessService {
	buildGuess: (request: Request) => LocationGuessInput | null;
	publicConfig: LocationGuessCapability;
	varyHeaders: string[];
}

function normalizeMode(value?: string | null): LocationGuessMode {
	const normalized = (value || "").trim();

	switch (normalized) {
		case "browser_geolocation":
		case "geoip_provider":
		case "proxy_headers":
			return normalized as LocationGuessMode;
		default:
			return "disabled";
	}
}

function parseHeaderList(value?: string | null) {
	return (value || "")
		.split(",")
		.map(item => item.trim())
		.filter(Boolean);
}

function readHeaderList(
	envPlural: string,
	envSingular: string,
	override?: string[]
) {
	if (override)
		return override.map(item => item.trim()).filter(Boolean);

	const envValue = process.env[envPlural] ?? process.env[envSingular];

	return parseHeaderList(envValue);
}

function readRequestHeader(request: Request, names: string[]) {
	for (const name of names) {
		const value = request.header(name)?.trim();

		if (value)
			return value;
	}

	return undefined;
}

function buildProxyHeaderGuess(request: Request, proxyHeaders: ProxyHeaderConfig) {
	const country = readRequestHeader(request, proxyHeaders.countryHeaders);
	const postalCode = readRequestHeader(request, proxyHeaders.postalCodeHeaders);
	const city = readRequestHeader(request, proxyHeaders.cityHeaders);
	const region = readRequestHeader(request, proxyHeaders.regionHeaders);

	if (country && country.toUpperCase() !== "US")
		return null;

	if (postalCode) {
		return {
			city,
			country,
			postalCode,
			rawQuery: postalCode,
			region
		} satisfies LocationGuessInput;
	}

	if (city && region) {
		return {
			city,
			country,
			rawQuery: `${city}, ${region}`,
			region
		} satisfies LocationGuessInput;
	}

	return null;
}

export function buildLocationGuessNotePrefix(guess: LocationGuessInput) {
	if (guess.postalCode && guess.city && guess.region)
		return `Ballot Clarity made a best-effort location guess from your IP address and started with ZIP code ${guess.postalCode} near ${guess.city}, ${guess.region}.`;

	if (guess.postalCode)
		return `Ballot Clarity made a best-effort location guess from your IP address and started with ZIP code ${guess.postalCode}.`;

	if (guess.city && guess.region)
		return `Ballot Clarity made a best-effort location guess from your IP address and started with ${guess.city}, ${guess.region}.`;

	return "Ballot Clarity made a best-effort location guess from your IP address.";
}

export function createLocationGuessService(
	options: LocationGuessServiceOptions = {}
): LocationGuessService {
	const mode = normalizeMode(options.mode ?? process.env.LOCATION_GUESS_MODE);
	const proxyHeaders: ProxyHeaderConfig = {
		cityHeaders: readHeaderList(
			"LOCATION_GUESS_PROXY_CITY_HEADERS",
			"LOCATION_GUESS_PROXY_CITY_HEADER",
			options.proxyHeaders?.cityHeaders
		),
		countryHeaders: readHeaderList(
			"LOCATION_GUESS_PROXY_COUNTRY_HEADERS",
			"LOCATION_GUESS_PROXY_COUNTRY_HEADER",
			options.proxyHeaders?.countryHeaders
		),
		postalCodeHeaders: readHeaderList(
			"LOCATION_GUESS_PROXY_POSTAL_CODE_HEADERS",
			"LOCATION_GUESS_PROXY_POSTAL_CODE_HEADER",
			options.proxyHeaders?.postalCodeHeaders
		),
		regionHeaders: readHeaderList(
			"LOCATION_GUESS_PROXY_REGION_HEADERS",
			"LOCATION_GUESS_PROXY_REGION_HEADER",
			options.proxyHeaders?.regionHeaders
		)
	};
	const varyHeaders = Array.from(new Set([
		...proxyHeaders.postalCodeHeaders,
		...proxyHeaders.cityHeaders,
		...proxyHeaders.regionHeaders,
		...proxyHeaders.countryHeaders
	]));
	const canGuessOnLoad = mode === "proxy_headers"
		&& (
			proxyHeaders.postalCodeHeaders.length > 0
			|| (proxyHeaders.cityHeaders.length > 0 && proxyHeaders.regionHeaders.length > 0)
		);

	return {
		buildGuess(request) {
			if (!canGuessOnLoad)
				return null;

			if (mode === "proxy_headers")
				return buildProxyHeaderGuess(request, proxyHeaders);

			return null;
		},
		publicConfig: {
			canGuessOnLoad,
			mode
		},
		varyHeaders
	};
}
