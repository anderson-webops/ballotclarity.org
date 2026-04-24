<template>
	<section class="app-shell">
		<div class="gap-8 grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					What Ballot Clarity shows
				</p>
				<ul class="mt-6 space-y-5">
					<li class="flex gap-4">
						<span class="text-sm text-app-ink font-semibold mt-1 rounded-full bg-app-bg inline-flex h-8 w-8 items-center justify-center dark:text-app-text-dark dark:bg-app-bg-dark/70">1</span>
						<div>
							<p class="text-app-ink font-semibold dark:text-app-text-dark">
								Districts and current officials
							</p>
							<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
								Use lookup results, district pages, and representative pages to see the offices tied to your area.
							</p>
						</div>
					</li>
					<li class="flex gap-4">
						<span class="text-sm text-app-ink font-semibold mt-1 rounded-full bg-app-bg inline-flex h-8 w-8 items-center justify-center dark:text-app-text-dark dark:bg-app-bg-dark/70">2</span>
						<div>
							<p class="text-app-ink font-semibold dark:text-app-text-dark">
								Official election links
							</p>
							<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
								Use the attached voter portals, election offices, and polling tools for final deadline, precinct, and ballot confirmation.
							</p>
						</div>
					</li>
					<li class="flex gap-4">
						<span class="text-sm text-app-ink font-semibold mt-1 rounded-full bg-app-bg inline-flex h-8 w-8 items-center justify-center dark:text-app-text-dark dark:bg-app-bg-dark/70">3</span>
						<div>
							<p class="text-app-ink font-semibold dark:text-app-text-dark">
								Local guides where available
							</p>
							<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
								When Ballot Clarity has a local guide for an area, ballot, candidate, and measure pages open from the same workflow.
							</p>
						</div>
					</li>
				</ul>
			</div>

			<InfoCallout title="How to use this safely" tone="warning" class="self-start">
				Ballot Clarity should only show local guide pages when that material is ready. When a guide is not available, use the lookup results and the linked official election tools instead.
				<NuxtLink to="/methodology" class="underline underline-offset-3" prefetch-on="interaction">
					Read the methodology
				</NuxtLink>
				for more on sourcing, freshness, and review standards.
			</InfoCallout>
		</div>
	</section>
</template>
