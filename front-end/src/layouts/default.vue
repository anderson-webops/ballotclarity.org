<script setup lang="ts">
import AppFooter from "~/components/AppFooter.vue";
import AppHeader from "~/components/AppHeader.vue";
import CivicStorageNotice from "~/components/CivicStorageNotice.vue";
</script>

<template>
	<div class="flex flex-col min-h-screen">
		<a href="#main-content" class="skip-link focus-ring">Skip to content</a>
		<AppHeader class="print-hidden" />
		<main id="main-content" class="pb-16 pt-6 flex-1 sm:pt-8">
			<CivicStorageNotice />
			<slot />
		</main>
		<AppFooter class="print-hidden" />
	</div>
</template>
