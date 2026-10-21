<script setup lang="ts">
import { isExternalHref } from "~/utils/link";

defineProps<{
	items: Array<{
		href?: string;
		label: string;
		note?: string;
		value: string | number;
	}>;
}>();
</script>

<template>
	<div class="summary-strip">
		<template v-for="item in items" :key="item.label">
			<SafeExternalLink
				v-if="item.href && isExternalHref(item.href)"
				:href="item.href"
				class="summary-strip__item summary-strip__item--interactive focus-ring"
			>
				<p class="summary-strip__label">
					{{ item.label }}
				</p>
				<p class="summary-strip__value">
					{{ item.value }}
				</p>
			</SafeExternalLink>

			<NuxtLink
				v-else-if="item.href"
				:to="item.href"
				class="summary-strip__item summary-strip__item--interactive focus-ring"
			>
				<p class="summary-strip__label">
					{{ item.label }}
				</p>
				<p class="summary-strip__value">
					{{ item.value }}
				</p>
			</NuxtLink>

			<article
				v-else
				class="summary-strip__item"
			>
				<p class="summary-strip__label">
					{{ item.label }}
				</p>
				<p class="summary-strip__value">
					{{ item.value }}
				</p>
			</article>
		</template>
	</div>
</template>
