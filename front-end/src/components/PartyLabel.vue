<script setup lang="ts">
import { resolvePartyAffiliation } from "~/utils/party-affiliation";

defineProps<{ party: string }>();
</script>

<template>
	<span class="party-label" :data-party="resolvePartyAffiliation(party)">{{ party }}</span>
</template>

<style>
.party-label[data-party="democratic"] {
  color: #1d4ed8;
}

.party-label[data-party="republican"] {
  color: #b91c1c;
}

html.dark .party-label[data-party="democratic"] {
  color: #93c5fd;
}

html.dark .party-label[data-party="republican"] {
  color: #fca5a5;
}

@media print, (forced-colors: active) {
  .party-label[data-party] {
    color: inherit !important;
  }
}
</style>
