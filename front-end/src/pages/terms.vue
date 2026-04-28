<script setup lang="ts">
import { appName } from "~/constants";

const effectiveAt = "2026-04-26T23:30:00-04:00";
const runtimeConfig = useRuntimeConfig();
const siteUrl = useSiteUrl();
const currentOperatorName = String(runtimeConfig.public.operatorLegalName || "Jacob Anderson").trim();
const operatorNoticeAddress = String(runtimeConfig.public.operatorNoticeAddress || "").trim();
const governingLaw = String(runtimeConfig.public.governingLaw || "").trim();
const venue = String(runtimeConfig.public.venue || "").trim();

const serviceScope = [
	"Ballot lookup and location-based ballot guides.",
	"Candidate, measure, compare, methodology, neutrality, privacy, accessibility, and help pages.",
	"Printable or shareable ballot-guide views generated from the current release.",
	"Public contact and correction-request routes."
];

const coreTerms = [
	`By accessing or using the Ballot Clarity website at ${siteUrl}, you agree to these Terms of Service and the Privacy Notice.`,
	"If you do not agree to these terms, do not use the site.",
	"The current release does not require a public account for the public site, although separate internal/admin authentication exists for editorial operations."
];

const operatorAndNoticeRules = [
	`Ballot Clarity is currently operated by ${currentOperatorName}.`,
	"Operational questions, corrections, and formal notices can be sent through the public contact page or protected email link below.",
	...(operatorNoticeAddress
		? [`Postal notices may also be sent to ${operatorNoticeAddress}.`]
		: ["A separate postal notice address is not published on this host today, so the public contact page and protected email link are the current notice channels for the release now online."])
];

const governingLawAndVenueRules = [
	...(governingLaw
		? [`These public site terms are governed by the laws of ${governingLaw}, without regard to conflict-of-law rules that would require a different jurisdiction's law to apply.`]
		: ["No governing-law clause is published on this host today. Do not assume any unstated jurisdiction rule applies."]),
	...(venue
		? [`Any claim that must be filed in court should be brought in ${venue}, unless a different venue is required by non-waivable law.`]
		: ["No venue clause is published on this host today. Do not assume any unstated venue term applies."])
];

const noAdviceRules = [
	"The site provides civic information, not legal advice, campaign advice, election-administration advice, or individualized voting advice.",
	"Ballot Clarity does not endorse candidates, recommend ballot positions, or present contests as a leaderboard.",
	"Plain-language measure explanations and candidate summaries are intended to make public records more readable, not to replace the official source text."
];

const sourceAndTimelinessRules = [
	"Where possible, Ballot Clarity cites official records, primary public documents, candidate-provided materials, and other nonpartisan supporting sources.",
	"Election information can change quickly. Filing status, polling logistics, deadlines, and ballot composition should be confirmed with the relevant election office before you rely on them.",
	"Provider-returned ballot previews, candidate lists, contest lists, or measure summaries are not the official ballot and are not treated as a fully reviewed local guide unless Ballot Clarity labels them that way. Verify your exact ballot with the linked official state or local voter/ballot tool.",
	"Source links may lead to third-party sites. Ballot Clarity does not control those sites and does not endorse every statement or policy they contain."
];

const licenseRules = [
	"You may view, print, and share Ballot Clarity pages or ballot guides for personal, educational, journalistic, research, or other lawful noncommercial public-interest use.",
	"You may quote limited excerpts with attribution and without removing source labels, update dates, coverage notices, or neutrality caveats.",
	"You may not present Ballot Clarity content as an official government publication, a campaign endorsement, or your own original election record without clear attribution."
];

const ownershipRules = [
	"Ballot Clarity retains rights in its original site design, compilation choices, original summaries, rubric text, and other project-created material except where another owner is identified.",
	"Official records, filing systems, candidate materials, and other third-party source documents remain subject to the rights and terms of their respective publishers.",
	"Using the site does not transfer ownership of Ballot Clarity content, trademarks, or source records."
];

const prohibitedUses = [
	"Do not overload, probe, attack, reverse engineer, or interfere with the site, its hosting, or its source systems.",
	"Do not use automated access in a way that bypasses rate limits, harms reliability, or creates misleading bulk republication of the service.",
	"Do not attempt to access internal editorial, admin, or review routes unless you are explicitly authorized to use them.",
	"Do not use the site to impersonate an election office, spread voter confusion, or create fraudulent voting materials.",
	"Do not remove coverage notices, source context, correction notes, or trust signals when redistributing content.",
	"Do not submit knowingly false correction requests, malicious files, or sensitive personal information that the project does not need."
];

