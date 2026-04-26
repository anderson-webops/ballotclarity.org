<script setup lang="ts">
import { appDescription, appName } from "~/constants";
import { themeSchemeStyleContent } from "~/utils/theme-schemes";

const noindexPathPattern = /^\/(?:admin|api|ballot|compare|plan|search)(?:\/|$)/;

const route = useRoute();
const siteUrl = useSiteUrl();
const { activeScheme, scheme } = useThemeScheme();
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
		"data-theme-scheme": scheme.value
	},
	meta: [
		...(shouldNoindex.value
			? [
					{
						content: "noindex,nofollow",
						name: "robots"
					}
				]
			: []),
		{
			content: activeScheme.value.swatches.light.surface,
			key: "theme-color-light",
			media: "(prefers-color-scheme: light)",
			name: "theme-color"
		},
		{
			content: activeScheme.value.swatches.dark.surface,
			key: "theme-color-dark",
			media: "(prefers-color-scheme: dark)",
			name: "theme-color"
		}
	],
	titleTemplate: title => title ? `${title} | ${appName}` : appName,
	script: [
		{
			innerHTML: JSON.stringify(siteSchema),
			key: "website-jsonld",
			type: "application/ld+json"
		}
	],
	style: [
		{
			innerHTML: themeSchemeStyleContent,
			key: "ballot-clarity-theme-schemes"
		}
	]
}));
</script>

<template>
	<NuxtLayout>
		<NuxtPage />
	</NuxtLayout>
</template>
