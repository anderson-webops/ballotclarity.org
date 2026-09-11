import { appDescription, appName, appSocialImageAlt, appSocialImagePath } from "~/constants";
import { serializeJsonLd } from "~/utils/json-ld";

interface PageSeoInput {
	description?: string;
	canonicalPath?: string;
	jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
	ogType?: "article" | "profile" | "website";
	path?: string;
	robots?: string;
	title: string;
}

export function usePageSeo(input: MaybeRefOrGetter<PageSeoInput>) {
	const siteUrl = useSiteUrl();
	const page = computed(() => toValue(input));
	const description = computed(() => page.value.description ?? appDescription);
	const canonicalUrl = computed(() => {
		const path = page.value.canonicalPath ?? page.value.path;
		return path ? `${siteUrl}${path.startsWith("/") ? path : `/${path}`}` : siteUrl;
	});
	const socialImageUrl = buildSiteUrl(appSocialImagePath);
	const jsonLdEntries = computed(() => (Array.isArray(page.value.jsonLd) ? page.value.jsonLd : [page.value.jsonLd]).filter(
		(entry): entry is Record<string, unknown> => Boolean(entry)
	));

	useSeoMeta({
		description,
		ogDescription: description,
		ogImage: socialImageUrl,
		ogImageAlt: appSocialImageAlt,
		ogSiteName: appName,
		ogTitle: () => page.value.title,
		ogType: () => page.value.ogType ?? "website",
		ogUrl: canonicalUrl,
		robots: () => page.value.robots,
		title: () => page.value.title,
		twitterCard: "summary_large_image",
		twitterDescription: description,
		twitterImage: socialImageUrl,
		twitterImageAlt: appSocialImageAlt,
		twitterTitle: () => page.value.title,
	});

	useHead(() => ({
		link: [
			{
				href: canonicalUrl.value,
				rel: "canonical"
			}
		],
		script: jsonLdEntries.value.map((entry, index) => ({
			innerHTML: serializeJsonLd(entry),
			key: `jsonld-${index}`,
			type: "application/ld+json"
		}))
	}));
}
