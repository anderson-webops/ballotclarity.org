<script setup lang="ts">
const { data, error, pending } = await useDataSources();
const activeProviders = computed(() => data.value?.ballotContentProviders?.filter(provider => provider.connectionStatus === "active") ?? []);
</script>

<template>
	<section v-if="pending || error || activeProviders.length || data?.categories.length" id="providers" class="scroll-mt-24" aria-labelledby="providers-heading">
		<h2 id="providers-heading" class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
			Data providers
		</h2>
		<p v-if="pending" class="text-sm text-app-muted mt-4 dark:text-app-muted-dark" role="status">
			Loading providers…
		</p>
		<p v-else-if="error || !data" class="text-sm text-app-muted mt-4 dark:text-app-muted-dark" role="status">
			Provider details are unavailable.
		</p>
		<template v-else>
			<UpdatedAt v-if="data.updatedAt" :value="data.updatedAt" label="Source data updated on" footer />
			<div class="mt-4 divide-app-line divide-y dark:divide-app-line-dark">
				<SafeExternalLink v-for="provider in activeProviders" :key="provider.id" :href="provider.setupUrl" class="text-base text-app-accent font-semibold py-4 rounded-sm underline underline-offset-3 block focus-ring">
					{{ provider.label }}
				</SafeExternalLink>
				<section v-for="category in data.categories" :key="category.slug" class="py-4">
					<h3 v-if="category.options.length > 1" class="text-base text-app-ink font-semibold dark:text-app-text-dark">
						{{ category.title }}
					</h3>
					<div class="mt-3 divide-app-line divide-y dark:divide-app-line-dark">
						<section v-for="option in category.options" :key="option.id" class="text-sm text-app-muted leading-7 py-4 dark:text-app-muted-dark">
							<SafeExternalLink v-if="option.links?.[0]" :href="option.links[0].url" class="text-base text-app-accent font-semibold underline underline-offset-3 block focus-ring">
								{{ option.name }}
							</SafeExternalLink>
							<p v-else class="text-base text-app-ink font-semibold dark:text-app-text-dark">
								{{ option.name }}
							</p>
							<p v-if="option.coverage" class="mt-2">
								{{ option.coverage }}
							</p>
						</section>
					</div>
				</section>
			</div>
		</template>
	</section>
</template>
