<template>
	<section class="app-shell">
		<div class="gap-8 grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					How the current coverage is organized
				</p>
				<ul class="mt-6 space-y-5">
					<li class="flex gap-4">
						<span class="text-sm text-app-ink font-semibold mt-1 rounded-full bg-app-bg inline-flex h-8 w-8 items-center justify-center dark:text-app-text-dark dark:bg-app-bg-dark/70">1</span>
						<div>
							<p class="text-app-ink font-semibold dark:text-app-text-dark">
								One federal, one state, one local race
							</p>
							<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
								The ballot guide shows different contest types so the product can be tested against different evidence shapes and ballot layouts.
							</p>
						</div>
					</li>
					<li class="flex gap-4">
						<span class="text-sm text-app-ink font-semibold mt-1 rounded-full bg-app-bg inline-flex h-8 w-8 items-center justify-center dark:text-app-text-dark dark:bg-app-bg-dark/70">2</span>
						<div>
							<p class="text-app-ink font-semibold dark:text-app-text-dark">
								Plain-language ballot measure pages
							</p>
							<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
								Measures separate current law, proposed change, YES and NO outcomes, fiscal context, and attributed arguments so the user can scan structure before reading details.
							</p>
						</div>
					</li>
					<li class="flex gap-4">
						<span class="text-sm text-app-ink font-semibold mt-1 rounded-full bg-app-bg inline-flex h-8 w-8 items-center justify-center dark:text-app-text-dark dark:bg-app-bg-dark/70">3</span>
						<div>
							<p class="text-app-ink font-semibold dark:text-app-text-dark">
								Future-ready data architecture
							</p>
							<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
								The front end already consumes API-driven data, so published local coverage snapshots can replace empty or lookup-only states later without rewriting the page structure.
							</p>
						</div>
					</li>
				</ul>
			</div>

			<InfoCallout title="How we verify data" tone="warning">
				Ballot Clarity should only show published local data when a verified coverage snapshot exists. Otherwise the app should say that local coverage is unavailable and keep official election tools visible.
				<NuxtLink to="/methodology" class="underline underline-offset-3" prefetch-on="interaction">
					Read the methodology
				</NuxtLink>
				or open the footer’s data-verification panel for the current badge, freshness, and source rules.
			</InfoCallout>
		</div>
	</section>
</template>
