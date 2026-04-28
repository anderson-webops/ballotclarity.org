<script setup lang="ts">
defineProps<{
	items: {
		body: string[];
		label: string;
	}[];
	summary: string;
	title?: string;
}>();
</script>

<template>
	<section class="surface-panel">
		<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
			{{ title ?? "How this page is built" }}
		</p>
		<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
			{{ summary }}
		</p>

		<details class="group mt-5 surface-row">
			<summary class="text-sm text-app-ink font-semibold list-none flex gap-4 cursor-pointer items-center justify-between dark:text-app-text-dark focus-ring">
				<span>Read about our process</span>
				<span class="i-carbon-add group-open:i-carbon-subtract text-base text-app-muted dark:text-app-muted-dark" />
			</summary>
			<div class="mt-4 space-y-4">
				<section v-for="item in items" :key="item.label">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						{{ item.label }}
					</p>
					<ul class="mt-2 space-y-2">
						<li v-for="paragraph in item.body" :key="paragraph" class="text-sm text-app-muted leading-7 dark:text-app-muted-dark">
							{{ paragraph }}
						</li>
					</ul>
				</section>
			</div>
		</details>
	</section>
</template>
