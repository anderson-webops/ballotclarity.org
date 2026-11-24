import { useRequestHeaders, useRuntimeConfig } from "#app";
import { $fetch } from "#build/fetch";

export function useApiClient() {
	const config = useRuntimeConfig();

	return $fetch.create({
		baseURL: config.public.apiBase,
		credentials: "include",
		headers: import.meta.server
			? useRequestHeaders(["cookie"])
			: undefined,
		timeout: config.public.apiFetchTimeoutMs
	});
}
