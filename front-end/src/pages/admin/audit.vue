<script setup lang="ts">
import type { AdminAuditEvent } from "~/types/civic";

definePageMeta({
	layout: "admin",
	middleware: "admin"
});

const { data: session } = await useAdminSession("admin-audit-session");
const { data, error, refresh } = await useAdminAudit();

function formatDate(value: string | undefined) {
	if (!value)
		return "Not recorded";

	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(new Date(value));
}

function formatEventType(value: string) {
	return value.replaceAll("_", " ");
}

function shortHash(value: string | undefined) {
	return value ? `${value.slice(0, 12)}...${value.slice(-8)}` : "Genesis event";
}

function metadataEntries(metadata: AdminAuditEvent["metadata"]) {
	return Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== "");
}

function stringifyMetadataValue(value: unknown) {
	if (Array.isArray(value))
		return value.join(", ");

	if (typeof value === "object" && value !== null)
		return JSON.stringify(value);

	return String(value);
}

async function refreshAudit() {
	await refresh();
}

usePageSeo({
	description: "Internal Ballot Clarity immutable audit trail for publication and user-management actions.",
	path: "/admin/audit",
	robots: "noindex,nofollow",
	title: "Admin audit trail"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				Immutable audit trail
			</p>
			<h1 class="text-5xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
				Publication and account actions
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
				Review the append-only hash chain for publish, rollback, unpublish, and admin account changes. This log is separate from the public activity feed.
			</p>
		</header>

		<InfoCallout v-if="session?.role !== 'admin'" title="Admin-only audit log" tone="warning">
			Only admin users can view publication and account-management audit records.
		</InfoCallout>

		<div v-if="error" class="max-w-4xl">
			<InfoCallout title="Audit trail unavailable" tone="warning">
				The audit trail could not be loaded for this session.
			</InfoCallout>
		</div>

		<section v-else class="gap-4 grid lg:grid-cols-3">
			<article class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Integrity
				</p>
				<h2 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ data?.integrityVerified ? "Hash chain verified" : "Hash chain needs review" }}
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					Each event stores the previous event hash and a deterministic event hash so unexpected edits are visible.
				</p>
			</article>

			<article class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Latest hash
				</p>
				<p class="text-lg text-app-ink font-semibold mt-3 break-all dark:text-app-text-dark">
					{{ shortHash(data?.latestHash) }}
				</p>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					Use the full API payload for complete hash values during incident review.
				</p>
			</article>

			<article class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Events shown
				</p>
				<p class="text-4xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ data?.events.length ?? 0 }}
				</p>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					Latest 100 events, updated {{ formatDate(data?.updatedAt) }}.
				</p>
			</article>
		</section>

		<section class="surface-panel space-y-5">
			<div class="flex flex-wrap gap-4 items-center justify-between">
				<div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Event log
					</p>
					<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						Most recent audit events
					</h2>
				</div>
				<button type="button" class="btn-secondary" @click="refreshAudit">
					Refresh
				</button>
			</div>

			<InfoCallout v-if="!data?.events.length" title="No audit events recorded yet">
				The audit trail will populate when an admin publishes content, rolls content back, changes guide publication state, or manages admin users.
			</InfoCallout>

			<ol v-else class="space-y-4">
				<li
					v-for="event in data.events"
					:key="event.id"
					class="px-5 py-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70"
				>
					<div class="flex flex-wrap gap-3 items-start justify-between">
						<div class="min-w-0">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								#{{ event.sequence }} · {{ formatEventType(event.eventType) }}
							</p>
							<h3 class="text-xl text-app-ink font-serif mt-2 dark:text-app-text-dark">
								{{ event.targetLabel }}
							</h3>
						</div>
						<UpdatedAt :value="event.timestamp" label="Logged" />
					</div>

					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						{{ event.summary }}
					</p>

					<div class="mt-5 gap-3 grid md:grid-cols-3">
						<p class="text-sm text-app-muted leading-7 dark:text-app-muted-dark">
							<span class="text-app-ink font-semibold dark:text-app-text-dark">Actor:</span>
							{{ event.actorDisplayName }}
							<span v-if="event.actorUsername">({{ event.actorUsername }})</span>
						</p>
						<p class="text-sm text-app-muted leading-7 dark:text-app-muted-dark">
							<span class="text-app-ink font-semibold dark:text-app-text-dark">Target:</span>
							{{ event.targetType }} / {{ event.targetId }}
						</p>
						<p class="text-sm text-app-muted leading-7 break-all dark:text-app-muted-dark">
							<span class="text-app-ink font-semibold dark:text-app-text-dark">Hash:</span>
							{{ shortHash(event.eventHash) }}
						</p>
					</div>

					<dl v-if="metadataEntries(event.metadata).length" class="mt-5 gap-3 grid md:grid-cols-2">
						<div
							v-for="[key, value] in metadataEntries(event.metadata)"
							:key="key"
							class="px-4 py-3 border border-app-line/80 rounded-2xl bg-white/70 dark:border-app-line-dark dark:bg-app-panel-dark/70"
						>
							<dt class="text-xs text-app-muted tracking-[0.16em] font-semibold uppercase dark:text-app-muted-dark">
								{{ formatEventType(key) }}
							</dt>
							<dd class="text-sm text-app-ink mt-2 break-words dark:text-app-text-dark">
								{{ stringifyMetadataValue(value) }}
							</dd>
						</div>
					</dl>
				</li>
			</ol>
		</section>
	</section>
</template>
