import { demoElection, demoElectionSummaries, demoJurisdictionSummaries, demoSources } from "../../../back-end/src/coverage-data";

function xmlEscape(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll("\"", "&quot;")
		.replaceAll("'", "&apos;");
}

function unique<T>(values: T[]) {
	return Array.from(new Set(values));
}

export default defineEventHandler((event) => {
	const origin = getRequestURL(event).origin;
	const staticRoutes = [
		"/",
		"/about",
		"/accessibility",
		"/contact",
		"/corrections",
		"/coverage",
		"/data-sources",
		"/help",
		"/methodology",
		"/neutrality",
		"/privacy",
		"/status",
		"/sources",
		"/terms"
	];

	const electionRoutes = demoElectionSummaries.map(({ slug }) => `/elections/${slug}`);
	const jurisdictionRoutes = demoJurisdictionSummaries.map(({ slug }) => `/locations/${slug}`);
	const sourceRoutes = demoSources.map(({ id }) => `/sources/${id}`);
	const candidateRoutes = unique(
		demoElection.contests.flatMap(contest =>
			contest.type === "candidate" ? (contest.candidates ?? []).map(candidate => `/candidate/${candidate.slug}`) : []
		)
	);
	const contestRoutes = unique(demoElection.contests.map(contest => `/contest/${contest.slug}`));
	const measureRoutes = unique(
		demoElection.contests.flatMap(contest =>
			contest.type === "measure" ? (contest.measures ?? []).map(measure => `/measure/${measure.slug}`) : []
		)
	);

	const body = unique([
		...staticRoutes,
		...electionRoutes,
		...jurisdictionRoutes,
		...candidateRoutes,
		...contestRoutes,
		...measureRoutes,
		...sourceRoutes
	])
		.map((route) => {
			const loc = new URL(route, `${origin}/`).toString();
			return `<url><loc>${xmlEscape(loc)}</loc></url>`;
		})
		.join("");

	setHeader(event, "content-type", "application/xml; charset=utf-8");

	return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
});
