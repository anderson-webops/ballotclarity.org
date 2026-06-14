<script setup lang="ts">
import type { AdminContentHistoryItem, AdminContentSnapshot } from "~/types/civic";
import { FetchError } from "ofetch";

definePageMeta({
	layout: "admin",
	middleware: "admin"
});

const route = useRoute();
const contentId = computed(() => String(route.params.id || ""));
const { data: contentData, refresh: refreshContent } = await useAdminContent();
const { data: historyData, refresh: refreshHistory } = await useAdminContentHistory(contentId);

const item = computed(() => contentData.value?.items.find(entry => entry.id === contentId.value));
const rollbackId = ref<string | null>(null);
const confirmRollbackId = ref<string | null>(null);
const feedbackMessage = ref("");
const feedbackTone = ref<"error" | "success">("success");

const snapshotFields: Array<{
	key: keyof AdminContentSnapshot;
	label: string;
}> = [
	{ key: "status", label: "Status" },
	{ key: "published", label: "Published" },
	{ key: "priority", label: "Priority" },
	{ key: "assignedTo", label: "Assigned to" },
	{ key: "blocker", label: "Blocker" },
	{ key: "publishApprovedBy", label: "Publish approved by" },
	{ key: "publishApprovedAt", label: "Publish approved at" },
	{ key: "publishApprovalNote", label: "Publish approval note" },
	{ key: "publicSummary", label: "Public page summary" },
	{ key: "publicBallotSummary", label: "Ballot card summary" },
	{ key: "publishedAt", label: "Published at" }
];

function formatDate(value: string | undefined) {
	if (!value)
		return "Not set";

	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(new Date(value));
}

function snapshotValue(snapshot: AdminContentSnapshot, key: keyof AdminContentSnapshot) {
	const value = snapshot[key];

	if (typeof value === "boolean")
		return value ? "Yes" : "No";

	if (!value)
		return "Not set";

	return String(value);
}

function changedLabel(history: AdminContentHistoryItem) {
	return history.changedFields
		.map(field => snapshotFields.find(item => item.key === field)?.label || field)
		.join(", ");
}

async function rollback(history: AdminContentHistoryItem) {
	rollbackId.value = history.id;
	feedbackMessage.value = "";

	try {
		await $fetch(`/api/admin/content/${contentId.value}/rollback`, {
			body: {
				historyId: history.id
			},
			method: "POST"
		});
		feedbackMessage.value = "Content record rolled back.";
		feedbackTone.value = "success";
		confirmRollbackId.value = null;
		await Promise.all([refreshContent(), refreshHistory()]);
	}
	catch (error) {
		feedbackMessage.value = error instanceof FetchError
			? error.data?.message || error.statusMessage || "Unable to roll back content."
			: "Unable to roll back content.";
		feedbackTone.value = "error";
	}
	finally {
		rollbackId.value = null;
	}
}

