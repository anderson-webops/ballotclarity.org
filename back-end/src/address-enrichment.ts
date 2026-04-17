import type { AddressCacheRepository } from "./address-cache-repository.js";
import type { CensusAddressLookupResult, CensusGeocoderClient } from "./census-geocoder.js";
import type { OpenStatesClient } from "./openstates.js";
import type { LocationRepresentativeMatch } from "./types/civic.js";

export interface AddressEnrichmentResult extends CensusAddressLookupResult {
	fromCache: boolean;
	representativeMatches: LocationRepresentativeMatch[];
}

export interface AddressEnrichmentService {
	lookupAddress: (address: string) => Promise<AddressEnrichmentResult | null>;
}

function sortRepresentatives(matches: LocationRepresentativeMatch[]) {
	const rank = new Map<string, number>([
		["senator", 1],
		["representative", 2]
	]);

	return [...matches].sort((left, right) => {
		const leftRank = rank.get(left.officeTitle.toLowerCase()) ?? 10;
		const rightRank = rank.get(right.officeTitle.toLowerCase()) ?? 10;

		return leftRank - rightRank
			|| left.districtLabel.localeCompare(right.districtLabel)
			|| left.name.localeCompare(right.name);
	});
}

async function resolveRepresentativeMatches(
	openStatesClient: OpenStatesClient | null,
	lookup: CensusAddressLookupResult
) {
	if (!openStatesClient || lookup.latitude === undefined || lookup.longitude === undefined)
		return [];

	return sortRepresentatives(await openStatesClient.lookupPeopleByCoordinates(lookup.latitude, lookup.longitude));
}

export function createAddressEnrichmentService(
	censusGeocoderClient: CensusGeocoderClient,
	openStatesClient: OpenStatesClient | null,
	addressCacheRepository: AddressCacheRepository
): AddressEnrichmentService {
	return {
		async lookupAddress(address: string) {
			const cached = await addressCacheRepository.getByInput(address);

			if (cached) {
				return {
					...cached,
					fromCache: true,
					representativeMatches: await resolveRepresentativeMatches(openStatesClient, cached)
				};
			}

			const lookup = await censusGeocoderClient.lookupAddress(address);

			if (!lookup)
				return null;

			await addressCacheRepository.save(address, lookup);

			return {
				...lookup,
				fromCache: false,
				representativeMatches: await resolveRepresentativeMatches(openStatesClient, lookup)
			};
		}
	};
}
