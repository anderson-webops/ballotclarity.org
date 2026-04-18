import process from "node:process";

export interface CongressMemberRecord {
	bioguideId: string;
	district?: number;
	name: string;
	party: string;
	state: string;
	updatedAt?: string;
	url?: string;
}

export interface CongressClient {
	listMembersByState: (stateCode: string) => Promise<CongressMemberRecord[]>;
}

interface CongressClientOptions {
	apiKey?: string;
	fetchImpl?: typeof fetch;
}

interface CongressMembersResponse {
	members?: Array<{
		bioguideId?: string;
		district?: number;
		name?: string;
		partyName?: string;
		state?: string;
		updateDate?: string;
		url?: string;
	}>;
}

export function createCongressClient({
	apiKey = process.env.CONGRESS_API_KEY?.trim() || process.env.DATA_API_KEY?.trim(),
	fetchImpl = fetch
}: CongressClientOptions = {}): CongressClient | null {
	const resolvedApiKey = apiKey?.trim();

	if (!resolvedApiKey)
		return null;

	return {
		async listMembersByState(stateCode: string) {
			const requestUrl = new URL(`https://api.congress.gov/v3/member/${stateCode.toUpperCase()}`);
			requestUrl.searchParams.set("api_key", resolvedApiKey);
			requestUrl.searchParams.set("format", "json");
			requestUrl.searchParams.set("limit", "100");

			const response = await fetchImpl(requestUrl, {
				headers: {
					Accept: "application/json"
				}
			});

			if (!response.ok)
				throw new Error(`Congress member lookup failed: ${response.status} ${response.statusText}`);

			const payload = await response.json() as CongressMembersResponse;

			return (payload.members ?? []).map(member => ({
				bioguideId: member.bioguideId?.trim() || "unknown-member",
				district: member.district,
				name: member.name?.trim() || "Unknown member",
				party: member.partyName?.trim() || "Unknown party",
				state: member.state?.trim() || stateCode.toUpperCase(),
				updatedAt: member.updateDate?.trim() || undefined,
				url: member.url?.trim() || undefined
			}));
		}
	};
}
