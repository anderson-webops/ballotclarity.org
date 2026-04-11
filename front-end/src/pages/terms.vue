<script setup lang="ts">
import { appName, appUrl, contactEmail } from "~/constants";

const effectiveAt = "2026-04-11T09:00:00-04:00";

const summaryCards = [
	{
		body: "Ballot Clarity is a source-first civic-information product. It is designed to help voters understand a ballot, not to tell them how to vote.",
		title: "Informational only"
	},
	{
		body: "The site is not an official government election website and is not affiliated with a state or local election office.",
		title: "Not official"
	},
	{
		body: "This MVP still includes clearly labeled demo data and experimental product surfaces. Time-sensitive election details should be verified with the relevant public authority.",
		title: "Demo and verification limits"
	}
];

const serviceScope = [
	"Ballot lookup and location-based ballot guides.",
	"Candidate, measure, compare, methodology, neutrality, privacy, accessibility, and help pages.",
	"Printable or shareable ballot-guide views generated from the current MVP.",
	"Public contact and correction-request routes."
];

const coreTerms = [
	`By accessing or using the Ballot Clarity website at ${appUrl}, you agree to these Terms of Service and the Privacy Notice.`,
	"If you do not agree to these terms, do not use the site.",
	"The current MVP does not require an account. A production launch may add a clearer click-through assent step before higher-risk features go live."
];

const noAdviceRules = [
	"The site provides civic information, not legal advice, campaign advice, election-administration advice, or individualized voting advice.",
	"Ballot Clarity does not endorse candidates, recommend ballot positions, or present contests as a leaderboard.",
	"Plain-language measure explanations and candidate summaries are intended to make public records more readable, not to replace the official source text."
];

const sourceAndTimelinessRules = [
	"Where possible, Ballot Clarity cites official records, primary public documents, candidate-provided materials, and other nonpartisan supporting sources.",
	"Election information can change quickly. Filing status, polling logistics, deadlines, and ballot composition should be confirmed with the relevant election office before you rely on them.",
	"Source links may lead to third-party sites. Ballot Clarity does not control those sites and does not endorse every statement or policy they contain."
];

const licenseRules = [
	"You may view, print, and share Ballot Clarity pages or ballot guides for personal, educational, journalistic, research, or other lawful noncommercial public-interest use.",
	"You may quote limited excerpts with attribution and without removing source labels, update dates, demo notices, or neutrality caveats.",
	"You may not present Ballot Clarity content as an official government publication, a campaign endorsement, or your own original election record without clear attribution."
];

const prohibitedUses = [
	"Do not overload, probe, attack, reverse engineer, or interfere with the site, its hosting, or its source systems.",
	"Do not use automated access in a way that bypasses rate limits, harms reliability, or creates misleading bulk republication of the service.",
	"Do not use the site to impersonate an election office, spread voter confusion, or create fraudulent voting materials.",
	"Do not remove demo labels, source context, correction notes, or trust signals when redistributing content.",
	"Do not submit knowingly false correction requests, malicious files, or sensitive personal information that the project does not need."
];

const correctionsAndFeedback = [
	"Correction and dispute requests should go through the public contact route so the project can review the claim against sources.",
	"If you send feedback, supporting documents, or correction materials, you represent that you have the right to share them and that they are accurate to the best of your knowledge.",
	"Ballot Clarity may use submitted feedback and source suggestions to review, improve, and correct the service, while you keep any rights you already own in your original material.",
	"Accurate, well-sourced information may remain published even when it is unfavorable to a candidate, committee, or other subject."
];

const futureFeatureRules = [
	"If Ballot Clarity later adds accounts, newsletters, donations, APIs, or user-submission features, additional or revised terms may apply.",
	"Those features should not go live until the public terms, privacy notice, and operational policies are updated to match them."
];

const legalLimits = [
	"The site is provided on an \"as is\" and \"as available\" basis while the product remains in MVP form.",
	"Ballot Clarity does not guarantee that every page will be complete, current, uninterrupted, secure, or free from error.",
	"To the fullest extent permitted by applicable law, Ballot Clarity disclaims warranties of accuracy, merchantability, fitness for a particular purpose, and non-infringement.",
	"To the fullest extent permitted by applicable law, Ballot Clarity is not liable for indirect, incidental, special, consequential, or punitive damages arising from use of the site.",
	"Nothing in these terms is intended to waive liability that cannot lawfully be disclaimed, including liability for fraud, willful misconduct, or other non-waivable obligations under applicable law."
];

