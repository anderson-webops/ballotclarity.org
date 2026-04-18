import { createCoverageRepository } from "../../../back-end/src/coverage-repository";

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

export default defineEventHandler(async (event) => {
	const origin = getRequestURL(event).origin;
	const coverageRepository = await createCoverageRepository();
	const election = coverageRepository.data.election;
	const electionSummaries = coverageRepository.data.electionSummaries;
	const jurisdictionSummaries = coverageRepository.data.jurisdictionSummaries;
	const sourceInventory = coverageRepository.data.sources;
	const candidates = coverageRepository.data.candidates;
	const contests = election?.contests ?? [];
	const measures = coverageRepository.data.measures;
	const staticRoutes = [
		"/",
		"/about",
		"/accessibility",
		"/contact",
		"/corrections",
		"/coverage",
		"/data-sources",
		"/districts",
		"/help",
		"/methodology",
		"/neutrality",
		"/privacy",
		"/results",
		"/representatives",
		"/status",
		"/sources",
		"/terms"
	];

	const electionRoutes = electionSummaries.map(({ slug }) => `/elections/${slug}`);
	const jurisdictionRoutes = jurisdictionSummaries.map(({ slug }) => `/locations/${slug}`);
	const sourceRoutes = sourceInventory.map(({ id }) => `/sources/${id}`);
	const candidateRoutes = unique(
		candidates.map(candidate => `/candidate/${candidate.slug}`)
	);
	const candidateSubRoutes = unique(
		candidates.flatMap(candidate => [`/candidate/${candidate.slug}/funding`, `/candidate/${candidate.slug}/influence`])
	);
	const contestRoutes = unique(contests.map(contest => `/contest/${contest.slug}`));
	const districtRoutes = unique(
		contests.flatMap(contest => contest.type === "candidate" ? [`/districts/${contest.slug}`] : [])
	);
	const measureRoutes = unique(
		measures.map(measure => `/measure/${measure.slug}`)
	);
	const representativeCandidates = unique(
		candidates.filter(candidate => candidate.incumbent).map(candidate => candidate.slug)
	);
	const representativeRoutes = representativeCandidates.map(slug => `/representatives/${slug}`);
	const representativeSubRoutes = representativeCandidates.flatMap(slug => [
		`/representatives/${slug}/funding`,
		`/representatives/${slug}/influence`
	]);

	const ballotGuideRoutes = election ? [`/ballot/${election.slug}`] : [];
	const guideUtilityRoutes = coverageRepository.mode === "snapshot"
		? ["/ballot", "/plan"]
		: []
	;
	const routeFamilies = [
		...staticRoutes,
		...guideUtilityRoutes,
		...ballotGuideRoutes,
		...electionRoutes,
		...jurisdictionRoutes,
		...candidateRoutes,
		...candidateSubRoutes,
		...contestRoutes,
		...districtRoutes,
		...measureRoutes,
		...representativeRoutes,
		...representativeSubRoutes,
		...sourceRoutes
	];

	const body = unique(routeFamilies)
		.map((route) => {
			const loc = new URL(route, `${origin}/`).toString();
			return `<url><loc>${xmlEscape(loc)}</loc></url>`;
		})
		.join("");

	setHeader(event, "content-type", "application/xml; charset=utf-8");

	return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
});
