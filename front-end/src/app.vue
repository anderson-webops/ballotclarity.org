<script setup lang="ts">
import { appDescription, appName } from "~/constants";

const noindexPathPattern = /^\/(?:admin|api|ballot|compare|plan|search)(?:\/|$)/;

const route = useRoute();
const siteUrl = useSiteUrl();
const shouldNoindex = computed(() => noindexPathPattern.test(route.path));
const siteSchema = {
	"@context": "https://schema.org",
	"@type": "WebSite",
	"description": appDescription,
	"name": appName,
	"url": siteUrl
};

useHead(() => ({
	meta: shouldNoindex.value
		? [
				{
					name: "robots",
					content: "noindex,nofollow"
				}
			]
		: [],
	titleTemplate: title => title ? `${title} | ${appName}` : appName,
	script: [
		{
			innerHTML: JSON.stringify(siteSchema),
			key: "website-jsonld",
			type: "application/ld+json"
		}
	]
}));
</script>

<template>
	<NuxtLayout>
		<NuxtPage />
	</NuxtLayout>
</template>
