import process from "node:process";

export interface ProviderConfigItem {
	id: string;
	label: string;
	envVar?: string;
	configured: boolean;
	requiredFor: string;
	setupUrl: string;
}

function hasEnv(name: string) {
	return Boolean(process.env[name]?.trim());
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
			configured: hasEnv("GOOGLE_CIVIC_API_KEY"),
			envVar: "GOOGLE_CIVIC_API_KEY",
			id: "google-civic",
			label: "Google Civic Information API",
			requiredFor: "Official voter info, polling places, early voting, and sample ballot verification where supported",
			setupUrl: "https://developers.google.com/civic-information"
		},
		{
			configured: hasEnv("CONGRESS_API_KEY"),
			envVar: "CONGRESS_API_KEY",
			id: "congress",
			label: "Congress.gov API",
			requiredFor: "Federal legislative officeholder and activity context",
			setupUrl: "https://api.congress.gov/sign-up/"
		},
		{
			configured: hasEnv("OPENFEC_API_KEY"),
			envVar: "OPENFEC_API_KEY",
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
