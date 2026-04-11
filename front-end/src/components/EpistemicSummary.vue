<script setup lang="ts">
import type { TrustBullet } from "~/types/civic";

withDefaults(defineProps<{
	knownItems: TrustBullet[];
	knownTitle?: string;
	unknownItems: TrustBullet[];
	unknownTitle?: string;
}>(), {
	knownTitle: "What we know",
	unknownTitle: "What we're still checking",
});
</script>

<template>
	<section class="gap-6 grid md:grid-cols-2">
		<div class="surface-panel">
			<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
				{{ knownTitle }}
			</h2>
			<ul class="mt-5 space-y-4">
				<li v-for="item in knownItems" :key="item.id" class="p-4 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
					<div class="flex gap-3 items-start justify-between">
						<div class="flex gap-3">
							<span class="i-carbon-checkmark text-app-accent mt-1" />
							<div>
								<p class="text-sm text-app-muted leading-7 dark:text-app-muted-dark">
									{{ item.text }}
								</p>
								<p v-if="item.note" class="text-xs text-app-muted mt-2 dark:text-app-muted-dark">
									{{ item.note }}
								</p>
							</div>
						</div>
						<SourceDrawer :sources="item.sources" :title="item.text" button-label="Evidence" />
					</div>
				</li>
			</ul>
		</div>

		<div class="surface-panel">
			<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
				{{ unknownTitle }}
			</h2>
			<ul class="mt-5 space-y-4">
				<li v-for="item in unknownItems" :key="item.id" class="p-4 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
					<div class="flex gap-3 items-start justify-between">
						<div class="flex gap-3">
							<span class="i-carbon-help text-[#8f6c2f] mt-1 dark:text-[#efcf96]" />
							<div>
								<p class="text-sm text-app-muted leading-7 dark:text-app-muted-dark">
									{{ item.text }}
								</p>
								<p v-if="item.note" class="text-xs text-app-muted mt-2 dark:text-app-muted-dark">
									{{ item.note }}
								</p>
							</div>
						</div>
						<SourceDrawer :sources="item.sources" :title="item.text" button-label="Evidence" />
					</div>
				</li>
			</ul>
		</div>
	</section>
</template>
