<script setup lang="ts">
import { navigateTo } from "#app";
import { definePageMeta } from "#app/composables/pages";
import { usePageSeo } from "~/composables/usePageSeo";

usePageSeo({ path: "/records", title: "Directory", robots: "noindex,follow" });
definePageMeta({
	middleware: to => navigateTo({
		path: "/search",
		query: { ...to.query, type: "candidate" }
	}, { redirectCode: 302 })
});
</script>

<template>
	<div />
</template>
