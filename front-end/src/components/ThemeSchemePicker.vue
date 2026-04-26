<script setup lang="ts">
import type { ThemeSchemeId } from "~/utils/theme-schemes";
import { onClickOutside, useEventListener } from "@vueuse/core";
import { isDarkThemeValue } from "~/utils/theme-schemes";

const props = withDefaults(defineProps<{
	align?: "end" | "start";
	compact?: boolean;
	panelAlign?: "end" | "start";
}>(), {
	align: "end",
	compact: false
});

const colorMode = useColorMode();
const { activeScheme, scheme, schemes } = useThemeScheme();

const open = ref(false);
const panelRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
const panelStyle = ref<Record<string, string>>({});
const isDark = computed(() => isDarkThemeValue(colorMode.value));
const panelAlignment = computed(() => props.panelAlign ?? props.align);

function toggleOpen() {
	open.value = !open.value;
}

function updatePanelPosition() {
	if (!open.value || !panelRef.value || !triggerRef.value)
		return;

	const viewportMargin = 12;
	const triggerRect = triggerRef.value.getBoundingClientRect();
	const panelRect = panelRef.value.getBoundingClientRect();
	const preferredLeft = panelAlignment.value === "start"
		? triggerRect.left
		: triggerRect.right - panelRect.width;
	const maxLeft = Math.max(viewportMargin, window.innerWidth - panelRect.width - viewportMargin);
	const left = Math.min(Math.max(preferredLeft, viewportMargin), maxLeft);

	panelStyle.value = {
		transform: `translateX(${Math.round(left - triggerRect.left)}px)`
	};
}

function selectScheme(nextScheme: ThemeSchemeId) {
	scheme.value = nextScheme;
}

onClickOutside(panelRef, () => {
	open.value = false;
}, {
	ignore: [triggerRef]
});

useEventListener("keydown", (event: KeyboardEvent) => {
	if (event.key === "Escape")
		open.value = false;
});

useEventListener("resize", updatePanelPosition);

watch(open, async (nextOpen) => {
	if (!nextOpen) {
		panelStyle.value = {};
		return;
	}

	await nextTick();
	updatePanelPosition();
});

watch(panelAlignment, async () => {
	if (!open.value)
		return;

	await nextTick();
	updatePanelPosition();
});
</script>

<template>
	<div
		class="theme-scheme-picker flex flex-col gap-3 relative z-20"
		:class="props.align === 'start' ? 'items-start' : 'items-end'"
	>
		<div
			v-if="open"
			ref="panelRef"
			role="dialog"
			aria-label="Color scheme picker"
			class="theme-scheme-picker__panel p-4 border border-app-line rounded-[1.45rem] bg-app-panel shadow-[0_28px_80px_rgba(0,0,0,0.26)] bottom-[calc(100%+0.75rem)] left-0 absolute z-[90] dark:border-app-line-dark dark:bg-app-panel-dark"
			:class="[
				props.compact ? 'w-[min(28rem,calc(100vw-2rem))]' : 'w-[min(30rem,calc(100vw-2rem))]',
			]"
			:style="panelStyle"
		>
			<div class="flex gap-4 items-start justify-between">
				<div>
					<p class="text-xs text-app-muted tracking-[0.22em] font-semibold uppercase dark:text-app-muted-dark">
						Color scheme
					</p>
					<h2 class="text-base text-app-ink font-semibold mt-2 dark:text-app-text-dark">
						Choose the palette family.
					</h2>
					<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
						The palette applies to both light and dark mode. Current mode: {{ isDark ? "Dark" : "Light" }}.
					</p>
				</div>
				<button
					type="button"
					class="text-app-ink border border-app-line rounded-full inline-flex shrink-0 h-11 w-11 transition items-center justify-center dark:text-app-text-dark dark:border-app-line-dark hover:bg-app-bg focus-ring dark:hover:bg-app-bg-dark"
					aria-label="Close color scheme picker"
					@click="open = false"
				>
					<span aria-hidden="true" class="text-lg leading-none font-semibold">×</span>
				</button>
			</div>

			<div class="mt-4 gap-3 grid">
				<button
					v-for="option in schemes"
					:key="option.id"
					type="button"
					class="p-4 text-left border rounded-[1.25rem] transition focus-ring"
					:class="option.id === scheme
						? 'border-app-accent bg-app-accent/10 shadow-[0_0_0_1px_rgba(var(--app-accent-rgb),0.24)]'
						: 'border-app-line bg-app-bg/60 hover:border-app-accent dark:border-app-line-dark dark:bg-app-bg-dark/50'"
					@click="selectScheme(option.id)"
				>
					<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<div class="min-w-0">
							<div class="flex flex-wrap gap-2 items-center">
								<span class="text-app-ink font-semibold dark:text-app-text-dark">{{ option.label }}</span>
								<span
									v-if="option.isDefault"
									class="text-[11px] text-app-muted font-semibold px-2 py-1 border border-app-line rounded-full uppercase dark:text-app-muted-dark dark:border-app-line-dark"
								>
									Default
								</span>
								<span
									v-if="option.id === scheme"
									class="text-[11px] text-app-accent font-semibold px-2 py-1 border border-app-accent/30 rounded-full bg-app-accent/10 uppercase"
								>
									Active
								</span>
							</div>
							<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
								{{ option.description }}
							</p>
						</div>

						<div class="flex shrink-0 gap-2 self-start">
							<div class="p-1.5 border border-black/8 rounded-2xl bg-white/40">
								<div class="flex gap-1">
									<span class="border border-black/8 rounded-xl h-7 w-7" :style="{ backgroundColor: option.swatches.light.surface }" />
									<span class="rounded-full h-7 w-3" :style="{ backgroundColor: option.swatches.light.accent }" />
									<span class="rounded-full h-7 w-3" :style="{ backgroundColor: option.swatches.light.text }" />
								</div>
							</div>
							<div class="p-1.5 border border-white/8 rounded-2xl bg-black/15">
								<div class="flex gap-1">
									<span class="border border-white/10 rounded-xl h-7 w-7" :style="{ backgroundColor: option.swatches.dark.surface }" />
									<span class="rounded-full h-7 w-3" :style="{ backgroundColor: option.swatches.dark.accent }" />
									<span class="rounded-full h-7 w-3" :style="{ backgroundColor: option.swatches.dark.text }" />
								</div>
							</div>
						</div>
					</div>
				</button>
			</div>
		</div>

		<button
			ref="triggerRef"
			type="button"
			class="theme-scheme-picker__trigger px-4 py-3 border border-app-line rounded-full bg-app-panel inline-flex gap-3 shadow-[0_20px_60px_rgba(0,0,0,0.14)] transition items-center dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark focus-ring"
			:class="props.compact ? 'w-full justify-between' : ''"
			:aria-expanded="open"
			aria-haspopup="dialog"
			@click="toggleOpen"
		>
			<span class="i-carbon-color-palette text-app-accent" />
			<span
				class="text-sm text-app-ink font-semibold dark:text-app-text-dark"
				:class="props.compact ? 'min-w-[4.75rem] text-left' : ''"
			>{{ activeScheme.label }}</span>
			<span class="text-xs text-app-muted tracking-[0.14em] uppercase dark:text-app-muted-dark">
				{{ isDark ? "Dark" : "Light" }}
			</span>
		</button>
	</div>
</template>
