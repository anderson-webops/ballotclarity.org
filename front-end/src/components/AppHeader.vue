<script setup lang="ts">
import { storeToRefs } from "pinia";
import { appName } from "~/constants";

const civicStore = useCivicStore();
const colorMode = useColorMode();
const route = useRoute();
const isMenuOpen = ref(false);

const { ballotPlanCount, compareCount, selectedLocation } = storeToRefs(civicStore);

const primaryLinks = [
	{ label: "Ballot guide", to: "/ballot" },
	{ label: "Compare", to: "/compare" },
	{ label: "Search", to: "/search" },
	{ label: "Sources", to: "/sources" }
];

const secondaryLinks = [
	{ label: "Coverage", to: "/coverage" },
	{ label: "Methodology", to: "/methodology" },
	{ label: "About", to: "/about" }
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
		<div class="mx-auto px-4 py-4 max-w-[96rem] w-full lg:px-8 sm:px-6">
			<div class="flex gap-4 items-center justify-between xl:gap-6">
				<div class="flex shrink-0 min-w-0 items-center">
					<NuxtLink to="/" class="rounded-full min-w-0 focus-ring">
						<span class="flex gap-3 items-center">
							<span class="text-app-ink border border-app-line rounded-2xl bg-white flex shrink-0 h-11 w-11 shadow-sm items-center justify-center dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark">
								<span class="i-carbon-notebook text-xl" />
							</span>
							<span class="min-w-0">
								<span class="text-lg text-app-ink leading-none font-serif block dark:text-app-text-dark">{{ appName }}</span>
								<span class="text-xs text-app-muted mt-1 block dark:text-app-muted-dark">Nonpartisan ballot guide and source archive</span>
							</span>
						</span>
					</NuxtLink>
				</div>

				<nav class="flex-1 min-w-0 hidden justify-center xl:flex" aria-label="Primary">
					<div class="px-2 py-2 border border-app-line/80 rounded-full bg-white/88 flex gap-1 max-w-full shadow-sm items-center dark:border-app-line-dark dark:bg-app-panel-dark/92">
						<NuxtLink
							v-for="link in primaryLinks"
							:key="link.to"
							:to="link.to"
							class="text-sm font-medium px-3 py-2 rounded-full whitespace-nowrap transition focus-ring"
							:class="isActive(link.to)
								? 'bg-app-ink text-white'
								: 'text-app-muted hover:bg-app-bg hover:text-app-ink dark:text-app-muted-dark dark:hover:bg-app-bg-dark/70 dark:hover:text-app-text-dark'"
						>
							{{ link.label }}
							<span v-if="link.to === '/compare' && compareCount" class="text-[11px] text-app-ink font-bold ml-2 px-1.5 rounded-full bg-app-warm inline-flex h-5 min-w-5 items-center justify-center">
								{{ compareCount }}
							</span>
						</NuxtLink>

						<div class="mx-2 bg-app-line/80 h-6 w-px dark:bg-app-line-dark" />

						<NuxtLink
							v-for="link in secondaryLinks"
							:key="link.to"
							:to="link.to"
							class="text-sm font-medium px-3 py-2 rounded-full whitespace-nowrap transition focus-ring"
							:class="isActive(link.to)
								? 'bg-app-ink text-white'
								: 'text-app-muted hover:bg-app-bg hover:text-app-ink dark:text-app-muted-dark dark:hover:bg-app-bg-dark/70 dark:hover:text-app-text-dark'"
						>
							{{ link.label }}
						</NuxtLink>
					</div>
				</nav>

				<div class="shrink-0 gap-3 hidden items-center md:flex">
					<NuxtLink
						to="/plan"
						class="text-sm text-app-ink font-medium px-4 py-2 border border-app-line rounded-full bg-white inline-flex gap-2 min-h-11 shadow-sm transition items-center dark:text-app-text-dark hover:text-app-accent dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark focus-ring dark:hover:text-white"
						:class="isActive('/plan') ? 'border-app-accent text-app-accent dark:border-app-accent dark:text-white' : ''"
					>
						<span>My plan</span>
						<span v-if="ballotPlanCount" class="text-[11px] text-app-ink font-bold px-1.5 rounded-full bg-app-warm inline-flex h-5 min-w-5 items-center justify-center">
							{{ ballotPlanCount }}
						</span>
					</NuxtLink>

					<div
						v-if="selectedLocation"
						class="text-xs text-app-muted px-3 py-2 border border-app-line rounded-full bg-white max-w-[12rem] hidden whitespace-nowrap shadow-sm items-center dark:text-app-muted-dark dark:border-app-line-dark dark:bg-app-panel-dark 2xl:inline-flex"
					>
						<span class="i-carbon-location mr-1.5 align-middle shrink-0" />
						<span class="truncate">{{ selectedLocation.displayName }}</span>
					</div>

					<button
						type="button"
						class="text-app-ink border border-app-line rounded-full bg-white inline-flex shrink-0 h-11 w-11 shadow-sm transition items-center justify-center dark:text-app-text-dark hover:text-app-accent dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark focus-ring"
						:aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
						@click="toggleColorMode"
					>
						<span :class="isDark ? 'i-carbon-sun' : 'i-carbon-moon'" class="text-lg" />
					</button>

					<button
						type="button"
						class="text-app-ink border border-app-line rounded-full bg-white inline-flex shrink-0 h-11 w-11 shadow-sm transition items-center justify-center dark:text-app-text-dark hover:text-app-accent dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark xl:hidden focus-ring"
						:aria-expanded="isMenuOpen"
						aria-label="Toggle navigation"
						@click="isMenuOpen = !isMenuOpen"
					>
						<span :class="isMenuOpen ? 'i-carbon-close' : 'i-carbon-menu'" class="text-lg" />
					</button>
				</div>

				<button
					type="button"
					class="text-app-ink border border-app-line rounded-full bg-white inline-flex shrink-0 h-11 w-11 shadow-sm transition items-center justify-center dark:text-app-text-dark hover:text-app-accent dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark md:hidden focus-ring"
					:aria-expanded="isMenuOpen"
					aria-label="Toggle navigation"
					@click="isMenuOpen = !isMenuOpen"
				>
					<span :class="isMenuOpen ? 'i-carbon-close' : 'i-carbon-menu'" class="text-lg" />
				</button>
			</div>
		</div>

		<div v-if="isMenuOpen" class="px-4 pb-4 pt-3 border-t border-app-line/80 bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark xl:hidden">
			<nav class="flex flex-col gap-2" aria-label="Mobile navigation">
				<NuxtLink
					to="/plan"
					class="text-sm font-medium px-4 py-3 rounded-2xl transition focus-ring"
					:class="isActive('/plan')
						? 'bg-app-ink text-white'
						: 'bg-white text-app-ink dark:bg-app-panel-dark dark:text-app-text-dark'"
				>
					My plan
					<span v-if="ballotPlanCount" class="text-[11px] text-app-ink font-bold ml-2 px-2 py-0.5 rounded-full bg-app-warm">
						{{ ballotPlanCount }}
					</span>
				</NuxtLink>

				<NuxtLink
					v-for="link in primaryLinks"
					:key="link.to"
					:to="link.to"
					class="text-sm font-medium px-4 py-3 rounded-2xl transition focus-ring"
					:class="isActive(link.to)
						? 'bg-app-ink text-white'
						: 'bg-white text-app-ink dark:bg-app-panel-dark dark:text-app-text-dark'"
				>
					{{ link.label }}
					<span v-if="link.to === '/compare' && compareCount" class="text-[11px] text-app-ink font-bold ml-2 px-2 py-0.5 rounded-full bg-app-warm">
						{{ compareCount }}
					</span>
				</NuxtLink>

				<NuxtLink
					v-for="link in secondaryLinks"
					:key="link.to"
					:to="link.to"
					class="text-sm font-medium px-4 py-3 rounded-2xl transition focus-ring"
					:class="isActive(link.to)
						? 'bg-app-ink text-white'
						: 'bg-white text-app-ink dark:bg-app-panel-dark dark:text-app-text-dark'"
				>
					{{ link.label }}
				</NuxtLink>

				<div class="text-sm mt-2 px-4 py-3 border border-app-line rounded-2xl bg-white flex items-center justify-between dark:border-app-line-dark dark:bg-app-panel-dark">
					<span class="text-app-muted dark:text-app-muted-dark">
						{{ selectedLocation?.displayName || "Ballot context not yet selected" }}
					</span>
					<button type="button" class="text-xs font-semibold px-3 py-2 border border-app-line rounded-full dark:border-app-line-dark focus-ring" @click="toggleColorMode">
						{{ isDark ? "Light mode" : "Dark mode" }}
					</button>
				</div>
			</nav>
		</div>
	</header>
</template>
