const EXTERNAL_HREF_PATTERN = /^https?:\/\//;

export function isExternalHref(href: string): boolean {
	return EXTERNAL_HREF_PATTERN.test(href);
}
