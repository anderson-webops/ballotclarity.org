import { appDescription, appName, appUrl } from "~/constants";

interface PageSeoInput {
	description?: string;
	path?: string;
	title: string;
}

export function usePageSeo(input: PageSeoInput) {
	const description = input.description ?? appDescription;
	const url = input.path ? `${appUrl}${input.path}` : appUrl;

	useSeoMeta({
		description,
		ogDescription: description,
		ogSiteName: appName,
		ogTitle: input.title,
		ogType: "website",
		ogUrl: url,
		title: input.title,
		twitterCard: "summary_large_image",
		twitterDescription: description,
		twitterTitle: input.title,
	});
}
