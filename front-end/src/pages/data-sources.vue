<script setup lang="ts">
import { navigateTo } from "#app";
import { definePageMeta } from "#app/composables/pages";
import { usePageSeo } from "~/composables/usePageSeo";

usePageSeo({ path: "/sources", title: "Sources" });
definePageMeta({
	middleware: to => navigateTo({ path: "/sources", query: to.query, hash: "#providers" }, { redirectCode: 301 })
});
</script>

<template>
	<div />
</template>
