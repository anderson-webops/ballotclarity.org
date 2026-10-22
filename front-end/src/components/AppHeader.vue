<script setup lang="ts">
import { storeToRefs } from "pinia";
import { appName } from "~/constants";
import { buildCompareRoute } from "~/stores/civic";
import { buildLookupContextFromNationwideResult, buildNationwideRouteTarget } from "~/utils/nationwide-route-context";

interface HeaderLink {
	badge?: "compare" | "plan";
	label: string;
	to: string;
}

const civicStore = useCivicStore();
const route = useRoute();
const { activeNationwideResult, hasGuideShellContext, hasNationwideResultContext, hasVerifiedGuideContext } = useGuideEntryGate();
const isMenuOpen = ref(false);
const isAboutOpen = ref(false);
const aboutMenuRef = ref<HTMLElement | null>(null);
const aboutTrigger = shallowRef<HTMLButtonElement | null>(null);
const mobileMenuTrigger = shallowRef<HTMLButtonElement | null>(null);
const mobileNavigationId = `mobile-navigation-${useId()}`;
const aboutPanelId = `about-navigation-${useId()}`;

const { ballotPlanCount, compareCount, compareList, isHydrated, selectedElection, selectedLocation } = storeToRefs(civicStore);
const electionOverviewPath = computed(() => selectedElection.value?.slug ? `/elections/${selectedElection.value.slug}` : "/coverage");

// Task links stay visible in the header; their first entry follows the voter's progress through the guide.
const taskLinks = computed<HeaderLink[]>(() => {
	const shared: HeaderLink[] = [
		{ label: "Districts", to: "/districts" },
		{ label: "Representatives", to: "/representatives" },
		{ label: "Search", to: "/search" }
	];

	if (hasVerifiedGuideContext.value) {
		return [
			{ label: "Ballot guide", to: "/ballot" },
			{ badge: "plan", label: "My plan", to: "/plan" },
			{ badge: "compare", label: "Compare", to: "/compare" },
			...shared
		];
	}

	if (hasGuideShellContext.value)
		return [{ label: "Election overview", to: electionOverviewPath.value }, ...shared];

	if (hasNationwideResultContext.value)
		return [{ label: "Your results", to: "/results" }, ...shared];

	return [{ label: "Look up", to: "/" }, ...shared];
});

const aboutLinks: HeaderLink[] = [
	{ label: "About", to: "/about" },
	{ label: "Sources", to: "/sources" },
	{ label: "Coverage", to: "/coverage" },
	{ label: "Voting help", to: "/help" },
	{ label: "Contact", to: "/contact" }
];

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
const isAboutSectionActive = computed(() => aboutLinks.some(link => isActive(link.to)));

watch(() => route.fullPath, () => {
	isMenuOpen.value = false;
	isAboutOpen.value = false;
});

