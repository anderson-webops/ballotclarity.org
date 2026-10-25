<script setup lang="ts">
import type {
	GuidePackageRecord,
	GuidePackageReviewRecommendation,
	GuidePackageStatus,
} from "~/types/civic";
import { FetchError } from "ofetch";

definePageMeta({
	layout: "admin",
	middleware: "admin"
});

const packageId = useRouteStringParam("id");
const { data: record, error, pending, refresh } = await useAdminGuidePackage(packageId);
const data = computed(() => record.value ? { packages: [record.value.package] } : null);
const { data: session } = await useAdminSession("admin-packages-session");

const savingId = ref<string | null>(null);
const feedbackMessage = ref("");
const feedbackTone = ref<"error" | "success">("success");
const unpublishReasons = reactive<Record<string, string>>({});
const canPublish = computed(() => session.value?.role === "admin" && Boolean(session.value.mfaEnabledAt));
const fieldClass = "text-app-ink mt-2 px-4 py-3 border border-app-line rounded-lg bg-white w-full block dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring";

const statusOptions: GuidePackageStatus[] = ["draft", "in_review", "ready_to_publish"];
const recommendationOptions: GuidePackageReviewRecommendation[] = [
	"publish",
	"publish_with_warnings",
	"needs_revision",
	"do_not_publish",
];

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

function recommendationLabel(value: GuidePackageReviewRecommendation | undefined) {
	return value ? value.replaceAll("_", " ") : "not set";
}

function recommendationTone(value: GuidePackageReviewRecommendation | undefined) {
	if (value === "publish")
		return "accent" as const;

	if (value === "publish_with_warnings" || value === "needs_revision" || value === "do_not_publish")
		return "warning" as const;

	return "neutral" as const;
}

