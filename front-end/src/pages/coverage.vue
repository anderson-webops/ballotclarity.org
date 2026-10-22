<script setup lang="ts">
const { formatDate } = useFormatters();
const { data, error, pending } = await useCoverage();
const publicCapabilities = computed(() => (data.value?.supportedContentTypes ?? []).filter(capability => capability.id !== "editorial-ops" && capability.status !== "planned"));
const hasVerifiedContestPackage = computed(() => Boolean(data.value?.guideContent?.verifiedContestPackage));
const coverageIntro = computed(() => hasVerifiedContestPackage.value
	? "Verified local guide published."
	: "Official election links published.");

usePageSeo({
	description: "Guide availability, official election links, and known limits for Ballot Clarity coverage.",
	path: "/coverage",
	title: "Coverage"
});

function capabilityTone(status: "in-build" | "live-now" | "planned") {
	if (status === "live-now")
		return "accent" as const;

	if (status === "in-build")
		return "warning" as const;

	return "neutral" as const;
}

function capabilityLabel(status: "in-build" | "live-now" | "planned") {
	if (status === "live-now")
		return "Live now";

	if (status === "in-build")
		return "In build";

	return "Planned";
}
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<div v-if="pending" class="space-y-6">
			<div class="rounded-lg bg-app-bg h-72 animate-pulse dark:bg-app-bg-dark" />
			<div class="gap-6 grid xl:grid-cols-2">
				<div v-for="index in 4" :key="index" class="rounded-lg bg-app-bg h-56 animate-pulse dark:bg-app-bg-dark" />
			</div>
		</div>

		<div v-else-if="error || !data" class="max-w-3xl">
			<InfoCallout title="Coverage profile unavailable" tone="warning">
				Try again later.
			</InfoCallout>
		</div>

		<div v-else-if="!data.launchTarget" class="max-w-4xl space-y-6">
			<InfoCallout title="No local guide published right now" tone="info">
				Districts, representatives, and official election links are still available.
			</InfoCallout>
			<div class="surface-panel">
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					What you can use now
				</h2>
				<ul class="readable-list text-sm text-app-muted mt-5 pl-5 dark:text-app-muted-dark">
					<li>Lookup, district pages, representative pages, and official election links can still be available.</li>
					<li>Contest, candidate, measure, compare, and ballot-plan pages open only when a local guide is available.</li>
					<li>Official election tools remain the final authority for ballot, deadline, and polling-place confirmation.</li>
				</ul>
				<div class="mt-6 flex flex-wrap gap-3">
					<NuxtLink to="/#location-lookup" class="btn-primary">
						Open location lookup
					</NuxtLink>
					<NuxtLink to="/results" class="btn-secondary">
						Open results
					</NuxtLink>
					<NuxtLink to="/status" class="btn-secondary">
						Open public status
					</NuxtLink>
					<NuxtLink to="/sources" class="btn-secondary">
						Open data sources
					</NuxtLink>
				</div>
			</div>
		</div>

		<div v-else class="space-y-8">
			<header class="gap-6 grid xl:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)]">
				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.06em] font-semibold mt-6 uppercase dark:text-app-muted-dark">
						Election coverage
					</p>
					<h1 class="text-5xl text-app-ink leading-tight font-serif mt-3 dark:text-app-text-dark">
						{{ data.launchTarget.displayName }}
					</h1>
					<p class="bc-prose text-app-muted mt-5 dark:text-app-muted-dark">
						{{ coverageIntro }}
					</p>
					<div class="mt-6 gap-4 grid md:grid-cols-2">
						<div class="content-block">
							<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
								Current election
							</p>
							<p class="text-lg text-app-ink font-semibold mt-3 dark:text-app-text-dark">
								{{ data.launchTarget.currentElectionName }}
							</p>
							<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
								{{ formatDate(data.launchTarget.currentElectionDate) }}
							</p>
						</div>
						<div class="content-block">
							<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
								Next election
							</p>
							<p class="text-lg text-app-ink font-semibold mt-3 dark:text-app-text-dark">
								{{ data.launchTarget.nextElectionName }}
							</p>
							<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
								{{ data.launchTarget.nextElectionDate ? formatDate(data.launchTarget.nextElectionDate) : "Not set" }}
							</p>
						</div>
					</div>
					<div class="mt-6">
						<UpdatedAt :value="data.updatedAt" label="Coverage updated" />
					</div>
				</div>

				<div class="space-y-4">
					<div class="surface-panel">
						<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
							Open next
						</p>
						<div class="mt-4 flex flex-wrap gap-3">
							<NuxtLink :to="`/locations/${data.launchTarget.slug}`" class="btn-primary">
								Open location hub
							</NuxtLink>
							<NuxtLink to="/results" class="btn-secondary">
								Open results
							</NuxtLink>
							<NuxtLink to="/sources" class="btn-secondary">
								Open sources
							</NuxtLink>
						</div>
					</div>
				</div>
			</header>

			<section class="surface-panel">
				<div class="flex flex-wrap gap-4 items-start justify-between">
					<div>
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							Coverage for this area
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							These are the main public layers currently available, plus the limits to verify before relying on the guide.
						</p>
					</div>
					<NuxtLink to="/results" class="btn-secondary">
						Open results
					</NuxtLink>
				</div>
				<div class="mt-6 gap-5 grid xl:grid-cols-2">
					<article v-for="capability in publicCapabilities" :key="capability.id" class="content-block">
						<div class="flex flex-wrap gap-2 items-center">
							<TrustBadge :label="capabilityLabel(capability.status)" :tone="capabilityTone(capability.status)" />
						</div>
						<h3 class="text-2xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
							{{ capability.label }}
						</h3>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							{{ capability.summary }}
						</p>
					</article>
				</div>
				<details class="mt-6 surface-row">
					<summary class="text-sm text-app-ink font-semibold cursor-pointer dark:text-app-text-dark focus-ring">
						Known limits and final checks
					</summary>
					<ul class="mt-5 space-y-4">
						<li v-for="item in data.limitations" :key="item.id" class="content-block">
							<p class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
								{{ item.title }}
							</p>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ item.summary }}
							</p>
						</li>
					</ul>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						Ballot Clarity can organize sources and public records, but official election offices remain the final authority for deadlines, precincts, polling places, and the exact ballot you receive.
					</p>
					<div class="mt-6 flex flex-wrap gap-3">
						<NuxtLink to="/status" class="btn-secondary">
							Open public status
						</NuxtLink>
						<NuxtLink to="/sources" class="btn-secondary">
							Open data sources
						</NuxtLink>
					</div>
				</details>
			</section>
		</div>
	</section>
</template>
