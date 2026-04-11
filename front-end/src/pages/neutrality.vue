<script setup lang="ts">
const sourceHierarchy = [
	{
		label: "1. Official election authorities",
		summary: "Election offices, official ballot language, official calendars, and certified election materials come first whenever Ballot Clarity can obtain them."
	},
	{
		label: "2. Primary public records",
		summary: "Filings, vote records, fiscal notes, hearing materials, court records, and other government or regulated disclosures come before secondary interpretation."
	},
	{
		label: "3. Candidate-supplied material",
		summary: "Questionnaire responses, campaign websites, and submitted statements are labeled as candidate-supplied rather than treated as verified official records."
	},
	{
		label: "4. Supporting nonpartisan context",
		summary: "Research briefs or civic compilations can add context, but they do not replace official or primary records where those exist."
	}
];

const languageRules = [
	"No rankings, fit scores, odds, or recommendation language.",
	"No loaded adjectives unless they are directly quoted and clearly attributed.",
	"No serious allegation stated as a Ballot Clarity house fact without source posture and supporting records.",
	"Quotes, questionnaires, and excerpts must preserve the speaker's meaning rather than edit toward a sharper conclusion.",
	"Symmetric structure for YES and NO outcomes on measure pages.",
	"Equal visual treatment for candidates and options in the same contest.",
	"Explicit labels for official text, candidate-supplied material, and Ballot Clarity summaries."
];

const workflowSteps = [
	{
		description: "Identify ballot-listed candidates and measures, gather attached source records, and log what is missing.",
		title: "Intake"
	},
	{
		description: "Attach source records to each claim block and separate official text from candidate-supplied statements and Ballot Clarity interpretation.",
		title: "Source logging"
	},
	{
		description: "Draft plain-language summaries in a fixed structure designed to reduce framing drift and information overload.",
		title: "Structured drafting"
	},
	{
		description: "Run a red-flag review for quote integrity, allegations, omissions, and language that could imply endorsement or undisclosed facts.",
		title: "Risk review"
	},
	{
		description: "Publish with timestamps, source drawers, and stated limits so users can inspect the evidence trail.",
		title: "Publish"
	},
	{
		description: "Accept error reports, update changelogs, and avoid silent edits to substantive content.",
		title: "Corrections"
	}
];

const redFlagChecklist = [
	"Crime, fraud, corruption, ethics, or financial-misconduct allegations.",
	"Claims about private individuals who are not clearly public figures.",
	"Edited quotes, paraphrases, or questionnaire answers where meaning could shift.",
	"Content that relies on a single unverified secondary source for a serious claim.",
	"Page structures or design choices that could function like a scorecard, endorsement, or comparative ranking."
];

const boundaryRules = [
	"Ballot Clarity is designed to support a strict nonpartisan voter-education posture and can be read as compatible with a future 501(c)(3)-style operating model, without claiming that tax status today.",
	"Candidate pages should never recommend, rank, or visually privilege one candidate over another in the same contest.",
	"Ballot-measure pages should separate legal effect, fiscal context, and attributed arguments so explanatory text does not become advocacy copy.",
	"If the project ever runs paid promotion, fundraising tied to election coverage, or sponsored political communications, that work should be routed through a separate compliance review before launch."
];

const disputeProcess = [
	"Users can report an error, omission, or framing concern through the public contact page or the listed email address.",
	"Target response standard for this policy model: acknowledge within 2 business days and resolve straightforward factual issues within 7 business days.",
	"Substantive changes should create a visible update note or changelog entry rather than silently replacing earlier wording.",
	"Campaigns, researchers, or members of the public should be expected to provide source links or specific record references when challenging a claim."
];

const auditMetrics = [
	{
		label: "Coverage completeness",
		summary: "How many ballot-listed contests, candidates, and measures are actually covered."
	},
	{
		label: "Source density",
		summary: "Whether major claims are supported by visible source links rather than a single buried citation."
	},
	{
		label: "Readability",
		summary: "Whether summaries remain plainspoken and understandable without turning into slogans or legalese."
	},
	{
		label: "Correction latency",
		summary: "How quickly reported errors are acknowledged, investigated, and resolved."
	},
	{
		label: "Symmetry checks",
		summary: "Whether similar contests and measure options receive equivalent structure, caveats, and visual treatment."
	},
	{
		label: "Missing-data disclosure",
		summary: "Whether gaps are shown plainly instead of being hidden behind polished summary copy."
	}
];

