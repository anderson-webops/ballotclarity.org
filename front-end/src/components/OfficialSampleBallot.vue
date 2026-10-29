<script setup lang="ts">
import { normalizeExternalHref } from "~/utils/link";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ href?: string | null }>();
const target = computed(() => normalizeExternalHref(props.href));
</script>

<template>
	<SafeExternalLink v-if="target" v-bind="$attrs" :href="target" :new-tab="false" external-icon class="btn-primary inline-flex gap-2 items-center">
		Official Sample Ballot
	</SafeExternalLink>
</template>
