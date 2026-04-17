<script setup lang="ts">
defineProps<{
	items: Array<{
		label: string;
		note?: string;
		value: string | number;
	}>;
}>();
</script>

<template>
	<div class="summary-strip">
		<article
			v-for="item in items"
			:key="item.label"
			class="summary-strip__item"
		>
			<p class="summary-strip__label">
				{{ item.label }}
			</p>
			<p class="summary-strip__value">
				{{ item.value }}
			</p>
			<p v-if="item.note" class="summary-strip__note">
				{{ item.note }}
			</p>
		</article>
	</div>
</template>
