<script setup lang="ts">
import { contactEmail } from "~/constants";

const correctionHref = `mailto:${contactEmail}?subject=${encodeURIComponent("Ballot Clarity correction or dispute")}`;
const volunteerHref = `mailto:${contactEmail}?subject=${encodeURIComponent("Ballot Clarity volunteer or research inquiry")}`;
const generalHref = `mailto:${contactEmail}?subject=${encodeURIComponent("Ballot Clarity general inquiry")}`;

const correctionChecklist = [
	"The page URL or route where you found the issue.",
	"The specific sentence, claim, quote, or label that needs review.",
	"A short explanation of what seems incorrect, incomplete, or unevenly framed.",
	"Supporting documentation or links, preferably primary sources such as filings, official records, transcripts, or public notices.",
	"Any timing note that matters, such as a recent filing, late correction, or new election-office notice."
];

const reviewSteps = [
	{
		description: "The request is logged, categorized, and checked for the specific claim, page, and sources at issue.",
		title: "1. Intake"
	},
	{
		description: "A reviewer compares the reported issue against the attached records, page citations, and any newly submitted primary sources.",
		title: "2. Verification"
	},
	{
		description: "Ballot Clarity may correct the claim, add missing context, attach additional sourcing, or note that the information remains disputed.",
		title: "3. Resolution"
	},
	{
		description: "If the change is substantive, the page should receive a visible update note rather than a silent rewrite.",
		title: "4. Public update"
	}
];

const outcomes = [
	"Correct a factual error.",
	"Add clarification, sourcing, or procedural context.",
	"Add a note explaining that a claim is disputed or still being verified.",
	"Decline the request if the content remains accurate and appropriately sourced."
];

const handlingNotes = [
	"We aim to acknowledge correction requests within 2 business days.",
	"We aim to resolve straightforward factual issues within 7 business days. Complex disputes can take longer when multiple records or jurisdictions are involved.",
	"Ballot Clarity will not remove accurate, well-sourced information solely because it is unfavorable to a candidate, committee, or other subject.",
	"Do not send Social Security numbers, financial account data, unpublished home addresses, or other sensitive personal information."
];

usePageSeo({
	description: "Contact Ballot Clarity, request a correction, or review the public dispute and update process for source-backed civic information.",
	path: "/contact",
	title: "Contact"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<div class="flex flex-wrap gap-2">
				<TrustBadge label="Contact" tone="accent" />
				<TrustBadge label="Corrections path" />
				<TrustBadge label="Public update process" tone="warning" />
			</div>
			<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
				Contact and correction requests
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 max-w-3xl dark:text-app-muted-dark">
				Use this page to report factual issues, flag missing context, challenge framing, or send research and volunteer inquiries. Corrections are treated as part of the product's trust model, not as a private side channel.
			</p>
		</header>

		<section class="gap-6 grid lg:grid-cols-3">
			<div class="surface-panel">
				<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					Report an error or dispute
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					Use this when a page appears inaccurate, incomplete, unevenly framed, misquoted, or missing an important public record.
				</p>
				<a :href="correctionHref" class="btn-primary mt-6">
					Email a correction request
				</a>
			</div>

			<div class="surface-panel">
				<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					Volunteer or research
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					Researchers, designers, civic technologists, and public-interest reviewers can use this route for collaboration or independent review.
				</p>
				<a :href="volunteerHref" class="btn-secondary mt-6">
					Send a volunteer inquiry
				</a>
			</div>

			<div class="surface-panel">
				<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					General contact
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					For general questions about Ballot Clarity, the MVP, or the nonprofit concept, use the direct project inbox.
				</p>
				<a :href="generalHref" class="btn-secondary mt-6">
					Email {{ contactEmail }}
				</a>
			</div>
		</section>

		<section class="gap-6 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
			<div class="surface-panel">
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					What to include in a correction request
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in correctionChecklist" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>

			<div class="space-y-4">
				<InfoCallout title="Response target">
					We aim to acknowledge correction requests within 2 business days and resolve straightforward factual issues within 7 business days.
				</InfoCallout>
				<InfoCallout title="Good-faith standard" tone="warning">
					Ballot Clarity will not remove accurate, well-sourced information solely because it is unfavorable. The purpose of the correction path is accuracy and fairness, not reputation management.
				</InfoCallout>
				<InfoCallout title="Related pages">
					Read the <NuxtLink to="/neutrality" class="underline underline-offset-3">
						neutrality policy
					</NuxtLink>, <NuxtLink to="/methodology" class="underline underline-offset-3">
						methodology notes
					</NuxtLink>, and <NuxtLink to="/privacy" class="underline underline-offset-3">
						privacy notice
					</NuxtLink> to see how source review, dispute handling, and contact data are handled together.
				</InfoCallout>
			</div>
		</section>

		<section class="surface-panel">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				Process
			</p>
			<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
				What happens after you send a request
			</h2>
			<div class="mt-6 gap-4 grid lg:grid-cols-4">
				<article v-for="step in reviewSteps" :key="step.title" class="px-5 py-5 border border-app-line/80 rounded-3xl bg-white/80 dark:border-app-line-dark dark:bg-app-panel-dark/70">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						{{ step.title }}
					</p>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						{{ step.description }}
					</p>
				</article>
			</div>
		</section>

		<section class="gap-6 grid lg:grid-cols-2">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Possible outcomes
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					How a request can be resolved
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in outcomes" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>

			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Handling notes
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Standards around timing, fairness, and sensitive data
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in handlingNotes" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>
		</section>
	</section>
</template>
