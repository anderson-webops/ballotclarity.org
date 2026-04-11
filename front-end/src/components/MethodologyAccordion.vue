<script setup lang="ts">
defineProps<{
	items: {
		body: string[];
		title: string;
	}[];
}>();
</script>

<template>
	<div class="space-y-4">
		<details
			v-for="item in items"
			:key="item.title"
			class="group surface-panel"
		>
			<summary class="text-xl text-app-ink font-serif list-none flex gap-4 cursor-pointer items-center justify-between dark:text-app-text-dark focus-ring">
				<span>{{ item.title }}</span>
				<span class="i-carbon-add group-open:i-carbon-subtract text-lg text-app-muted dark:text-app-muted-dark" />
			</summary>
			<div class="text-sm text-app-muted leading-7 mt-4 space-y-3 dark:text-app-muted-dark">
				<p v-for="paragraph in item.body" :key="paragraph">
					{{ paragraph }}
				</p>
			</div>
		</details>
	</div>
</template>
