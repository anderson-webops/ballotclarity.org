<script setup lang="ts">
import { appDescription, appName, appUrl } from "~/constants";

const route = useRoute();
const shouldNoindex = computed(() => /^\/plan(?:\/|$)/.test(route.path));
const siteSchema = {
	"@context": "https://schema.org",
	"@type": "WebSite",
		"description": appDescription,
	"name": appName,
	"url": appUrl
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
