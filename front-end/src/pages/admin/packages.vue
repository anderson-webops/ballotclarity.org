<script setup lang="ts">
import type { GuidePackageRecord, GuidePackageStatus } from "~/types/civic";
import { FetchError } from "ofetch";

definePageMeta({
	layout: "admin",
	middleware: "admin"
});

const { data, refresh } = await useAdminGuidePackages();

const draftElectionSlug = ref("2026-fulton-county-general");
const draftJurisdictionSlug = ref("fulton-county-georgia");
const savingId = ref<string | null>(null);
const feedbackMessage = ref("");
const feedbackTone = ref<"error" | "success">("success");

const statusOptions: GuidePackageStatus[] = ["draft", "in_review", "ready_to_publish", "published"];

function statusLabel(status: GuidePackageStatus) {
	return status.replaceAll("_", " ");
}

function statusTone(status: GuidePackageStatus) {
	if (status === "published")
		return "accent" as const;

	if (status === "ready_to_publish")
		return "warning" as const;

	return "neutral" as const;
}

function summarizeBlockingIssues(packageRecord: GuidePackageRecord) {
	if (!packageRecord.diagnostics.blockingIssueCount)
		return "No blocking publish checks are open.";

	return `${packageRecord.diagnostics.blockingIssueCount} blocking publish check${packageRecord.diagnostics.blockingIssueCount === 1 ? "" : "s"} still need resolution.`;
}

async function withPackageAction(id: string | null, action: () => Promise<void>) {
	savingId.value = id;
	feedbackMessage.value = "";

	try {
		await action();
		feedbackMessage.value = "Guide package updated.";
		feedbackTone.value = "success";
		await refresh();
	}
	catch (error) {
		feedbackMessage.value = error instanceof FetchError
			? error.data?.message || error.statusMessage || "Unable to update guide package."
			: "Unable to update guide package.";
		feedbackTone.value = "error";
	}
	finally {
		savingId.value = null;
	}
}

async function createDraft() {
	await withPackageAction("new-package", async () => {
		await $fetch("/api/admin/packages", {
			body: {
				electionSlug: draftElectionSlug.value,
				jurisdictionSlug: draftJurisdictionSlug.value || undefined,
			},
			method: "POST",
		});
	});
}

async function savePackage(item: GuidePackageRecord) {
	await withPackageAction(item.workflow.id, async () => {
		await $fetch(`/api/admin/packages/${item.workflow.id}`, {
			body: {
				coverageLimits: item.workflow.coverageLimits,
				coverageNotes: item.workflow.coverageNotes,
				reviewNotes: item.workflow.reviewNotes,
				reviewer: item.workflow.reviewer,
				status: item.workflow.status === "published" ? undefined : item.workflow.status,
			},
			method: "PATCH",
		});
	});
}

async function publishPackage(item: GuidePackageRecord) {
	await withPackageAction(item.workflow.id, async () => {
		await $fetch(`/api/admin/packages/${item.workflow.id}/publish`, {
			body: {
				reviewNotes: item.workflow.reviewNotes,
				reviewer: item.workflow.reviewer,
			},
			method: "POST",
		});
	});
}

async function unpublishPackage(item: GuidePackageRecord) {
	await withPackageAction(item.workflow.id, async () => {
		await $fetch(`/api/admin/packages/${item.workflow.id}/unpublish`, {
			body: {
				reviewNotes: item.workflow.reviewNotes,
				reviewer: item.workflow.reviewer,
			},
			method: "POST",
		});
	});
}

