import type { LocationLookupResponse } from "~/types/civic";

export default defineNuxtPlugin((nuxtApp) => {
	const civicStore = useCivicStore();
	const api = useApiClient();

	civicStore.hydrateFromStorage();

	nuxtApp.hook("app:mounted", () => {
		civicStore.markHydrated();

		const hasManualLookupContext = Boolean(
			civicStore.selectedLocation
			|| (civicStore.nationwideLookupResult && !civicStore.nationwideLookupResult.detectedFromIp)
			|| (civicStore.lookupContext && !civicStore.nationwideLookupResult)
		);

		if (hasManualLookupContext)
			return;

		void api<LocationLookupResponse>("/location/guess")
			.then((response) => {
				if (response.result !== "resolved")
					return;

				civicStore.setLookupResponse(response, null);
			})
			.catch(() => {});
	});
});
