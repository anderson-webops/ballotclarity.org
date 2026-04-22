<script setup lang="ts">
import type { ElectionsResponse } from "~/types/civic";
import { storeToRefs } from "pinia";
import { nationwideResultsPath } from "~/utils/nationwide-results";

const api = useApiClient();
const civicStore = useCivicStore();
const { selectedElection } = storeToRefs(civicStore);
const { allowsGuideEntryPoints, hasGuideShellContext, hasNationwideResultContext } = useGuideEntryGate();
const { data } = await useAsyncData<ElectionsResponse>(
	"ballot-index-elections",
	() => api<ElectionsResponse>("/elections")
);
const target = data.value?.elections[0]?.slug ?? null;
const electionOverviewTarget = selectedElection.value?.slug
	? `/elections/${selectedElection.value.slug}`
	: target
		? `/elections/${target}`
		: "/coverage";

await navigateTo(
	allowsGuideEntryPoints.value && target
		? `/ballot/${target}`
		: hasGuideShellContext.value
			? electionOverviewTarget
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
