<script setup lang="ts">
import { buildProtectedContactHref, getProtectedContactEmail } from "~/utils/protected-contact";

const props = withDefaults(defineProps<{
	buttonClass?: string;
	linkClass?: string;
	linkLabel?: string;
	revealLabel?: string;
	subject?: string;
}>(), {
	buttonClass: "underline underline-offset-3 rounded-md focus-ring",
	linkClass: "underline underline-offset-3 rounded-md focus-ring",
	linkLabel: "",
	revealLabel: "Reveal email address",
	subject: ""
});

const isRevealed = ref(false);
const emailAddress = computed(() => getProtectedContactEmail());
const href = computed(() => buildProtectedContactHref(props.subject));
const visibleLabel = computed(() => props.linkLabel || emailAddress.value);
</script>

<template>
	<button v-if="!isRevealed" type="button" :class="buttonClass" @click="isRevealed = true">
		{{ revealLabel }}
	</button>
	<a v-else :href="href" :class="linkClass">
		{{ visibleLabel }}
	</a>
</template>
