<script setup lang="ts">
const route = useRoute();
const contestSlug = computed(() => String(route.params.slug));
const { data, error, pending } = await useContest(contestSlug);

const compareHref = computed(() => {
	if (!data.value || data.value.contest.type !== "candidate")
		return null;

	return {
		path: "/compare",
		query: {
			slugs: (data.value.contest.candidates ?? []).map(candidate => candidate.slug).join(",")
		}
	};
});

const districtHref = computed(() => {
	if (!data.value || data.value.contest.type !== "candidate")
		return null;

	return `/districts/${data.value.contest.slug}`;
});

const breadcrumbs = computed(() => {
	if (!data.value) {
		return [
			{ label: "Home", to: "/" },
			{ label: "Contest" }
		];
	}

	return [
		{ label: "Home", to: "/" },
		{ label: data.value.election.name, to: `/elections/${data.value.election.slug}` },
		{ label: data.value.contest.office }
	];
});
const contestContextStats = computed(() => {
	if (!data.value)
		return [];

	return [
		{
			label: "Source records",
			note: "Attached across the full contest surface.",
			value: data.value.sourceCount
		},
		{
			label: data.value.contest.type === "candidate" ? "Candidates" : "Measures",
			note: data.value.contest.type === "candidate"
				? "People currently included in this contest surface."
				: "Measure explainers included in this contest surface.",
			value: data.value.contest.type === "candidate"
				? data.value.contest.candidates?.length ?? 0
				: data.value.contest.measures?.length ?? 0
		},
		{
			label: "Related contests",
			note: "Linked follow-on surfaces in the same public guide.",
			value: data.value.relatedContests.length
		}
	];
});
const contestMatrixColumns = computed(() => {
	if (!data.value)
		return [];

	if (data.value.contest.type === "candidate") {
		return (data.value.contest.candidates ?? []).map(candidate => ({
			id: candidate.slug,
			label: candidate.comparison.displayName,
			meta: `${candidate.officeSought} · ${candidate.party}`,
			badges: [
				{ label: candidate.incumbent ? "Incumbent" : "Not incumbent", tone: candidate.incumbent ? "accent" as const : "neutral" as const },
				{ label: candidate.comparison.ballotStatus.label, tone: "neutral" as const }
			],
			sources: candidate.sources
		}));
	}

	return (data.value.contest.measures ?? []).map(measure => ({
		id: measure.slug,
		label: measure.title,
		meta: measure.location,
		badges: [
			{ label: measure.freshness.statusLabel, tone: measure.freshness.status === "up-to-date" ? "accent" as const : "neutral" as const }
		],
		sources: measure.sources
	}));
});
const contestMatrixRows = computed(() => {
	if (!data.value)
		return [];

	if (data.value.contest.type === "candidate") {
		return [
			{
				id: "ballot-status",
				label: "Ballot status",
				note: "Verified ballot inclusion and provenance.",
				cells: (data.value.contest.candidates ?? []).map(candidate => ({
					columnId: candidate.slug,
					sources: candidate.comparison.ballotStatus.sources,
					value: candidate.comparison.ballotStatus.label
				}))
			},
			{
				id: "priorities",
				label: "Top priorities",
				note: "First readable issue signal in the current archive.",
				cells: (data.value.contest.candidates ?? []).map(candidate => ({
					columnId: candidate.slug,
					sources: candidate.comparison.topPriorities.flatMap(priority => priority.sources),
					value: candidate.comparison.topPriorities[0]?.text ?? "No top priority documented yet."
				}))
			},
			{
				id: "questionnaire",
				label: "Questionnaire coverage",
				note: "Answered prompts in the current archive.",
				cells: (data.value.contest.candidates ?? []).map(candidate => ({
					columnId: candidate.slug,
					sources: candidate.comparison.questionnaireResponses.flatMap(response => response.sources),
					value: `${candidate.comparison.questionnaireResponses.filter(response => response.responseStatus === "answered").length}/${candidate.comparison.questionnaireResponses.length} answered`
				}))
			},
			{
				id: "actions",
				label: "Documented actions",
				note: "Source-backed actions attached to the current profile.",
				cells: (data.value.contest.candidates ?? []).map(candidate => ({
					columnId: candidate.slug,
					sources: candidate.keyActions.flatMap(action => action.sources),
					value: `${candidate.keyActions.length} documented action${candidate.keyActions.length === 1 ? "" : "s"}`
				}))
			}
		];
	}

	return [
		{
			id: "ballot-summary",
			label: "Official ballot summary",
			note: "What the voter sees in the official measure description.",
			cells: (data.value.contest.measures ?? []).map(measure => ({
				columnId: measure.slug,
				sources: measure.sources,
				value: measure.ballotSummary
			}))
		},
		{
			id: "plain-language",
			label: "Plain-language explanation",
			note: "Ballot Clarity explanation layer.",
			cells: (data.value.contest.measures ?? []).map(measure => ({
				columnId: measure.slug,
				sources: measure.sources,
				value: measure.plainLanguageExplanation
			}))
		},
		{
			id: "yes-path",
			label: "If YES",
			note: "Headline effect if the measure passes.",
			cells: (data.value.contest.measures ?? []).map(measure => ({
				columnId: measure.slug,
				sources: measure.sources,
				value: measure.yesMeaning
			}))
		},
		{
			id: "no-path",
			label: "If NO",
			note: "Headline effect if the measure fails.",
			cells: (data.value.contest.measures ?? []).map(measure => ({
				columnId: measure.slug,
				sources: measure.sources,
				value: measure.noMeaning
			}))
		}
	];
});
const sourceDensityEntities = computed(() => {
	if (!data.value)
		return [];

	if (data.value.contest.type === "candidate") {
		return (data.value.contest.candidates ?? []).map(candidate => ({
			count: candidate.sources.length,
			detail: `${candidate.keyActions.length} action item${candidate.keyActions.length === 1 ? "" : "s"} and ${candidate.publicStatements.length} public statement block${candidate.publicStatements.length === 1 ? "" : "s"} are attached to this profile.`,
			id: candidate.slug,
			label: candidate.name,
			sources: candidate.sources
		}));
	}

	return (data.value.contest.measures ?? []).map(measure => ({
		count: measure.sources.length,
		detail: `${measure.implementationTimeline.length} implementation item${measure.implementationTimeline.length === 1 ? "" : "s"} and ${measure.fiscalSummary.length} fiscal item${measure.fiscalSummary.length === 1 ? "" : "s"} are attached to this explainer.`,
		id: measure.slug,
		label: measure.title,
		sources: measure.sources
	}));
});

