<script setup lang="ts">
import type { ComponentPublicInstance } from "vue";
import { storeToRefs } from "pinia";
import { appName } from "~/constants";
import { buildCompareRoute } from "~/stores/civic";

interface HeaderLink {
	badge?: "compare" | "plan";
	description: string;
	label: string;
	to: string;
}

interface HeaderGroup {
	description: string;
	label: string;
	links: HeaderLink[];
}

const civicStore = useCivicStore();
const colorMode = useColorMode();
const route = useRoute();
const isMenuOpen = ref(false);
const isHeaderVisible = ref(true);
const lastScrollY = ref(0);
const activeDesktopGroup = ref<string | null>(null);
const desktopNavRef = ref<ComponentPublicInstance<HTMLElement> | HTMLElement | null>(null);

const headerTopRevealOffset = 24;
const headerDirectionThreshold = 12;

let scrollFramePending = false;

const { ballotPlanCount, compareCount, compareList, isHydrated, selectedLocation } = storeToRefs(civicStore);

const navGroups: HeaderGroup[] = [
	{
		description: "Ballot-reading tools and active voter workflows.",
		label: "Use the guide",
		links: [
			{ badge: "plan", description: "Saved checklist and print-friendly plan.", label: "My plan", to: "/plan" },
			{ description: "Contest reading view with filters and official links.", label: "Ballot guide", to: "/ballot" },
			{ description: "Office-area pages for each active district or contest area.", label: "Districts", to: "/districts" },
			{ description: "Current representatives linked to district, funding, and influence pages.", label: "Representatives", to: "/representatives" },
			{ badge: "compare", description: "Side-by-side candidate comparison.", label: "Compare", to: "/compare" },
			{ description: "Search the current public coverage archive.", label: "Search", to: "/search" }
		]
	},
	{
		description: "How Ballot Clarity works and how to verify it.",
		label: "Learn and verify",
		links: [
			{ description: "Source directory and citation targets.", label: "Sources", to: "/sources" },
			{ description: "Coverage scope and launch profile.", label: "Coverage", to: "/coverage" },
			{ description: "How summaries and links are produced.", label: "Methodology", to: "/methodology" },
			{ description: "Neutrality, sourcing, and editorial rules.", label: "Neutrality", to: "/neutrality" }
		]
	},
	{
		description: "Help, public standards, and organization context.",
		label: "Project and help",
		links: [
			{ description: "Voting FAQ and how to use the site.", label: "Help", to: "/help" },
			{ description: "Corrections workflow and public updates.", label: "Corrections", to: "/corrections" },
			{ description: "Public site status and source review notes.", label: "Status", to: "/status" },
			{ description: "About the nonprofit and contact options.", label: "About", to: "/about" }
		]
	}
];

const isDark = computed(() => colorMode.value === "dark");
const effectiveBallotPlanCount = computed(() => isHydrated.value ? ballotPlanCount.value : 0);
const effectiveCompareCount = computed(() => isHydrated.value ? compareCount.value : 0);
const effectiveCompareList = computed(() => isHydrated.value ? compareList.value : []);
const effectiveSelectedLocation = computed(() => isHydrated.value ? selectedLocation.value : null);
const locationLookupHref = computed(() => route.path.startsWith("/plan") ? "/plan#change-location" : "/#location-lookup");

watch(() => route.fullPath, () => {
	isMenuOpen.value = false;
	isHeaderVisible.value = true;
	activeDesktopGroup.value = null;

	if (import.meta.client)
		lastScrollY.value = window.scrollY;
});

watch(isMenuOpen, (menuOpen) => {
	if (menuOpen)
		isHeaderVisible.value = true;
});

function isActive(path: string) {
	return path === "/"
		? route.path === path
		: route.path.startsWith(path);
}

function isGroupActive(group: HeaderGroup) {
	return group.links.some(link => isActive(link.to));
}

function isDesktopGroupOpen(group: HeaderGroup) {
	return activeDesktopGroup.value === group.label;
}

function linkBadge(link: HeaderLink) {
	if (link.badge === "compare" && effectiveCompareCount.value)
		return String(effectiveCompareCount.value);

	if (link.badge === "plan" && effectiveBallotPlanCount.value)
		return String(effectiveBallotPlanCount.value);

	return "";
}

