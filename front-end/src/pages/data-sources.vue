<script setup lang="ts">
const { data, error, pending } = await useDataSources();

usePageSeo({
	description: "How Ballot Clarity uses official sources, public-interest providers, and supporting data systems across the site.",
	path: "/data-sources",
	title: "Data Sources"
});

function statusLabel(status: "planned-live" | "reference-pattern" | "research-layer") {
	if (status === "planned-live")
		return "Planned live source";

	if (status === "research-layer")
		return "Research layer";

	return "Reference pattern";
}

function statusTone(status: "planned-live" | "reference-pattern" | "research-layer") {
	if (status === "planned-live")
		return "accent" as const;

	if (status === "research-layer")
		return "neutral" as const;

	return "warning" as const;
}

function providerStatusLabel(status: "active" | "needs_endpoint" | "needs_key" | "needs_partner_access") {
	if (status === "active")
		return "Connected";

	if (status === "needs_endpoint")
		return "Needs endpoint";

	if (status === "needs_partner_access")
		return "Needs partner access";

	return "Needs API key";
}

function providerStatusTone(status: "active" | "needs_endpoint" | "needs_key" | "needs_partner_access") {
	return status === "active" ? "accent" as const : "warning" as const;
}
</script>

<template>
	<section class="app-shell section-gap">
		<div v-if="pending" class="space-y-6">
			<div class="surface-panel bg-white/70 h-72 animate-pulse dark:bg-app-panel-dark/70" />
			<div class="gap-6 grid lg:grid-cols-2">
				<div v-for="index in 4" :key="index" class="surface-panel bg-white/70 h-64 animate-pulse dark:bg-app-panel-dark/70" />
			</div>
		</div>

		<div v-else-if="error || !data" class="max-w-3xl">
			<InfoCallout title="Data sources unavailable" tone="warning">
				The data-sources page could not be loaded. Refresh the page or return to the methodology page and try again.
			</InfoCallout>
		</div>

		<div v-else-if="!data.launchTarget && !data.categories.length && !data.roadmap.length" class="max-w-4xl space-y-6">
			<InfoCallout title="No local source plan published" tone="info">
				No local source plan is published in this environment. Ballot Clarity should still keep lookup results and official election links available.
			</InfoCallout>
			<div class="flex flex-wrap gap-3">
				<NuxtLink to="/coverage" class="btn-primary">
					Open coverage profile
				</NuxtLink>
				<NuxtLink to="/#location-lookup" class="btn-secondary">
					Open location lookup
				</NuxtLink>
			</div>
		</div>

		<div v-else class="reading-page space-y-8">
			<header class="gap-8 grid xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.85fr)]">
				<div class="surface-panel">
					<div class="flex flex-wrap gap-2">
						<TrustBadge label="Official sources first" tone="accent" />
						<TrustBadge label="Providers when needed" />
						<TrustBadge label="Limits stated" tone="warning" />
					</div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-6 uppercase dark:text-app-muted-dark">
						Data sources
					</p>
					<h1 class="text-5xl text-app-ink leading-tight font-serif mt-3 dark:text-app-text-dark">
						Data sources
					</h1>
					<p class="bc-prose text-app-muted mt-5 dark:text-app-muted-dark">
						This page explains which source systems Ballot Clarity uses, what each one is good for, and where the limits are.
					</p>
					<div class="mt-6 flex flex-wrap gap-4 items-center">
						<UpdatedAt :value="data.updatedAt" label="Updated" />
						<NuxtLink to="/methodology" class="btn-secondary">
							Read methodology
						</NuxtLink>
					</div>
				</div>

				<div class="surface-panel">
					<details>
						<summary class="text-sm text-app-ink font-semibold cursor-pointer dark:text-app-text-dark focus-ring">
							Core source rules
						</summary>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							This page is here so readers can see the source hierarchy behind the public guide.
						</p>
						<ul class="readable-list text-sm text-app-muted mt-5 pl-5 dark:text-app-muted-dark">
							<li v-for="principle in data.principles" :key="principle">
								{{ principle }}
							</li>
						</ul>
					</details>
				</div>
			</header>

			<section v-if="data.ballotContentProviders?.length" class="surface-panel">
				<div class="flex flex-wrap gap-4 items-start justify-between">
					<div>
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Ballot-content data providers
						</p>
						<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							Provider ballot data is useful, but still not the final ballot.
						</h2>
					</div>
					<TrustBadge label="Review before publish" tone="warning" />
				</div>
				<p class="bc-prose text-app-muted mt-5 dark:text-app-muted-dark">
					These are the national ballot-content APIs Ballot Clarity can use or prepare for. Connected provider records can help populate ballot previews, but a local guide is not considered verified until official state or county ballot tools and the review workflow confirm it.
				</p>
				<div class="mt-6 gap-4 grid lg:grid-cols-2">
					<article
						v-for="provider in data.ballotContentProviders"
						:key="provider.id"
						class="surface-row"
					>
						<div class="flex flex-wrap gap-2 items-center">
							<SourceAuthorityBadge :authority="provider.authority" />
							<TrustBadge :label="providerStatusLabel(provider.connectionStatus)" :tone="providerStatusTone(provider.connectionStatus)" />
						</div>
						<h3 class="text-2xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
							{{ provider.label }}
						</h3>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							{{ provider.bestUse }}
						</p>
						<details class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
							<summary class="text-app-ink font-semibold cursor-pointer dark:text-app-text-dark focus-ring">
								Capabilities and limits
							</summary>
							<div class="mt-4 gap-4 grid md:grid-cols-2">
								<div>
									<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
										Capabilities
									</p>
									<ul class="readable-list text-sm text-app-muted mt-3 pl-5 dark:text-app-muted-dark">
										<li v-for="capability in provider.capabilities.slice(0, 4)" :key="capability">
											{{ capability }}
										</li>
									</ul>
								</div>
								<div>
									<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
										Limits
									</p>
									<ul class="readable-list text-sm text-app-muted mt-3 pl-5 dark:text-app-muted-dark">
										<li v-for="limitation in provider.limitations.slice(0, 3)" :key="limitation">
											{{ limitation }}
										</li>
									</ul>
								</div>
							</div>
						</details>
						<details class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							<summary class="text-app-ink font-semibold cursor-pointer dark:text-app-text-dark focus-ring">
								For operators: access and configuration
							</summary>
							<p class="mt-3">
								Environment placeholders: <span class="text-app-ink font-semibold dark:text-app-text-dark">{{ provider.envVars.join(', ') }}</span>
							</p>
							<div class="mt-4 flex flex-wrap gap-3">
								<a :href="provider.setupUrl" target="_blank" rel="noreferrer" class="btn-secondary">
									Get access
								</a>
								<a v-if="provider.docsUrl" :href="provider.docsUrl" target="_blank" rel="noreferrer" class="btn-secondary">
									Open docs
								</a>
							</div>
						</details>
					</article>
				</div>
			</section>

			<section class="gap-6 grid xl:grid-cols-2">
				<article v-for="category in data.categories" :key="category.slug" class="surface-panel">
					<div class="flex flex-wrap gap-3 items-start justify-between">
						<div>
							<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
								{{ category.title }}
							</p>
							<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
								{{ category.summary }}
							</h2>
						</div>
						<TrustBadge label="Source hierarchy" tone="accent" />
					</div>
					<div class="mt-6 gap-4 grid md:grid-cols-2">
						<div class="surface-row">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Authoritative rule
							</p>
							<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
								{{ category.authoritativeRule }}
							</p>
						</div>
						<div class="surface-row">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Live approach
							</p>
							<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
								{{ category.liveApproach }}
							</p>
						</div>
					</div>
					<div class="mt-6 space-y-4">
						<article v-for="option in category.options" :key="option.id" class="surface-row">
							<div class="flex flex-wrap gap-2 items-center">
								<SourceAuthorityBadge :authority="option.authority" />
								<TrustBadge :label="statusLabel(option.status)" :tone="statusTone(option.status)" />
							</div>
							<h3 class="text-2xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
								{{ option.name }}
							</h3>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ option.summary }}
							</p>
							<div class="mt-5 gap-4 grid md:grid-cols-3">
								<div>
									<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
										Access
									</p>
									<p class="text-sm text-app-ink font-semibold mt-2 dark:text-app-text-dark">
										{{ option.accessMethod }}
									</p>
								</div>
								<div>
									<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
										Coverage
									</p>
									<p class="text-sm text-app-ink font-semibold mt-2 dark:text-app-text-dark">
										{{ option.coverage }}
									</p>
								</div>
								<div>
									<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
										Update pattern
									</p>
									<p class="text-sm text-app-ink font-semibold mt-2 dark:text-app-text-dark">
										{{ option.updatePattern }}
									</p>
								</div>
							</div>
							<details class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
								<summary class="text-app-ink font-semibold cursor-pointer dark:text-app-text-dark focus-ring">
									Best use and notes
								</summary>
								<p class="mt-3">
									<strong class="text-app-ink dark:text-app-text-dark">Best use:</strong> {{ option.bestUse }}
								</p>
								<ul class="readable-list text-sm text-app-muted mt-4 pl-5 dark:text-app-muted-dark">
									<li v-for="note in option.notes" :key="note">
										{{ note }}
									</li>
								</ul>
							</details>
							<div v-if="option.links?.length" class="mt-5 flex flex-wrap gap-3">
								<a
									v-for="link in option.links"
									:key="link.url"
									:href="link.url"
									target="_blank"
									rel="noreferrer"
									class="btn-secondary"
								>
									{{ link.label }}
								</a>
							</div>
						</article>
					</div>
				</article>
			</section>
		</div>
	</section>
</template>
