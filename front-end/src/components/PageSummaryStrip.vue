<script setup lang="ts">
defineProps<{
	items: Array<{
		href?: string;
		label: string;
		note?: string;
		value: string | number;
	}>;
}>();

const externalHrefPattern = /^https?:\/\//;

function isExternalHref(href: string) {
	return externalHrefPattern.test(href);
}
</script>

<template>
	<div class="summary-strip">
		<template v-for="item in items" :key="item.label">
			<a
				v-if="item.href && isExternalHref(item.href)"
				:href="item.href"
				class="summary-strip__item summary-strip__item--interactive focus-ring"
				rel="noreferrer"
				target="_blank"
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
			</a>

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
				<p v-if="item.note" class="summary-strip__note">
					{{ item.note }}
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
				<p v-if="item.note" class="summary-strip__note">
					{{ item.note }}
				</p>
			</article>
		</template>
	</div>
</template>