function isActive(path: string) {
	return path === "/"
		? route.path === path
		: route.path.startsWith(path);
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

function toggleAbout(event: MouseEvent) {
	aboutTrigger.value = event.currentTarget as HTMLButtonElement;
	isAboutOpen.value = !isAboutOpen.value;
}

function toggleMobileMenu(event: MouseEvent) {
	mobileMenuTrigger.value = event.currentTarget as HTMLButtonElement;
	isMenuOpen.value = !isMenuOpen.value;
}

function handleDocumentPointerDown(event: PointerEvent) {
	const target = event.target;

	if (!isAboutOpen.value || !(target instanceof Node) || aboutMenuRef.value?.contains(target))
		return;

	isAboutOpen.value = false;
}

function handleDocumentKeydown(event: KeyboardEvent) {
	if (event.key !== "Escape" || event.defaultPrevented)
		return;

	const returnFocus = isMenuOpen.value
		? mobileMenuTrigger.value
		: isAboutOpen.value
			? aboutTrigger.value
			: null;
	isMenuOpen.value = false;
	isAboutOpen.value = false;
	if (returnFocus) {
		event.preventDefault();
		returnFocus.focus();
	}
}

onMounted(() => {
	document.addEventListener("pointerdown", handleDocumentPointerDown);
	document.addEventListener("keydown", handleDocumentKeydown);
});

onBeforeUnmount(() => {
	document.removeEventListener("pointerdown", handleDocumentPointerDown);
	document.removeEventListener("keydown", handleDocumentKeydown);
});
</script>

<template>
	<header class="border-b border-app-line bg-app-panel top-0 sticky z-40 dark:border-app-line-dark dark:bg-app-panel-dark">
		<div class="mx-auto px-4 max-w-[80rem] w-full lg:px-8 sm:px-6">
			<div class="flex gap-4 h-16 items-center">
				<NuxtLink to="/" class="rounded-lg flex shrink-0 gap-2.5 items-center focus-ring">
					<span class="text-app-action-text rounded-lg bg-app-action flex h-9 w-9 items-center justify-center" aria-hidden="true">
						<span class="i-carbon-notebook text-lg" />
					</span>
					<span class="text-lg text-app-ink leading-none font-serif dark:text-app-text-dark">{{ appName }}</span>
				</NuxtLink>

				<nav class="ml-4 hidden self-stretch lg:flex" aria-label="Primary">
					<ul class="flex gap-1 items-stretch">
						<li v-for="link in taskLinks" :key="link.to" class="flex">
							<NuxtLink
								:to="resolveLinkTo(link.to)"
								:aria-current="isActive(link.to) ? 'page' : undefined"
								prefetch-on="interaction"
								class="header-nav-link text-[0.95rem] font-semibold px-3 border-b-3 inline-flex gap-1.5 whitespace-nowrap transition items-center focus-ring"
								:class="isActive(link.to)
									? 'border-app-accent text-app-ink dark:text-app-text-dark'
									: 'border-transparent text-app-muted hover:text-app-ink dark:text-app-muted-dark dark:hover:text-app-text-dark'"
							>
								{{ link.label }}
								<ClientOnly>
									<span v-if="linkBadge(link)" class="text-[11px] text-app-action-text font-bold px-1.5 rounded-full bg-app-accent inline-flex h-5 min-w-5 items-center justify-center">
										{{ linkBadge(link) }}
									</span>
								</ClientOnly>
							</NuxtLink>
						</li>
						<li ref="aboutMenuRef" class="flex relative">
							<button
								type="button"
								class="text-[0.95rem] font-semibold px-3 border-b-3 inline-flex gap-1.5 whitespace-nowrap transition items-center focus-ring"
								:class="isAboutSectionActive || isAboutOpen
									? 'border-app-accent text-app-ink dark:text-app-text-dark'
									: 'border-transparent text-app-muted hover:text-app-ink dark:text-app-muted-dark dark:hover:text-app-text-dark'"
								:aria-expanded="isAboutOpen"
								:aria-controls="aboutPanelId"
								@click="toggleAbout"
							>
								About
								<span class="i-carbon-chevron-down text-sm transition" :class="isAboutOpen ? 'rotate-180' : ''" aria-hidden="true" />
							</button>
							<div
								v-if="isAboutOpen"
								:id="aboutPanelId"
								class="mt-px p-2 border border-app-line rounded-xl bg-app-panel w-52 shadow-[0_16px_40px_-20px_rgba(13,37,62,0.35)] right-0 top-full absolute dark:border-app-line-dark dark:bg-app-panel-dark"
							>
								<ul class="space-y-0.5">
									<li v-for="link in aboutLinks" :key="link.to">
										<NuxtLink
											:to="link.to"
											:aria-current="isActive(link.to) ? 'page' : undefined"
											prefetch-on="interaction"
											class="px-2 py-2 rounded-lg block transition hover:bg-app-bg focus-ring dark:hover:bg-app-bg-dark"
										>
											<span class="text-sm text-app-ink block dark:text-app-text-dark">{{ link.label }}</span>
										</NuxtLink>
									</li>
								</ul>
							</div>
						</li>
					</ul>
				</nav>

				<div class="ml-auto flex shrink-0 gap-2 items-center">
					<ClientOnly>
						<NuxtLink
							v-if="effectiveSelectedLocation"
							:to="locationLookupHref"
							prefetch-on="interaction"
							class="text-sm text-app-ink px-3 border border-app-line rounded-lg max-w-[20rem] min-h-10 hidden transition items-center dark:text-app-text-dark dark:border-app-line-dark hover:border-app-accent xl:inline-flex focus-ring"
							:title="`Change location (currently ${effectiveSelectedLocation.displayName})`"
						>
							<span class="i-carbon-location text-app-accent mr-1.5 shrink-0" aria-hidden="true" />
							<span class="truncate">{{ effectiveSelectedLocation.displayName }}</span>
							<span class="text-app-accent font-semibold ml-2 shrink-0">Change</span>
						</NuxtLink>
					</ClientOnly>

					<NuxtLink to="/search" aria-label="Search public records" class="text-app-ink rounded-lg flex h-10 w-10 items-center justify-center dark:text-app-text-dark lg:hidden focus-ring">
						<span class="i-carbon-search text-xl" aria-hidden="true" />
					</NuxtLink>

					<div class="shrink-0 h-10 w-10">
						<ThemeToggleButton variant="icon" />
					</div>

					<button
						type="button"
						class="text-app-ink border border-app-line rounded-lg inline-flex shrink-0 h-10 w-10 transition items-center justify-center dark:text-app-text-dark dark:border-app-line-dark hover:border-app-accent lg:hidden focus-ring"
						:aria-expanded="isMenuOpen"
						:aria-controls="mobileNavigationId"
						aria-label="Menu"
						@click="toggleMobileMenu"
					>
						<span :class="isMenuOpen ? 'i-carbon-close' : 'i-carbon-menu'" class="text-xl" aria-hidden="true" />
					</button>
				</div>
			</div>
		</div>

		<div v-if="isMenuOpen" :id="mobileNavigationId" class="mobile-navigation-panel px-4 pb-6 pt-4 border-t border-app-line bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark lg:hidden">
			<nav class="mx-auto max-w-xl space-y-6" aria-label="Mobile navigation">
				<div class="px-4 py-3 border border-app-line rounded-xl bg-app-panel flex gap-3 items-center justify-between dark:border-app-line-dark dark:bg-app-panel-dark">
					<div class="min-w-0">
						<p class="eyebrow">
							Your location
						</p>
						<p class="text-[0.95rem] text-app-ink font-semibold mt-0.5 truncate dark:text-app-text-dark">
							{{ isHydrated ? (effectiveSelectedLocation?.displayName || "Not set yet") : "Loading…" }}
						</p>
					</div>
					<NuxtLink :to="locationLookupHref" prefetch-on="interaction" class="btn-secondary shrink-0">
						{{ effectiveSelectedLocation ? "Change" : "Set location" }}
					</NuxtLink>
				</div>

				<ul class="space-y-1">
					<li v-for="link in taskLinks" :key="link.to">
						<NuxtLink
							:to="resolveLinkTo(link.to)"
							:aria-current="isActive(link.to) ? 'page' : undefined"
							prefetch-on="interaction"
							class="text-base font-semibold px-4 py-3 rounded-lg flex gap-3 transition items-center justify-between focus-ring"
							:class="isActive(link.to)
								? 'bg-app-action text-app-action-text'
								: 'text-app-ink hover:bg-app-panel dark:text-app-text-dark dark:hover:bg-app-panel-dark'"
						>
							{{ link.label }}
							<span v-if="linkBadge(link)" class="text-xs font-bold px-2 py-0.5 rounded-full bg-app-warm">
								{{ linkBadge(link) }}
							</span>
						</NuxtLink>
					</li>
				</ul>

				<section>
					<p class="eyebrow px-4">
						About
					</p>
					<ul class="mt-2 gap-x-2 grid grid-cols-2">
						<li v-for="link in aboutLinks" :key="link.to">
							<NuxtLink
								:to="link.to"
								:aria-current="isActive(link.to) ? 'page' : undefined"
								prefetch-on="interaction"
								class="text-[0.95rem] px-4 py-2.5 rounded-lg block transition focus-ring"
								:class="isActive(link.to)
									? 'text-app-accent font-semibold'
									: 'text-app-ink hover:bg-app-panel dark:text-app-text-dark dark:hover:bg-app-panel-dark'"
							>
								{{ link.label }}
							</NuxtLink>
						</li>
					</ul>
				</section>
			</nav>
		</div>
	</header>
</template>
