import process from "node:process";

export interface ProviderConfigItem {
	fallbackEnvVar?: string;
	id: string;
	label: string;
	envVar?: string;
	configured: boolean;
	requiredFor: string;
	setupUrl: string;
}

export type ProviderId = "census-geocoder" | "data-gov" | "google-civic" | "congress" | "openfec" | "openstates" | "lda" | "openai";

function getEnv(name: string) {
	return process.env[name]?.trim() || "";
}

function hasEnv(name: string) {
	return Boolean(getEnv(name));
}

export function resolveProviderCredential(id: ProviderId) {
	switch (id) {
		case "google-civic":
			return hasEnv("GOOGLE_CIVIC_API_KEY")
				? { source: "GOOGLE_CIVIC_API_KEY", value: getEnv("GOOGLE_CIVIC_API_KEY") }
				: null;
		case "data-gov":
			return hasEnv("DATA_API_KEY")
				? { source: "DATA_API_KEY", value: getEnv("DATA_API_KEY") }
				: null;
		case "congress":
			if (hasEnv("CONGRESS_API_KEY"))
				return { source: "CONGRESS_API_KEY", value: getEnv("CONGRESS_API_KEY") };

			return hasEnv("DATA_API_KEY")
				? { source: "DATA_API_KEY", value: getEnv("DATA_API_KEY") }
				: null;
		case "openfec":
			if (hasEnv("OPENFEC_API_KEY"))
				return { source: "OPENFEC_API_KEY", value: getEnv("OPENFEC_API_KEY") };

			return hasEnv("DATA_API_KEY")
				? { source: "DATA_API_KEY", value: getEnv("DATA_API_KEY") }
				: null;
		case "openstates":
			return hasEnv("OPENSTATES_API_KEY")
				? { source: "OPENSTATES_API_KEY", value: getEnv("OPENSTATES_API_KEY") }
				: null;
		case "lda":
			return hasEnv("LDA_API_KEY")
				? { source: "LDA_API_KEY", value: getEnv("LDA_API_KEY") }
				: null;
		case "openai":
			return hasEnv("OPENAI_API_KEY")
				? { source: "OPENAI_API_KEY", value: getEnv("OPENAI_API_KEY") }
				: null;
		default:
			return null;
	}
}

export function getProviderConfigItems(): ProviderConfigItem[] {
	return [
		{
			configured: true,
			id: "census-geocoder",
			label: "U.S. Census Geocoder",
			requiredFor: "Address normalization and district lookup",
			setupUrl: "https://www.census.gov/programs-surveys/geography/technical-documentation/complete-technical-documentation/census-geocoder.html"
		},
		{
			configured: hasEnv("DATA_API_KEY"),
			envVar: "DATA_API_KEY",
			id: "data-gov",
			label: "api.data.gov shared key",
			requiredFor: "Shared credential source for Congress.gov and OpenFEC when service-specific keys are not set",
			setupUrl: "https://api.data.gov/signup/"
		},
		{
			configured: hasEnv("GOOGLE_CIVIC_API_KEY"),
			envVar: "GOOGLE_CIVIC_API_KEY",
			id: "google-civic",
			label: "Google Civic Information API",
			requiredFor: "Official voter info, polling places, early voting, and sample ballot verification where supported",
			setupUrl: "https://developers.google.com/civic-information"
		},
		{
			configured: Boolean(resolveProviderCredential("congress")),
			envVar: "CONGRESS_API_KEY",
			fallbackEnvVar: "DATA_API_KEY",
			id: "congress",
			label: "Congress.gov API",
			requiredFor: "Federal legislative officeholder and activity context",
			setupUrl: "https://api.congress.gov/sign-up/"
		},
		{
			configured: Boolean(resolveProviderCredential("openfec")),
			envVar: "OPENFEC_API_KEY",
			fallbackEnvVar: "DATA_API_KEY",
			id: "openfec",
			label: "OpenFEC",
			requiredFor: "Federal campaign-finance enrichment",
			setupUrl: "https://api.open.fec.gov/developers/"
		},
		{
			configured: hasEnv("OPENSTATES_API_KEY"),
			envVar: "OPENSTATES_API_KEY",
			id: "openstates",
			label: "Open States API",
			requiredFor: "State legislative normalization and people.geo lookups",
			setupUrl: "https://docs.openstates.org/api-v3/"
		},
		{
			configured: hasEnv("LDA_API_KEY"),
			envVar: "LDA_API_KEY",
			id: "lda",
			label: "LDA.gov API",
			requiredFor: "Federal lobbying enrichment",
			setupUrl: "https://lda.senate.gov/api/tos/"
		},
		{
			configured: hasEnv("OPENAI_API_KEY"),
			envVar: "OPENAI_API_KEY",
			id: "openai",
			label: "OpenAI API",
			requiredFor: "Offline summary drafting, extraction, and editorial review jobs",
			setupUrl: "https://platform.openai.com/docs/guides/production-best-practices/model-overview"
		}
	];
}

export function buildProviderSummary() {
	const items = getProviderConfigItems();

	return {
		configured: items.filter(item => item.configured).length,
		missing: items.filter(item => !item.configured).length,
		total: items.length
	};
}
