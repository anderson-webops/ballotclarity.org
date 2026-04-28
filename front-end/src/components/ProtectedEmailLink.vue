<script setup lang="ts">
import { buildProtectedContactHref, getProtectedContactEmail } from "~/utils/protected-contact";

const props = withDefaults(defineProps<{
	linkClass?: string;
	linkLabel?: string;
	loadingClass?: string;
	loadingLabel?: string;
	subject?: string;
}>(), {
	linkClass: "underline underline-offset-3 rounded-md focus-ring",
	linkLabel: "",
	loadingClass: "text-app-muted dark:text-app-muted-dark",
	loadingLabel: "Email link loads in your browser.",
	subject: ""
});

const isMounted = ref(false);
const emailAddress = computed(() => getProtectedContactEmail());
const href = computed(() => buildProtectedContactHref(props.subject));
const visibleLabel = computed(() => props.linkLabel || emailAddress.value);

onMounted(() => {
	isMounted.value = true;
});
</script>

<template>
	<a v-if="isMounted" :href="href" :class="linkClass">
		{{ visibleLabel }}
	</a>
	<span v-else :class="loadingClass">
		{{ loadingLabel }}
	</span>
</template>
