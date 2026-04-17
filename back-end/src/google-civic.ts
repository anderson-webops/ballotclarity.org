import type { LocationLookupAction } from "./types/civic.js";
import { Buffer } from "node:buffer";
import { lookup as dnsLookup } from "node:dns";
import { request as httpsRequest } from "node:https";
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

interface GoogleCivicClientOptions {
	apiKey?: string;
	fetchImpl?: typeof fetch;
	forceIPv4?: boolean;
}

interface LookupOptions {
	all?: boolean;
	family?: number | "IPv4" | "IPv6";
	hints?: number;
}

interface LookupCallback {
	(error: NodeJS.ErrnoException | null, address: string, family: number): void;
}

interface DnsLookupFn {
	(hostname: string, options: LookupOptions, callback: LookupCallback): void;
}

const lookupBaseUrl = "https://www.googleapis.com/civicinfo/v2/voterinfo";
const truthyEnvPattern = /^(?:1|true|yes|on)$/i;

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

export function shouldForceGoogleCivicIpv4(value = process.env.GOOGLE_CIVIC_FORCE_IPV4) {
	return truthyEnvPattern.test(value?.trim() ?? "");
}

export function createGoogleCivicLookup(lookupImpl: DnsLookupFn = dnsLookup as DnsLookupFn) {
	return (hostname: string, options: LookupOptions, callback: LookupCallback) => {
		lookupImpl(hostname, {
			all: false,
			family: 4,
			hints: options.hints
		}, callback);
	};
}

async function fetchGoogleCivicWithPreferredIpv4(resource: URL, headers: Record<string, string>) {
	const response = await new Promise<{
		headers: Record<string, string | string[] | undefined>;
		statusCode: number;
		statusMessage: string;
		text: string;
	}>((resolve, reject) => {
		const request = httpsRequest(resource, {
			headers,
			lookup: createGoogleCivicLookup() as never
		}, (response) => {
			const chunks: Buffer[] = [];

			response.on("data", (chunk) => {
				chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
			});
			response.on("end", () => {
				resolve({
					headers: response.headers,
					statusCode: response.statusCode ?? 500,
					statusMessage: response.statusMessage ?? "Unknown error",
					text: Buffer.concat(chunks).toString("utf8")
				});
			});
			response.on("error", reject);
		});

		request.on("error", reject);
		request.end();
	});

	return new Response(response.text, {
		headers: toResponseHeaders(response.headers),
		status: response.statusCode,
		statusText: response.statusMessage
	});
}

function toResponseHeaders(headers: Record<string, string | string[] | undefined>) {
	const responseHeaders = new Headers();

	for (const [name, value] of Object.entries(headers)) {
		if (Array.isArray(value)) {
			for (const item of value)
				responseHeaders.append(name, item);

			continue;
		}

		if (value !== undefined)
			responseHeaders.set(name, value);
	}

	return responseHeaders;
}

export async function fetchGoogleCivic(
	resource: URL,
	{
		fetchImpl = fetch,
		forceIPv4 = shouldForceGoogleCivicIpv4(),
		headers = {
			Accept: "application/json"
		}
	}: {
		fetchImpl?: typeof fetch;
		forceIPv4?: boolean;
		headers?: Record<string, string>;
	} = {}
) {
	if (!forceIPv4 || fetchImpl !== fetch) {
		return fetchImpl(resource, {
			headers
		});
	}

	return fetchGoogleCivicWithPreferredIpv4(resource, headers);
}

export function createGoogleCivicClient(
	fetchOrOptions: typeof fetch | GoogleCivicClientOptions = fetch,
	apiKey = process.env.GOOGLE_CIVIC_API_KEY?.trim(),
	forceIPv4 = shouldForceGoogleCivicIpv4()
): GoogleCivicClient | null {
	const options = typeof fetchOrOptions === "function"
		? {
				apiKey,
				fetchImpl: fetchOrOptions,
				forceIPv4
			}
		: {
				apiKey: process.env.GOOGLE_CIVIC_API_KEY?.trim(),
				fetchImpl: fetch,
				forceIPv4: shouldForceGoogleCivicIpv4(),
				...fetchOrOptions
			};

	const resolvedApiKey = options.apiKey?.trim();

	if (!resolvedApiKey)
		return null;

	return {
		async lookupVoterInfo(address: string) {
			const requestUrl = new URL(lookupBaseUrl);
			requestUrl.searchParams.set("address", address);
			requestUrl.searchParams.set("key", resolvedApiKey);
			requestUrl.searchParams.set("officialOnly", "true");

			const response = await fetchGoogleCivic(requestUrl, {
				fetchImpl: options.fetchImpl,
				forceIPv4: options.forceIPv4
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
