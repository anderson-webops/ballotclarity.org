<script setup lang="ts">
import { appName, contactEmail } from "~/constants";

const effectiveAt = "2026-04-11T09:00:00-04:00";
const siteUrl = useSiteUrl();

const summaryCards = [
	{
		body: "Ballot lookup input, and any optional approximate location guess configured on a host, are used only to match ballot coverage and jurisdiction in the current release.",
		title: "Lookup use is narrow"
	},
	{
		body: "The current site does not create user accounts, run targeted advertising, or sell personal data.",
		title: "No adtech profile"
	},
	{
		body: "Saved location labels, compare choices, reading mode, and ballot-plan selections stay in your browser until you clear them.",
		title: "Device-side persistence only"
	}
];

const collectionSections = [
	{
		body: [
			"When you use the ballot lookup, the address or ZIP code is sent with a POST request so the service can determine a location and ballot guide.",
			"Some hosts may also use coarse geolocation derived from request metadata to make a best-effort default location guess before you enter anything manually.",
			"The application is designed not to publish the raw lookup text in the public archive and not to persist it in browser storage used for saved ballot preferences."
		],
		title: "Address or ZIP lookup input"
	},
	{
		body: [
			"The app stores selected location labels, compare selections, saved ballot-plan choices, issue filters, and reading mode in local browser storage so the guide remains usable across refreshes.",
			"This local storage is tied to the browser on your device. Ballot Clarity does not maintain a server-side user account for that state in the current release."
		],
		title: "Information stored on your device"
	},
	{
		body: [
			"Hosting and runtime infrastructure may process technical data such as IP address, user agent, endpoint path, timestamp, and basic error or request metadata needed for security, integrity, and reliability.",
			"That operational metadata is different from the election-guide content itself and is handled as infrastructure telemetry rather than published civic data."
		],
		title: "Operational metadata"
	},
	{
		body: [
			"The current contact and correction paths open your email client instead of hosting a web form inside the site.",
			"If you email the project, the message, attachments, and any source links you send may be handled in the project inbox so the team can review, verify, and respond."
		],
		title: "Messages you send us"
	}
];

const useSections = [
	"Provide location-based ballot guides and related civic-information pages.",
	"Preserve local usability features such as saved ballot-plan choices, compare state, and reading preferences.",
	"Operate, secure, debug, and improve the website and its reliability.",
	"Review and respond to correction requests, privacy questions, and public-interest inquiries."
];

const sharingSections = [
	"Ballot Clarity may rely on hosting, content-delivery, security, logging, and similar service providers needed to operate the site.",
	"The current release does not disclose address lookup input to advertising networks and is not designed to sell or share personal data for cross-context behavioral advertising.",
	"When you follow external source links, official agencies, filing systems, campaigns, or other third-party sites operate under their own privacy practices.",
	"If future live civic-data APIs require transmitting lookup data or derived district information to third parties, this policy should be updated before that architecture ships."
];

const retentionRows = [
	{
		access: "Runtime handling only during the request.",
		category: "Raw ballot lookup input",
		deletion: "The current app flow is designed to avoid adding the raw lookup string to published source records or saved browser state.",
		retention: "Request-time processing only.",
		scope: "Street address or ZIP entered into the lookup."
	},
	{
		access: "Stored in your browser on the current device.",
		category: "Saved guide preferences",
		deletion: "Clear browser storage, use a private session, or overwrite the saved state.",
		retention: "Until you clear it or replace it on your device.",
		scope: "Selected location label, compare list, ballot plan, issue filters, and reading mode."
	},
	{
		access: "Hosting, operations, and security tooling.",
		category: "Operational request metadata",
		deletion: "Managed through provider defaults and operational retention settings.",
		retention: "Only as long as reasonably needed for security, reliability, and troubleshooting.",
		scope: "IP address, user agent, endpoint path, timestamps, and similar request metadata."
	},
	{
		access: "Project inbox and editorial reviewers handling the issue.",
		category: "Correction or contact emails",
		deletion: "Archived or deleted when no longer needed for support, verification, or auditability.",
		retention: "Until the issue is resolved and follow-up records are no longer needed.",
		scope: "Email address, message body, attachments, and source links you provide."
	}
];

const rightsNotes = [
	"You can browse much of the site without using the ballot lookup.",
	"You can clear browser storage on your device to remove saved ballot-plan state and selected location labels kept locally by the app.",
	"Because the current release does not create public user accounts and is designed to keep some data ephemeral, Ballot Clarity may have limited ability to associate a privacy request with operational logs or transient lookup activity.",
	"If applicable law gives you rights to request access, deletion, correction, or appeal, contact the project and describe the data or interaction as specifically as possible."
];

