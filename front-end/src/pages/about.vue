<script setup lang="ts">
usePageSeo({
	description: "About Ballot Clarity, its sources, editorial standards, and corrections.",
	path: "/about",
	title: "About"
});
</script>

<template>
	<article class="app-shell section-gap">
		<div class="max-w-3xl">
			<h1 class="text-5xl text-app-ink font-serif dark:text-app-text-dark">
				About Ballot Clarity
			</h1>
			<p class="text-base text-app-muted leading-7 mt-6 dark:text-app-muted-dark">
				Ballot Clarity is a nonpartisan, public-interest civic-information site.
			</p>
			<section id="methodology" class="mt-10 scroll-mt-24" aria-labelledby="methodology-heading">
				<h2 id="methodology-heading" class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					Sources and editorial standards
				</h2>
				<ul class="readable-list text-base text-app-muted leading-7 mt-4 pl-5 dark:text-app-muted-dark">
					<li>Official election authorities and primary public records take precedence over campaign material and secondary reporting.</li>
					<li>Summaries cite supporting records and distinguish official text, candidate-supplied statements, and editorial explanation.</li>
					<li>Quotes preserve the speaker’s meaning. Disputed claims and serious allegations require attribution and supporting records.</li>
				</ul>
			</section>
			<section id="neutrality" class="mt-8 scroll-mt-24" aria-labelledby="neutrality-heading">
				<h2 id="neutrality-heading" class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					Neutrality
				</h2>
				<p class="text-base text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					Ballot Clarity does not endorse, rank, or score candidates or measures. Candidates in the same contest receive equal treatment. Measure summaries distinguish current law, proposed changes, YES and NO outcomes, fiscal effects, and attributed arguments.
				</p>
			</section>
			<section id="coverage" class="mt-8 scroll-mt-24" aria-labelledby="coverage-heading">
				<h2 id="coverage-heading" class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					Coverage and limits
				</h2>
				<p class="text-base text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					Coverage varies by location. Missing records do not establish that a candidate, contest, or measure is absent. ZIP codes and location guesses do not determine an exact ballot. Confirm ballot eligibility, deadlines, and polling locations with your election office.
				</p>
				<div class="text-sm font-semibold mt-4 flex flex-wrap gap-x-6 gap-y-2">
					<NuxtLink to="/coverage" class="text-app-accent rounded-sm underline underline-offset-3 focus-ring">
						Coverage
					</NuxtLink>
					<NuxtLink to="/sources" class="text-app-accent rounded-sm underline underline-offset-3 focus-ring">
						Sources
					</NuxtLink>
					<NuxtLink to="/help" class="text-app-accent rounded-sm underline underline-offset-3 focus-ring">
						Voting help
					</NuxtLink>
				</div>
			</section>
			<section id="corrections" class="mt-8 scroll-mt-24" aria-labelledby="corrections-heading">
				<h2 id="corrections-heading" class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					Contact and corrections
				</h2>
				<p class="text-base text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					Substantive corrections are recorded publicly. Accurate, well-sourced information is not removed solely because it is unfavorable.
				</p>
				<div class="text-sm font-semibold mt-4 flex flex-wrap gap-x-6 gap-y-2">
					<NuxtLink to="/contact" class="text-app-accent rounded-sm underline underline-offset-3 focus-ring">
						Contact
					</NuxtLink>
					<NuxtLink to="/corrections" class="text-app-accent rounded-sm underline underline-offset-3 focus-ring">
						Corrections log
					</NuxtLink>
				</div>
			</section>
		</div>
	</article>
</template>
