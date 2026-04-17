import { currentCoverageTimeZone } from "~/constants";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function parseDateInput(value: string) {
	if (isoDatePattern.test(value)) {
		const parts = value.split("-");
		const year = Number(parts[0]);
		const month = Number(parts[1]);
		const day = Number(parts[2]);
		return new Date(Date.UTC(year, month - 1, day, 12));
	}

	return new Date(value);
}

export function useFormatters() {
	const compactFormatter = new Intl.NumberFormat("en-US", {
		maximumFractionDigits: 1,
		notation: "compact",
	});

	const currencyFormatter = new Intl.NumberFormat("en-US", {
		currency: "USD",
		maximumFractionDigits: 0,
		style: "currency",
	});

	const dateFormatter = new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "long",
		timeZone: currentCoverageTimeZone,
		year: "numeric",
	});

	const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		month: "short",
		timeZone: currentCoverageTimeZone,
		year: "numeric",
	});

	const percentFormatter = new Intl.NumberFormat("en-US", {
		maximumFractionDigits: 0,
		style: "percent",
	});

	return {
		formatCompactNumber: (value: number) => compactFormatter.format(value),
		formatCurrency: (value: number) => currencyFormatter.format(value),
		formatDate: (value: string) => dateFormatter.format(parseDateInput(value)),
		formatDateTime: (value: string) => dateTimeFormatter.format(parseDateInput(value)),
		formatPercent: (value: number) => percentFormatter.format(value),
	};
}
