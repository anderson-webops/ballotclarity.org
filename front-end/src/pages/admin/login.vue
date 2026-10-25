<script setup lang="ts">
import type { AdminSessionResponse } from "~/types/civic";
import { FetchError } from "ofetch";

definePageMeta({
	layout: false
});

const route = useRoute();
const username = ref("");
const password = ref("");
const mfaCode = ref("");
const mfaRequired = ref(false);
const errorMessage = ref("");
const isSubmitting = ref(false);

const redirectTarget = computed(() => {
	const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/admin";

	return redirect.startsWith("/admin") ? redirect : "/admin";
});

const { data: session } = await useAdminSession("admin-login-session");

if (session.value?.authenticated) {
	await navigateTo(session.value.passwordChangeRequiredAt
		? "/admin/account"
		: redirectTarget.value);
}

async function handleSubmit() {
	errorMessage.value = "";
	isSubmitting.value = true;

	try {
		const loginResponse = await $fetch<AdminSessionResponse>("/api/admin/session", {
			body: {
				...(mfaRequired.value ? { mfaCode: mfaCode.value } : {}),
				password: password.value,
				username: username.value
			},
			method: "POST"
		});

		if (loginResponse.mfaRequired) {
			mfaRequired.value = true;
			mfaCode.value = "";
			errorMessage.value = "Enter the six-digit code from your authenticator app.";
			return;
		}

		await navigateTo(loginResponse.passwordChangeRequiredAt
			? "/admin/account"
			: redirectTarget.value);
	}
	catch (error) {
		if (error instanceof FetchError) {
			errorMessage.value = error.statusCode === 503
				? "No admin users are configured for this deployment yet."
				: mfaRequired.value
					? "The admin verification code was not accepted."
					: "The admin credentials were not accepted.";
		}
		else {
			errorMessage.value = "Unable to sign in right now.";
		}
	}
	finally {
		isSubmitting.value = false;
	}
}

usePageSeo({
	description: "Internal Ballot Clarity editorial and operations login.",
	path: "/admin/login",
	robots: "noindex,nofollow",
	title: "Admin login"
});
</script>

<template>
	<div class="text-app-ink px-4 py-10 bg-app-bg min-h-screen dark:text-app-text-dark sm:px-6 dark:bg-app-bg-dark">
		<div class="mx-auto max-w-md w-full">
			<NuxtLink to="/" class="underline focus-ring">
				Public site
			</NuxtLink>
			<section class="mt-10 space-y-8">
				<h1 class="text-4xl font-serif">
					Admin sign in
				</h1>
				<form class="mt-6 space-y-4" @submit.prevent="handleSubmit">
					<label class="block">
						<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Username</span>
						<input
							v-model="username"
							type="text"
							name="username"
							autocomplete="username"
							class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						>
					</label>

					<label class="block">
						<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Password</span>
						<input
							v-model="password"
							type="password"
							name="password"
							autocomplete="current-password"
							class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						>
					</label>

					<label v-if="mfaRequired" class="block">
						<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Authenticator code</span>
						<input
							v-model="mfaCode"
							type="text"
							name="one-time-code"
							autocomplete="one-time-code"
							inputmode="numeric"
							pattern="[0-9]*"
							class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						>
					</label>

					<p v-if="errorMessage" role="alert" class="text-sm text-[#8B3A2E] px-4 py-3 rounded-2xl bg-[#F8E6E1] dark:text-[#FFD4CB] dark:bg-[#472722]">
						{{ errorMessage }}
					</p>

					<button type="submit" class="btn-primary w-full" :disabled="isSubmitting">
						{{ isSubmitting ? "Signing in..." : mfaRequired ? "Verify code" : "Sign in to admin" }}
					</button>
				</form>
			</section>
		</div>
	</div>
</template>
