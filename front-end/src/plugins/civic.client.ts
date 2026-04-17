export default defineNuxtPlugin((nuxtApp) => {
	const civicStore = useCivicStore();

	civicStore.hydrateFromStorage();

	nuxtApp.hook("app:mounted", () => {
		civicStore.markHydrated();
	});
});
