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
			<div class="mt-4 divide-app-line divide-y dark:divide-app-line-dark">
				<details v-for="provider in data.ballotContentProviders" :key="provider.id" class="py-4">
					<summary class="text-base text-app-ink font-semibold rounded-sm cursor-pointer dark:text-app-text-dark focus-ring">
						{{ provider.label }}
						<span class="text-sm text-app-muted font-normal ml-2 dark:text-app-muted-dark">{{ provider.connectionStatus === 'active' ? 'Connected' : 'Not connected' }}</span>
					</summary>
					<div class="text-sm text-app-muted leading-7 mt-3 space-y-3 dark:text-app-muted-dark">
						<p>{{ provider.bestUse }}</p>
						<ul v-if="provider.capabilities.length" class="readable-list pl-5">
							<li v-for="capability in provider.capabilities" :key="capability">
								{{ capability }}
							</li>
						</ul>
						<ul v-if="provider.limitations.length" class="readable-list pl-5">
							<li v-for="limitation in provider.limitations" :key="limitation">
								{{ limitation }}
							</li>
						</ul>
						<div class="flex flex-wrap gap-x-5 gap-y-2">
							<SafeExternalLink :href="provider.setupUrl" class="text-app-accent underline underline-offset-3">
								Provider site
							</SafeExternalLink>
							<SafeExternalLink v-if="provider.docsUrl" :href="provider.docsUrl" class="text-app-accent underline underline-offset-3">
								Technical docs
							</SafeExternalLink>
						</div>
					</div>
				</details>
				<details v-for="category in data.categories" :key="category.slug" class="py-4">
					<summary class="text-base text-app-ink font-semibold rounded-sm cursor-pointer dark:text-app-text-dark focus-ring">
						{{ category.title }}
					</summary>
					<div class="mt-3 divide-app-line divide-y dark:divide-app-line-dark">
						<section v-for="option in category.options" :key="option.id" class="text-sm text-app-muted leading-7 py-4 dark:text-app-muted-dark">
							<h3 class="text-base text-app-ink font-semibold dark:text-app-text-dark">
								{{ option.name }}
							</h3>
							<p class="mt-2">
								{{ option.summary }}
							</p>
							<p class="mt-2">
								{{ option.coverage }}
							</p>
							<ul v-if="option.notes.length" class="readable-list mt-2 pl-5">
								<li v-for="note in option.notes" :key="note">
									{{ note }}
								</li>
							</ul>
							<div v-if="option.links?.length" class="mt-3 flex flex-wrap gap-x-5 gap-y-2">
								<SafeExternalLink v-for="link in option.links" :key="link.url" :href="link.url" class="text-app-accent underline underline-offset-3">
									{{ link.label }}
								</SafeExternalLink>
							</div>
						</section>
					</div>
				</details>
			</div>
		</template>
	</section>
</template>