usePageSeo({
	description: data.value?.contest.description ?? "Canonical contest page with contest context, source-backed records, and links back to the election overview.",
	path: `/contest/${contestSlug.value}`,
	title: data.value?.contest.office ?? "Contest"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<div v-if="pending" class="space-y-6">
			<div class="surface-panel bg-white/70 h-72 animate-pulse dark:bg-app-panel-dark/70" />
			<div class="gap-6 grid xl:grid-cols-2">
				<div v-for="index in 3" :key="index" class="surface-panel bg-white/70 h-64 animate-pulse dark:bg-app-panel-dark/70" />
			</div>
		</div>

		<div v-else-if="error || !data" class="max-w-3xl">
			<InfoCallout title="Contest page unavailable" tone="warning">
				This contest page could not be loaded. Return to the election overview or ballot guide and try again.
			</InfoCallout>
		</div>

		<div v-else class="space-y-8">
			<AppBreadcrumbs :items="breadcrumbs" />

			<header class="gap-6 grid xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
				<div class="surface-panel">
					<div class="flex flex-wrap gap-2">
						<VerificationBadge label="Canonical contest page" tone="accent" />
						<VerificationBadge :label="`${data.sourceCount} source${data.sourceCount === 1 ? '' : 's'}`" />
					</div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-6 uppercase dark:text-app-muted-dark">
						{{ data.election.name }}
					</p>
					<h1 class="text-5xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						{{ data.contest.office }}
					</h1>
					<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
						{{ data.contest.description }}
					</p>
					<div class="mt-6 flex flex-wrap gap-3">
						<UpdatedAt :value="data.updatedAt" />
						<NuxtLink :to="`/ballot/${data.election.slug}`" class="btn-secondary">
							Open ballot guide
						</NuxtLink>
						<NuxtLink v-if="districtHref" :to="districtHref" class="btn-secondary">
							Open district page
						</NuxtLink>
						<NuxtLink v-if="districtHref" to="/representatives" class="btn-secondary">
							Representative directory
						</NuxtLink>
						<NuxtLink :to="`/elections/${data.election.slug}`" class="btn-secondary">
							Election overview
						</NuxtLink>
						<NuxtLink v-if="compareHref" :to="compareHref" class="btn-secondary">
							Compare this race
						</NuxtLink>
					</div>
				</div>

				<div class="space-y-4">
					<InfoCallout title="What this page is for" tone="warning">
						{{ data.note }}
					</InfoCallout>
					<OfficeContextCard
						title="What this office or question controls"
						:office-label="data.contest.office"
						:summary="data.contest.roleGuide.summary"
						:stats="contestContextStats"
						:responsibilities="data.contest.roleGuide.decisionAreas"
						:sources="data.sources"
						source-button-label="Contest sources"
						uncertainty="This role guide explains the office or measure context, but users should still inspect the specific candidate or measure records before deciding."
						:why-it-matters="data.contest.roleGuide.whyItMatters"
						:badges="[
							{ label: data.contest.type === 'candidate' ? 'Candidate contest' : 'Measure contest', tone: 'accent' },
							{ label: data.contest.jurisdiction, tone: 'neutral' },
						]"
					/>
				</div>
			</header>

			<ComparisonMatrix
				:columns="contestMatrixColumns"
				:rows="contestMatrixRows"
				:eyebrow="data.contest.type === 'candidate' ? 'Contest comparison matrix' : 'Measure comparison matrix'"
				:note="data.contest.type === 'candidate'
					? 'Use this matrix to compare the candidates in the same race before opening each full profile.'
					: 'Use this matrix to compare the published measure surfaces in the same contest before opening each full explainer.'"
				:title="data.contest.type === 'candidate'
					? 'Where this contest differs at a glance'
					: 'How these measures differ before a full read'"
				uncertainty="The matrix only reflects the source-backed fields attached to the current contest surface. Open the linked pages when you need the full evidence trail."
			/>

			<section v-if="data.contest.type === 'candidate'" class="gap-6 grid xl:grid-cols-2">
				<CandidateCard
					v-for="candidate in data.contest.candidates"
					:key="candidate.slug"
					:candidate="candidate"
				/>
			</section>

			<section v-else class="gap-6 grid xl:grid-cols-2">
				<MeasureCard
					v-for="measure in data.contest.measures"
					:key="measure.slug"
					:measure="measure"
				/>
			</section>

			<section class="gap-6 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<div class="surface-panel">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						Contest sources
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						This list aggregates the public records used across the entire contest surface, not just one candidate or one measure card.
					</p>
					<div class="mt-6">
						<SourceList :sources="data.sources" />
					</div>
				</div>

				<div class="space-y-6">
					<SourceDensityByEntity
						:entities="sourceDensityEntities"
						note="This helps a voter see whether one candidate or measure currently has much more attached source depth than another."
						title="How much source depth exists for each entity in this contest"
						uncertainty="More sources do not automatically mean stronger evidence quality. Use the attached source drawers and full pages to inspect the records themselves."
					/>
					<div class="surface-panel">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							Related contests
						</h2>
						<div class="mt-6 space-y-4">
							<NuxtLink
								v-for="contest in data.relatedContests"
								:key="contest.slug"
								:to="contest.href"
								class="px-5 py-5 border border-app-line/70 rounded-3xl bg-white/80 block transition dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark/70 focus-ring"
							>
								<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
									{{ contest.jurisdiction }}
								</p>
								<p class="text-xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
									{{ contest.office }}
								</p>
								<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
									{{ contest.type === "candidate" ? "Candidate contest" : "Ballot measure" }}
								</p>
							</NuxtLink>
						</div>
					</div>
				</div>
			</section>
		</div>
	</section>
</template>
