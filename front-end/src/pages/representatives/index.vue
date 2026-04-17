<script setup lang="ts">
const { formatDateTime } = useFormatters();
const { data, error, pending } = await useRepresentatives();

const summaryItems = computed(() => {
	if (!data.value)
		return [];

	return [
		{ label: "Current representatives", note: "Incumbents on the active ballot surfaces.", value: data.value.representatives.length },
		{ label: "District pages", note: "Office-area hubs with candidate fields.", value: data.value.districts.length, href: "/districts" },
		{ label: "Updated", note: "Directory freshness.", value: formatDateTime(data.value.updatedAt) }
	];
});

usePageSeo({
	description: "Directory of current representatives on the active Ballot Clarity ballot coverage, with links to district, funding, and influence pages.",
	path: "/representatives",
	title: "Representatives"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="gap-6 grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
			<div class="surface-panel">
				<div class="flex flex-wrap gap-2">
					<VerificationBadge label="Representative directory" tone="accent" />
					<VerificationBadge label="Incumbents only" />
				</div>
				<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
					Representatives
				</h1>
				<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
					This directory pulls out the currently serving officials who also appear on the active ballot coverage, so you can jump straight into their district, funding, and influence pages.
				</p>
			</div>

			<div class="surface-panel">
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					Use this page for
				</h2>
				<ul class="readable-list text-sm text-app-muted mt-5 pl-5 dark:text-app-muted-dark">
					<li>Finding the incumbent tied to a district page</li>
					<li>Opening campaign-finance context directly</li>
					<li>Opening influence and lobbying context directly</li>
				</ul>
				<div class="mt-6">
					<NuxtLink to="/districts" class="btn-secondary">
						Open district hub
					</NuxtLink>
				</div>
			</div>
		</header>

		<div v-if="pending" class="gap-6 grid lg:grid-cols-2">
			<div v-for="index in 3" :key="index" class="surface-panel bg-white/70 h-72 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="error || !data" class="max-w-3xl">
			<InfoCallout title="Representative directory unavailable" tone="warning">
				The representative directory could not be loaded. Open a district or contest page and try again.
			</InfoCallout>
		</div>

		<div v-else class="space-y-6">
			<PageSummaryStrip :items="summaryItems" />

			<section class="gap-6 grid lg:grid-cols-2">
				<article
					v-for="representative in data.representatives"
					:key="representative.slug"
					class="surface-panel"
				>
					<div class="flex flex-wrap gap-3 items-center">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							{{ representative.name }}
						</h2>
						<IncumbentBadge />
					</div>
					<p class="text-sm text-app-muted mt-4 dark:text-app-muted-dark">
						{{ representative.party }} · {{ representative.officeSought }}
					</p>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						{{ representative.summary }}
					</p>
					<div class="mt-5 flex flex-wrap gap-2">
						<VerificationBadge :label="representative.districtLabel" />
						<VerificationBadge :label="`${representative.sourceCount} sources`" tone="accent" />
					</div>
					<div class="mt-6 flex flex-wrap gap-3">
						<NuxtLink :to="`/districts/${representative.districtSlug}`" class="btn-secondary">
							District page
						</NuxtLink>
						<NuxtLink :to="representative.href" class="btn-secondary">
							Profile
						</NuxtLink>
						<NuxtLink :to="`${representative.href}/funding`" class="btn-primary">
							Funding
						</NuxtLink>
						<NuxtLink :to="`${representative.href}/influence`" class="btn-secondary">
							Influence
						</NuxtLink>
					</div>
				</article>
			</section>
		</div>
	</section>
</template>
