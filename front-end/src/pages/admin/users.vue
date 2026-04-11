<script setup lang="ts">
import type { AdminUserRole } from "~/types/civic";
import { FetchError } from "ofetch";

definePageMeta({
	layout: "admin",
	middleware: "admin"
});

const { data: session } = await useAdminSession("admin-users-session");
const { data, refresh, error } = await useAdminUsers();

const form = reactive({
	displayName: "",
	password: "",
	role: "editor" as AdminUserRole,
	username: ""
});

const isSubmitting = ref(false);
const feedbackMessage = ref("");
const feedbackTone = ref<"error" | "success">("success");

async function createUser() {
	isSubmitting.value = true;
	feedbackMessage.value = "";

	try {
		await $fetch("/api/admin/users", {
			body: form,
			method: "POST"
		});
		feedbackMessage.value = "Admin user created.";
		feedbackTone.value = "success";
		form.displayName = "";
		form.password = "";
		form.role = "editor";
		form.username = "";
		await refresh();
	}
	catch (error) {
		feedbackMessage.value = error instanceof FetchError
			? error.data?.message || error.statusMessage || "Unable to create admin user."
			: "Unable to create admin user.";
		feedbackTone.value = "error";
	}
	finally {
		isSubmitting.value = false;
	}
}

usePageSeo({
	description: "Internal Ballot Clarity admin account management.",
	path: "/admin/users",
	robots: "noindex,nofollow",
	title: "Admin users"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				User management
			</p>
			<h1 class="text-5xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
				Admin and editor accounts
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
				Use persisted internal accounts instead of shared deployment credentials. Editors can work the queues; admins can also manage accounts.
			</p>
		</header>

		<InfoCallout v-if="session?.role !== 'admin'" title="Admin-only area" tone="warning">
			Only admin users can create or review accounts. Your current session is read-only for this page.
		</InfoCallout>

		<p
			v-if="feedbackMessage"
			class="text-sm px-4 py-3 rounded-2xl"
			:class="feedbackTone === 'success'
				? 'text-[#0f5b45] bg-[#e6f4ef] dark:text-[#9ae6c2] dark:bg-[#11352c]'
				: 'text-[#8B3A2E] bg-[#F8E6E1] dark:text-[#FFD4CB] dark:bg-[#472722]'"
		>
			{{ feedbackMessage }}
		</p>

		<section class="gap-6 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Current users
				</p>
				<div v-if="error" class="mt-6">
					<InfoCallout title="User list unavailable" tone="warning">
						The user directory could not be loaded for this session.
					</InfoCallout>
				</div>
				<ul v-else class="mt-6 space-y-4">
					<li v-for="user in data?.users ?? []" :key="user.id" class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
						<div class="flex flex-wrap gap-3 items-center justify-between">
							<div>
								<p class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
									{{ user.displayName }}
								</p>
								<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
									{{ user.username }}
								</p>
							</div>
							<TrustBadge :label="user.role" :tone="user.role === 'admin' ? 'accent' : 'neutral'" />
						</div>
						<div class="mt-4 gap-4 grid sm:grid-cols-2">
							<UpdatedAt :value="user.createdAt" label="Created" />
							<p class="text-sm text-app-muted dark:text-app-muted-dark">
								<span class="text-app-ink font-semibold dark:text-app-text-dark">Last login:</span>
								{{ user.lastLoginAt || "No recorded login yet" }}
							</p>
						</div>
					</li>
				</ul>
			</div>

			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Create user
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Add an editor or admin
				</h2>
				<form class="mt-6 space-y-4" @submit.prevent="createUser">
					<label class="block">
						<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Display name</span>
						<input
							v-model="form.displayName"
							:disabled="session?.role !== 'admin'"
							type="text"
							class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						>
					</label>

					<label class="block">
						<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Username</span>
						<input
							v-model="form.username"
							:disabled="session?.role !== 'admin'"
							type="text"
							autocomplete="off"
							class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						>
					</label>

					<label class="block">
						<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Role</span>
						<select
							v-model="form.role"
							:disabled="session?.role !== 'admin'"
							class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						>
							<option value="editor">
								editor
							</option>
							<option value="admin">
								admin
							</option>
						</select>
					</label>

					<label class="block">
						<span class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Temporary password</span>
						<input
							v-model="form.password"
							:disabled="session?.role !== 'admin'"
							type="password"
							autocomplete="new-password"
							class="text-sm text-app-ink mt-2 px-4 border border-app-line rounded-2xl bg-white h-13 w-full shadow-sm dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"
						>
					</label>

					<button type="submit" class="btn-primary w-full" :disabled="isSubmitting || session?.role !== 'admin'">
						{{ isSubmitting ? "Creating..." : "Create user" }}
					</button>
				</form>
			</div>
		</section>
	</section>
</template>
