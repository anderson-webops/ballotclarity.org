const defaultSiteUrl = "https://ballotclarity.org";
const trailingSlashPattern = /\/$/;

export function useSiteUrl() {
	const runtimeConfig = useRuntimeConfig();
	return String(runtimeConfig.public.siteUrl || defaultSiteUrl).replace(trailingSlashPattern, "");
}

export function buildSiteUrl(path = "") {
	const siteUrl = useSiteUrl();

	if (!path)
		return siteUrl;

	return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
