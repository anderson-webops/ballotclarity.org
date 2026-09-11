import type { CoverageResponse, LocationLookupResponse } from "~/types/civic";
import { canGuessLocationOnLoad } from "~/utils/location-guess";

export default defineNuxtPlugin((nuxtApp) => {
	const civicStore = useCivicStore();
	const api = useApiClient();
	const coverageState = useNuxtData<CoverageResponse | null>("coverage-profile");
	let hasHydrated = false;

	nuxtApp.hook("page:finish", () => {
		if (hasHydrated)
			return;

		hasHydrated = true;
		civicStore.hydrateFromStorage();
		civicStore.markHydrated();

		const hasManualLookupContext = Boolean(
			civicStore.lookupRevision > 0
			|| civicStore.selectedLocation
			|| (civicStore.nationwideLookupResult && !civicStore.nationwideLookupResult.detectedFromIp)
			|| (civicStore.lookupContext && !civicStore.nationwideLookupResult)
		);

		if (hasManualLookupContext)
			return;
		const lookupRevision = civicStore.lookupRevision;
		const guessRequest = new AbortController();
		const stopWatching = watch(() => civicStore.lookupRevision, () => guessRequest.abort(), { flush: "sync" });

		void (coverageState.data.value
			? Promise.resolve(coverageState.data.value)
			: api<CoverageResponse>("/coverage", { signal: guessRequest.signal })
					.then((coverage) => {
						coverageState.data.value = coverage;
						return coverage;
					}))
			.then((coverage) => {
				if (civicStore.lookupRevision !== lookupRevision || !canGuessLocationOnLoad(coverage?.locationGuess ?? null))
					return null;

				return api<LocationLookupResponse>("/location/guess", { signal: guessRequest.signal });
			})
			.then((response) => {
				if (!response || response.result !== "resolved" || civicStore.lookupRevision !== lookupRevision)
					return;

				civicStore.setLookupResponse(response, null);
			})
			.catch(() => {})
			.finally(stopWatching);
	});
});
