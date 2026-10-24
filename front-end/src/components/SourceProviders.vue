<script setup lang="ts">
const { data, error, pending } = await useDataSources();
</script>

<template>
	<section id="providers" class="scroll-mt-24" aria-labelledby="providers-heading">
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
			<UpdatedAt v-if="data.updatedAt" :value="data.updatedAt" label="Updated" class="mt-3" />
			<p v-if="!data.ballotContentProviders?.length && !data.categories.length" class="text-sm text-app-muted mt-4 dark:text-app-muted-dark">
				No additional provider details published.
			</p>
			<ul v-if="data.ballotContentProviders?.length" class="mt-4 divide-app-line divide-y dark:divide-app-line-dark">
				<li v-for="provider in data.ballotContentProviders" :key="provider.id" class="py-4">
					<SafeExternalLink :href="provider.setupUrl" class="text-base text-app-accent font-semibold underline underline-offset-3 focus-ring">
						{{ provider.label }}
					</SafeExternalLink>
					<span class="text-sm text-app-muted ml-2 dark:text-app-muted-dark">{{ provider.connectionStatus === 'active' ? 'Connected' : 'Not connected' }}</span>
					<p class="text-sm text-app-muted leading-6 mt-1 dark:text-app-muted-dark">
						{{ provider.bestUse }}
					</p>
				</li>
			</ul>
			<section v-for="category in data.categories" :key="category.slug" class="mt-6">
				<h3 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
					{{ category.title }}
				</h3>
				<ul class="mt-2 divide-app-line divide-y dark:divide-app-line-dark">
					<li v-for="option in category.options" :key="option.id" class="py-4">
						<SafeExternalLink v-if="option.links?.length" :href="option.links[0]!.url" class="text-base text-app-accent font-semibold underline underline-offset-3 focus-ring">
							{{ option.name }}
						</SafeExternalLink>
						<p v-else class="text-base text-app-ink font-semibold dark:text-app-text-dark">
							{{ option.name }}
						</p>
						<p class="text-sm text-app-muted leading-6 mt-1 dark:text-app-muted-dark">
							{{ option.summary }}
						</p>
					</li>
				</ul>
			</section>
		</template>
	</section>
</template>
