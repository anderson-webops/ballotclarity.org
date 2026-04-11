<script setup lang="ts">
import { storeToRefs } from "pinia";

const civicStore = useCivicStore();
const route = useRoute();
const { compareList } = storeToRefs(civicStore);
const candidateSlug = computed(() => String(route.params.slug));
const { formatCurrency, formatPercent } = useFormatters();
const { data: candidate, error, pending } = await useCandidate(candidateSlug);

watchEffect(() => {
	if (candidate.value) {
		civicStore.setLocation({
			coverageLabel: "Demo coverage: Metro County, Franklin",
			displayName: candidate.value.location,
			slug: "metro-county-franklin",
			state: "Franklin",
		});
	}
});

usePageSeo({
	description: candidate.value?.summary ?? "Review a source-backed candidate profile in the Ballot Clarity demo.",
	path: `/candidate/${candidateSlug.value}`,
	title: candidate.value?.name ?? "Candidate detail",
});

const isCompared = computed(() => candidate.value ? compareList.value.includes(candidate.value.slug) : false);

function toggleCompare() {
	if (candidate.value)
		civicStore.toggleCompare(candidate.value.slug);
}
</script>

<template>
	<section class="app-shell section-gap">
		<div v-if="pending" class="gap-8 grid xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.8fr)]">
			<div class="space-y-6">
				<div class="surface-panel animate-pulse">
					<div class="rounded-full bg-app-line/70 h-6 w-32 dark:bg-app-line-dark" />
					<div class="mt-4 rounded-[1rem] bg-app-line/60 h-14 w-3/4 dark:bg-app-line-dark" />
					<div class="mt-4 rounded-full bg-app-line/60 h-4 w-full dark:bg-app-line-dark" />
					<div class="mt-2 rounded-full bg-app-line/60 h-4 w-2/3 dark:bg-app-line-dark" />
				</div>
				<div v-for="index in 4" :key="index" class="surface-panel bg-white/70 h-48 animate-pulse dark:bg-app-panel-dark/70" />
			</div>
			<div class="surface-panel bg-white/70 h-96 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="error || !candidate" class="max-w-3xl">
			<InfoCallout title="Candidate profile not available" tone="warning">
				This demo candidate page could not be loaded. Return to the ballot overview to choose another profile.
			</InfoCallout>
		</div>

		<div v-else class="gap-8 grid xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,0.85fr)]">
			<div class="space-y-6">
				<header class="surface-panel">
					<div class="flex flex-wrap gap-2 items-center">
						<TrustBadge label="Demo candidate profile" tone="warning" />
						<TrustBadge label="Source-backed" tone="accent" />
					</div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-5 uppercase dark:text-app-muted-dark">
						{{ candidate.location }}
					</p>
					<div class="mt-3 flex flex-wrap gap-3 items-center">
						<h1 class="text-5xl text-app-ink leading-tight font-serif dark:text-app-text-dark">
							{{ candidate.name }}
						</h1>
						<IncumbentBadge v-if="candidate.incumbent" />
					</div>
					<p class="text-lg text-app-muted mt-4 dark:text-app-muted-dark">
						{{ candidate.officeSought }} · {{ candidate.party }}
					</p>
					<p class="text-base text-app-muted leading-8 mt-6 max-w-3xl dark:text-app-muted-dark">
						{{ candidate.summary }}
					</p>
					<div class="mt-6 flex flex-wrap gap-4 items-center">
						<UpdatedAt :value="candidate.updatedAt" />
						<button type="button" class="btn-secondary" @click="toggleCompare">
							<span :class="isCompared ? 'i-carbon-checkmark' : 'i-carbon-compare'" />
							{{ isCompared ? 'Added to compare' : 'Compare candidate' }}
						</button>
						<NuxtLink to="/ballot/2026-metro-county-general" class="btn-primary">
							Back to ballot
						</NuxtLink>
					</div>
				</header>

				<InfoCallout title="Before you rely on this profile">
					Information may be incomplete. Review attached source files and original public records where possible, especially for late campaign activity, independent spending, and unpublished negotiations.
				</InfoCallout>

				<section class="surface-panel">
					<div class="flex gap-4 items-center justify-between">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							Biography and background
						</h2>
						<SourceDrawer :sources="candidate.biography.flatMap(block => block.sources)" :title="`${candidate.name} background sources`" />
					</div>
					<div class="mt-6 space-y-4">
						<article v-for="block in candidate.biography" :key="block.id" class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
									{{ block.title }}
								</h3>
								<SourceDrawer :sources="block.sources" :title="block.title" button-label="Sources" />
							</div>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ block.summary }}
							</p>
						</article>
					</div>
				</section>

				<section class="surface-panel">
					<div class="flex gap-4 items-center justify-between">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							Key votes and actions
						</h2>
						<SourceDrawer :sources="candidate.keyActions.flatMap(action => action.sources)" :title="`${candidate.name} key actions`" />
					</div>
					<div class="mt-6 space-y-4">
						<article v-for="action in candidate.keyActions" :key="action.id" class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<div>
									<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
										{{ action.title }}
									</h3>
									<p class="text-xs text-app-muted tracking-[0.18em] mt-1 uppercase dark:text-app-muted-dark">
										{{ action.date }}
									</p>
								</div>
								<SourceDrawer :sources="action.sources" :title="action.title" button-label="Sources" />
							</div>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ action.summary }}
							</p>
							<p class="text-sm text-app-ink font-medium mt-3 dark:text-app-text-dark">
								{{ action.significance }}
							</p>
						</article>
					</div>
				</section>

				<section class="surface-panel">
					<div class="flex gap-4 items-center justify-between">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							Campaign funding overview
						</h2>
						<SourceDrawer :sources="candidate.funding.sources" title="Campaign funding sources" />
					</div>
					<div class="mt-6 gap-4 grid md:grid-cols-3">
						<div class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Raised
							</p>
							<p class="text-2xl text-app-ink font-semibold mt-2 dark:text-app-text-dark">
								{{ formatCurrency(candidate.funding.totalRaised) }}
							</p>
						</div>
						<div class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Cash on hand
							</p>
							<p class="text-2xl text-app-ink font-semibold mt-2 dark:text-app-text-dark">
								{{ formatCurrency(candidate.funding.cashOnHand) }}
							</p>
						</div>
						<div class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Small donors
							</p>
							<p class="text-2xl text-app-ink font-semibold mt-2 dark:text-app-text-dark">
								{{ formatPercent(candidate.funding.smallDonorShare) }}
							</p>
						</div>
					</div>
					<p class="text-sm text-app-muted leading-7 mt-6 dark:text-app-muted-dark">
						{{ candidate.funding.summary }}
					</p>
					<ul class="mt-5 space-y-3">
						<li v-for="funder in candidate.funding.topFunders" :key="funder.name" class="text-sm px-4 py-3 border border-app-line/80 rounded-2xl bg-white/70 flex gap-4 items-start justify-between dark:border-app-line-dark dark:bg-app-panel-dark/70">
							<div>
								<p class="text-app-ink font-semibold dark:text-app-text-dark">
									{{ funder.name }}
								</p>
								<p class="text-app-muted mt-1 dark:text-app-muted-dark">
									{{ funder.category }}
								</p>
							</div>
							<span class="text-app-ink font-semibold dark:text-app-text-dark">
								{{ formatCurrency(funder.amount) }}
							</span>
						</li>
					</ul>
				</section>

				<section class="surface-panel">
					<div class="flex gap-4 items-center justify-between">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							Lobbying and influence context
						</h2>
						<SourceDrawer :sources="candidate.lobbyingContext.flatMap(block => block.sources)" :title="`${candidate.name} influence context`" />
					</div>
					<div class="mt-6 space-y-4">
						<article v-for="block in candidate.lobbyingContext" :key="block.id" class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
									{{ block.title }}
								</h3>
								<SourceDrawer :sources="block.sources" :title="block.title" button-label="Sources" />
							</div>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ block.summary }}
							</p>
						</article>
					</div>
				</section>

				<section class="surface-panel">
					<div class="flex gap-4 items-center justify-between">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							Public statements and issues
						</h2>
						<SourceDrawer :sources="candidate.publicStatements.flatMap(block => block.sources)" :title="`${candidate.name} public statements`" />
					</div>
					<div class="mt-6 space-y-4">
						<article v-for="statement in candidate.publicStatements" :key="statement.id" class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
									{{ statement.title }}
								</h3>
								<SourceDrawer :sources="statement.sources" :title="statement.title" button-label="Sources" />
							</div>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ statement.summary }}
							</p>
						</article>
					</div>
				</section>

				<section class="surface-panel">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						Constituent-alignment placeholder
					</h2>
					<InfoCallout class="mt-5" title="Experimental feature not yet live" tone="warning">
						{{ candidate.alignmentModule.summary }}
					</InfoCallout>
					<ul class="text-sm text-app-muted leading-7 mt-5 space-y-3 dark:text-app-muted-dark">
						<li v-for="consideration in candidate.alignmentModule.considerations" :key="consideration" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
							{{ consideration }}
						</li>
					</ul>
				</section>

				<section class="gap-6 grid md:grid-cols-2">
					<div class="surface-panel">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							What we know
						</h2>
						<ul class="text-sm text-app-muted leading-7 mt-5 space-y-3 dark:text-app-muted-dark">
							<li v-for="item in candidate.whatWeKnow" :key="item" class="flex gap-3">
								<span class="i-carbon-checkmark text-app-accent mt-1" />
								<span>{{ item }}</span>
							</li>
						</ul>
					</div>
					<div class="surface-panel">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							What we do not know
						</h2>
						<ul class="text-sm text-app-muted leading-7 mt-5 space-y-3 dark:text-app-muted-dark">
							<li v-for="item in candidate.whatWeDoNotKnow" :key="item" class="flex gap-3">
								<span class="i-carbon-warning text-[#8f341f] mt-1" />
								<span>{{ item }}</span>
							</li>
						</ul>
					</div>
				</section>

				<section class="surface-panel">
					<div class="flex gap-4 items-center justify-between">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							Sources and methodology notes
						</h2>
						<SourceDrawer :sources="candidate.sources" :title="`${candidate.name} full source list`" />
					</div>
					<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
						<li v-for="note in candidate.methodologyNotes" :key="note" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
							{{ note }}
						</li>
					</ul>
				</section>
			</div>

			<aside class="xl:self-start xl:top-28 xl:sticky">
				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Source panel
					</p>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						Every summary on this page is drawn from the source set below. This is demo data, so treat it as a model for transparency rather than a real filing archive.
					</p>
					<div class="mt-4">
						<UpdatedAt :value="candidate.updatedAt" />
					</div>
					<div class="mt-6">
						<SourceList :sources="candidate.sources" compact title="Attached sources" />
					</div>
				</div>
			</aside>
		</div>
	</section>
</template>
