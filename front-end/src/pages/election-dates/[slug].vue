<script setup lang="ts">
import { buildKeyDateTimeline } from "~/utils/election-timeline";

const slug = useRouteStringParam("slug");
const { data, error, pending } = await useBallot(slug);
const { displayTimeZone } = useFormatters();
const clock = useElectionClock();
const entries = computed(() => buildKeyDateTimeline(data.value?.election.keyDates ?? [], new Date(clock.value), displayTimeZone.value));
usePageSeo({ title: "Election dates", path: `/election-dates/${slug.value}` });
</script>

<template>
	<section class="app-shell section-gap max-w-4xl">
		<p v-if="pending" role="status">
			Loading dates…
		</p>
		<p v-else-if="error || !data" role="status">
			Election dates are temporarily unavailable.
		</p>
		<template v-else>
			<NuxtLink :to="`/elections/${data.election.slug}`" class="text-app-accent py-2 underline inline-block focus-ring">
				Election overview
			</NuxtLink>
			<h1 class="text-4xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
				Dates and deadlines
			</h1>
			<p class="text-app-muted mt-3 dark:text-app-muted-dark">
				{{ data.location.displayName }}
			</p>
			<ElectionKeyDates :entries="entries" />
			<UpdatedAt :value="data.election.updatedAt" class="mt-8" />
		</template>
	</section>
</template>
