<script setup lang="ts">
import type { AdminCorrectionStatus, AdminPriority } from "~/types/civic";
import { FetchError } from "ofetch";

definePageMeta({
	layout: "admin",
	middleware: "admin"
});

const { data, refresh } = await useAdminCorrections();
const statusOptions: AdminCorrectionStatus[] = ["new", "triaged", "researching", "resolved"];
const priorityOptions: AdminPriority[] = ["high", "medium", "low"];
const savingId = ref<string | null>(null);
const feedbackMessage = ref("");
const feedbackTone = ref<"error" | "success">("success");

async function saveCorrection(id: string, payload: {
	nextStep?: string;
	priority?: AdminPriority;
	status?: AdminCorrectionStatus;
}) {
	savingId.value = id;
	feedbackMessage.value = "";

	try {
		await $fetch(`/api/admin/corrections/${id}`, {
			body: payload,
			method: "PATCH"
		});
		feedbackMessage.value = "Correction record updated.";
		feedbackTone.value = "success";
		await refresh();
	}
	catch (error) {
		feedbackMessage.value = error instanceof FetchError
			? error.data?.message || error.statusMessage || "Unable to update correction."
			: "Unable to update correction.";
		feedbackTone.value = "error";
	}
	finally {
		savingId.value = null;
	}
}

usePageSeo({
	description: "Internal Ballot Clarity corrections queue.",
	path: "/admin/corrections",
	robots: "noindex,nofollow",
	title: "Admin corrections queue"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				Corrections queue
			</p>
			<h1 class="text-5xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
				Reported issues and next steps
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
				Reader and internal reports stay visible here from submission through resolution. The goal is traceability, not silent edits.
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

		<div class="space-y-5">
			<article v-for="item in data?.corrections ?? []" :key="item.id" class="surface-panel">
				<div class="gap-6 grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
					<div class="min-w-0">
						<div class="flex flex-wrap gap-2">
							<TrustBadge :label="item.submissionType" :tone="item.submissionType === 'correction' ? 'warning' : 'neutral'" />
							<TrustBadge :label="item.entityType" />
							<TrustBadge :label="item.status" :tone="item.status === 'resolved' ? 'accent' : item.status === 'new' ? 'warning' : 'neutral'" />
							<TrustBadge :label="`${item.priority} priority`" :tone="item.priority === 'high' ? 'warning' : 'neutral'" />
						</div>
						<h2 class="text-3xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
							{{ item.subject }}
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							{{ item.summary }}
						</p>
						<div class="mt-5 px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.16em] font-semibold uppercase dark:text-app-muted-dark">
								Next step
							</p>
							<p class="text-sm text-app-ink leading-7 mt-2 dark:text-app-text-dark">
								{{ item.nextStep }}
							</p>
						</div>
					</div>

					<form class="space-y-4" @submit.prevent="saveCorrection(item.id, item)">
						<div class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.16em] font-semibold uppercase dark:text-app-muted-dark">
								Entity
							</p>
							<p class="text-sm text-app-ink font-semibold mt-2 dark:text-app-text-dark">
								{{ item.entityLabel }}
							</p>
						</div>
						<div class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.16em] font-semibold uppercase dark:text-app-muted-dark">
								Reported by
							</p>
							<p class="text-sm text-app-ink font-semibold mt-2 break-all dark:text-app-text-dark">
								{{ item.reportedBy }}
							</p>
						</div>
						<div class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.16em] font-semibold uppercase dark:text-app-muted-dark">
								Attached sources
							</p>
							<p class="text-sm text-app-ink font-semibold mt-2 dark:text-app-text-dark">
								{{ item.sourceCount }}
							</p>
						</div>
						<div class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<UpdatedAt :value="item.submittedAt" label="Submitted" />
						</div>
						<label class="block">
							<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Status</span>
							<select
								v-model="item.status"
								class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
							>
								<option v-for="status in statusOptions" :key="status" :value="status">
									{{ status }}
								</option>
							</select>
						</label>
						<label class="block">
							<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Priority</span>
							<select
								v-model="item.priority"
								class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
							>
								<option v-for="priority in priorityOptions" :key="priority" :value="priority">
									{{ priority }}
								</option>
							</select>
						</label>
						<label class="block">
							<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Next step</span>
							<textarea
								v-model="item.nextStep"
								rows="4"
								class="text-sm text-app-ink mt-2 px-4 py-3 border border-app-line rounded-2xl bg-white min-h-28 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
							/>
						</label>
						<button type="submit" class="btn-primary w-full" :disabled="savingId === item.id">
							{{ savingId === item.id ? "Saving..." : "Save correction" }}
						</button>
					</form>
				</div>
			</article>
		</div>
	</section>
</template>
