<script setup lang="ts">
import { FetchError } from "ofetch";
import { contactEmail } from "~/constants";

const api = useApiClient();
const correctionHref = `mailto:${contactEmail}?subject=${encodeURIComponent("Ballot Clarity correction or dispute")}`;
const volunteerHref = `mailto:${contactEmail}?subject=${encodeURIComponent("Ballot Clarity volunteer or research inquiry")}`;
const generalHref = `mailto:${contactEmail}?subject=${encodeURIComponent("Ballot Clarity general inquiry")}`;
const form = reactive({
	email: "",
	message: "",
	name: "",
	pageUrl: "",
	sourceLinks: "",
	subject: "",
	submissionType: "correction" as "correction" | "feedback"
});
const isSubmitting = ref(false);
const formMessage = ref("");
const formTone = ref<"error" | "success">("success");

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

async function submitForm() {
	isSubmitting.value = true;
	formMessage.value = "";

	try {
		await api("/feedback", {
			body: form,
			method: "POST"
		});
		formMessage.value = form.submissionType === "correction"
			? "Correction request submitted. It has been added to the editorial queue."
			: "Feedback submitted. It has been added to the editorial queue.";
		formTone.value = "success";
		form.email = "";
		form.message = "";
		form.name = "";
		form.pageUrl = "";
		form.sourceLinks = "";
		form.subject = "";
		form.submissionType = "correction";
	}
	catch (error) {
		formMessage.value = error instanceof FetchError
			? error.data?.message || error.statusMessage || "Unable to submit the form right now."
			: "Unable to submit the form right now.";
		formTone.value = "error";
	}
	finally {
		isSubmitting.value = false;
	}
}

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
				Contact and corrections
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 max-w-3xl dark:text-app-muted-dark">
				Use this page to report an error, request a correction, ask a question, or volunteer.
			</p>
		</header>

		<section class="surface-panel">
			<div class="gap-6 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
				<div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Submit online
					</p>
					<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						Send a correction request or product note
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						Use this form when a page appears inaccurate, incomplete, unevenly framed, or hard to use. Submissions are reviewed with the page URL and supporting notes you provide.
					</p>
				</div>

				<form class="space-y-4" @submit.prevent="submitForm">
					<label class="block">
						<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Request type</span>
						<select
							v-model="form.submissionType"
							class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						>
							<option value="correction">
								correction
							</option>
							<option value="feedback">
								feedback
							</option>
						</select>
					</label>

					<div class="gap-4 grid sm:grid-cols-2">
						<label class="block">
							<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Name</span>
							<input
								v-model="form.name"
								type="text"
								class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
							>
						</label>
						<label class="block">
							<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Email</span>
							<input
								v-model="form.email"
								type="email"
								required
								class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
							>
						</label>
					</div>

					<label class="block">
						<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Subject</span>
						<input
							v-model="form.subject"
							type="text"
							required
							class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						>
					</label>

					<label class="block">
						<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Page URL or route</span>
						<input
							v-model="form.pageUrl"
							type="text"
							placeholder="/candidate/elena-torres"
							class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						>
					</label>

					<label class="block">
						<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Message</span>
						<textarea
							v-model="form.message"
							required
							rows="5"
							class="text-sm text-app-ink mt-2 px-4 py-3 border border-app-line rounded-2xl bg-white min-h-32 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						/>
					</label>

					<label class="block">
						<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Supporting links</span>
						<textarea
							v-model="form.sourceLinks"
							rows="3"
							placeholder="One link per line"
							class="text-sm text-app-ink mt-2 px-4 py-3 border border-app-line rounded-2xl bg-white min-h-24 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						/>
					</label>

					<p
						v-if="formMessage"
						class="text-sm px-4 py-3 rounded-2xl"
						:class="formTone === 'success'
							? 'text-[#0f5b45] bg-[#e6f4ef] dark:text-[#9ae6c2] dark:bg-[#11352c]'
							: 'text-[#8B3A2E] bg-[#F8E6E1] dark:text-[#FFD4CB] dark:bg-[#472722]'"
					>
						{{ formMessage }}
					</p>

					<button type="submit" class="btn-primary w-full" :disabled="isSubmitting">
						{{ isSubmitting ? "Submitting..." : "Send request" }}
					</button>
				</form>
			</div>
		</section>

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
					Use this if you want to volunteer, collaborate, or help review public records.
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
					For general questions about Ballot Clarity, use the direct project inbox.
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
