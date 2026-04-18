import {
	detectBrowserDisplayTimeZone,
	displayTimeZoneCookieName,
	formatCivicDate,
	formatCivicDateTime,
	normalizeDisplayTimeZone,
	readDisplayTimeZoneFromDocument,
} from "~/utils/display-time-zone";

export function useFormatters() {
	const displayTimeZone = useState<string | null>("display-time-zone", () => {
		if (import.meta.server) {
			const cookie = useCookie<string | null>(displayTimeZoneCookieName);
			return normalizeDisplayTimeZone(cookie.value);
		}

		return readDisplayTimeZoneFromDocument()
			|| normalizeDisplayTimeZone(useCookie<string | null>(displayTimeZoneCookieName).value)
			|| detectBrowserDisplayTimeZone();
	});

	const compactFormatter = new Intl.NumberFormat("en-US", {
		maximumFractionDigits: 1,
		notation: "compact",
	});

	const currencyFormatter = new Intl.NumberFormat("en-US", {
		currency: "USD",
		maximumFractionDigits: 0,
		style: "currency",
	});

	const percentFormatter = new Intl.NumberFormat("en-US", {
		maximumFractionDigits: 0,
		style: "percent",
	});

	return {
		formatCompactNumber: (value: number) => compactFormatter.format(value),
		formatCurrency: (value: number) => currencyFormatter.format(value),
		formatDate: (value: string) => formatCivicDate(value, displayTimeZone.value),
		formatDateTime: (value: string) => formatCivicDateTime(value, displayTimeZone.value),
		formatPercent: (value: number) => percentFormatter.format(value),
	};
}
