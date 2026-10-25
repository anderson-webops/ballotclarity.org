<script setup lang="ts">
import { normalizeExternalHref } from "~/utils/link";

const props = defineProps<{
	providerUrl?: string;
	websiteUrl?: string;
}>();

const website = computed(() => normalizeExternalHref(props.websiteUrl));
const href = computed(() => website.value || normalizeExternalHref(props.providerUrl));
</script>

<template>
	<SafeExternalLink v-if="href" :href="href" external-icon class="inline-flex gap-1.5 items-center focus-ring">
		{{ website ? "Website" : "Provider record" }}
	</SafeExternalLink>
</template>
