<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin" });
const { data: session } = await useAdminSession("admin-settings-session");
const { data: overview, error, pending, refresh } = await useAdminOverview();
const security = computed(() => overview.value?.security);
usePageSeo({ title: "Settings", path: "/admin/settings", robots: "noindex,nofollow" });
</script>

<template>
	<section class="app-shell max-w-4xl space-y-16">
		<h1 class="text-5xl font-serif">
			Settings
		</h1>
		<section class="space-y-6">
			<h2 class="text-3xl font-serif">
				Account
			</h2>
			<AdminLoadState :pending="pending" :error="Boolean(error)" label="account security" @retry="refresh()" />
			<dl v-if="security && !error && !pending" class="space-y-3">
				<div>
					<dt class="inline">
						MFA enabled:
					</dt><dd class="inline">
						{{ security.mfaEnabledUserCount }}/{{ security.activeUserCount }} accounts
					</dd>
				</div>
				<div>
					<dt class="inline">
						Password changes required:
					</dt><dd class="inline">
						{{ security.passwordChangeRequiredUserCount }}
					</dd>
				</div>
			</dl>
			<NuxtLink to="/admin/account" class="text-xl underline block focus-ring">
				Password and multi-factor authentication
			</NuxtLink>
		</section>
		<section class="space-y-6">
			<h2 class="text-3xl font-serif">
				Sources
			</h2><NuxtLink to="/admin/datasets" class="text-xl underline block focus-ring">
				Configured datasets
			</NuxtLink><NuxtLink to="/admin/sources" class="text-xl underline block focus-ring">
				Editorial source notices
			</NuxtLink>
		</section>
		<section v-if="session?.role === 'admin'" class="space-y-6">
			<h2 class="text-3xl font-serif">
				Administration
			</h2><NuxtLink to="/admin/users" class="text-xl underline block focus-ring">
				Users
			</NuxtLink><NuxtLink to="/admin/audit" class="text-xl underline block focus-ring">
				Audit history
			</NuxtLink>
		</section>
	</section>
</template>