const suspensionRules = [
	"Ballot Clarity may suspend, block, or rate-limit access that threatens reliability, security, source integrity, legal compliance, or other users' access to the service.",
	"Internal editorial/admin access may be disabled when credentials are misused, when an account is no longer authorized, or when an operational incident requires lockdown.",
	"Suspension or blocking may occur without advance notice when the risk is security-sensitive or time-critical."
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

const changesToTermsRules = [
	"The effective date at the top of this page marks the current public version of these terms.",
	"Material changes should be posted on this page before or when they take effect, with related updates made to the Privacy Policy and other trust pages where needed.",
	"Continuing to use the public site after a materially updated version becomes effective means you accept the revised terms."
];

const legalLimits = [
	"The site is provided on an \"as is\" and \"as available\" basis while Ballot Clarity remains in a limited-coverage release phase.",
	"Ballot Clarity does not guarantee that every page will be complete, current, uninterrupted, secure, or free from error.",
	"To the fullest extent permitted by applicable law, Ballot Clarity disclaims warranties of accuracy, merchantability, fitness for a particular purpose, and non-infringement.",
	"To the fullest extent permitted by applicable law, Ballot Clarity is not liable for indirect, incidental, special, consequential, or punitive damages arising from use of the site.",
	"Nothing in these terms is intended to waive liability that cannot lawfully be disclaimed, including liability for fraud, willful misconduct, or other non-waivable obligations under applicable law."
];

const disputeNotes = [
	"If you believe a legal or factual issue needs review, start with the public contact path so the project can evaluate the issue and respond.",
	"The current public terms do not impose arbitration or a class-action waiver on ordinary site visitors.",
	"Any non-waivable consumer-protection or election-law rights remain in place regardless of these general website terms."
];

usePageSeo({
	description: "Terms of Service for Ballot Clarity, covering informational use, current-coverage limits, permitted public-interest reuse, prohibited conduct, and service disclaimers for the current release.",
	path: "/terms",
	title: "Terms of Service"
});
</script>

<template>
	<section class="legal-page app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<div class="flex flex-wrap gap-2">
				<TrustBadge label="Current terms" tone="accent" />
				<TrustBadge label="Public-interest use" />
				<TrustBadge label="No endorsement" tone="warning" />
			</div>
			<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
				Terms of Service
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 max-w-3xl dark:text-app-muted-dark">
				These terms describe how the current {{ appName }} website may be used, what the service is designed to do, and the limits that apply to the public site.
			</p>
			<div class="mt-5">
				<UpdatedAt label="Effective" :value="effectiveAt" />
			</div>
		</header>

		<InfoCallout title="Current scope">
			This page is written for the current release now online. It governs the public civic-information site, not separate contracts with upstream providers or any future account, donation, or API products that Ballot Clarity may add later.
		</InfoCallout>

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
					Operator and notices
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Who operates the site and how to send notice
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in operatorAndNoticeRules" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>
		</section>

		<section class="gap-6 grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Governing law and venue
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Which legal terms are currently published
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in governingLawAndVenueRules" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>
		</section>

		<section class="gap-6 grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
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
					Ownership
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Who owns what on the site
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in ownershipRules" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>
		</section>

		<section class="gap-6 grid lg:grid-cols-2">
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

			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Suspension and access control
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					When access can be restricted
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in suspensionRules" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
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
					Changes and future modules
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					How the terms change as the product changes
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in [...changesToTermsRules, ...futureFeatureRules]" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
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
						Questions about these terms, corrections, or public-interest collaboration can be sent through the public contact page or the protected email link below.
					</p>
					<p>
						<ProtectedEmailLink
							loading-label="Email link loads in your browser."
							loading-class="text-app-muted dark:text-app-muted-dark"
							link-class="underline underline-offset-3 rounded-md focus-ring"
							subject="Ballot Clarity terms question"
						/>
					</p>
					<p>
						This section should stay aligned with the operator identity, notice channel, and effective-date process actually used on the public site.
					</p>
				</div>
			</div>
		</section>
	</section>
</template>
