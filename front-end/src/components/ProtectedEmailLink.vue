<script setup lang="ts">
import { buildProtectedContactHref, requestProtectedContactAddress } from "~/utils/protected-contact";

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

const emailAddress = ref("");
const hasLoadFailed = ref(false);
const href = computed(() => emailAddress.value ? buildProtectedContactHref(emailAddress.value, props.subject) : "");
const visibleLabel = computed(() => props.linkLabel || emailAddress.value);
const fallbackLabel = computed(() => hasLoadFailed.value ? "Email link unavailable. Use the contact form above." : props.loadingLabel);

onMounted(async () => {
	try {
		emailAddress.value = await requestProtectedContactAddress();
	}
	catch {
		hasLoadFailed.value = true;
	}
});
</script>

<template>
	<a v-if="emailAddress" :href="href" :class="linkClass">
		{{ visibleLabel }}
	</a>
	<span v-else :class="loadingClass">
		{{ fallbackLabel }}
	</span>
</template>
