<script setup lang="ts">
import { storeToRefs } from "pinia";
import { appName } from "~/constants";

const civicStore = useCivicStore();
const colorMode = useColorMode();
const route = useRoute();
const isMenuOpen = ref(false);

const { ballotPlanCount, compareCount, selectedLocation } = storeToRefs(civicStore);

const navLinks = [
	{ label: "Home", to: "/" },
	{ label: "Ballot guide", to: "/ballot" },
	{ label: "Search", to: "/search" },
	{ label: "Sources", to: "/sources" },
	{ label: "My plan", to: "/plan" },
	{ label: "Compare", to: "/compare" },
	{ label: "How it works", to: "/methodology" },
	{ label: "Help", to: "/help" },
	{ label: "About", to: "/about" },
];

const isDark = computed(() => colorMode.value === "dark");

watch(() => route.fullPath, () => {
	isMenuOpen.value = false;
});

function isActive(path: string) {
	return path === "/"
		? route.path === path
		: route.path.startsWith(path);
}

function toggleColorMode() {
	colorMode.preference = isDark.value ? "light" : "dark";
}
</script>

<template>
	<header class="border-b border-app-line/80 bg-app-bg/94 top-0 sticky z-40 backdrop-blur dark:border-app-line-dark dark:bg-app-bg-dark/92">
		<div class="app-shell py-4 flex gap-4 items-center justify-between">
			<div class="flex gap-3 min-w-0 items-center">
				<NuxtLink to="/" class="rounded-full focus-ring">
					<span class="flex gap-3 items-center">
						<span class="text-app-ink border border-app-line rounded-2xl bg-white flex h-11 w-11 shadow-sm items-center justify-center dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark">
							<span class="i-carbon-notebook text-xl" />
						</span>
						<span class="min-w-0">
							<span class="text-lg text-app-ink leading-none font-serif block dark:text-app-text-dark">{{ appName }}</span>
							<span class="text-xs text-app-muted mt-1 block dark:text-app-muted-dark">Nonpartisan ballot guide and source archive</span>
						</span>
					</span>
				</NuxtLink>
			</div>

			<nav class="gap-1 hidden items-center lg:flex" aria-label="Primary">
				<NuxtLink
					v-for="link in navLinks"
					:key="link.to"
					:to="link.to"
					class="text-sm font-medium px-4 py-2 rounded-full transition focus-ring"
					:class="isActive(link.to)
						? 'bg-app-ink text-white'
						: 'text-app-muted hover:bg-white hover:text-app-ink dark:text-app-muted-dark dark:hover:bg-app-panel-dark dark:hover:text-app-text-dark'"
				>
					{{ link.label }}
					<span v-if="link.to === '/plan' && ballotPlanCount" class="text-[11px] text-app-ink font-bold ml-2 px-1.5 rounded-full bg-app-warm inline-flex h-5 min-w-5 items-center justify-center">
						{{ ballotPlanCount }}
					</span>
					<span v-if="link.to === '/compare' && compareCount" class="text-[11px] text-app-ink font-bold ml-2 px-1.5 rounded-full bg-app-warm inline-flex h-5 min-w-5 items-center justify-center">
						{{ compareCount }}
					</span>
				</NuxtLink>
			</nav>

			<div class="gap-3 hidden items-center lg:flex">
				<div
					v-if="selectedLocation"
					class="text-xs text-app-muted px-3 py-2 border border-app-line rounded-full bg-white dark:text-app-muted-dark dark:border-app-line-dark dark:bg-app-panel-dark"
				>
					<span class="i-carbon-location mr-1 align-middle" />
					{{ selectedLocation.displayName }}
				</div>

				<button
					type="button"
					class="text-app-ink border border-app-line rounded-full bg-white inline-flex h-11 w-11 transition items-center justify-center dark:text-app-text-dark hover:text-app-accent dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark focus-ring"
					:aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
					@click="toggleColorMode"
				>
					<span :class="isDark ? 'i-carbon-sun' : 'i-carbon-moon'" class="text-lg" />
				</button>
			</div>

			<button
				type="button"
				class="text-app-ink border border-app-line rounded-full bg-white inline-flex h-11 w-11 transition items-center justify-center dark:text-app-text-dark hover:text-app-accent dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark lg:hidden focus-ring"
				:aria-expanded="isMenuOpen"
				aria-label="Toggle navigation"
				@click="isMenuOpen = !isMenuOpen"
			>
				<span :class="isMenuOpen ? 'i-carbon-close' : 'i-carbon-menu'" class="text-lg" />
			</button>
		</div>

		<div v-if="isMenuOpen" class="px-4 pb-4 pt-3 border-t border-app-line/80 bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark lg:hidden">
			<nav class="flex flex-col gap-2" aria-label="Mobile navigation">
				<NuxtLink
					v-for="link in navLinks"
					:key="link.to"
					:to="link.to"
					class="text-sm font-medium px-4 py-3 rounded-2xl transition focus-ring"
					:class="isActive(link.to)
						? 'bg-app-ink text-white'
						: 'bg-white text-app-ink dark:bg-app-panel-dark dark:text-app-text-dark'"
				>
					{{ link.label }}
					<span v-if="link.to === '/plan' && ballotPlanCount" class="text-[11px] text-app-ink font-bold ml-2 px-2 py-0.5 rounded-full bg-app-warm">
						{{ ballotPlanCount }}
					</span>
					<span v-if="link.to === '/compare' && compareCount" class="text-[11px] text-app-ink font-bold ml-2 px-2 py-0.5 rounded-full bg-app-warm">
						{{ compareCount }}
					</span>
				</NuxtLink>

				<div class="text-sm mt-2 px-4 py-3 border border-app-line rounded-2xl bg-white flex items-center justify-between dark:border-app-line-dark dark:bg-app-panel-dark">
					<span class="text-app-muted dark:text-app-muted-dark">
						{{ selectedLocation?.displayName || 'Ballot context not yet selected' }}
					</span>
					<button type="button" class="text-xs font-semibold px-3 py-2 border border-app-line rounded-full dark:border-app-line-dark focus-ring" @click="toggleColorMode">
						{{ isDark ? 'Light mode' : 'Dark mode' }}
					</button>
				</div>
			</nav>
		</div>
	</header>
</template>
