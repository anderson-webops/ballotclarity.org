<script setup lang="ts">
const { formatDateTime } = useFormatters();
const { data, error, pending } = await useDataSources();

usePageSeo({
	description: "Ballot Clarity's live data roadmap: official source hierarchy, provider strategy, migration risks, and the backend architecture planned to replace the current archive.",
	path: "/data-sources",
	title: "Data Sources and Live API Roadmap"
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
			<InfoCallout title="Data roadmap unavailable" tone="warning">
				The data-sources roadmap could not be loaded. Refresh the page or return to the methodology page and try again.
			</InfoCallout>
		</div>

		<div v-else class="space-y-8">
			<header class="gap-8 grid xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.85fr)]">
				<div class="surface-panel">
					<div class="flex flex-wrap gap-2">
						<TrustBadge label="Official where authoritative" tone="accent" />
						<TrustBadge label="Provider layer for scale" />
						<TrustBadge label="Current archive, live later" tone="warning" />
					</div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-6 uppercase dark:text-app-muted-dark">
						Data sources and live API roadmap
					</p>
					<h1 class="text-5xl text-app-ink leading-tight font-serif mt-3 dark:text-app-text-dark">
						The trust model depends on the data stack, not just the interface.
					</h1>
					<p class="bc-prose text-app-muted mt-5 dark:text-app-muted-dark">
						Ballot Clarity currently runs on a limited public-record archive. This page shows how the site is designed to move to live civic data without pretending there is a single perfect national source. The rule is simple: official sources where they are authoritative, normalized providers where scale matters, and a separate research layer for archives and analytics.
					</p>
					<div class="mt-6 flex flex-wrap gap-4 items-center">
						<UpdatedAt :value="data.updatedAt" label="Roadmap updated" />
						<NuxtLink to="/methodology" class="btn-secondary">
							Read methodology
						</NuxtLink>
					</div>
				</div>

				<div class="space-y-4">
					<InfoCallout title="Why this matters" tone="warning">
						A voter-facing civic product can look calm and trustworthy while still hiding weak data assumptions. This roadmap makes the planned source hierarchy public before live integrations are added.
					</InfoCallout>
					<div class="surface-panel">
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Current position
						</p>
						<ul class="readable-list text-sm text-app-muted mt-5 pl-5 dark:text-app-muted-dark">
							<li v-for="principle in data.principles" :key="principle">
								{{ principle }}
							</li>
						</ul>
					</div>
				</div>
			</header>

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
						<div class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Authoritative rule
							</p>
							<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
								{{ category.authoritativeRule }}
							</p>
						</div>
						<div class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Live approach
							</p>
							<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
								{{ category.liveApproach }}
							</p>
						</div>
					</div>
					<div class="mt-6 space-y-4">
						<article v-for="option in category.options" :key="option.id" class="px-5 py-5 border border-app-line/70 rounded-3xl bg-white/80 dark:border-app-line-dark dark:bg-app-panel-dark/70">
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
							<p class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
								<strong class="text-app-ink dark:text-app-text-dark">Best use:</strong> {{ option.bestUse }}
							</p>
							<ul class="readable-list text-sm text-app-muted mt-4 pl-5 dark:text-app-muted-dark">
								<li v-for="note in option.notes" :key="note">
									{{ note }}
								</li>
							</ul>
						</article>
					</div>
				</article>
			</section>

			<section class="gap-6 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Backend architecture
					</p>
					<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						How live civic data would move through the platform
					</h2>
					<div class="mt-6 space-y-4">
						<article v-for="stage in data.architectureStages" :key="stage.id" class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<h3 class="text-xl text-app-ink font-semibold dark:text-app-text-dark">
								{{ stage.title }}
							</h3>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ stage.summary }}
							</p>
							<ul class="readable-list text-sm text-app-muted mt-4 pl-5 dark:text-app-muted-dark">
								<li v-for="detail in stage.details" :key="detail">
									{{ detail }}
								</li>
							</ul>
						</article>
					</div>
				</div>

				<div class="space-y-6">
					<div class="surface-panel">
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Migration watch
						</p>
						<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							Provider changes the architecture already anticipates
						</h2>
						<ul class="mt-6 space-y-4">
							<li v-for="item in data.migrationWatch" :key="item.id" class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
								<p class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
									{{ item.title }}
								</p>
								<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
									{{ item.summary }}
								</p>
								<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
									<strong class="text-app-ink dark:text-app-text-dark">Implication:</strong> {{ item.implication }}
								</p>
							</li>
						</ul>
					</div>

					<div class="surface-panel">
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Implementation order
						</p>
						<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							Six-step live data roadmap
						</h2>
						<ol class="mt-6 space-y-4">
							<li v-for="milestone in data.roadmap" :key="milestone.id" class="px-5 py-5 border border-app-line/70 rounded-3xl bg-white/80 dark:border-app-line-dark dark:bg-app-panel-dark/70">
								<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
									{{ milestone.title }}
								</p>
								<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
									{{ milestone.summary }}
								</p>
							</li>
						</ol>
						<div class="mt-6 flex flex-wrap gap-3">
							<NuxtLink to="/locations/metro-county-franklin" class="btn-secondary">
								Open location hub
							</NuxtLink>
							<NuxtLink to="/contact" class="btn-secondary">
								Contact the project
							</NuxtLink>
						</div>
					</div>
				</div>
			</section>

			<section class="surface-panel">
				<div class="flex flex-wrap gap-4 items-start justify-between">
					<div>
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Trust takeaway
						</p>
						<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							The product should always say which layer a fact came from.
						</h2>
					</div>
					<p class="text-sm text-app-muted dark:text-app-muted-dark">
						Last roadmap refresh: {{ formatDateTime(data.updatedAt) }}
					</p>
				</div>
				<p class="bc-prose text-app-muted mt-5 dark:text-app-muted-dark">
					When Ballot Clarity eventually moves beyond the current archive, the interface should keep exposing source authority, source system, and freshness at the field level. That is what lets a voter tell the difference between an official office notice, a provider-normalized ballot package, a candidate-submitted statement, and an archival research source.
				</p>
			</section>
		</div>
	</section>
</template>