function resolveLinkTo(path: string) {
	return path === "/compare"
		? buildCompareRoute(effectiveCompareList.value)
		: path;
}

function toggleDesktopGroup(group: HeaderGroup) {
	activeDesktopGroup.value = isDesktopGroupOpen(group) ? null : group.label;
}

function closeDesktopGroups() {
	activeDesktopGroup.value = null;
}

function toggleColorMode() {
	colorMode.preference = isDark.value ? "light" : "dark";
}

function updateHeaderVisibility(nextScrollY: number) {
	const clampedScrollY = Math.max(nextScrollY, 0);
	const scrollDelta = clampedScrollY - lastScrollY.value;

	if (isMenuOpen.value || clampedScrollY <= headerTopRevealOffset) {
		isHeaderVisible.value = true;
	}
	else if (scrollDelta >= headerDirectionThreshold) {
		isHeaderVisible.value = false;
	}
	else if (scrollDelta <= -headerDirectionThreshold) {
		isHeaderVisible.value = true;
	}

	lastScrollY.value = clampedScrollY;
}

function handleScroll() {
	if (scrollFramePending)
		return;

	scrollFramePending = true;

	window.requestAnimationFrame(() => {
		scrollFramePending = false;
		updateHeaderVisibility(window.scrollY);
	});
}

function handleDocumentPointerDown(event: PointerEvent) {
	const target = event.target;
	const desktopNavElement = desktopNavRef.value instanceof HTMLElement
		? desktopNavRef.value
		: desktopNavRef.value?.$el;

	if (!(target instanceof Node) || !desktopNavElement || desktopNavElement.contains(target))
		return;

	closeDesktopGroups();
}

function handleDocumentKeydown(event: KeyboardEvent) {
	if (event.key === "Escape")
		closeDesktopGroups();
}

onMounted(() => {
	lastScrollY.value = window.scrollY;
	window.addEventListener("scroll", handleScroll, { passive: true });
	document.addEventListener("pointerdown", handleDocumentPointerDown);
	document.addEventListener("keydown", handleDocumentKeydown);
});

onBeforeUnmount(() => {
	window.removeEventListener("scroll", handleScroll);
	document.removeEventListener("pointerdown", handleDocumentPointerDown);
	document.removeEventListener("keydown", handleDocumentKeydown);
});
</script>

