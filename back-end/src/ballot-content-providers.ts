import type { BallotContentProviderOption } from "./types/civic.js";
import process from "node:process";

function hasEnv(name: string) {
	return Boolean(process.env[name]?.trim());
}

function connectionStatus(configured: boolean, fallback: BallotContentProviderOption["connectionStatus"]) {
	return configured ? "active" : fallback;
}

export function getBallotContentProviderOptions(): BallotContentProviderOption[] {
	const ctclConfigured = hasEnv("CTCL_BIP_API_URL");
	const ballotpediaConfigured = hasEnv("BALLOTPEDIA_API_KEY");
	const ballotReadyConfigured = hasEnv("BALLOTREADY_API_KEY") && hasEnv("BALLOTREADY_API_URL");
	const democracyWorksConfigured = hasEnv("DEMOCRACY_WORKS_API_KEY");
	const googleCivicConfigured = hasEnv("GOOGLE_CIVIC_API_KEY");

	return [
		{
			authority: "commercial-provider",
			bestUse: "Official-source voter-information lookup, polling places, early voting, drop-off sites, and provider ballot previews where Voting Information Project data exists.",
			capabilities: [
				"election IDs",
				"polling places",
				"early vote sites",
				"drop-off locations",
				"contest and candidate previews",
				"referenda where returned by the provider",
				"official election office links"
			],
			configured: googleCivicConfigured,
			connectionStatus: connectionStatus(googleCivicConfigured, "needs_key"),
			docsUrl: "https://developers.google.com/civic-information/docs/v2/elections/voterInfoQuery",
			envVars: ["GOOGLE_CIVIC_API_KEY"],
			id: "google-civic",
			label: "Google Civic Information API",
			limitations: [
				"Coverage is limited to supported elections and addresses.",
				"Provider ballot previews still need local review before Ballot Clarity treats them as a verified local guide."
			],
			setupUrl: "https://developers.google.com/civic-information"
		},
		{
			authority: "nonprofit-provider",
			bestUse: "Trusted national ballot backbone once CTCL grants direct Ballot Information Project access.",
			capabilities: [
				"address-and-election ballot lookup",
				"candidate records",
				"referenda",
				"OCD-ID geography linkage",
				"bulk file imports by arrangement"
			],
			configured: ctclConfigured,
			connectionStatus: connectionStatus(ctclConfigured, "needs_partner_access"),
			docsUrl: "https://www.techandciviclife.org/our-work/research-department/our-data/ballot-information/",
			envVars: ["CTCL_BIP_API_URL", "CTCL_BIP_API_KEY"],
			id: "ctcl-bip",
			label: "CTCL Ballot Information Project",
			limitations: [
				"Direct API access is not public self-serve.",
				"Ballot Clarity needs a granted endpoint or data delivery before this connector can run."
			],
			setupUrl: "https://www.techandciviclife.org/our-work/research-department/our-data/ballot-information/"
		},
		{
			authority: "nonprofit-provider",
			bestUse: "Races, candidates, and ballot measures by location point or state/election date.",
			capabilities: [
				"elections by latitude and longitude",
				"elections by state",
				"races",
				"candidate lists",
				"ballot measures",
				"incumbency flags where returned"
			],
			configured: ballotpediaConfigured,
			connectionStatus: connectionStatus(ballotpediaConfigured, "needs_key"),
			docsUrl: "https://developer.ballotpedia.org/geographic-apis/elections_by_point",
			envVars: ["BALLOTPEDIA_API_KEY", "BALLOTPEDIA_API_BASE_URL"],
			id: "ballotpedia",
			label: "Ballotpedia API",
			limitations: [
				"Returned fields can depend on the purchased API package.",
				"Production browser-origin usage may require domain whitelisting by Ballotpedia.",
				"Ballot Clarity still needs official-source verification before publishing a reviewed local guide."
			],
			setupUrl: "https://developer.ballotpedia.org/geographic-apis/getting-started-with-geographic-apis"
		},
		{
			authority: "commercial-provider",
			bestUse: "Turnkey voter-guide style ballot matching, candidate profiles, issue content, and logistics if the licensing terms fit Ballot Clarity.",
			capabilities: [
				"GraphQL ballot data",
				"candidate profiles",
				"candidate issue content",
				"ballot measures",
				"district matching",
				"voting logistics"
			],
			configured: ballotReadyConfigured,
			connectionStatus: hasEnv("BALLOTREADY_API_KEY") && !hasEnv("BALLOTREADY_API_URL") ? "needs_endpoint" : connectionStatus(ballotReadyConfigured, "needs_partner_access"),
			docsUrl: "https://developers.civicengine.com/docs/api/graphql/reference/objects/ballot-event",
			envVars: ["BALLOTREADY_API_URL", "BALLOTREADY_API_KEY"],
			id: "ballotready-civicengine",
			label: "BallotReady CivicEngine",
			limitations: [
				"Requires a partner account, endpoint, and pricing agreement.",
				"Republishing provider-authored profiles or issue content needs licensing review."
			],
			setupUrl: "https://organizations.ballotready.org"
		},
		{
			authority: "nonprofit-provider",
			bestUse: "Election dates, deadlines, voting guidance, and Ballotpedia-sourced ballot data where Democracy Works coverage includes it.",
			capabilities: [
				"election discovery by address",
				"dates and deadlines",
				"voting guidance",
				"ballot measures with includeBallotData",
				"candidates and contests with includeBallotData"
			],
			configured: democracyWorksConfigured,
			connectionStatus: connectionStatus(democracyWorksConfigured, "needs_key"),
			docsUrl: "https://developers.democracy.works/api/v2",
			envVars: ["DEMOCRACY_WORKS_API_KEY", "DEMOCRACY_WORKS_API_BASE_URL"],
			id: "democracy-works",
			label: "Democracy Works Elections API",
			limitations: [
				"Ballot data is not the default response and must be requested with includeBallotData=true.",
				"Local ballot coverage can be limited by provider mapping constraints.",
				"Ballot data is sourced from Ballotpedia, so provenance should not be presented as independent official verification."
			],
			setupUrl: "https://www.democracy.works/elections-api"
		}
	];
}

export function buildBallotContentProviderSummary() {
	const providers = getBallotContentProviderOptions();

	return {
		active: providers.filter(provider => provider.connectionStatus === "active").length,
		needsAccess: providers.filter(provider => provider.connectionStatus !== "active").length,
		total: providers.length
	};
}