const disputeNotes = [
	"For the current public MVP, Ballot Clarity has not yet published a final governing-law, venue, or arbitration clause because the production operating entity and legal posture are still being finalized.",
	"If you believe a legal or factual issue needs review, start with the public contact path so the project can evaluate the issue and respond.",
	"A production launch should publish the operating legal entity, legal notice address, and any final dispute-resolution terms before the service is treated as a mature public product."
];

usePageSeo({
	description: "Terms of Service for Ballot Clarity, covering informational use, demo-data limits, permitted public-interest reuse, prohibited conduct, and service disclaimers for the current MVP.",
	path: "/terms",
	title: "Terms of Service"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<div class="flex flex-wrap gap-2">
				<TrustBadge label="Current MVP terms" tone="accent" />
				<TrustBadge label="Public-interest use" />
				<TrustBadge label="No endorsement" tone="warning" />
			</div>
			<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
				Terms of Service
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 max-w-3xl dark:text-app-muted-dark">
				These terms describe how the current {{ appName }} website may be used, what the service is designed to do, and the limits that apply to Ballot Clarity's public MVP.
			</p>
			<div class="mt-5">
				<UpdatedAt label="Effective" :value="effectiveAt" />
			</div>
		</header>

		<InfoCallout title="Current MVP scope">
			This page is written for the current public demo. A production launch should add the final operator legal name, legal notice address, and any governing-law or dispute-resolution clause chosen by counsel.
		</InfoCallout>

		<section class="gap-6 grid lg:grid-cols-3">
			<article v-for="item in summaryCards" :key="item.title" class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					At a glance
				</p>
				<h2 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ item.title }}
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					{{ item.body }}
				</p>
			</article>
		</section>

		<section class="gap-6 grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Acceptance
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Who these terms apply to
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in coreTerms" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>

			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Service scope
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					What the service includes today
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in serviceScope" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>
		</section>

		<section class="gap-6 grid lg:grid-cols-2">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Informational limits
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					What the service is not
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in noAdviceRules" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>

			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Sources and timeliness
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					How to use source-backed information responsibly
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in sourceAndTimelinessRules" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
				<div class="mt-6 flex flex-wrap gap-3">
					<NuxtLink to="/methodology" class="btn-secondary">
						Read methodology
					</NuxtLink>
					<NuxtLink to="/neutrality" class="btn-secondary">
						Read neutrality policy
					</NuxtLink>
				</div>
			</div>
		</section>

		<section class="gap-6 grid lg:grid-cols-2">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Permitted use and limited license
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					How you may use Ballot Clarity content
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in licenseRules" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>

			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Prohibited conduct
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					How the service may and may not be used
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in prohibitedUses" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>
		</section>

		<section class="gap-6 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Corrections and submissions
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					What happens when you send information to the project
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in correctionsAndFeedback" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
				<div class="mt-6 flex flex-wrap gap-3">
					<NuxtLink to="/contact" class="btn-primary">
						Open correction path
					</NuxtLink>
					<NuxtLink to="/privacy" class="btn-secondary">
						Read privacy notice
					</NuxtLink>
				</div>
			</div>

			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Future modules
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					How later features would change these terms
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in futureFeatureRules" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>
		</section>

		<section class="surface-panel">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				Disclaimers
			</p>
			<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
				Service limits and liability posture
			</h2>
			<div class="mt-6 gap-4 grid lg:grid-cols-2">
				<article v-for="item in legalLimits" :key="item" class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
					<p class="text-sm text-app-muted leading-7 dark:text-app-muted-dark">
						{{ item }}
					</p>
				</article>
			</div>
			<p class="text-sm text-app-muted leading-7 mt-6 dark:text-app-muted-dark">
				You remain responsible for confirming deadlines, polling logistics, filing status, and other time-sensitive election details with the relevant public authority.
			</p>
		</section>

		<section class="gap-6 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Disputes and notices
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					How legal and formal issues should be raised today
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in disputeNotes" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>

			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Contact
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					How to reach the project
				</h2>
				<div class="text-sm text-app-muted leading-7 mt-5 space-y-4 dark:text-app-muted-dark">
					<p>
						Questions about these terms, corrections, or public-interest collaboration can be sent to
						<a :href="`mailto:${contactEmail}`" class="underline underline-offset-3">
							{{ contactEmail }}
						</a>.
					</p>
					<p>
						If Ballot Clarity moves beyond MVP status, this page should be updated with the final operator identity, legal notice address, and versioned material-change process.
					</p>
				</div>
			</div>
		</section>
	</section>
</template>