usePageSeo({
	description: "Ballot Clarity's neutrality policy: source hierarchy, legal-risk guardrails, language constraints, review workflow, and correction standards for a nonpartisan civic-information product.",
	path: "/neutrality",
	title: "Neutrality Policy"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<div class="flex flex-wrap gap-2">
				<TrustBadge label="Neutrality policy" tone="accent" />
				<TrustBadge label="Red-flag review" />
				<TrustBadge label="Corrections required" tone="warning" />
			</div>
			<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
				How Ballot Clarity operationalizes neutrality
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 max-w-3xl dark:text-app-muted-dark">
				Ballot Clarity treats neutrality as a set of operating constraints, not a slogan. That means visible sourcing, constrained language, equal treatment, explicit uncertainty, and a public corrections path that can withstand legal and editorial scrutiny.
			</p>
		</header>

		<section class="gap-6 grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Purpose and scope
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Informational, not advisory
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
					The product is designed to help voters inspect what is documented on their ballot without telling them what conclusion to reach. Neutrality here means no endorsements, no partisan framing, no scorecards, and no attempt to hide tradeoffs behind a single fit metric.
				</p>
			</div>

			<InfoCallout title="Why this page exists">
				This policy is written to support a strict nonpartisan voter-education posture. It explains how Ballot Clarity tries to reduce editorial drift, quote distortion, and legal-risk exposure while remaining readable to voters.
			</InfoCallout>
		</section>

		<section class="surface-panel">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				Source hierarchy
			</p>
			<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
				What kinds of sources come first
			</h2>
			<div class="mt-6 gap-4 grid md:grid-cols-2">
				<article v-for="item in sourceHierarchy" :key="item.label" class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
					<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
						{{ item.label }}
					</p>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						{{ item.summary }}
					</p>
				</article>
			</div>
		</section>

		<section class="gap-6 grid lg:grid-cols-2">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Language rules
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					How wording is constrained
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="rule in languageRules" :key="rule" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ rule }}
					</li>
				</ul>
			</div>

			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Organizational boundaries
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Guardrails around candidate and measure coverage
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="rule in boundaryRules" :key="rule" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ rule }}
					</li>
				</ul>
			</div>
		</section>

		<section class="surface-panel">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				Workflow
			</p>
			<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
				The editorial and review path
			</h2>
			<div class="mt-6 gap-4 grid lg:grid-cols-3">
				<article v-for="step in workflowSteps" :key="step.title" class="px-5 py-5 border border-app-line/80 rounded-3xl bg-white/80 dark:border-app-line-dark dark:bg-app-panel-dark/70">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						{{ step.title }}
					</p>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						{{ step.description }}
					</p>
				</article>
			</div>
		</section>

		<section class="gap-6 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Red-flag review
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Claims that need extra scrutiny
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in redFlagChecklist" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
				<p class="text-sm text-app-muted leading-7 mt-6 dark:text-app-muted-dark">
					When these triggers appear, the page should receive an explicit verification pass before publication and may need narrower wording, clearer attribution, or a visible dispute note.
				</p>
			</div>

			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Corrections and disputes
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					How issues should be reported and resolved
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in disputeProcess" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
				<div class="mt-6 flex flex-wrap gap-3">
					<NuxtLink to="/contact" class="btn-primary">
						Report an issue
					</NuxtLink>
					<NuxtLink to="/methodology" class="btn-secondary">
						Review methodology
					</NuxtLink>
				</div>
			</div>
		</section>

		<section class="surface-panel">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				Audit metrics
			</p>
			<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
				Signals worth monitoring
			</h2>
			<div class="mt-6 gap-4 grid md:grid-cols-2 xl:grid-cols-3">
				<article v-for="item in auditMetrics" :key="item.label" class="px-4 py-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
					<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
						{{ item.label }}
					</p>
					<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
						{{ item.summary }}
					</p>
				</article>
			</div>
		</section>
	</section>
</template>
