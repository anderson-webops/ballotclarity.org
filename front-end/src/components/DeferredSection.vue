<script setup lang="ts">
const props = withDefaults(defineProps<{
	placeholderClass?: string;
	rootMargin?: string;
}>(), {
	placeholderClass: "",
	rootMargin: "420px"
});

const containerRef = ref<HTMLElement | null>(null);
const shouldRender = ref(false);

let observer: IntersectionObserver | null = null;

onMounted(() => {
	if (!containerRef.value || !("IntersectionObserver" in window)) {
		shouldRender.value = true;
		return;
	}

	observer = new IntersectionObserver(([entry]) => {
		if (!entry?.isIntersecting)
			return;

		shouldRender.value = true;
		observer?.disconnect();
		observer = null;
	}, { rootMargin: props.rootMargin });

	observer.observe(containerRef.value);
});

onBeforeUnmount(() => {
	observer?.disconnect();
	observer = null;
});
</script>

<template>
	<div ref="containerRef">
		<slot v-if="shouldRender" />
		<div v-else :class="placeholderClass" aria-hidden="true" />
	</div>
</template>
