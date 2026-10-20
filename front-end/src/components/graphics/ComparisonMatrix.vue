<script setup lang="ts">
import type { ComparisonMatrixCell, ComparisonMatrixData, ComparisonMatrixRow } from "~/types/civic";

const props = defineProps<{
	matrix: ComparisonMatrixData;
}>();

function cellFor(row: ComparisonMatrixRow, columnId: string): ComparisonMatrixCell | undefined {
	return row.cells.find(cell => cell.columnId === columnId);
}
</script>

<template>
	<section v-if="props.matrix.columns.length && props.matrix.rows.length" class="surface-panel">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-4xl">
				<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
					{{ props.matrix.eyebrow || "Comparison matrix" }}
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ props.matrix.title }}
				</h2>
				<p v-if="props.matrix.note" class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.matrix.note }}
				</p>
			</div>
			<VerificationBadge label="Source-backed matrix" tone="accent" />
		</div>

		<div class="mt-6 border border-app-line rounded-xl hidden overflow-x-auto dark:border-app-line-dark lg:block">
			<table class="text-left min-w-[56rem] w-full border-collapse table-fixed">
				<caption class="sr-only">
					{{ props.matrix.title }}
				</caption>
				<colgroup>
					<col class="w-[16rem]">
					<col v-for="column in props.matrix.columns" :key="column.id">
				</colgroup>
				<thead>
					<tr>
						<td class="p-4 border-b border-app-line bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/80" />
						<th
							v-for="column in props.matrix.columns"
							:key="column.id"
							scope="col"
							:abbr="column.label"
							class="font-normal p-4 align-top border-b border-l border-app-line bg-app-panel dark:border-app-line-dark dark:bg-app-panel-dark"
						>
							<span class="text-lg text-app-ink font-serif block dark:text-app-text-dark">{{ column.label }}</span>
							<span v-if="column.meta" class="text-sm text-app-muted mt-2 block dark:text-app-muted-dark">{{ column.meta }}</span>
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
						</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="row in props.matrix.rows" :key="row.id">
						<th scope="row" :abbr="row.label" class="font-normal p-4 align-top border-b border-app-line bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/80">
							<span class="text-sm text-app-ink font-semibold block dark:text-app-text-dark">{{ row.label }}</span>
							<span v-if="row.note" class="text-xs text-app-muted leading-6 mt-2 block dark:text-app-muted-dark">{{ row.note }}</span>
						</th>
						<td
							v-for="column in props.matrix.columns"
							:key="`${row.id}-${column.id}`"
							class="p-4 align-top border-b border-l border-app-line bg-app-panel dark:border-app-line-dark dark:bg-app-panel-dark"
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
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="mt-6 space-y-4 lg:hidden">
			<article
				v-for="column in props.matrix.columns"
				:key="column.id"
				class="p-4 border border-app-line/80 rounded-xl bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70"
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
						v-for="row in props.matrix.rows"
						:key="`${column.id}-${row.id}`"
						class="px-4 py-3 border border-app-line/70 rounded-xl bg-app-panel dark:border-app-line-dark dark:bg-app-panel-dark/80"
					>
						<dt class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
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

		<p v-if="props.matrix.uncertainty" class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
			<strong class="text-app-ink dark:text-app-text-dark">Keep in mind:</strong>
			{{ props.matrix.uncertainty }}
		</p>
	</section>
</template>