const cookieNotes = [
	"The current release does not use an advertising-cookie stack and is not designed for targeted advertising or sale or sharing of personal data.",
	"The site may still use browser storage for user-facing preferences and may rely on infrastructure-level cookies or similar technical mechanisms that support delivery, security, or basic functionality.",
	"If Ballot Clarity later adds analytics, experiments, donations, newsletters, or embedded third-party tools, the cookie and tracking section should be updated before those features go live."
];

const childrenNotes = [
	"Ballot Clarity is a general-audience civic-information site and is not designed for children under 13.",
	"The current release does not offer child-directed accounts, community posting, or other features intended to collect personal information from children.",
	"If you believe a child has sent personal information to the project through email or another channel, contact the project so the issue can be reviewed."
];

const securityNotes = [
	"Ballot Clarity aims to use reasonable administrative, technical, and organizational safeguards appropriate to the current release.",
	"Those safeguards are intended to reduce unnecessary data collection, limit retention, and protect the integrity of the service and its operational systems.",
	"No internet service can guarantee absolute security. If the project's data practices or incident posture changes materially, this policy should change as well."
];

usePageSeo({
	description: "Privacy Policy for Ballot Clarity, covering address lookup handling, browser storage, operational metadata, third-party disclosures, retention, user choices, and current release limits.",
	path: "/privacy",
	title: "Privacy Policy"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<div class="flex flex-wrap gap-2">
				<TrustBadge label="Current policy" tone="accent" />
				<TrustBadge label="Lookup handling disclosed" />
				<TrustBadge label="No targeted advertising" tone="warning" />
			</div>
			<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
				Privacy Policy
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 max-w-3xl dark:text-app-muted-dark">
				This policy describes how {{ appName }} currently handles address lookup input, any optional approximate location-guessing configured on a host, browser-stored guide preferences, operational metadata, and direct contact messages. It is written for the current release at {{ siteUrl }}, not for a future product that collects more data than the site collects today.
			</p>
			<div class="mt-5">
				<UpdatedAt label="Effective" :value="effectiveAt" />
			</div>
		</header>

		<InfoCallout title="Plain-language summary">
			The current release uses address or ZIP input, plus any optional approximate location guess configured on a host, only to match ballot coverage. It does not create public user accounts, does not run targeted advertising, and is not designed to sell or share personal data. The app does save selected location labels and ballot-plan preferences locally in your browser so the guide remains usable across refreshes.
		</InfoCallout>

		<section class="gap-6 grid lg:grid-cols-3">
			<article v-for="item in summaryCards" :key="item.title" class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					At a glance
				</p>
				<h2 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ item.title }}
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					{{ item.body }}
				</p>
			</article>
		</section>

		<section class="surface-panel">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				What data we handle
			</p>
			<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
				What data Ballot Clarity handles today
			</h2>
			<div class="mt-6 gap-4 grid lg:grid-cols-2">
				<article v-for="item in collectionSections" :key="item.title" class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
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

		<section class="gap-6 grid lg:grid-cols-2">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					How we use data
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Why the current build uses data
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in useSections" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>

			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					How we share or disclose data
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Service providers, external links, and current limits
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in sharingSections" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>
		</section>

		<section class="gap-6 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Cookies and tracking
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					No sale, sharing, or targeted advertising in the current build
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in cookieNotes" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>

			<InfoCallout title="Address lookup sensitivity" tone="warning">
				An address lookup can reveal precise household or location context. Ballot Clarity therefore treats the lookup flow as a narrow, high-sensitivity feature and keeps the explanation near the lookup form instead of burying it only in legal copy.
			</InfoCallout>
		</section>

		<section class="surface-panel">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				Retention and deletion
			</p>
			<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
				How long information lasts and who can access it
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
					Your choices and requests
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Rights requests and limits in a no-account public build
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in rightsNotes" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>

			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Children and families
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Children's privacy
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in childrenNotes" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>
		</section>

		<section class="gap-6 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Security
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					How Ballot Clarity approaches privacy and security controls
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
					<li v-for="item in securityNotes" :key="item" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						{{ item }}
					</li>
				</ul>
			</div>

			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Changes and contact
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					How to reach the project and when this policy changes
				</h2>
				<div class="text-sm text-app-muted leading-7 mt-5 space-y-4 dark:text-app-muted-dark">
					<p>
						Questions, privacy concerns, and correction requests can be sent to
						<a :href="`mailto:${contactEmail}`" class="underline underline-offset-3">
							{{ contactEmail }}
						</a>.
					</p>
					<p>
						If Ballot Clarity materially changes how lookup input, browser storage, analytics, vendors, or future account-based features work, this Privacy Policy should be updated before those changes go live.
					</p>
					<p>
						This page should be read together with the on-page explanation near the ballot lookup form, the contact and corrections workflow, and the public methodology notes.
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
