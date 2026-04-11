<script setup lang="ts">
import { appDescription, appName } from "~/constants";

const noindexPathPattern = /^\/(?:admin|ballot|compare|plan|search)(?:\/|$)/;

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
	htmlAttrs: {
		lang: "en"
	},
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
			children: JSON.stringify(siteSchema),
			key: "website-jsonld",
			type: "application/ld+json"
		}
	]
}));
</script>

<template>
	<VitePwaManifest />
	<NuxtLayout>
		<NuxtPage />
	</NuxtLayout>
</template>
