<script setup lang="ts">
import type { Source } from "~/types/civic";

interface ComparisonMatrixBadge {
	label: string;
	tone?: "accent" | "neutral" | "warning";
}

interface ComparisonMatrixColumn {
	badges?: ComparisonMatrixBadge[];
	id: string;
	label: string;
	meta?: string;
	sources?: Source[];
}

interface ComparisonMatrixCell {
	columnId: string;
	note?: string;
	sources?: Source[];
	value: string;
}

interface ComparisonMatrixRow {
	cells: ComparisonMatrixCell[];
	id: string;
	label: string;
	note?: string;
}

const props = withDefaults(defineProps<{
	columns: ComparisonMatrixColumn[];
	eyebrow?: string;
	note?: string;
	rows: ComparisonMatrixRow[];
	title: string;
	uncertainty?: string;
}>(), {
	eyebrow: "Comparison matrix",
	note: "",
	uncertainty: ""
});

function cellFor(row: ComparisonMatrixRow, columnId: string) {
	return row.cells.find(cell => cell.columnId === columnId);
}
</script>

<template>
	<section v-if="props.columns.length && props.rows.length" class="surface-panel">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-4xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					{{ props.eyebrow }}
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ props.title }}
				</h2>
				<p v-if="props.note" class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.note }}
				</p>
			</div>
			<VerificationBadge label="Source-backed matrix" tone="accent" />
		</div>

		<div class="mt-6 border border-app-line rounded-[1.5rem] hidden overflow-x-auto dark:border-app-line-dark lg:block">
			<div
				class="grid min-w-[56rem]"
				:style="{ gridTemplateColumns: `minmax(14rem, 18rem) repeat(${props.columns.length}, minmax(12rem, 1fr))` }"
			>
				<div class="p-4 border-b border-app-line bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/80" />
				<div
					v-for="column in props.columns"
					:key="column.id"
					class="p-4 border-b border-l border-app-line bg-white dark:border-app-line-dark dark:bg-app-panel-dark"
				>
					<p class="text-lg text-app-ink font-serif dark:text-app-text-dark">
						{{ column.label }}
					</p>
					<p v-if="column.meta" class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
						{{ column.meta }}
					</p>
					<div class="mt-3 flex flex-wrap gap-2 items-center">
						<VerificationBadge
							v-for="badge in column.badges ?? []"
							:key="`${column.id}-${badge.label}`"
							:label="badge.label"
							:tone="badge.tone"
						/>
						<SourceDrawer
							v-if="column.sources?.length"
							:sources="column.sources"
							:title="column.label"
							button-label="Sources"
						/>
					</div>
				</div>

				<template v-for="row in props.rows" :key="row.id">
					<div class="p-4 border-b border-app-line bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/80">
						<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
							{{ row.label }}
						</p>
						<p v-if="row.note" class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
							{{ row.note }}
						</p>
					</div>
					<div
						v-for="column in props.columns"
						:key="`${row.id}-${column.id}`"
						class="p-4 border-b border-l border-app-line bg-white dark:border-app-line-dark dark:bg-app-panel-dark"
					>
						<p class="text-sm text-app-ink leading-6 font-semibold dark:text-app-text-dark">
							{{ cellFor(row, column.id)?.value ?? "Not documented yet" }}
						</p>
						<p v-if="cellFor(row, column.id)?.note" class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
							{{ cellFor(row, column.id)?.note }}
						</p>
						<div v-if="cellFor(row, column.id)?.sources?.length" class="mt-3">
							<SourceDrawer
								:sources="cellFor(row, column.id)?.sources ?? []"
								:title="`${row.label} for ${column.label}`"
								button-label="Sources"
							/>
						</div>
					</div>
				</template>
			</div>
		</div>

		<div class="mt-6 space-y-4 lg:hidden">
			<article
				v-for="column in props.columns"
				:key="column.id"
				class="p-4 border border-app-line/80 rounded-[1.3rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70"
			>
				<div class="flex flex-wrap gap-2 items-center justify-between">
					<div>
						<h3 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
							{{ column.label }}
						</h3>
						<p v-if="column.meta" class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
							{{ column.meta }}
						</p>
					</div>
					<SourceDrawer
						v-if="column.sources?.length"
						:sources="column.sources"
						:title="column.label"
						button-label="Sources"
					/>
				</div>
				<div class="mt-3 flex flex-wrap gap-2">
					<VerificationBadge
						v-for="badge in column.badges ?? []"
						:key="`${column.id}-${badge.label}`"
						:label="badge.label"
						:tone="badge.tone"
					/>
				</div>
				<dl class="mt-4 space-y-3">
					<div
						v-for="row in props.rows"
						:key="`${column.id}-${row.id}`"
						class="px-4 py-3 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80"
					>
						<dt class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							{{ row.label }}
						</dt>
						<dd class="text-sm text-app-ink font-semibold mt-2 dark:text-app-text-dark">
							{{ cellFor(row, column.id)?.value ?? "Not documented yet" }}
						</dd>
						<p v-if="row.note || cellFor(row, column.id)?.note" class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
							{{ cellFor(row, column.id)?.note ?? row.note }}
						</p>
					</div>
				</dl>
			</article>
		</div>

		<p v-if="props.uncertainty" class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
			<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
			{{ props.uncertainty }}
		</p>
	</section>
</template>
