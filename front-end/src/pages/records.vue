<script setup lang="ts">
usePageSeo({ path: "/records", title: "Directory", robots: "noindex,follow" });
definePageMeta({ middleware: to => navigateTo({ path: "/search", query: { ...to.query, type: "candidate" } }, { redirectCode: 302 }) });
</script>

<template>
	<div />
</template>
