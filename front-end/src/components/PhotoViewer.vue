<script setup lang="ts">
import type { ProfileImage } from "~/types/civic";

const props = defineProps<{ image: ProfileImage; name: string }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const scrollLocked = useScrollLock(import.meta.client ? document.documentElement : null);
const { width, height } = useWindowSize();
const aspectRatio = ref(1);
const photoWidth = computed(() => Math.max(1, Math.min(width.value - 48, (height.value - 128) * aspectRatio.value)));
const source = computed(() => {
	try {
		return new URL(props.image.sourceUrl ?? props.image.url).hostname.replace(/^www\./u, "");
	}
	catch {
		return props.image.sourceLabel;
	}
});

function onImageLoad(event: Event) {
	const image = event.target as HTMLImageElement;
	if (image.naturalWidth && image.naturalHeight)
		aspectRatio.value = image.naturalWidth / image.naturalHeight;
}

onMounted(() => {
	dialog.value?.showModal();
	scrollLocked.value = true;
});
onBeforeUnmount(() => {
	dialog.value?.close();
	scrollLocked.value = false;
});
</script>

<template>
	<dialog
		ref="dialog"
		:aria-label="`Photo of ${name}`"
		class="photo-viewer text-white m-0 p-6 border-0 bg-transparent max-h-none max-w-none w-screen inset-0 fixed overflow-auto h-dvh"
		@cancel.prevent="emit('close')"
		@close="emit('close')"
		@click.self="emit('close')"
		@keydown.tab.prevent="closeButton?.focus()"
	>
		<button ref="closeButton" type="button" aria-label="Close photo" class="text-white rounded-full bg-black/50 grid h-11 w-11 right-3 top-3 place-items-center fixed focus-ring" @click="emit('close')">
			<span class="i-carbon-close text-xl" aria-hidden="true" />
		</button>
		<figure class="m-0 max-w-full pointer-events-none">
			<img :src="image.url" :alt="image.alt || `Portrait of ${name}`" :style="{ width: `${photoWidth}px` }" class="h-auto max-w-full block pointer-events-auto object-contain" decoding="async" referrerpolicy="no-referrer" @load="onImageLoad" @error="emit('close')">
			<figcaption v-if="source" class="text-sm text-white/80 mt-4 text-center pointer-events-auto break-words">
				{{ source }}
			</figcaption>
		</figure>
	</dialog>
</template>

<style scoped>
.photo-viewer[open] {
	display: flex;
	align-items: center;
	justify-content: center;
}
.photo-viewer::backdrop {
	background: rgb(0 0 0 / 90%);
}
</style>
