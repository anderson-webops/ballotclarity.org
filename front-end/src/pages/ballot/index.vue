<script setup lang="ts">
import type { ElectionsResponse } from "~/types/civic";

const api = useApiClient();
const { data } = await useAsyncData<ElectionsResponse>(
	"ballot-index-elections",
	() => api<ElectionsResponse>("/elections")
);
const target = data.value?.elections[0]?.slug ?? "2026-metro-county-general";

await navigateTo(`/ballot/${target}`, { replace: true });
</script>

<template>
	<section class="app-shell section-gap">
		<p class="text-sm text-app-muted dark:text-app-muted-dark">
			Loading ballot…
		</p>
	</section>
</template>
