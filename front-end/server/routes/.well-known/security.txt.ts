const securityTxtTtlMs = 180 * 24 * 60 * 60 * 1000;
const trailingSlashesPattern = /\/+$/u;
const productionSiteUrl = "https://ballotclarity.org";

function isLocalSiteUrl(siteUrl: string) {
	try {
		const hostname = new URL(siteUrl).hostname;
		return hostname === "localhost"
			|| hostname === "127.0.0.1"
			|| hostname === "::1";
	}
	catch {
		return true;
	}
}

export default defineEventHandler((event): string => {
	const runtimeConfig = useRuntimeConfig(event);
	const configuredSiteUrl = String(runtimeConfig.public.siteUrl || productionSiteUrl).replace(trailingSlashesPattern, "");
	const siteUrl = isLocalSiteUrl(configuredSiteUrl) ? productionSiteUrl : configuredSiteUrl;
	const expires = new Date(Date.now() + securityTxtTtlMs).toISOString();
	const contactUrl = new URL("/contact", `${siteUrl}/`).toString();
	const canonicalUrl = new URL("/.well-known/security.txt", `${siteUrl}/`).toString();
	const termsUrl = new URL("/terms", `${siteUrl}/`).toString();

	setHeader(event, "cache-control", "public, max-age=86400, must-revalidate");
	setHeader(event, "content-type", "text/plain; charset=utf-8");

	return [
		"# Ballot Clarity security contact.",
		"# Please use the contact page for vulnerability reports, abuse reports, or security concerns.",
		`Contact: ${contactUrl}`,
		`Expires: ${expires}`,
		"Preferred-Languages: en",
		`Canonical: ${canonicalUrl}`,
		`Policy: ${termsUrl}`,
		""
	].join("\n");
});
