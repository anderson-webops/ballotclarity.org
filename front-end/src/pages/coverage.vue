<script setup lang="ts">
const { formatDate } = useFormatters();
const { data, error, pending } = await useCoverage();

usePageSeo({
	description: "Public launch profile for Ballot Clarity, including the starting jurisdiction, coverage limits, official verification links, and rollout priorities.",
	path: "/coverage",
	title: "Coverage and Launch Profile"
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
			<div class="surface-panel bg-white/70 h-72 animate-pulse dark:bg-app-panel-dark/70" />
			<div class="gap-6 grid xl:grid-cols-2">
				<div v-for="index in 4" :key="index" class="surface-panel bg-white/70 h-56 animate-pulse dark:bg-app-panel-dark/70" />
			</div>
		</div>

		<div v-else-if="error || !data" class="max-w-3xl">
			<InfoCallout title="Coverage profile unavailable" tone="warning">
				The public coverage profile could not be loaded. Refresh the page or return to the home page and try again.
			</InfoCallout>
		</div>

		<div v-else-if="!data.launchTarget" class="max-w-4xl space-y-6">
			<InfoCallout title="No published local coverage profile" tone="info">
				{{ data.currentState }} {{ data.scopeNote }}
			</InfoCallout>
			<div class="surface-panel">
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					What this means
				</h2>
				<ul class="readable-list text-sm text-app-muted mt-5 pl-5 dark:text-app-muted-dark">
					<li>No published local guide snapshot is active in this environment.</li>
					<li>Nationwide civic lookup is still available and remains the main success path: district matches, representative records, and official election tools are shown here when providers can resolve them.</li>
					<li>Guide-dependent features (local guide, candidate detail flows, measure pages, and plan) stay unavailable until a published local guide snapshot is active for the location.</li>
				</ul>
				<div class="mt-6 flex flex-wrap gap-3">
					<NuxtLink to="/#location-lookup" class="btn-primary">
						Open location lookup
					</NuxtLink>
					<NuxtLink to="/results" class="btn-secondary">
						Open nationwide results
					</NuxtLink>
					<NuxtLink to="/status" class="btn-secondary">
						Open public status
					</NuxtLink>
					<NuxtLink to="/data-sources" class="btn-secondary">
						Open data sources
					</NuxtLink>
				</div>
			</div>
		</div>

		<div v-else class="space-y-8">
			<header class="gap-6 grid xl:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)]">
				<div class="surface-panel">
					<div class="flex flex-wrap gap-2">
						<TrustBadge :label="data.launchTarget.phaseLabel" tone="accent" />
						<TrustBadge label="Postgres-backed ops" />
						<TrustBadge label="Official verification first" tone="warning" />
					</div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-6 uppercase dark:text-app-muted-dark">
						Current launch target
					</p>
					<h1 class="text-5xl text-app-ink leading-tight font-serif mt-3 dark:text-app-text-dark">
						{{ data.launchTarget.displayName }}
					</h1>
					<p class="bc-prose text-app-muted mt-5 dark:text-app-muted-dark">
						{{ data.launchTarget.summary }}
					</p>
					<div class="mt-6 gap-4 grid md:grid-cols-2">
						<div class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Current election target
							</p>
							<p class="text-lg text-app-ink font-semibold mt-3 dark:text-app-text-dark">
								{{ data.launchTarget.currentElectionName }}
							</p>
							<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
								{{ formatDate(data.launchTarget.currentElectionDate) }}
							</p>
						</div>
						<div class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Next election target
							</p>
							<p class="text-lg text-app-ink font-semibold mt-3 dark:text-app-text-dark">
								{{ data.launchTarget.nextElectionName }}
							</p>
							<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
								{{ data.launchTarget.nextElectionDate ? formatDate(data.launchTarget.nextElectionDate) : "Not set" }}
							</p>
						</div>
					</div>
					<div class="mt-6 flex flex-wrap gap-3">
						<UpdatedAt :value="data.updatedAt" label="Coverage profile updated" />
						<TrustBadge :label="data.coverageMode === 'snapshot' ? 'Imported snapshot active' : 'No local snapshot active'" :tone="data.coverageMode === 'snapshot' ? 'accent' : 'warning'" />
					</div>
				</div>

				<div class="space-y-4">
					<InfoCallout title="Current state" tone="warning">
						{{ data.currentState }}
					</InfoCallout>
					<div class="surface-panel">
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Scope note
						</p>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							{{ data.scopeNote }}
						</p>
						<div class="mt-6 flex flex-wrap gap-3">
							<NuxtLink to="/status" class="btn-secondary">
								Open public status
							</NuxtLink>
							<NuxtLink to="/data-sources" class="btn-secondary">
								Open data roadmap
							</NuxtLink>
						</div>
					</div>
				</div>
			</header>

			<section class="gap-6 grid xl:grid-cols-2">
				<div class="surface-panel">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						Official launch systems
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						These are the official systems Ballot Clarity should point to and verify against for the current published local target.
					</p>
					<div class="mt-6">
						<OfficialResourceList :resources="data.launchTarget.officialResources" />
					</div>
				</div>

				<div class="surface-panel">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						Reference providers and docs
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						These links are the chosen provider and documentation layer for launch engineering, data normalization, and production operations.
					</p>
					<ul class="mt-6 space-y-4">
						<li v-for="link in data.launchTarget.referenceLinks" :key="link.url" class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<a :href="link.url" target="_blank" rel="noreferrer" class="text-base text-app-ink font-semibold rounded-lg inline-flex gap-2 items-center dark:text-app-text-dark hover:text-app-accent focus-ring dark:hover:text-white">
								<span class="i-carbon-launch" />
								<span>{{ link.label }}</span>
							</a>
							<p v-if="link.note" class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ link.note }}
							</p>
						</li>
					</ul>
				</div>
			</section>

			<section class="surface-panel">
				<div class="flex flex-wrap gap-4 items-start justify-between">
					<div>
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							Product capabilities
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							This is the honest line between what is already live in the product and what still needs verified local integration work.
						</p>
					</div>
					<NuxtLink to="/corrections" class="btn-secondary">
						Open corrections log
					</NuxtLink>
				</div>
				<div class="mt-6 gap-5 grid xl:grid-cols-2">
					<article v-for="capability in data.supportedContentTypes" :key="capability.id" class="px-5 py-5 border border-app-line/70 rounded-3xl bg-white/80 dark:border-app-line-dark dark:bg-app-panel-dark/70">
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
			</section>

			<section class="gap-6 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<div class="surface-panel">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						Current limitations
					</h2>
					<ul class="mt-6 space-y-4">
						<li v-for="item in data.limitations" :key="item.id" class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
								{{ item.title }}
							</p>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ item.summary }}
							</p>
						</li>
					</ul>
				</div>

				<div class="space-y-6">
					<div class="surface-panel">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							Next implementation steps
						</h2>
						<ul class="readable-list text-sm text-app-muted mt-6 pl-5 dark:text-app-muted-dark">
							<li v-for="step in data.nextSteps" :key="step">
								{{ step }}
							</li>
						</ul>
					</div>

					<div class="surface-panel">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							Public collections
						</h2>
						<div class="mt-6 space-y-4">
							<NuxtLink
								v-for="collection in data.collections"
								:key="collection.id"
								:to="collection.href"
								class="px-5 py-5 border border-app-line/70 rounded-3xl bg-white/80 block transition dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark/70 focus-ring"
							>
								<div class="flex flex-wrap gap-2 items-center">
									<TrustBadge :label="collection.status === 'canonical' ? 'Canonical page' : 'Reference collection'" :tone="collection.status === 'canonical' ? 'accent' : 'warning'" />
								</div>
								<p class="text-xl text-app-ink font-semibold mt-4 dark:text-app-text-dark">
									{{ collection.label }}
								</p>
								<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
									{{ collection.summary }}
								</p>
							</NuxtLink>
						</div>
					</div>
				</div>
			</section>
		</div>
	</section>
</template>
