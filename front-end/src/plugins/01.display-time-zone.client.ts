import {
	detectBrowserDisplayTimeZone,
	displayTimeZoneCookieName,
	readDisplayTimeZoneFromDocument,
	writeDisplayTimeZoneToDocument,
} from "~/utils/display-time-zone";

export default defineNuxtPlugin((nuxtApp) => {
	const displayTimeZone = useState<string | null>("display-time-zone");
	const displayTimeZoneCookie = useCookie<string | null>(displayTimeZoneCookieName, {
		maxAge: 60 * 60 * 24 * 365,
		sameSite: "lax",
	});
	const browserDisplayTimeZone = readDisplayTimeZoneFromDocument() || detectBrowserDisplayTimeZone();

	if (browserDisplayTimeZone) {
		writeDisplayTimeZoneToDocument(document, browserDisplayTimeZone);
		displayTimeZoneCookie.value = browserDisplayTimeZone;
	}

	nuxtApp.hook("app:mounted", () => {
		const resolvedDisplayTimeZone = readDisplayTimeZoneFromDocument() || detectBrowserDisplayTimeZone();

		if (!resolvedDisplayTimeZone)
			return;

		writeDisplayTimeZoneToDocument(document, resolvedDisplayTimeZone);
		displayTimeZoneCookie.value = resolvedDisplayTimeZone;

		if (displayTimeZone.value !== resolvedDisplayTimeZone)
			displayTimeZone.value = resolvedDisplayTimeZone;
	});
});
