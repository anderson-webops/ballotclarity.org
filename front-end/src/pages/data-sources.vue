<script setup lang="ts">
usePageSeo({ path: "/sources", title: "Sources" });
definePageMeta({
	middleware: to => navigateTo({ path: "/sources", query: to.query, hash: "#providers" }, { redirectCode: 301 })
});
</script>

<template>
	<div />
</template>
