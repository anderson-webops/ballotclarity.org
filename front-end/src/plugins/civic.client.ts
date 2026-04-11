export default defineNuxtPlugin(() => {
	const civicStore = useCivicStore();

	civicStore.hydrateFromStorage();
});
