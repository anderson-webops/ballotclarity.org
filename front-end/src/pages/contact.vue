<script setup lang="ts">
import { FetchError } from "ofetch";

const api = useApiClient();
const route = useRoute();
function readQueryValue(key: string) {
	const value = route.query[key];
	return typeof value === "string" ? value : "";
}

const form = reactive({
	email: "",
	message: "",
	name: "",
	pageUrl: readQueryValue("pageUrl"),
	sourceLinks: "",
	subject: readQueryValue("subject"),
	submissionType: (readQueryValue("type") === "feedback" ? "feedback" : "correction") as "correction" | "feedback"
});
const isSubmitting = ref(false);
const formMessage = ref("");
const formTone = ref<"error" | "success">("success");

async function submitForm() {
	isSubmitting.value = true;
	formMessage.value = "";

	try {
		await api("/feedback", {
			body: form,
			method: "POST"
		});
		formMessage.value = form.submissionType === "correction"
			? "Correction request submitted. We will review the page and follow up if needed."
			: "Feedback submitted. Thank you.";
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
	description: "Contact Ballot Clarity, request a correction, or send feedback about the site.",
	path: "/contact",
	title: "Contact"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<h1 class="text-5xl text-app-ink font-serif dark:text-app-text-dark">
				Contact and corrections
			</h1>
		</header>

		<section id="contact-form" class="max-w-2xl scroll-mt-28">
			<form class="space-y-4" @submit.prevent="submitForm">
				<label class="block">
					<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Request type</span>
					<select
						v-model="form.submissionType"
						class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-md bg-app-panel h-12 w-full dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
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
							autocomplete="name"
							maxlength="120"
							type="text"
							class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-md bg-app-panel h-12 w-full dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						>
					</label>
					<label class="block">
						<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Email</span>
						<input
							v-model="form.email"
							autocomplete="email"
							maxlength="254"
							type="email"
							required
							class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-md bg-app-panel h-12 w-full dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						>
					</label>
				</div>

				<label class="block">
					<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Subject</span>
					<input
						v-model="form.subject"
						maxlength="160"
						type="text"
						required
						class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-md bg-app-panel h-12 w-full dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
					>
				</label>

				<label class="block">
					<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Page URL or site path</span>
					<input
						v-model="form.pageUrl"
						maxlength="1024"
						type="text"
						placeholder="/representatives/jon-ossoff"
						class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-md bg-app-panel h-12 w-full dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
					>
				</label>

				<label class="block">
					<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Message</span>
					<textarea
						v-model="form.message"
						maxlength="5000"
						required
						rows="5"
						class="text-sm text-app-ink mt-2 px-4 py-3 border border-app-line rounded-md bg-app-panel min-h-32 w-full dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
					/>
				</label>

				<label class="block">
					<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Supporting links</span>
					<textarea
						v-model="form.sourceLinks"
						maxlength="20489"
						rows="3"
						placeholder="One link per line"
						class="text-sm text-app-ink mt-2 px-4 py-3 border border-app-line rounded-md bg-app-panel min-h-24 w-full dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
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
		</section>

		<div class="text-sm text-app-muted leading-7 max-w-2xl space-y-4 dark:text-app-muted-dark">
			<ProtectedEmailLink loading-label="Email link loads in your browser." loading-class="text-app-muted dark:text-app-muted-dark" link-class="text-app-accent rounded-sm underline underline-offset-3 focus-ring" subject="Ballot Clarity inquiry" />
			<p>We aim to acknowledge correction requests within 2 business days and resolve straightforward factual issues within 7 business days.</p>
			<NuxtLink to="/corrections" class="text-app-accent rounded-sm underline underline-offset-3 focus-ring">
				Corrections log
			</NuxtLink>
		</div>
	</section>
</template>
