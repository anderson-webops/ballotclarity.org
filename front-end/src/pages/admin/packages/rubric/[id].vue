<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin" });
const packageId = useRouteStringParam("id");
const { data, error, pending, refresh } = await useAdminGuidePackage(packageId);
usePageSeo({ title: "Publication rubric", path: `/admin/packages/rubric/${packageId.value}`, robots: "noindex,nofollow" });
</script>

<template>
	<section class="app-shell max-w-4xl space-y-16">
		<header class="space-y-6">
			<NuxtLink :to="`/admin/packages/${packageId}`" class="underline focus-ring">
				Publication review
			</NuxtLink>
			<h1 class="text-4xl font-serif">
				Full rubric and evidence
			</h1>
		</header>
		<AdminLoadState :pending="pending" :error="Boolean(error)" label="publication rubric" @retry="refresh()" />
		<template v-if="data && !error && !pending">
			<p>{{ data.package.coverageScope.label }} · {{ data.package.diagnostics.rubricVersion }}</p>
			<nav aria-label="Rubric categories">
				<ul class="space-y-3">
					<li v-for="group in data.package.diagnostics.checklistCategories" :key="group.id">
						<a :href="`#${group.id}`" class="underline focus-ring">{{ group.label }}</a>
					</li>
				</ul>
			</nav>
			<section v-for="group in data.package.diagnostics.checklistCategories" :id="group.id" :key="group.id" class="space-y-8">
				<header class="space-y-4">
					<h2 class="text-3xl font-serif">
						{{ group.label }}
					</h2>
					<p>{{ group.description }}</p>
				</header>
				<article v-for="check in group.items" :key="check.id" class="pt-8 border-t border-app-line space-y-5 dark:border-app-line-dark">
					<header class="space-y-3">
						<h3 class="text-xl font-semibold">
							{{ check.label }}
						</h3>
						<p class="text-app-muted dark:text-app-muted-dark">
							{{ check.status.replaceAll('_', ' ') }} · {{ check.evaluationMode.replaceAll('_', ' ') }} · {{ check.pipelineClass.replaceAll('_', ' ') }}
						</p>
						<p>{{ check.detail }}</p>
					</header>
					<dl class="space-y-5">
						<div>
							<dt class="font-semibold">
								What to check
							</dt><dd class="mt-2">
								{{ check.whatToCheck }}
							</dd>
						</div>
						<div>
							<dt class="font-semibold">
								Why it matters
							</dt><dd class="mt-2">
								{{ check.whyItMatters }}
							</dd>
						</div>
						<div>
							<dt class="font-semibold">
								Pass
							</dt><dd class="mt-2">
								{{ check.passStandard }}
							</dd>
						</div>
						<div>
							<dt class="font-semibold">
								Warning
							</dt><dd class="mt-2">
								{{ check.warningStandard }}
							</dd>
						</div>
						<div>
							<dt class="font-semibold">
								Fail
							</dt><dd class="mt-2">
								{{ check.failStandard }}
							</dd>
						</div>
						<div v-if="check.autoSignal">
							<dt class="font-semibold">
								Automated evidence
							</dt><dd class="mt-2">
								{{ check.autoSignal }}
							</dd>
						</div>
						<div v-if="check.reviewerSignal">
							<dt class="font-semibold">
								Reviewer evidence
							</dt><dd class="mt-2">
								{{ check.reviewerSignal }}
							</dd>
						</div>
					</dl>
				</article>
			</section>
		</template>
	</section>
</template>
