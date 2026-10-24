<script setup lang="ts">
import type { Measure } from "~/types/civic";

defineProps<{ measure: Measure; viewMode?: "deep" | "quick" }>();
</script>

<template>
	<NuxtLink :to="`/measure/${measure.slug}`" class="py-3 min-w-0 block focus-ring">
		<h3 class="text-[1.45rem] text-app-ink leading-tight font-serif dark:text-app-text-dark">
			{{ measure.title }}
		</h3>
		<p class="text-base text-app-ink leading-7 mt-2 dark:text-app-text-dark">
			{{ measure.summary }}
		</p>
		<dl class="text-sm leading-6 mt-3 space-y-1">
			<div>
				<dt class="text-app-ink font-semibold inline dark:text-app-text-dark">
					Yes:
				</dt>
				<dd class="text-app-muted inline dark:text-app-muted-dark">
					{{ measure.yesMeaning }}
				</dd>
			</div>
			<div>
				<dt class="text-app-ink font-semibold inline dark:text-app-text-dark">
					No:
				</dt>
				<dd class="text-app-muted inline dark:text-app-muted-dark">
					{{ measure.noMeaning }}
				</dd>
			</div>
		</dl>
	</NuxtLink>
</template>
