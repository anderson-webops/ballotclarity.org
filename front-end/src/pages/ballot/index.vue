<script setup lang="ts">
import type { ElectionsResponse } from "~/types/civic";
import { currentCoverageElectionSlug } from "~/constants";

const api = useApiClient();
const { data } = await useAsyncData<ElectionsResponse>(
	"ballot-index-elections",
	() => api<ElectionsResponse>("/elections")
);
const target = data.value?.elections[0]?.slug ?? currentCoverageElectionSlug;

await navigateTo(`/ballot/${target}`, { replace: true });
</script>

<template>
	<section class="app-shell section-gap">
		<p class="text-sm text-app-muted dark:text-app-muted-dark">
			Loading ballot…
		</p>
	</section>
</template>
