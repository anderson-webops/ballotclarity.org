<script setup lang="ts">
import { FetchError } from "ofetch";

definePageMeta({ layout: "admin", middleware: "admin" });
const { data, error, pending, refresh } = await useAdminGuidePackages();
const electionSlug = ref("");
const saving = ref(false);
const feedback = ref("");
async function createReview() {
	if (!data.value?.reviewOptions.some(option => option.electionSlug === electionSlug.value)) return;
	saving.value = true;
	feedback.value = "";
	try {
		const result = await $fetch<{ package: { workflow: { id: string } } }>("/api/admin/packages", { method: "POST", body: { electionSlug: electionSlug.value } });
		await navigateTo(`/admin/packages/${result.package.workflow.id}`);
	}
	catch (error) {
		feedback.value = error instanceof FetchError ? error.data?.message || "Unable to create publication review." : "Unable to create publication review.";
	}
	finally { saving.value = false; }
}
usePageSeo({ title: "Publication reviews", path: "/admin/packages", robots: "noindex,nofollow" });
</script>

<template>
	<section class="app-shell max-w-5xl space-y-16">
		<header>
			<NuxtLink to="/admin/exceptions" class="underline focus-ring">
				Exceptions
			</NuxtLink><h1 class="text-5xl font-serif mt-5">
				Publication reviews
			</h1>
		</header>
		<AdminLoadState :pending="pending" :error="Boolean(error)" label="publication reviews" @retry="refresh()" />
		<ul v-if="data && !error && !pending" class="divide-app-line divide-y dark:divide-app-line-dark">
			<li v-for="item in data.packages" :key="item.workflow.id">
				<NuxtLink :to="`/admin/packages/${item.workflow.id}`" class="py-6 block focus-ring">
					<h2 class="text-2xl font-serif">
						{{ item.coverageScope.label }}
					</h2><p class="text-app-muted mt-2 dark:text-app-muted-dark">
						{{ item.workflow.status.replaceAll('_', ' ') }} · {{ item.diagnostics.blockingIssueCount }} blockers · {{ item.diagnostics.warnings.length }} warnings
					</p>
				</NuxtLink>
			</li>
		</ul>
		<p v-if="data && !error && !pending && !data.packages.length">
			No publication reviews.
		</p>
		<section v-if="data && !error && !pending" class="max-w-xl space-y-5">
			<h2 class="text-3xl font-serif">
				New review
			</h2><p v-if="!data.reviewOptions.length">
				No elections are awaiting a new publication review.
			</p><form v-else class="space-y-5" @submit.prevent="createReview">
				<label class="block"><span>Election</span><select v-model="electionSlug" required class="text-app-ink mt-2 px-4 py-3 border border-app-line rounded-lg bg-white w-full block dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"><option disabled value="">Select an election</option><option v-for="option in data.reviewOptions" :key="option.electionSlug" :value="option.electionSlug">{{ option.name }} · {{ option.jurisdictionName }}</option></select></label><p v-if="feedback" role="alert">
					{{ feedback }}
				</p><button type="submit" class="btn-primary" :disabled="saving || !electionSlug">
					{{ saving ? 'Creating…' : 'Create review' }}
				</button>
			</form>
		</section>
	</section>
</template>