usePageSeo({
	description: "Internal Ballot Clarity content history and rollback controls.",
	path: `/admin/content/${contentId.value}`,
	robots: "noindex,nofollow",
	title: item.value ? `${item.value.title} history` : "Content history"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<NuxtLink to="/admin/content" class="text-sm text-app-muted font-semibold rounded-full dark:text-app-muted-dark hover:text-app-ink focus-ring dark:hover:text-app-text-dark">
				Back to content
			</NuxtLink>
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-6 uppercase dark:text-app-muted-dark">
				Content history
			</p>
			<h1 class="text-5xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
				{{ item?.title || "Content record" }}
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
				Review saved public-copy changes before restoring an earlier version. Rollbacks create a new history entry so the recovery path remains auditable.
			</p>
		</header>

		<p
			v-if="feedbackMessage"
			class="text-sm px-4 py-3 rounded-2xl"
			:class="feedbackTone === 'success'
				? 'text-[#0f5b45] bg-[#e6f4ef] dark:text-[#9ae6c2] dark:bg-[#11352c]'
				: 'text-[#8B3A2E] bg-[#F8E6E1] dark:text-[#FFD4CB] dark:bg-[#472722]'"
		>
			{{ feedbackMessage }}
		</p>

		<AdminEmptyState
			v-if="!item"
			action-label="Return to content"
			action-to="/admin/content"
			eyebrow="Content record unavailable"
			message="This content record is not available in the current admin dataset."
			title="No record found"
		/>

		<div v-else class="space-y-6">
			<article class="surface-panel">
				<div class="flex flex-wrap gap-2">
					<TrustBadge :label="item.entityType" />
					<TrustBadge :label="item.status" :tone="item.status === 'published' ? 'accent' : item.status === 'needs-sources' ? 'warning' : 'neutral'" />
					<TrustBadge :label="item.published ? 'Published' : 'Internal only'" :tone="item.published ? 'accent' : 'warning'" />
				</div>
				<div class="mt-6 gap-5 grid md:grid-cols-2 xl:grid-cols-4">
					<div class="p-5 border border-app-line rounded-3xl bg-white/70 dark:border-app-line-dark dark:bg-app-panel-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Owner
						</p>
						<p class="text-lg text-app-ink font-semibold mt-3 dark:text-app-text-dark">
							{{ item.assignedTo }}
						</p>
					</div>
					<div class="p-5 border border-app-line rounded-3xl bg-white/70 dark:border-app-line-dark dark:bg-app-panel-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Priority
						</p>
						<p class="text-lg text-app-ink font-semibold mt-3 dark:text-app-text-dark">
							{{ item.priority }}
						</p>
					</div>
					<div class="p-5 border border-app-line rounded-3xl bg-white/70 dark:border-app-line-dark dark:bg-app-panel-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Updated
						</p>
						<p class="text-lg text-app-ink font-semibold mt-3 dark:text-app-text-dark">
							{{ formatDate(item.updatedAt) }}
						</p>
					</div>
					<div class="p-5 border border-app-line rounded-3xl bg-white/70 dark:border-app-line-dark dark:bg-app-panel-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Revisions
						</p>
						<p class="text-lg text-app-ink font-semibold mt-3 dark:text-app-text-dark">
							{{ historyData?.history.length ?? 0 }}
						</p>
					</div>
				</div>
			</article>

			<AdminEmptyState
				v-if="!(historyData?.history.length ?? 0)"
				action-label="Edit content"
				action-to="/admin/content"
				eyebrow="No revisions"
				message="This record has not been changed since content history was enabled."
				title="No rollback point exists yet"
			/>

			<article v-for="history in historyData?.history ?? []" :key="history.id" class="surface-panel">
				<div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							{{ formatDate(history.changedAt) }}
						</p>
						<h2 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							{{ history.summary }}
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							Changed fields: {{ changedLabel(history) }}
						</p>
					</div>
					<div v-if="confirmRollbackId === history.id" class="p-4 border border-app-line rounded-3xl bg-white/70 shrink-0 space-y-3 dark:border-app-line-dark dark:bg-app-panel-dark/70">
						<p class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
							Restore the version from {{ formatDate(history.changedAt) }}?
						</p>
						<div class="flex flex-wrap gap-2">
							<button type="button" class="btn-secondary !px-4 !py-2" :disabled="rollbackId === history.id" @click="confirmRollbackId = null">
								Cancel
							</button>
							<button type="button" class="btn-primary !px-4 !py-2" :disabled="rollbackId === history.id" @click="rollback(history)">
								{{ rollbackId === history.id ? "Rolling back..." : "Confirm rollback" }}
							</button>
						</div>
					</div>
					<button v-else type="button" class="btn-secondary shrink-0" @click="confirmRollbackId = history.id">
						Restore previous version
					</button>
				</div>

				<div class="mt-6 gap-4 grid lg:grid-cols-2">
					<div class="p-5 border border-app-line rounded-3xl bg-white/70 dark:border-app-line-dark dark:bg-app-panel-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Before
						</p>
						<dl class="mt-4 space-y-4">
							<div v-for="field in snapshotFields" :key="`previous-${history.id}-${field.key}`">
								<dt class="text-xs text-app-muted font-semibold uppercase dark:text-app-muted-dark">
									{{ field.label }}
								</dt>
								<dd class="text-sm text-app-ink leading-6 mt-1 whitespace-pre-wrap dark:text-app-text-dark">
									{{ snapshotValue(history.previous, field.key) }}
								</dd>
							</div>
						</dl>
					</div>
					<div class="p-5 border border-app-line rounded-3xl bg-white/70 dark:border-app-line-dark dark:bg-app-panel-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							After
						</p>
						<dl class="mt-4 space-y-4">
							<div v-for="field in snapshotFields" :key="`next-${history.id}-${field.key}`">
								<dt class="text-xs text-app-muted font-semibold uppercase dark:text-app-muted-dark">
									{{ field.label }}
								</dt>
								<dd class="text-sm text-app-ink leading-6 mt-1 whitespace-pre-wrap dark:text-app-text-dark">
									{{ snapshotValue(history.next, field.key) }}
								</dd>
							</div>
						</dl>
					</div>
				</div>
			</article>
		</div>
	</section>
</template>
