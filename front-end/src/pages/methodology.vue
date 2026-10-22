<script setup lang="ts">
usePageSeo({ path: "/about", title: "About" });
definePageMeta({
	middleware: to => navigateTo({ path: "/about", query: to.query, hash: "#methodology" }, { redirectCode: 301 })
});
</script>

<template>
	<div />
</template>
