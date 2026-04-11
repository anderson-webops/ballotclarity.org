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
		year: "numeric",
	});

	const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		month: "short",
		year: "numeric",
	});

	const percentFormatter = new Intl.NumberFormat("en-US", {
		maximumFractionDigits: 0,
		style: "percent",
	});

	return {
		formatCompactNumber: (value: number) => compactFormatter.format(value),
		formatCurrency: (value: number) => currencyFormatter.format(value),
		formatDate: (value: string) => dateFormatter.format(new Date(value)),
		formatDateTime: (value: string) => dateTimeFormatter.format(new Date(value)),
		formatPercent: (value: number) => percentFormatter.format(value),
	};
}
