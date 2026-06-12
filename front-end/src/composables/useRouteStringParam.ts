export function useRouteStringParam(key: string) {
	const route = useRoute();

	return computed(() => {
		const value = (route.params as Record<string, unknown>)[key];

		if (Array.isArray(value))
			return typeof value[0] === "string" ? value[0] : "";

		return typeof value === "string" ? value : "";
	});
}