<template>
	<header
		class="will-change-transform border-b border-app-line/80 bg-app-bg/94 transition-transform duration-250 ease-out top-0 sticky z-40 backdrop-blur dark:border-app-line-dark dark:bg-app-bg-dark/92 focus-within:translate-y-0"
		:class="isHeaderVisible ? 'translate-y-0' : '-translate-y-full'"
	>
		<div class="mx-auto px-4 py-3 max-w-[96rem] w-full lg:px-8 sm:px-6">
			<div class="flex gap-4 items-center justify-between xl:gap-6">
				<div class="flex shrink-0 min-w-0 items-center">
					<NuxtLink to="/" class="rounded-full min-w-0 focus-ring">
						<span class="flex gap-3 items-center">
							<span class="text-app-ink border border-app-line rounded-2xl bg-white flex shrink-0 h-10 w-10 shadow-sm items-center justify-center dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark">
								<span class="i-carbon-notebook text-lg" />
							</span>
							<span class="min-w-0">
								<span class="text-[1.05rem] text-app-ink leading-none font-serif block dark:text-app-text-dark">{{ appName }}</span>
								<span class="text-[11px] text-app-muted mt-1 hidden dark:text-app-muted-dark 2xl:block">Nonpartisan ballot guide and public-record archive</span>
							</span>
						</span>
					</NuxtLink>
				</div>

				<nav ref="desktopNavRef" class="flex-1 min-w-0 hidden justify-center xl:flex" aria-label="Primary">
					<div class="px-2 py-1.5 border border-app-line/80 rounded-full bg-white/88 flex gap-1.5 max-w-full shadow-sm items-center dark:border-app-line-dark dark:bg-app-panel-dark/92">
						<div
							v-for="(group, index) in navGroups"
							:key="group.label"
							class="group relative"
						>
							<button
								type="button"
								class="text-sm font-medium px-4 py-1.5 list-none rounded-full cursor-pointer whitespace-nowrap transition focus-ring"
								:aria-controls="`header-group-panel-${index}`"
								:aria-expanded="isDesktopGroupOpen(group)"
								:class="isGroupActive(group) || isDesktopGroupOpen(group)
									? 'bg-app-ink text-white'
									: 'text-app-muted hover:bg-app-bg hover:text-app-ink dark:text-app-muted-dark dark:hover:bg-app-bg-dark/70 dark:hover:text-app-text-dark'"
								@click="toggleDesktopGroup(group)"
							>
								<span class="inline-flex gap-2 items-center">
									<span>{{ group.label }}</span>
									<span class="i-carbon-chevron-down text-xs transition" :class="isDesktopGroupOpen(group) ? 'rotate-180' : ''" />
								</span>
							</button>
							<div v-if="isDesktopGroupOpen(group)" class="pt-2.5 left-0 top-full absolute">
								<div class="p-3 border border-app-line/80 rounded-[1.2rem] bg-white min-w-[18rem] shadow-[0_22px_48px_-30px_rgba(16,37,62,0.45)] dark:border-app-line-dark dark:bg-app-panel-dark">
									<div :id="`header-group-panel-${index}`">
										<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
											{{ group.label }}
										</p>
										<p class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
											{{ group.description }}
										</p>
										<div class="mt-3 gap-1 grid">
											<NuxtLink
												v-for="link in group.links"
												:key="link.to"
												:to="resolveLinkTo(link.to)"
												prefetch-on="interaction"
												class="px-3 py-2.5 rounded-[0.95rem] transition hover:bg-app-bg focus-ring dark:hover:bg-app-bg-dark/70"
												@click="closeDesktopGroups"
											>
												<div class="flex gap-3 items-start justify-between">
													<div class="min-w-0">
														<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
															{{ link.label }}
														</p>
														<p class="text-xs text-app-muted leading-6 mt-1 dark:text-app-muted-dark">
															{{ link.description }}
														</p>
													</div>
													<span v-if="linkBadge(link)" class="text-[11px] text-app-ink font-bold px-1.5 rounded-full bg-app-warm inline-flex h-5 min-w-5 items-center justify-center">
														{{ linkBadge(link) }}
													</span>
												</div>
											</NuxtLink>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</nav>

				<div class="shrink-0 gap-3 hidden items-center md:flex">
					<NuxtLink
						to="/plan"
						prefetch-on="interaction"
						class="text-sm text-app-ink font-medium px-4 py-2 border border-app-line rounded-full bg-white inline-flex gap-2 min-h-10 shadow-sm transition items-center dark:text-app-text-dark hover:text-app-accent dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark focus-ring dark:hover:text-white"
						:class="isActive('/plan') ? 'border-app-accent text-app-accent dark:border-app-accent dark:text-white' : ''"
					>
						<span>My plan</span>
						<span v-if="effectiveBallotPlanCount" class="text-[11px] text-app-ink font-bold px-1.5 rounded-full bg-app-warm inline-flex h-5 min-w-5 items-center justify-center">
							{{ effectiveBallotPlanCount }}
						</span>
					</NuxtLink>

					<NuxtLink
						v-if="effectiveSelectedLocation"
						:to="locationLookupHref"
						prefetch-on="interaction"
						class="text-xs text-app-muted px-3 py-2 border border-app-line rounded-full bg-white max-w-[12rem] hidden whitespace-nowrap shadow-sm transition items-center dark:text-app-muted-dark hover:text-app-accent dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark 2xl:inline-flex focus-ring dark:hover:text-white"
						title="Change location"
					>
						<span class="i-carbon-location mr-1.5 align-middle shrink-0" />
						<span class="truncate">{{ effectiveSelectedLocation.displayName }}</span>
					</NuxtLink>

					<button
						type="button"
						class="text-app-ink border border-app-line rounded-full bg-white inline-flex shrink-0 h-10 w-10 shadow-sm transition items-center justify-center dark:text-app-text-dark hover:text-app-accent dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark focus-ring"
						:aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
						@click="toggleColorMode"
					>
						<span :class="isDark ? 'i-carbon-sun' : 'i-carbon-moon'" class="text-lg" />
					</button>

					<button
						type="button"
						class="text-app-ink border border-app-line rounded-full bg-white inline-flex shrink-0 h-10 w-10 shadow-sm transition items-center justify-center dark:text-app-text-dark hover:text-app-accent dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark xl:hidden focus-ring"
						:aria-expanded="isMenuOpen"
						aria-label="Toggle navigation"
						@click="isMenuOpen = !isMenuOpen"
					>
						<span :class="isMenuOpen ? 'i-carbon-close' : 'i-carbon-menu'" class="text-lg" />
					</button>
				</div>

				<button
					type="button"
					class="text-app-ink border border-app-line rounded-full bg-white inline-flex shrink-0 h-10 w-10 shadow-sm transition items-center justify-center dark:text-app-text-dark hover:text-app-accent dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark md:hidden focus-ring"
					:aria-expanded="isMenuOpen"
					aria-label="Toggle navigation"
					@click="isMenuOpen = !isMenuOpen"
				>
					<span :class="isMenuOpen ? 'i-carbon-close' : 'i-carbon-menu'" class="text-lg" />
				</button>
			</div>
		</div>

		<div v-if="isMenuOpen" class="px-4 pb-4 pt-3 border-t border-app-line/80 bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark xl:hidden">
			<nav class="space-y-5" aria-label="Mobile navigation">
				<div class="space-y-2">
					<NuxtLink
						to="/plan"
						prefetch-on="interaction"
						class="text-sm font-medium px-4 py-3 rounded-2xl flex transition items-center justify-between focus-ring"
						:class="isActive('/plan')
							? 'bg-app-ink text-white'
							: 'bg-white text-app-ink dark:bg-app-panel-dark dark:text-app-text-dark'"
					>
						<span>My plan</span>
						<span v-if="effectiveBallotPlanCount" class="text-[11px] text-app-ink font-bold ml-2 px-2 py-0.5 rounded-full bg-app-warm">
							{{ effectiveBallotPlanCount }}
						</span>
					</NuxtLink>
					<div class="text-sm px-4 py-3 border border-app-line rounded-2xl bg-white flex items-center justify-between dark:border-app-line-dark dark:bg-app-panel-dark">
						<div class="min-w-0">
							<p class="text-app-muted truncate dark:text-app-muted-dark">
								{{ effectiveSelectedLocation?.displayName || "Ballot context not yet selected" }}
							</p>
							<NuxtLink :to="locationLookupHref" prefetch-on="interaction" class="text-xs text-app-accent font-semibold mt-1 inline-flex dark:text-[#9ed4e3] focus-ring">
								Change location
							</NuxtLink>
						</div>
						<button type="button" class="text-xs font-semibold px-3 py-2 border border-app-line rounded-full shrink-0 dark:border-app-line-dark focus-ring" @click="toggleColorMode">
							{{ isDark ? "Light mode" : "Dark mode" }}
						</button>
					</div>
				</div>

				<section v-for="group in navGroups" :key="group.label" class="space-y-2">
					<div class="px-1">
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							{{ group.label }}
						</p>
						<p class="text-xs text-app-muted leading-6 mt-1 dark:text-app-muted-dark">
							{{ group.description }}
						</p>
					</div>
					<NuxtLink
						v-for="link in group.links"
						:key="link.to"
						:to="resolveLinkTo(link.to)"
						prefetch-on="interaction"
						class="px-4 py-3 rounded-2xl flex gap-3 transition items-start justify-between focus-ring"
						:class="isActive(link.to)
							? 'bg-app-ink text-white'
							: 'bg-white text-app-ink dark:bg-app-panel-dark dark:text-app-text-dark'"
					>
						<span class="min-w-0">
							<span class="text-sm font-semibold block">
								{{ link.label }}
							</span>
							<span class="text-xs mt-1 block" :class="isActive(link.to) ? 'text-white/75' : 'text-app-muted dark:text-app-muted-dark'">
								{{ link.description }}
							</span>
						</span>
						<span v-if="linkBadge(link)" class="text-[11px] text-app-ink font-bold px-2 py-0.5 rounded-full bg-app-warm">
							{{ linkBadge(link) }}
						</span>
					</NuxtLink>
				</section>
			</nav>
		</div>
	</header>
</template>
