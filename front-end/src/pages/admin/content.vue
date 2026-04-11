<script setup lang="ts">
import type { AdminPriority, AdminReviewStatus } from "~/types/civic";
import { FetchError } from "ofetch";

definePageMeta({
	layout: "admin",
	middleware: "admin"
});

const { data, refresh } = await useAdminContent();

const statusOptions: AdminReviewStatus[] = ["draft", "in-review", "needs-sources", "ready-to-publish", "published"];
const priorityOptions: AdminPriority[] = ["high", "medium", "low"];

const savingId = ref<string | null>(null);
const feedbackMessage = ref("");
const feedbackTone = ref<"error" | "success">("success");

async function saveItem(id: string, payload: {
	assignedTo?: string;
	blocker?: string | null;
	priority?: AdminPriority;
	published?: boolean;
	status?: AdminReviewStatus;
}) {
	savingId.value = id;
	feedbackMessage.value = "";

	try {
		await $fetch(`/api/admin/content/${id}`, {
			body: payload,
			method: "PATCH"
		});
		feedbackMessage.value = "Content record updated.";
		feedbackTone.value = "success";
		await refresh();
	}
	catch (error) {
		feedbackMessage.value = error instanceof FetchError
			? error.data?.message || error.statusMessage || "Unable to update content."
			: "Unable to update content.";
		feedbackTone.value = "error";
	}
	finally {
		savingId.value = null;
	}
}

usePageSeo({
	description: "Internal Ballot Clarity content state and publish controls.",
	path: "/admin/content",
	robots: "noindex,nofollow",
	title: "Admin content"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				Content control
			</p>
			<h1 class="text-5xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
				Manage publish status and assignment
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
				Use this page to keep public content operationally coherent: who owns the item, whether it is published, and what is still blocking release.
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
			<article v-for="item in data?.items ?? []" :key="item.id" class="surface-panel">
				<div class="gap-6 grid xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
					<div>
						<div class="flex flex-wrap gap-2">
							<TrustBadge :label="item.entityType" />
							<TrustBadge :label="item.status" :tone="item.status === 'published' ? 'accent' : item.status === 'needs-sources' ? 'warning' : 'neutral'" />
							<TrustBadge :label="item.published ? 'Published' : 'Internal only'" :tone="item.published ? 'accent' : 'warning'" />
						</div>
						<h2 class="text-3xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
							{{ item.title }}
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							{{ item.summary }}
						</p>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							{{ item.sourceCoverage }}
						</p>
						<div class="mt-5 flex flex-wrap gap-3">
							<NuxtLink
								v-if="item.entityType === 'candidate'"
								:to="`/candidate/${item.entitySlug}`"
								class="btn-secondary"
							>
								Open public page
							</NuxtLink>
							<NuxtLink
								v-else-if="item.entityType === 'measure'"
								:to="`/measure/${item.entitySlug}`"
								class="btn-secondary"
							>
								Open public page
							</NuxtLink>
							<NuxtLink
								v-else-if="item.entityType === 'election'"
								:to="`/elections/${item.entitySlug}`"
								class="btn-secondary"
							>
								Open public page
							</NuxtLink>
						</div>
					</div>

					<form class="space-y-4" @submit.prevent="saveItem(item.id, item)">
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
							<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Assigned to</span>
							<input
								v-model="item.assignedTo"
								type="text"
								class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
							>
						</label>

						<label class="block">
							<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Blocker</span>
							<textarea
								v-model="item.blocker"
								rows="3"
								class="text-sm text-app-ink mt-2 px-4 py-3 border border-app-line rounded-2xl bg-white min-h-28 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
								placeholder="Leave blank if there is no blocker."
							/>
						</label>

						<label class="text-sm text-app-muted px-4 py-3 border border-app-line rounded-2xl bg-white flex gap-3 items-center dark:text-app-muted-dark dark:border-app-line-dark dark:bg-app-panel-dark">
							<input v-model="item.published" type="checkbox" class="accent-app-accent h-4 w-4">
							Published on the public site
						</label>

						<button type="submit" class="btn-primary w-full" :disabled="savingId === item.id">
							{{ savingId === item.id ? "Saving..." : "Save changes" }}
						</button>
					</form>
				</div>
			</article>
		</div>
	</section>
</template>
