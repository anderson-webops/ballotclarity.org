<script setup lang="ts">
import type { ElectionsResponse } from "~/types/civic";
import { nationwideResultsPath } from "~/utils/nationwide-results";

const api = useApiClient();
const { allowsGuideEntryPoints, hasNationwideResultContext } = useGuideEntryGate();
const { data } = await useAsyncData<ElectionsResponse>(
	"ballot-index-elections",
	() => api<ElectionsResponse>("/elections")
);
const target = data.value?.elections[0]?.slug ?? null;

await navigateTo(
	allowsGuideEntryPoints.value && target
		? `/ballot/${target}`
		: hasNationwideResultContext.value
			? nationwideResultsPath
			: "/#location-lookup",
	{ replace: true }
);
</script>

<template>
	<section class="app-shell section-gap">
		<p class="text-sm text-app-muted dark:text-app-muted-dark">
			Loading ballot…
		</p>
	</section>
</template>
