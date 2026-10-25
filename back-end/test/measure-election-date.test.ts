import type { AddressInfo } from "node:net";
import type { CoverageRepository } from "../src/coverage-repository.js";
import type { Source } from "../src/types/civic.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { buildSeedCoverageSnapshot } from "../src/coverage-repository.js";
import { createApp } from "../src/server.js";

function repository(): CoverageRepository {
	const snapshot = buildSeedCoverageSnapshot();
	const measure = structuredClone(snapshot.measures[0]!);
	const source: Source = { id: "isolated-measure-source", title: "Public source fixture", publisher: "Public publisher", authority: "official-government", type: "official record", sourceSystem: "Isolated source fixture", date: "", url: "https://www.eac.gov/" };
	measure.electionDate = "2024-11-05";
	measure.electionSlug = "stale-other-state-election";
	measure.sources = [source];
	snapshot.measures = [measure];
	snapshot.sources = [source];
	snapshot.candidates = [];
	snapshot.election!.contests = [{ slug: measure.contestSlug, title: measure.title, office: "Statewide measure", jurisdiction: "Ballot measure", type: "measure", description: "", roleGuide: { summary: "", whyItMatters: "", decisionAreas: [] }, measures: [measure] }];
	return {
		configuredSnapshotMissing: false,
		data: snapshot,
		loadedAt: snapshot.updatedAt,
		mode: "snapshot",
		snapshotPath: ":isolated-measure-date:",
		snapshotMetadata: { status: "seed", sourceType: "seed", sourceLabel: "Isolated API fixture" },
		getCandidateBySlug: () => null,
		getCandidatesBySlugs: () => [],
		getElectionBySlug: slug => snapshot.election?.slug === slug ? snapshot.election : null,
		getJurisdictionBySlug: slug => snapshot.jurisdiction?.slug === slug ? snapshot.jurisdiction : null,
		getMeasureBySlug: slug => slug === measure.slug ? measure : null,
		getSourceById: id => id === source.id ? source : null,
	};
}

for (const published of [true, false]) {
	test(`measure dates come from the published parent election without changing publication gates: ${published}`, async () => {
		const coverage = repository();
		const application = await createApp({ activeLookupCookieSecret: "synthetic-measure-date-cookie-not-real", adminMfaEncryptionKey: "synthetic-measure-date-mfa-not-real", adminDbPath: ":memory:", coverageRepository: coverage, contentSeed: [], ...(published ? {} : { guidePackageSeed: [] }), addressEnrichmentService: null, congressClient: null, googleCivicClient: null, ldaClient: null, openFecClient: null, openStatesClient: null, zipLocationService: null, stateBallotRepository: null, electionReferenceRepository: null, locationGuessOptions: { mode: "disabled" }, zipLookupLogger: { enabled: false, logPath: ":memory:", async record() {} } });
		const listener = application.listen(0, "127.0.0.1");
		await once(listener, "listening");
		try {
			const measure = coverage.data.measures[0]!;
			const response = await fetch(`http://127.0.0.1:${(listener.address() as AddressInfo).port}/api/measures/${measure.slug}`);
			assert.equal(response.status, published ? 200 : 404);
			const body = await response.json();
			if (published) {
				assert.equal(body.electionDate, coverage.data.election!.date);
				assert.equal(body.electionSlug, coverage.data.election!.slug);
			}
			else {
				assert.equal(body.electionDate, undefined);
				assert.equal(body.electionSlug, undefined);
			}
			assert.equal(measure.electionDate, "2024-11-05");
			assert.equal(measure.electionSlug, "stale-other-state-election");
		}
		finally {
			listener.closeAllConnections();
			await new Promise<void>(accept => listener.close(() => accept()));
			await application.closeResources();
		}
	});
}
