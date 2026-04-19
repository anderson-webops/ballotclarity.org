<script setup lang="ts">
const route = useRoute();
const { data: session } = await useAdminSession(`admin-layout-session-${route.fullPath}`);

const baseLinks = [
	{ label: "Dashboard", to: "/admin" },
	{ label: "Guide packages", to: "/admin/packages" },
	{ label: "Content", to: "/admin/content" },
	{ label: "Review queue", to: "/admin/review" },
	{ label: "Corrections", to: "/admin/corrections" },
	{ label: "Source health", to: "/admin/sources" }
];

const navLinks = computed(() => {
	if (session.value?.role === "admin")
		return [...baseLinks, { label: "Users", to: "/admin/users" }];

	return baseLinks;
});

function isActive(path: string) {
	return path === "/admin"
		? route.path === path
		: route.path.startsWith(path);
}

async function signOut() {
	await $fetch("/api/admin/session", {
		method: "DELETE"
	});

	await navigateTo("/admin/login");
}
</script>

<template>
	<div class="bg-app-bg min-h-screen dark:bg-app-bg-dark">
		<a href="#admin-main-content" class="skip-link focus-ring">Skip to content</a>

		<header class="border-b border-app-line/80 bg-app-bg/95 top-0 sticky z-40 backdrop-blur dark:border-app-line-dark dark:bg-app-bg-dark/95">
			<div class="app-shell py-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div class="min-w-0">
					<NuxtLink to="/admin" class="rounded-full inline-flex gap-3 items-center focus-ring">
						<span class="text-app-ink border border-app-line rounded-2xl bg-white inline-flex h-11 w-11 shadow-sm items-center justify-center dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark">
							<span class="i-carbon-settings-adjust text-xl" />
						</span>
						<span class="min-w-0">
							<span class="text-lg text-app-ink font-serif block dark:text-app-text-dark">Ballot Clarity Admin</span>
							<span class="text-xs text-app-muted mt-1 block dark:text-app-muted-dark">Internal editorial and source operations</span>
						</span>
					</NuxtLink>
				</div>

				<nav class="flex flex-wrap gap-2" aria-label="Admin">
					<NuxtLink
						v-for="link in navLinks"
						:key="link.to"
						:to="link.to"
						class="text-sm font-medium px-4 py-2 rounded-full transition focus-ring"
						:class="isActive(link.to)
							? 'bg-app-ink text-white'
							: 'border border-app-line bg-white text-app-muted hover:text-app-ink dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-muted-dark dark:hover:text-app-text-dark'"
					>
						{{ link.label }}
					</NuxtLink>
				</nav>

				<div class="flex flex-wrap gap-3 items-center">
					<div class="text-xs text-app-muted px-3 py-2 border border-app-line rounded-full bg-white dark:text-app-muted-dark dark:border-app-line-dark dark:bg-app-panel-dark">
						{{ session?.displayName || session?.username || "Admin" }} · {{ session?.role || "admin" }}
					</div>
					<NuxtLink to="/" class="btn-secondary">
						View public site
					</NuxtLink>
					<button type="button" class="btn-primary" @click="signOut">
						Sign out
					</button>
				</div>
			</div>
		</header>

		<main id="admin-main-content" class="pb-16 pt-6 flex-1 sm:pt-8">
			<slot />
		</main>
	</div>
</template>
