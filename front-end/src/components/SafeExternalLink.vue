<script setup lang="ts">
import { resolvePublicLink } from "~/utils/link";

defineOptions({
	inheritAttrs: false
});

const props = withDefaults(defineProps<{
	externalIcon?: boolean;
	href?: string | null;
	newTab?: boolean;
}>(), {
	externalIcon: false,
	newTab: true
});

const siteUrl = useSiteUrl();
const link = computed(() => resolvePublicLink(props.href, siteUrl));
const opensNewTab = computed(() => link.value.external && props.newTab);
</script>

<template>
	<a
		v-if="link.href"
		v-bind="$attrs"
		:href="link.href"
		:target="opensNewTab ? '_blank' : undefined"
		:rel="opensNewTab ? 'noopener noreferrer' : undefined"
	>
		<slot />
		<span v-if="props.externalIcon && link.external" class="i-carbon-launch" aria-hidden="true" />
	</a>
</template>
