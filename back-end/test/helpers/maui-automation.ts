import type { MauiCharterCapture } from "../../src/maui-charter-measures.js";
import type { MauiMeasureAutomationPlan, MauiMeasureCohort } from "../../src/maui-measure-automation.js";
import type { fetchRemoteSourceDocument } from "../../src/remote-json-source.js";
import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { collectMauiCharterMeasures, readLatestMauiCharterCapture } from "../../src/maui-charter-collection.js";
import { mauiPreparationHash } from "../../src/maui-measure-automation-storage.js";

export async function mauiAutomationFixture(directory: string) {
	let clock = Date.parse("2028-09-20T12:00:00.000Z");
	const origin = "https://mauicountyvotes.gov";
	const articleUrl = `${origin}/blog/f/two-proposed-maui-county-charter-amendments-on-general-ballot`;
	const robots = `User-agent: *\nDisallow: /404\nSitemap: ${origin}/sitemap.xml\n`;
	const now = () => clock;
	const plan: MauiMeasureAutomationPlan = { schemaVersion: 1, type: "maui-measure-automation", collectionDirectory: join(directory, "collection"), preparationDirectory: join(directory, "preparation"), accessReview: { reviewedAt: new Date(clock).toISOString(), robotsSha256: mauiPreparationHash(robots) }, cohorts: [] };
	const planPath = join(directory, "automation-plan.json");
	let publication: MauiCharterCapture;
	const save = async () => writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`);
	async function seed(year = "2028", changed = false) {
		if (year === "2030") clock = Math.max(clock, Date.parse("2030-09-20T12:00:00.000Z"));
		const short = year.slice(2);
		const election = year === "2030" ? "Nov. 5" : "Nov. 7";
		const xml = (urls: string[], root = "urlset") => `<?xml version="1.0"?><${root}>${urls.map(url => `<loc>${url}</loc>`).join("")}</${root}>`;
		const article = `<script>window._BLOG_DATA=${JSON.stringify({ head: { canonicalUrl: articleUrl }, post: { publishedDate: `${year}-09-18T18:43:35.465Z`, fullContent: JSON.stringify({ blocks: [{ text: `WAILUKU, Hawaii (Sept. 17, ${year}), Councilmember reports that the ${election} general election ballot will include two proposed amendments to the Maui County Charter.` }, ...[1, 2].map(identifier => ({ text: `Resolution ${short}-${identifier}: “Shall the Charter be amended to establish ${changed && identifier === 2 ? "revised " : ""}procedure ${identifier}?”` }))] }) } })}</script>`;
		const rows = [
			[`${origin}/robots.txt`, robots],
			[`${origin}/charter-amendments`, `<h1>${year} Charter Amendments</h1>${[1, 2].map(identifier => `<h4>Maui: Procedure ${identifier}</h4><a href="https://img1.wsimg.com/blobby/go/d625d658-8582-4d35-b9fe-7702a7c85585/downloads/00000000-0000-0000-0000-00000000000${identifier}/Reso%20${short}-${identifier}.pdf?ver=1789162285624">Reso ${short}-${identifier}</a>`).join("")}`],
			[`${origin}/sitemap.xml`, xml([`${origin}/sitemap.blog.xml`], "sitemapindex")],
			[`${origin}/sitemap.blog.xml`, xml([articleUrl])],
			[articleUrl, article]
		];
		plan.accessReview.reviewedAt = new Date(clock).toISOString();
		publication = { schemaVersion: 1, type: "maui-charter-measure-capture", accessReview: plan.accessReview, documents: rows.map(([url, body]) => ({ url: url!, body: body!, sha256: mauiPreparationHash(body!), capturedAt: new Date(clock).toISOString() })) };
		const request: typeof fetchRemoteSourceDocument = async (url) => {
			const row = publication.documents.find(document => document.url === url)!;
			return { status: 200, body: Buffer.from(row.body), contentType: url.endsWith(".txt") ? "text/plain" : url.endsWith(".xml") ? "application/xml" : "text/html", etag: undefined };
		};
		await collectMauiCharterMeasures({ directory: plan.collectionDirectory, accessReview: plan.accessReview, now, request, pause: async () => {} });
		await save();
	}
	async function reviewCurrent() {
		const source = await readLatestMauiCharterCapture(plan.collectionDirectory, clock);
		const documents: MauiMeasureCohort["documents"] = [];
		const rows = [];
		const originals = join(directory, `originals-${clock}`);
		await mkdir(originals);
		for (const question of source.inventory!.questions) {
			const path = join(originals, `${question.resolution}.pdf`);
			const body = `%PDF-1.4\nSynthetic resolution ${question.resolution}.\n`;
			await writeFile(path, body);
			const sha256 = mauiPreparationHash(body);
			documents.push({ resolution: question.resolution, path, sha256, url: question.resolutionUrl, capturedAt: new Date(clock).toISOString() });
			rows.push({ resolution: question.resolution, questionSha256: mauiPreparationHash(question.ballotQuestion), resolutionSha256: sha256, summary: "Would change the county procedure.", yesMeaning: "Would adopt the proposed procedure.", noMeaning: "Would retain the existing procedure.", reviewedPages: [1] });
		}
		const review = { schemaVersion: 1, type: "maui-measure-editorial-review", electionDate: source.inventory!.electionDate, reviewedAt: new Date(clock).toISOString(), questions: rows, publicationApproved: false, automaticImportApproved: false };
		const path = join(originals, "review.json");
		const body = `${JSON.stringify(review)}\n`;
		await writeFile(path, body);
		const cohort = { electionDate: review.electionDate, review: { path, sha256: mauiPreparationHash(body) }, documents, baseSnapshot: null };
		plan.cohorts = [...plan.cohorts.filter(cohort => cohort.electionDate !== review.electionDate), cohort];
		await save();
		return cohort;
	}
	await seed();
	await reviewCurrent();
	return { plan, planPath, now, save, seed, reviewCurrent, advance: (milliseconds = 86_400_000) => {
		clock += milliseconds;
	} };
}