function guideContentDetail(packageRecord: GuidePackageRecord) {
	const contestStatus = packageRecord.contentStatus.contests.status.replaceAll("_", " ");
	const measureStatus = packageRecord.contentStatus.measures.status.replaceAll("_", " ");

	return `${packageRecord.contentStatus.summary} Contests: ${contestStatus}; measures: ${measureStatus}.`;
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

async function savePackage(item: GuidePackageRecord) {
	await withPackageAction(item.workflow.id, async () => {
		await $fetch(`/api/admin/packages/${item.workflow.id}`, {
			body: {
				coverageLimits: item.workflow.coverageLimits,
				coverageNotes: item.workflow.coverageNotes,
				reviewNotes: item.workflow.reviewNotes,
				reviewRecommendation: item.workflow.reviewRecommendation,
				status: item.workflow.status === "published" ? undefined : item.workflow.status,
			},
			method: "PATCH",
		});
	});
}

async function publishPackage(item: GuidePackageRecord) {
	await withPackageAction(item.workflow.id, async () => {
		await $fetch(`/api/admin/packages/${item.workflow.id}/publish`, {
			body: {},
			method: "POST",
		});
	});
}

async function unpublishPackage(item: GuidePackageRecord) {
	await withPackageAction(item.workflow.id, async () => {
		await $fetch(`/api/admin/packages/${item.workflow.id}/unpublish`, {
			body: {
				reason: unpublishReasons[item.workflow.id],
			},
			method: "POST",
		});
		unpublishReasons[item.workflow.id] = "";
	});
}

usePageSeo({
	path: `/admin/packages/${packageId.value}`,
	robots: "noindex,nofollow",
	title: "Publication review"
});
</script>

<template>
	<section class="app-shell max-w-4xl space-y-16">
		<NuxtLink to="/admin/packages" class="underline focus-ring">
			Publication reviews
		</NuxtLink>
		<AdminLoadState :pending="pending" :error="Boolean(error)" label="publication review" @retry="refresh()" />
		<p v-if="feedbackMessage" role="status">
			{{ feedbackMessage }}
		</p>
		<h1 v-if="!pending && !error && !data" class="text-4xl font-serif">
			Publication review unavailable
		</h1>
		<template v-if="data && !error && !pending">
			<article v-for="item in data.packages" :key="item.workflow.id" class="space-y-16">
				<header class="space-y-6">
					<h1 class="text-4xl font-serif">
						{{ item.coverageScope.label }}
					</h1>
					<div class="flex flex-wrap gap-3">
						<TrustBadge :label="statusLabel(item.workflow.status)" :tone="statusTone(item.workflow.status)" />
						<TrustBadge :label="recommendationLabel(item.diagnostics.recommendation.final)" :tone="recommendationTone(item.diagnostics.recommendation.final)" />
					</div>
					<p class="text-app-muted dark:text-app-muted-dark">
						{{ item.counts.contests }} contests · {{ item.counts.candidates }} candidates · {{ item.counts.measures }} measures
					</p>
					<p>{{ guideContentDetail(item) }}</p>
				</header>
				<section class="space-y-6" aria-labelledby="review-findings">
					<h2 id="review-findings" class="text-3xl font-serif">
						Review findings
					</h2>
					<p>{{ item.diagnostics.recommendation.reason }}</p>
					<section v-if="item.diagnostics.blockers.length" class="space-y-4">
						<h3 class="text-xl font-semibold">
							Blocking publication
						</h3>
						<ul class="space-y-6">
							<li v-for="issue in item.diagnostics.blockers" :key="issue.id" class="pl-5 border-app-line border-l-2 dark:border-app-line-dark">
								<h4 class="font-semibold">
									{{ issue.title }}
								</h4>
								<p class="mt-2">
									{{ issue.summary }}
								</p>
							</li>
						</ul>
					</section>
					<section v-if="item.diagnostics.warnings.length" class="space-y-4">
						<h3 class="text-xl font-semibold">
							Warnings
						</h3>
						<ul class="space-y-6">
							<li v-for="issue in item.diagnostics.warnings" :key="issue.id" class="pl-5 border-app-line border-l-2 dark:border-app-line-dark">
								<h4 class="font-semibold">
									{{ issue.title }}
								</h4>
								<p class="mt-2">
									{{ issue.summary }}
								</p>
							</li>
						</ul>
					</section>
					<NuxtLink :to="`/admin/packages/rubric/${item.workflow.id}`" class="underline inline-block focus-ring">
						Full rubric and evidence
					</NuxtLink>
				</section>
				<section class="space-y-6" aria-labelledby="review-decision">
					<h2 id="review-decision" class="text-3xl font-serif">
						Decision
					</h2>
					<p v-if="item.workflow.reviewer">
						Reviewer: {{ item.workflow.reviewer }}
					</p>
					<form class="space-y-6" @submit.prevent="savePackage(item)">
						<label class="block">
							<span class="font-semibold">Status</span>
							<select v-model="item.workflow.status" :disabled="item.workflow.status === 'published'" :class="fieldClass">
								<option v-if="item.workflow.status === 'published'" value="published">Published</option>
								<option v-for="status in statusOptions" :key="status" :value="status">{{ statusLabel(status) }}</option>
							</select>
						</label>
						<label class="block">
							<span class="font-semibold">Publish recommendation</span>
							<select v-model="item.workflow.reviewRecommendation" :disabled="item.workflow.status === 'published'" :class="fieldClass">
								<option :value="undefined">Not set</option>
								<option v-for="recommendation in recommendationOptions" :key="recommendation" :value="recommendation">{{ recommendationLabel(recommendation) }}</option>
							</select>
						</label>
						<label class="block">
							<span class="font-semibold">Review notes</span>
							<textarea v-model="item.workflow.reviewNotes" :disabled="item.workflow.status === 'published'" rows="4" :class="fieldClass" />
						</label>
						<label class="block">
							<span class="font-semibold">Coverage notes</span>
							<textarea :value="item.workflow.coverageNotes.join('\n')" :disabled="item.workflow.status === 'published'" rows="3" :class="fieldClass" @input="item.workflow.coverageNotes = String(($event.target as HTMLTextAreaElement).value).split('\n').map(line => line.trim()).filter(Boolean)" />
						</label>
						<label class="block">
							<span class="font-semibold">Coverage limits</span>
							<textarea :value="item.workflow.coverageLimits.join('\n')" :disabled="item.workflow.status === 'published'" rows="3" :class="fieldClass" @input="item.workflow.coverageLimits = String(($event.target as HTMLTextAreaElement).value).split('\n').map(line => line.trim()).filter(Boolean)" />
						</label>
						<button v-if="item.workflow.status !== 'published'" type="submit" class="btn-secondary" :disabled="savingId === item.workflow.id">
							{{ savingId === item.workflow.id ? 'Saving...' : 'Save review' }}
						</button>
					</form>
					<p v-if="session?.role === 'admin' && !session.mfaEnabledAt">
						Enable <NuxtLink to="/admin/account" class="underline focus-ring">
							multi-factor authentication
						</NuxtLink> before publishing or unpublishing.
					</p>
					<button v-if="item.workflow.status !== 'published' && canPublish" type="button" class="btn-primary" :disabled="savingId === item.workflow.id || !item.diagnostics.readyToPublish || item.workflow.status !== 'ready_to_publish'" @click="publishPackage(item)">
						Publish
					</button>
					<form v-if="item.workflow.status === 'published' && canPublish" class="space-y-4" @submit.prevent="unpublishPackage(item)">
						<label class="block">
							<span class="font-semibold">Unpublish reason</span>
							<textarea v-model="unpublishReasons[item.workflow.id]" required rows="3" :class="fieldClass" />
						</label>
						<button type="submit" class="btn-secondary" :disabled="savingId === item.workflow.id || !unpublishReasons[item.workflow.id]?.trim()">
							Unpublish
						</button>
					</form>
				</section>
				<nav v-if="item.workflow.status === 'published'" class="flex flex-wrap gap-6" aria-label="Published pages">
					<NuxtLink v-if="item.election?.slug" :to="`/ballot/${item.election.slug}`" class="underline focus-ring">
						Ballot
					</NuxtLink>
					<NuxtLink v-if="item.jurisdiction?.slug" :to="`/locations/${item.jurisdiction.slug}`" class="underline focus-ring">
						Area
					</NuxtLink>
				</nav>
			</article>
		</template>
	</section>
</template>
