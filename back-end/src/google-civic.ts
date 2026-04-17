import type { LocationLookupAction } from "./types/civic.js";
import process from "node:process";

interface GoogleCivicAddress {
	locationName?: string;
	line1?: string;
	line2?: string;
	line3?: string;
	city?: string;
	state?: string;
	zip?: string;
}

interface GoogleCivicElection {
	electionDay?: string;
	name?: string;
}

interface GoogleCivicAdministrationBody {
	absenteeVotingInfoUrl?: string;
	ballotInfoUrl?: string;
	electionInfoUrl?: string;
	electionNoticeUrl?: string;
	electionRegistrationConfirmationUrl?: string;
	electionRegistrationUrl?: string;
	electionRulesUrl?: string;
	votingLocationFinderUrl?: string;
}

interface GoogleCivicState {
	electionAdministrationBody?: GoogleCivicAdministrationBody;
}

interface GoogleCivicLocation {
	address?: GoogleCivicAddress;
	name?: string;
}

interface GoogleCivicErrorResponse {
	error?: {
		message?: string;
	};
}

interface GoogleCivicVoterInfoResponse {
	dropOffLocations?: GoogleCivicLocation[];
	earlyVoteSites?: GoogleCivicLocation[];
	election?: GoogleCivicElection;
	mailOnly?: boolean;
	normalizedInput?: GoogleCivicAddress;
	otherElections?: GoogleCivicElection[];
	pollingLocations?: GoogleCivicLocation[];
	state?: GoogleCivicState[];
}

export interface OfficialAddressMatch {
	actions: LocationLookupAction[];
	note: string;
	verified: boolean;
}

export interface GoogleCivicClient {
	lookupVoterInfo: (address: string) => Promise<OfficialAddressMatch | null>;
}

const lookupBaseUrl = "https://www.googleapis.com/civicinfo/v2/voterinfo";

function normalizeAddress(address: GoogleCivicAddress | undefined) {
	if (!address)
		return null;

	const locality = [address.city, address.state, address.zip].filter(Boolean).join(", ");

	return [
		address.locationName,
		address.line1,
		address.line2,
		address.line3,
		locality
	]
		.map(part => part?.trim())
		.filter(Boolean)
		.join(", ");
}

function pushOfficialAction(actions: LocationLookupAction[], id: string, title: string, url: string | undefined, description: string) {
	if (!url)
		return;

	actions.push({
		badge: "Official",
		description,
		id,
		kind: "official-verification",
		title,
		url
	});
}

function buildOfficialActions(payload: GoogleCivicVoterInfoResponse) {
	const body = payload.state?.[0]?.electionAdministrationBody;
	const actions: LocationLookupAction[] = [];

	pushOfficialAction(actions, "google-civic:election-info", "Official election information", body?.electionInfoUrl, "Open the election information page returned by Google Civic for this address.");
	pushOfficialAction(actions, "google-civic:sample-ballot", "Official ballot information", body?.ballotInfoUrl, "Open the official ballot or sample-ballot page returned for this address.");
	pushOfficialAction(actions, "google-civic:polling-finder", "Official polling-place finder", body?.votingLocationFinderUrl, "Open the official polling-place or voting-location finder returned for this address.");
	pushOfficialAction(actions, "google-civic:registration", "Registration and voter status", body?.electionRegistrationConfirmationUrl || body?.electionRegistrationUrl, "Confirm registration status or voter details in the official election system.");
	pushOfficialAction(actions, "google-civic:absentee", "Mail ballot information", body?.absenteeVotingInfoUrl, "Open the official absentee or vote-by-mail information returned for this address.");
	pushOfficialAction(actions, "google-civic:rules", "Official election rules", body?.electionRulesUrl || body?.electionNoticeUrl, "Open official election rules or notices associated with this address.");

	return actions;
}

export function createGoogleCivicClient(
	fetchImpl: typeof fetch = fetch,
	apiKey = process.env.GOOGLE_CIVIC_API_KEY?.trim()
): GoogleCivicClient | null {
	if (!apiKey)
		return null;

	return {
		async lookupVoterInfo(address: string) {
			const requestUrl = new URL(lookupBaseUrl);
			requestUrl.searchParams.set("address", address);
			requestUrl.searchParams.set("key", apiKey);
			requestUrl.searchParams.set("officialOnly", "true");

			const response = await fetchImpl(requestUrl, {
				headers: {
					Accept: "application/json"
				}
			});

			if (response.status === 400 || response.status === 404) {
				const errorPayload = await response.json().catch(() => ({})) as GoogleCivicErrorResponse;

				return {
					actions: [],
					note: errorPayload.error?.message?.trim()
						|| "The configured Google Civic provider did not return a verified address match for this lookup, so Ballot Clarity is falling back to the current public guide.",
					verified: false
				};
			}

			if (!response.ok)
				throw new Error(`Google Civic lookup failed: ${response.status} ${response.statusText}`);

			const payload = await response.json() as GoogleCivicVoterInfoResponse;
			const normalizedAddress = normalizeAddress(payload.normalizedInput);
			const pollingLocation = normalizeAddress(payload.pollingLocations?.[0]?.address);
			const actions = buildOfficialActions(payload);
			const otherElectionCount = payload.otherElections?.length ?? 0;
			const earlyVoteCount = payload.earlyVoteSites?.length ?? 0;
			const dropOffCount = payload.dropOffLocations?.length ?? 0;

			return {
				actions,
				note: [
					normalizedAddress ? `Google Civic accepted the address as ${normalizedAddress}.` : "Google Civic accepted the submitted address.",
					payload.election?.name ? `The current official election record is ${payload.election.name}${payload.election.electionDay ? ` on ${payload.election.electionDay}` : ""}.` : "",
					pollingLocation ? `The provider returned a polling location at ${pollingLocation}.` : "",
					earlyVoteCount ? `${earlyVoteCount} early-vote site${earlyVoteCount === 1 ? "" : "s"} returned.` : "",
					dropOffCount ? `${dropOffCount} ballot drop-off location${dropOffCount === 1 ? "" : "s"} returned.` : "",
					payload.mailOnly ? "This precinct is marked as mail-only." : "",
					otherElectionCount ? `${otherElectionCount} additional election${otherElectionCount === 1 ? "" : "s"} also matched this address.` : ""
				].filter(Boolean).join(" "),
				verified: true
			};
		}
	};
}
