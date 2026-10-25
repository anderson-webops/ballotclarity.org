<script setup lang="ts">
defineProps<{ pending?: boolean; error?: boolean; label?: string }>();
defineEmits<{ retry: [] }>();
</script>

<template>
	<div v-if="pending || error" class="py-6" aria-live="polite" :aria-busy="pending">
		<p v-if="pending" role="status">
			Loading…
		</p>
		<template v-else>
			<p role="alert">
				Unable to load {{ label || 'this section' }}.
			</p>
			<button type="button" class="btn-secondary mt-3" @click="$emit('retry')">
				Retry
			</button>
		</template>
	</div>
</template>
