<script setup lang="ts">
import type { AdminSessionResponse } from "~/types/civic";
import { FetchError } from "ofetch";

const { data: session, refresh } = await useAdminSession("admin-account-session");

definePageMeta({
	layout: "admin",
	middleware: "admin"
});

const form = reactive({
	confirmPassword: "",
	currentPassword: "",
	newPassword: ""
});

const feedbackMessage = ref("");
const feedbackTone = ref<"error" | "success">("success");
const isSubmitting = ref(false);

const canSubmit = computed(() => Boolean(
	form.currentPassword
	&& form.newPassword.trim().length >= 12
	&& form.confirmPassword
));

async function changePassword() {
	feedbackMessage.value = "";

	if (form.newPassword !== form.confirmPassword) {
		feedbackMessage.value = "The new password confirmation does not match.";
		feedbackTone.value = "error";
		return;
	}

	isSubmitting.value = true;

	try {
		const updatedSession = await $fetch<AdminSessionResponse>("/api/admin/session/password", {
			body: {
				currentPassword: form.currentPassword,
				newPassword: form.newPassword
			},
			method: "POST"
		});

		session.value = updatedSession;
		form.confirmPassword = "";
		form.currentPassword = "";
		form.newPassword = "";
		feedbackMessage.value = "Password changed. Other sessions for this account were invalidated.";
		feedbackTone.value = "success";
		await refresh();
	}
	catch (error) {
		feedbackMessage.value = error instanceof FetchError
			? error.data?.message || error.statusMessage || "Unable to change password."
			: "Unable to change password.";
		feedbackTone.value = "error";
	}
	finally {
		isSubmitting.value = false;
	}
}

usePageSeo({
	description: "Internal Ballot Clarity admin account settings.",
	path: "/admin/account",
	robots: "noindex,nofollow",
	title: "Admin account"
});
</script>

<template>
	<div class="app-shell">
		<section class="surface-panel">
			<div class="flex flex-wrap gap-2">
				<TrustBadge label="Account security" tone="accent" />
				<TrustBadge :label="session?.role || 'admin'" />
			</div>
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-6 uppercase dark:text-app-muted-dark">
				Current account
			</p>
			<h1 class="text-5xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
				{{ session?.displayName || session?.username || "Admin account" }}
			</h1>
			<p class="bc-measure text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
				Change your own admin password without using shared deployment credentials or another administrator's reset flow.
			</p>
		</section>

		<div class="mt-6 gap-6 grid lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,0.65fr)] lg:items-start">
			<section class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Password
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Change password
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					Enter your current password and choose a new password. The new password must be at least 12 characters.
				</p>

				<form class="mt-6 space-y-4" @submit.prevent="changePassword">
					<label class="block">
						<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Current password</span>
						<input
							v-model="form.currentPassword"
							type="password"
							autocomplete="current-password"
							class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						>
					</label>

					<label class="block">
						<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">New password</span>
						<input
							v-model="form.newPassword"
							type="password"
							autocomplete="new-password"
							class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						>
					</label>

					<label class="block">
						<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Confirm new password</span>
						<input
							v-model="form.confirmPassword"
							type="password"
							autocomplete="new-password"
							class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						>
					</label>

					<p
						v-if="feedbackMessage"
						class="text-sm px-4 py-3 rounded-2xl"
						:class="feedbackTone === 'success'
							? 'text-[#265C3A] bg-[#DFF2E6] dark:text-[#BFECCB] dark:bg-[#203D2A]'
							: 'text-[#8B3A2E] bg-[#F8E6E1] dark:text-[#FFD4CB] dark:bg-[#472722]'"
					>
						{{ feedbackMessage }}
					</p>

					<button type="submit" class="btn-primary" :disabled="!canSubmit || isSubmitting">
						{{ isSubmitting ? "Changing password..." : "Change password" }}
					</button>
				</form>
			</section>

			<aside class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Session
				</p>
				<h2 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Account details
				</h2>
				<div class="text-sm text-app-muted leading-7 mt-5 space-y-3 dark:text-app-muted-dark">
					<p>
						<span class="text-app-ink font-semibold dark:text-app-text-dark">Username:</span>
						{{ session?.username }}
					</p>
					<p>
						<span class="text-app-ink font-semibold dark:text-app-text-dark">Role:</span>
						{{ session?.role }}
					</p>
					<UpdatedAt v-if="session?.credentialsUpdatedAt" :value="session.credentialsUpdatedAt" label="Credentials" />
				</div>
				<InfoCallout title="Session invalidation" class="mt-6">
					Changing your password rotates the account credential timestamp. Other signed-in sessions for this account must sign in again.
				</InfoCallout>
			</aside>
		</div>
	</div>
</template>
