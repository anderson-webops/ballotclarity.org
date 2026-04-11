<script setup lang="ts">
import { appName } from "~/constants";

useHead({
	htmlAttrs: {
		lang: "en",
	},
	titleTemplate: title => title ? `${title} | ${appName}` : appName,
});
</script>

<template>
	<VitePwaManifest />
	<NuxtLayout>
		<NuxtPage />
	</NuxtLayout>
</template>