usePageSeo({
	description: "Internal Ballot Clarity guide-package drafting, review, and publication controls.",
	path: "/admin/packages",
	robots: "noindex,nofollow",
	title: "Admin guide packages"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				Guide packages
			</p>
			<h1 class="text-5xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
				Draft, review, and publish local guide packages
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
				Package publication is the switch that moves a jurisdiction from lookup-only coverage into a real local guide. Use this page to inspect blocking diagnostics, review notes, and the explicit publish gate.
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

		<section class="surface-panel">
			<div class="gap-4 grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
				<div class="gap-4 grid md:grid-cols-2">
					<label class="block">
						<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Election slug</span>
						<input
							v-model="draftElectionSlug"
							type="text"
							class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						>
					</label>
					<label class="block">
						<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Jurisdiction slug</span>
						<input
							v-model="draftJurisdictionSlug"
							type="text"
							class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						>
					</label>
				</div>
				<button type="button" class="btn-primary" :disabled="savingId === 'new-package'" @click="createDraft">
					{{ savingId === 'new-package' ? "Generating..." : "Generate draft package" }}
				</button>
			</div>
		</section>

		<div class="space-y-5">
			<article v-for="item in data?.packages ?? []" :key="item.workflow.id" class="surface-panel">
				<div class="gap-6 grid xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
					<div>
						<div class="flex flex-wrap gap-2">
							<TrustBadge :label="statusLabel(item.workflow.status)" :tone="statusTone(item.workflow.status)" />
							<TrustBadge :label="`${item.diagnostics.completenessScore}% complete`" :tone="item.diagnostics.readyToPublish ? 'accent' : 'warning'" />
							<TrustBadge :label="item.diagnostics.readyToPublish ? 'Ready checks pass' : 'Blocking checks open'" :tone="item.diagnostics.readyToPublish ? 'accent' : 'warning'" />
						</div>
						<h2 class="text-3xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
							{{ item.coverageScope.label }}
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							{{ summarizeBlockingIssues(item) }}
						</p>

						<div class="mt-5 gap-4 grid md:grid-cols-2 xl:grid-cols-3">
							<div class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
								<p class="text-xs text-app-muted tracking-[0.16em] font-semibold uppercase dark:text-app-muted-dark">
									Counts
								</p>
								<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
									{{ item.counts.contests }} contests · {{ item.counts.candidates }} candidates · {{ item.counts.measures }} measures
								</p>
							</div>
							<div class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
								<p class="text-xs text-app-muted tracking-[0.16em] font-semibold uppercase dark:text-app-muted-dark">
									Sources
								</p>
								<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
									{{ item.counts.officialResources }} official resources · {{ item.counts.attachedSources }} attached source records
								</p>
							</div>
							<div class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
								<p class="text-xs text-app-muted tracking-[0.16em] font-semibold uppercase dark:text-app-muted-dark">
									Workflow
								</p>
								<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
									Drafted {{ item.workflow.draftedAt ? item.workflow.draftedAt.slice(0, 10) : "—" }} · Published {{ item.workflow.publishedAt ? item.workflow.publishedAt.slice(0, 10) : "No" }}
								</p>
							</div>
						</div>

						<div class="mt-6 gap-4 grid lg:grid-cols-2">
							<div>
								<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
									Publish checklist
								</p>
								<ul class="readable-list text-sm text-app-muted mt-4 dark:text-app-muted-dark">
									<li v-for="check in item.diagnostics.checklist" :key="check.id" class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
										<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
											{{ check.label }}
										</p>
										<p class="text-xs tracking-[0.16em] font-semibold mt-2 uppercase" :class="check.passed ? 'text-app-accent' : 'text-[#8B3A2E] dark:text-[#FFD4CB]'">
											{{ check.passed ? 'passed' : 'open' }} · {{ check.pipelineClass.replaceAll('_', ' ') }}
										</p>
										<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
											{{ check.detail }}
										</p>
									</li>
								</ul>
							</div>
							<div>
								<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
									Diagnostics
								</p>
								<ul class="readable-list text-sm text-app-muted mt-4 dark:text-app-muted-dark">
									<li v-for="issue in item.diagnostics.issues" :key="issue.id" class="px-4 py-4 border rounded-[1.4rem]" :class="issue.blocking ? 'border-[#E7B9AA] bg-[#FBEEE8] dark:border-[#6D433C] dark:bg-[#3A2421]' : 'border-app-line/80 bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70'">
										<p class="text-sm font-semibold" :class="issue.blocking ? 'text-[#8B3A2E] dark:text-[#FFD4CB]' : 'text-app-ink dark:text-app-text-dark'">
											{{ issue.title }}
										</p>
										<p class="text-xs tracking-[0.16em] font-semibold mt-2 uppercase" :class="issue.blocking ? 'text-[#8B3A2E] dark:text-[#FFD4CB]' : 'text-app-muted dark:text-app-muted-dark'">
											{{ issue.kind.replaceAll('_', ' ') }} · {{ issue.pipelineClass.replaceAll('_', ' ') }}
										</p>
										<p class="text-sm leading-7 mt-3" :class="issue.blocking ? 'text-[#8B3A2E] dark:text-[#FFD4CB]' : 'text-app-muted dark:text-app-muted-dark'">
											{{ issue.summary }}
										</p>
									</li>
								</ul>
							</div>
						</div>

						<div class="mt-6 flex flex-wrap gap-3">
							<NuxtLink v-if="item.election?.slug && item.workflow.status === 'published'" :to="`/ballot/${item.election.slug}`" class="btn-primary">
								Open public ballot guide
							</NuxtLink>
							<NuxtLink v-if="item.jurisdiction?.slug && item.workflow.status === 'published'" :to="`/locations/${item.jurisdiction.slug}`" class="btn-secondary">
								Open public jurisdiction page
							</NuxtLink>
						</div>
					</div>

					<form class="space-y-4" @submit.prevent="savePackage(item)">
						<label class="block">
							<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Status</span>
							<select
								v-model="item.workflow.status"
								class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
							>
								<option v-for="status in statusOptions" :key="status" :value="status">
									{{ statusLabel(status) }}
								</option>
							</select>
						</label>

						<label class="block">
							<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Reviewer</span>
							<input
								v-model="item.workflow.reviewer"
								type="text"
								class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
							>
						</label>

						<label class="block">
							<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Review notes</span>
							<textarea
								v-model="item.workflow.reviewNotes"
								rows="4"
								class="text-sm text-app-ink mt-2 px-4 py-3 border border-app-line rounded-2xl bg-white min-h-32 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
							/>
						</label>

						<label class="block">
							<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Coverage notes</span>
							<textarea
								:value="item.workflow.coverageNotes.join('\n')"
								rows="4"
								class="text-sm text-app-ink mt-2 px-4 py-3 border border-app-line rounded-2xl bg-white min-h-32 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
								@input="item.workflow.coverageNotes = String(($event.target as HTMLTextAreaElement).value).split('\n').map(line => line.trim()).filter(Boolean)"
							/>
						</label>

						<label class="block">
							<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Coverage limits</span>
							<textarea
								:value="item.workflow.coverageLimits.join('\n')"
								rows="4"
								class="text-sm text-app-ink mt-2 px-4 py-3 border border-app-line rounded-2xl bg-white min-h-32 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
								@input="item.workflow.coverageLimits = String(($event.target as HTMLTextAreaElement).value).split('\n').map(line => line.trim()).filter(Boolean)"
							/>
						</label>

						<div class="flex flex-col gap-3">
							<button type="submit" class="btn-secondary w-full" :disabled="savingId === item.workflow.id">
								{{ savingId === item.workflow.id ? "Saving..." : "Save workflow state" }}
							</button>
							<button v-if="item.workflow.status !== 'published'" type="button" class="btn-primary w-full" :disabled="savingId === item.workflow.id" @click="publishPackage(item)">
								Publish package
							</button>
							<button
								v-if="item.workflow.status === 'published'"
								type="button"
								class="btn-secondary w-full"
								:disabled="savingId === item.workflow.id"
								@click="unpublishPackage(item)"
							>
								Unpublish package
							</button>
						</div>
					</form>
				</div>
			</article>
		</div>
	</section>
</template>
