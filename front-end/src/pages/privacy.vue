<script setup lang="ts">
import { appName, contactEmail } from "~/constants";

const effectiveAt = "2026-04-11T09:00:00-04:00";

const commitments = [
	{
		summary: "The ballot lookup is sent to the demo API only to match a sample ballot and location.",
		title: "Lookup use is narrow"
	},
	{
		summary: "The MVP does not create accounts, sell personal data, or run advertising cookies.",
		title: "No adtech profile"
	},
	{
		summary: "Saved location labels, compare choices, and ballot-plan selections stay in your browser until you clear them.",
		title: "Device-side persistence only"
	}
];

const collectionAreas = [
	{
		body: [
			"When you use the ballot lookup, the address or ZIP code is sent to the Ballot Clarity demo API with a POST request so the service can determine a sample location and ballot.",
			"The current MVP does not add the raw lookup text to the published demo dataset, does not create a user account from it, and does not use it for advertising."
		],
		title: "Ballot lookup input"
	},
	{
		body: [
			"To keep the guide usable across refreshes, the app stores your selected location label, compare list, reading mode, selected issues, and saved ballot-plan choices in local browser storage.",
			"The app is now designed not to persist the raw street-address or ZIP input itself in that local storage layer."
		],
		title: "Information stored on your device"
	},
	{
		body: [
			"Like most web services, hosting and runtime infrastructure may process technical metadata such as IP address, browser information, endpoint path, timestamp, and error details needed for security and reliability.",
			"Ballot Clarity's backend code is intended to avoid writing raw lookup text into the demo content records or application-level logs."
		],
		title: "Operational metadata"
	},
	{
		body: [
			"The contact and correction routes currently open your own email client instead of hosting a form inside the app.",
			"If you email the project, the message and any attachments will be handled in the project's inbox so the team can review, verify, and respond."
		],
		title: "Messages you send us"
	}
];

const retentionRows = [
	{
		access: "Runtime only during request handling.",
		category: "Raw ballot lookup input",
		deletion: "Request completes without adding the raw lookup text to the demo dataset or device-side persisted state.",
		retention: "Request-time processing only.",
		scope: "Street address or ZIP entered into the lookup."
	},
	{
		access: "Stored in your browser on the current device.",
		category: "Saved guide preferences",
		deletion: "Choose a different location, clear browser storage, or use a private session.",
		retention: "Until you clear browser storage or overwrite the saved state.",
		scope: "Selected location label, compare list, ballot plan, issue filters, and reading mode."
	},
	{
		access: "Hosting, operations, and reliability tooling.",
		category: "Operational request metadata",
		deletion: "Managed through provider defaults and short-lived operational retention settings.",
		retention: "Only as long as reasonably needed for security and service reliability.",
		scope: "IP address, user agent, endpoint path, timing, and basic error context."
	},
	{
		access: "Project inbox and editorial reviewers handling the request.",
		category: "Correction or contact emails",
		deletion: "Archived or deleted when no longer needed for support, verification, or auditability.",
		retention: "Until the issue is resolved and any follow-up record is no longer needed.",
		scope: "Email address, message body, and any files or links you provide."
	}
];

const choices = [
	"You can browse most of the site without using the ballot lookup.",
	"If you use a shared device, clear your browser storage after saving a ballot plan or selected location.",
	"Because the MVP does not create accounts, there is no separate account dashboard for export or deletion requests at this stage.",
	"You can contact the project if you believe the privacy notice no longer matches how the product behaves."
];

