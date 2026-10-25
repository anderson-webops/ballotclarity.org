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
		<section
			v-for="item in items"
			:key="item.title"
			class="surface-panel"
		>
			<h2 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
				{{ item.title }}
			</h2>
			<div class="text-sm text-app-muted leading-7 mt-4 space-y-3 dark:text-app-muted-dark">
				<p v-for="paragraph in item.body" :key="paragraph">
					{{ paragraph }}
				</p>
			</div>
		</section>
	</div>
</template>
