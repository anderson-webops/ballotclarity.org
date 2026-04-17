import type { LocationRepresentativeMatch } from "./types/civic.js";
import process from "node:process";

interface OpenStatesPersonResponse {
	results?: OpenStatesPerson[];
	pagination?: {
		max_page?: number;
		page?: number;
		total_items?: number;
	};
}

interface OpenStatesPerson {
	id?: string;
	name?: string;
	party?: string;
	openstates_url?: string;
	current_role?: {
		title?: string;
		district?: string;
		org_classification?: string;
	};
	jurisdiction?: {
		name?: string;
	};
}

export interface OpenStatesRepresentativeRecord {
	id: string;
	name: string;
	party?: string;
	districtLabel: string;
	jurisdictionName?: string;
	officeTitle: string;
	openstatesUrl?: string;
}

export interface OpenStatesClient {
	listPeopleByJurisdiction: (jurisdiction: string, options?: { perPage?: number }) => Promise<OpenStatesRepresentativeRecord[]>;
	lookupPeopleByCoordinates: (latitude: number, longitude: number) => Promise<LocationRepresentativeMatch[]>;
}

interface OpenStatesClientOptions {
	apiKey?: string;
	fetchImpl?: typeof fetch;
}

function mapRepresentative(person: OpenStatesPerson): OpenStatesRepresentativeRecord {
	const officeTitle = person.current_role?.title?.trim()
		|| (person.current_role?.org_classification === "upper" ? "Senator" : "Representative");
	const district = person.current_role?.district?.trim() || "Unknown district";
	const jurisdictionName = person.jurisdiction?.name?.trim();

	return {
		districtLabel: jurisdictionName && district === jurisdictionName ? district : `${officeTitle} ${district}`,
		id: person.id?.trim() || `${officeTitle}:${person.name?.trim() || "unknown"}`,
		jurisdictionName,
		name: person.name?.trim() || "Unknown representative",
		officeTitle,
		openstatesUrl: person.openstates_url?.trim() || undefined,
		party: person.party?.trim() || undefined
	};
}

function toLocationRepresentative(person: OpenStatesRepresentativeRecord): LocationRepresentativeMatch {
	return {
		districtLabel: person.districtLabel,
		id: person.id,
		name: person.name,
		officeTitle: person.officeTitle,
		openstatesUrl: person.openstatesUrl,
		party: person.party,
		sourceSystem: "Open States"
	};
}

export function createOpenStatesClient({
	apiKey = process.env.OPENSTATES_API_KEY?.trim(),
	fetchImpl = fetch
}: OpenStatesClientOptions = {}): OpenStatesClient | null {
	const resolvedApiKey = apiKey?.trim();

	if (!resolvedApiKey)
		return null;

	const apiKeyValue = resolvedApiKey;

	async function fetchOpenStates(pathname: string, query: Record<string, string>) {
		const requestUrl = new URL(pathname, "https://v3.openstates.org");

		requestUrl.searchParams.set("apikey", apiKeyValue);

		for (const [key, value] of Object.entries(query))
			requestUrl.searchParams.set(key, value);

		const response = await fetchImpl(requestUrl, {
			headers: {
				Accept: "application/json"
			}
		});

		if (!response.ok) {
			const detail = await response.text();

			throw new Error(`Open States lookup failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`.slice(0, 500));
		}

		return await response.json() as OpenStatesPersonResponse;
	}

	return {
		async lookupPeopleByCoordinates(latitude: number, longitude: number) {
			const payload = await fetchOpenStates("/people.geo", {
				lat: String(latitude),
				lng: String(longitude)
			});

			return (payload.results ?? []).map(mapRepresentative).map(toLocationRepresentative);
		},
		async listPeopleByJurisdiction(jurisdiction: string, options = {}) {
			const perPage = Math.min(Math.max(options.perPage ?? 50, 1), 50);
			const firstPage = await fetchOpenStates("/people", {
				jurisdiction,
				page: "1",
				per_page: String(perPage)
			});
			const people = [...(firstPage.results ?? [])];
			const maxPage = Math.min(firstPage.pagination?.max_page ?? 1, 10);

			for (let page = 2; page <= maxPage; page += 1) {
				const payload = await fetchOpenStates("/people", {
					jurisdiction,
					page: String(page),
					per_page: String(perPage)
				});

				people.push(...(payload.results ?? []));
			}

			return people.map(mapRepresentative);
		}
	};
}