usePageSeo({
	description: "Ballot Clarity's current MVP privacy notice, including address lookup handling, device-side persistence, operational metadata, and contact practices.",
	path: "/privacy",
	title: "Privacy"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<div class="flex flex-wrap gap-2">
				<TrustBadge label="Current MVP policy" tone="accent" />
				<TrustBadge label="Address handling disclosed" />
				<TrustBadge label="No ad cookies" tone="warning" />
			</div>
			<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
				Privacy notice
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 max-w-3xl dark:text-app-muted-dark">
				This page describes how the current {{ appName }} MVP handles lookup input, saved guide state, and operational metadata. It is written to match the product's present behavior, not an imagined future stack.
			</p>
			<div class="mt-5">
				<UpdatedAt label="Effective" :value="effectiveAt" />
			</div>
		</header>

		<InfoCallout title="Plain-language summary">
			The current MVP uses address or ZIP input only to match a sample ballot. It does not create user accounts, does not sell personal data, and does not use advertising cookies. The app does save your selected location label and ballot-plan state locally in your browser so the guide remains usable across refreshes.
		</InfoCallout>

		<section class="gap-6 grid lg:grid-cols-3">
			<article v-for="item in commitments" :key="item.title" class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Commitment
				</p>
				<h2 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ item.title }}
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					{{ item.summary }}
				</p>
			</article>
		</section>

		<section class="surface-panel">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				What we collect
			</p>
			<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
				Current data flows in the MVP
			</h2>
			<div class="mt-6 gap-4 grid lg:grid-cols-2">
				<article v-for="item in collectionAreas" :key="item.title" class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
					<h3 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
						{{ item.title }}
					</h3>
					<div class="text-sm text-app-muted leading-7 mt-4 space-y-3 dark:text-app-muted-dark">
						<p v-for="paragraph in item.body" :key="paragraph">
							{{ paragraph }}
						</p>
					</div>
				</article>
			</div>
		</section>

		<section class="gap-6 grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Cookies and third parties
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					What this demo does not do
				</h2>
				<div class="text-sm text-app-muted leading-7 mt-5 space-y-4 dark:text-app-muted-dark">
					<p>
						The current MVP does not run an advertising-cookie stack, does not build cross-site behavioral profiles, and is not designed to sell or rent personal data.
					</p>
					<p>
						Public source links may send you to official agencies, filing systems, or other external sites. Those sites operate under their own privacy practices once you leave Ballot Clarity.
					</p>
					<p>
						If the product later adds analytics, newsletters, donations, or third-party personalization tools, this page should be updated before those features are turned on.
					</p>
				</div>
			</div>

			<InfoCallout title="Important boundary" tone="warning">
				The safest way to read this policy is to compare it against the live product. If Ballot Clarity starts collecting new categories of data, using a third-party tracker, or keeping longer retention, the privacy notice should change first.
			</InfoCallout>
		</section>

		<section class="surface-panel">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				Retention and access
			</p>
			<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
				How long information lasts and who can see it
			</h2>
			<div class="mt-6 overflow-x-auto">
				<table class="text-left min-w-full">
					<thead>
						<tr class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							<th class="px-4 py-3 border-b border-app-line dark:border-app-line-dark">
								Category
							</th>
							<th class="px-4 py-3 border-b border-app-line dark:border-app-line-dark">
								Scope
							</th>
							<th class="px-4 py-3 border-b border-app-line dark:border-app-line-dark">
								Retention
							</th>
							<th class="px-4 py-3 border-b border-app-line dark:border-app-line-dark">
								Access
							</th>
							<th class="px-4 py-3 border-b border-app-line dark:border-app-line-dark">
								Removal path
							</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="row in retentionRows" :key="row.category" class="align-top">
							<td class="text-sm text-app-ink font-semibold px-4 py-4 border-b border-app-line/70 dark:text-app-text-dark dark:border-app-line-dark">
								{{ row.category }}
							</td>
							<td class="text-sm text-app-muted leading-7 px-4 py-4 border-b border-app-line/70 dark:text-app-muted-dark dark:border-app-line-dark">
								{{ row.scope }}
							</td>
							<td class="text-sm text-app-muted leading-7 px-4 py-4 border-b border-app-line/70 dark:text-app-muted-dark dark:border-app-line-dark">
								{{ row.retention }}
							</td>
							<td class="text-sm text-app-muted leading-7 px-4 py-4 border-b border-app-line/70 dark:text-app-muted-dark dark:border-app-line-dark">
								{{ row.access }}
							</td>
							<td class="text-sm text-app-muted leading-7 px-4 py-4 border-b border-app-line/70 dark:text-app-muted-dark dark:border-app-line-dark">
								{{ row.deletion }}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</section>

		<section class="gap-6 grid lg:grid-cols-2">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Your choices
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					What you can control
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in choices" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>

			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Questions and updates
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					How to reach the project
				</h2>
				<div class="text-sm text-app-muted leading-7 mt-5 space-y-4 dark:text-app-muted-dark">
					<p>
						Questions, privacy concerns, and correction requests can be sent to
						<a :href="`mailto:${contactEmail}`" class="underline underline-offset-3">
							{{ contactEmail }}
						</a>.
					</p>
					<p>
						Because the MVP does not currently host accounts, donations, or embedded contact forms, there is no separate user portal for privacy requests yet.
					</p>
					<p>
						If Ballot Clarity makes a material change to how lookup input, local persistence, analytics, or third-party services work, this page should be revised and dated again.
					</p>
				</div>
				<div class="mt-6 flex flex-wrap gap-3">
					<NuxtLink to="/contact" class="btn-primary">
						Open contact page
					</NuxtLink>
					<NuxtLink to="/methodology" class="btn-secondary">
						Review methodology
					</NuxtLink>
				</div>
			</div>
		</section>
	</section>
</template>
