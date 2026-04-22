<script setup lang="ts">
import type { ComponentPublicInstance } from "vue";
import { storeToRefs } from "pinia";
import { appName } from "~/constants";
import { buildCompareRoute } from "~/stores/civic";
import { buildLookupContextFromNationwideResult, buildNationwideRouteTarget } from "~/utils/nationwide-route-context";

interface HeaderLink {
	badge?: "compare" | "plan";
	label: string;
	to: string;
}

interface HeaderGroup {
	label: string;
	links: HeaderLink[];
}

const civicStore = useCivicStore();
const route = useRoute();
const { activeNationwideResult, hasNationwideResultContext, hasPublishedGuideContext } = useGuideEntryGate();
const isMenuOpen = ref(false);
const isHeaderVisible = ref(true);
const lastScrollY = ref(0);
const activeDesktopGroup = ref<string | null>(null);
const desktopNavRef = ref<ComponentPublicInstance<HTMLElement> | HTMLElement | null>(null);

const headerTopRevealOffset = 24;
const headerDirectionThreshold = 12;

let scrollFramePending = false;

const { ballotPlanCount, compareCount, compareList, isHydrated, selectedLocation } = storeToRefs(civicStore);
const primaryNavLabel = computed(() => "Explore");
const headerPrimaryAction = computed(() => hasPublishedGuideContext.value
	? { badge: "plan" as const, label: "My plan", to: "/plan" }
	: hasNationwideResultContext.value
		? { label: "Results", to: "/results" }
		: { label: "Lookup", to: "/" });

const navGroups = computed<HeaderGroup[]>(() => {
	const guideLinks: HeaderLink[] = hasPublishedGuideContext.value
		? [
				{ badge: "plan", label: "My plan", to: "/plan" },
				{ label: "Ballot guide", to: "/ballot" },
				{ label: "Districts", to: "/districts" },
				{ label: "Representatives", to: "/representatives" },
				{ badge: "compare", label: "Compare", to: "/compare" },
				{ label: "Search", to: "/search" }
			]
		: [
				...(hasNationwideResultContext.value
					? [{ label: "Results", to: "/results" }]
					: [{ label: "Location lookup", to: "/" }]),
				{ label: "Districts", to: "/districts" },
				{ label: "Representatives", to: "/representatives" },
				{ label: "Search", to: "/search" }
			];

	return [
		{
			label: primaryNavLabel.value,
			links: guideLinks
		},
		{
			label: "Learn and verify",
			links: [
				{ label: "Sources", to: "/sources" },
				{ label: "Coverage", to: "/coverage" },
				{ label: "Data sources", to: "/data-sources" },
				{ label: "Methodology", to: "/methodology" },
				{ label: "Neutrality", to: "/neutrality" }
			]
		},
		{
			label: "Project and help",
			links: [
				{ label: "Help", to: "/help" },
				{ label: "Corrections", to: "/corrections" },
				{ label: "Status", to: "/status" },
				{ label: "About", to: "/about" }
			]
		}
	];
});

const showPersistedCivicState = computed(() => isHydrated.value);
const effectiveBallotPlanCount = computed(() => isHydrated.value ? ballotPlanCount.value : 0);
const effectiveCompareCount = computed(() => isHydrated.value ? compareCount.value : 0);
const effectiveCompareList = computed(() => isHydrated.value ? compareList.value : []);
const effectiveSelectedLocation = computed(() => {
	if (!isHydrated.value)
		return null;

	return activeNationwideResult.value?.location ?? selectedLocation.value;
});
const locationLookupHref = computed(() => {
	if (route.path.startsWith("/plan"))
		return "/plan#change-location";

	if (route.path.startsWith("/results"))
		return "/results#change-location";

	return hasNationwideResultContext.value ? "/results#change-location" : "/#location-lookup";
});

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
	if (path === "/compare")
		return buildCompareRoute(effectiveCompareList.value);

	if (path === "/results" || path === "/districts" || path === "/representatives")
		return buildNationwideRouteTarget(path, buildLookupContextFromNationwideResult(activeNationwideResult.value), route.query);

	return path;
}

function toggleDesktopGroup(group: HeaderGroup) {
	activeDesktopGroup.value = isDesktopGroupOpen(group) ? null : group.label;
}

function closeDesktopGroups() {
	activeDesktopGroup.value = null;
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
		<div class="mx-auto px-4 py-2.5 max-w-[96rem] w-full lg:px-8 sm:px-6 sm:py-3">
			<div class="flex gap-3 items-center justify-between xl:gap-6">
				<div class="flex shrink-0 min-w-0 items-center">
					<NuxtLink to="/" class="rounded-full min-w-0 focus-ring">
						<span class="flex gap-3 items-center">
							<span class="text-app-ink border border-app-line rounded-2xl bg-white flex shrink-0 h-9 w-9 shadow-sm items-center justify-center dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark sm:h-10 sm:w-10">
								<span class="i-carbon-notebook text-lg" />
							</span>
							<span class="min-w-0">
								<span class="text-[0.98rem] text-app-ink leading-none font-serif block sm:text-[1.05rem] dark:text-app-text-dark">{{ appName }}</span>
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
								class="text-sm font-medium px-3.5 py-1.5 list-none rounded-full cursor-pointer whitespace-nowrap transition focus-ring"
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
							<div v-if="isDesktopGroupOpen(group)" class="pt-2 left-0 top-full absolute">
								<div class="p-3 border border-app-line/80 rounded-[1.2rem] bg-white min-w-[16.5rem] shadow-[0_22px_48px_-30px_rgba(16,37,62,0.45)] dark:border-app-line-dark dark:bg-app-panel-dark">
									<div :id="`header-group-panel-${index}`">
										<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
											{{ group.label }}
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

				<div class="shrink-0 gap-2.5 hidden items-center md:flex lg:gap-3">
					<NuxtLink
						:to="resolveLinkTo(headerPrimaryAction.to)"
						prefetch-on="interaction"
						class="text-sm text-app-ink font-medium px-3.5 py-2 border border-app-line rounded-full bg-white inline-flex gap-2 min-h-10 shadow-sm transition items-center dark:text-app-text-dark hover:text-app-accent lg:px-4 dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark focus-ring dark:hover:text-white"
						:class="isActive(headerPrimaryAction.to) ? 'border-app-accent text-app-accent dark:border-app-accent dark:text-white' : ''"
					>
						<span>{{ headerPrimaryAction.label }}</span>
						<ClientOnly>
							<span v-if="headerPrimaryAction.badge === 'plan' && showPersistedCivicState && effectiveBallotPlanCount" class="text-[11px] text-app-ink font-bold px-1.5 rounded-full bg-app-warm inline-flex h-5 min-w-5 items-center justify-center">
								{{ effectiveBallotPlanCount }}
							</span>
						</ClientOnly>
					</NuxtLink>

					<ClientOnly>
						<NuxtLink
							v-if="showPersistedCivicState && effectiveSelectedLocation"
							:to="locationLookupHref"
							prefetch-on="interaction"
							class="text-xs text-app-muted px-3 py-2 border border-app-line rounded-full bg-white max-w-[12rem] hidden whitespace-nowrap shadow-sm transition items-center dark:text-app-muted-dark hover:text-app-accent dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark 2xl:inline-flex focus-ring dark:hover:text-white"
							title="Change location"
						>
							<span class="i-carbon-location mr-1.5 align-middle shrink-0" />
							<span class="truncate">{{ effectiveSelectedLocation.displayName }}</span>
						</NuxtLink>
					</ClientOnly>

					<div class="shrink-0 h-10 w-10">
						<ThemeToggleButton variant="icon" />
					</div>

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

		<div v-if="isMenuOpen" class="px-4 pb-4 pt-2.5 border-t border-app-line/80 bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark xl:hidden">
			<nav class="space-y-5" aria-label="Mobile navigation">
				<div class="space-y-2">
					<NuxtLink
						:to="resolveLinkTo(headerPrimaryAction.to)"
						prefetch-on="interaction"
						class="text-sm font-medium px-4 py-3 rounded-2xl flex transition items-center justify-between focus-ring"
						:class="isActive(headerPrimaryAction.to)
							? 'bg-app-ink text-white'
							: 'bg-white text-app-ink dark:bg-app-panel-dark dark:text-app-text-dark'"
					>
						<span>{{ headerPrimaryAction.label }}</span>
						<ClientOnly>
							<span v-if="headerPrimaryAction.badge === 'plan' && showPersistedCivicState && effectiveBallotPlanCount" class="text-[11px] text-app-ink font-bold ml-2 px-2 py-0.5 rounded-full bg-app-warm">
								{{ effectiveBallotPlanCount }}
							</span>
						</ClientOnly>
					</NuxtLink>
					<div class="text-sm px-4 py-3 border border-app-line rounded-2xl bg-white flex items-center justify-between dark:border-app-line-dark dark:bg-app-panel-dark">
						<div class="min-w-0">
							<p class="text-app-muted truncate dark:text-app-muted-dark">
								{{ showPersistedCivicState ? (effectiveSelectedLocation?.displayName || "No active lookup context yet") : "Lookup context syncs after page load" }}
							</p>
							<NuxtLink :to="locationLookupHref" prefetch-on="interaction" class="text-xs text-app-accent font-semibold mt-1 inline-flex dark:text-[#9ed4e3] focus-ring">
								Change location
							</NuxtLink>
						</div>
						<ThemeToggleButton variant="text" />
					</div>
				</div>

				<section v-for="group in navGroups" :key="group.label" class="space-y-2">
					<div class="px-1">
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							{{ group.label }}
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
