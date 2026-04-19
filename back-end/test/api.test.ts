import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";
import { defaultContentSeed } from "../src/admin-store.js";
import {
	demoAdminCorrections,
	demoAdminOverview,
	demoAdminSourceMonitor,
} from "../src/coverage-data.js";
import { buildSeedCoverageSnapshot } from "../src/coverage-repository.js";
import { classifyRepresentative } from "../src/representative-classification.js";
import { createApp } from "../src/server.js";

let server: Server;
let baseUrl = "";
const adminApiKey = "test-admin-key";
const coverageSnapshot = buildSeedCoverageSnapshot();
const previousAdminStoreDriver = process.env.ADMIN_STORE_DRIVER;
const previousAdminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousSourceAssetBaseUrl = process.env.SOURCE_ASSET_BASE_URL;
const contentSeed = defaultContentSeed();
const correctionSeed = demoAdminCorrections.corrections;
const sourceMonitorSeed = demoAdminSourceMonitor.sources;
const activitySeed = demoAdminOverview.recentActivity;

function buildRepresentativeMatch({
	districtLabel,
	id,
	name,
	officeTitle,
	openstatesUrl,
	party,
	sourceSystem,
	stateName,
}: {
	districtLabel: string;
	id: string;
	name: string;
	officeTitle: string;
	openstatesUrl?: string;
	party?: string;
	sourceSystem: string;
	stateName?: string;
}) {
	const classification = classifyRepresentative({
		districtLabel,
		officeTitle,
		stateName,
	});

	return {
		districtLabel,
		governmentLevel: classification.governmentLevel,
		id,
		name,
		officeDisplayLabel: classification.officeDisplayLabel,
		officeTitle,
		officeType: classification.officeType,
		openstatesUrl,
		party,
		sourceSystem,
	};
}

before(async () => {
	process.env.ADMIN_STORE_DRIVER = "sqlite";
	delete process.env.ADMIN_DATABASE_URL;
	delete process.env.DATABASE_URL;
	delete process.env.SOURCE_ASSET_BASE_URL;

	server = (await createApp({
		adminApiKey,
		activitySeed,
		adminDbPath: ":memory:",
		contentSeed,
		coverageRepository: {
			data: coverageSnapshot,
			getCandidateBySlug(slug) {
				return coverageSnapshot.candidates.find(candidate => candidate.slug === slug) ?? null;
			},
			getCandidatesBySlugs(slugs) {
				const requested = new Set(slugs);
				return coverageSnapshot.candidates.filter(candidate => requested.has(candidate.slug));
			},
			getElectionBySlug(slug) {
				return coverageSnapshot.election?.slug === slug ? coverageSnapshot.election : null;
			},
			getJurisdictionBySlug(slug) {
				return coverageSnapshot.jurisdiction?.slug === slug ? coverageSnapshot.jurisdiction : null;
			},
			getMeasureBySlug(slug) {
				return coverageSnapshot.measures.find(measure => measure.slug === slug) ?? null;
			},
			getSourceById(id) {
				return coverageSnapshot.sources.find(source => source.id === id) ?? null;
			},
			mode: "snapshot",
			snapshotPath: ":memory:"
		},
		correctionSeed,
		locationGuessOptions: {
			mode: "proxy_headers",
			proxyHeaders: {
				cityHeaders: ["x-geo-city"],
				countryHeaders: ["x-geo-country"],
				postalCodeHeaders: ["x-geo-postal-code"],
				regionHeaders: ["x-geo-region"]
			}
		},
		addressEnrichmentService: {
			async lookupAddress(address) {
				if (/utah county|provo|84604/i.test(address)) {
					return {
						benchmark: "Public_AR_Current",
						countyFips: "049",
						districtMatches: [
							{
								districtCode: "3",
								districtType: "congressional",
								id: "congressional:3",
								label: "Congressional District 3",
								sourceSystem: "U.S. Census Geocoder"
							}
						],
						fromCache: false,
						latitude: 40.2338,
						longitude: -111.6585,
						normalizedAddress: "151 S UNIVERSITY AVE, PROVO, UT, 84601",
						representativeMatches: [
							buildRepresentativeMatch({
								districtLabel: "Congressional District 3",
								id: "ocd-person:test-ut-rep",
								name: "Mike Kennedy",
								officeTitle: "Representative",
								openstatesUrl: "https://openstates.org/person/example-ut",
								party: "Republican",
								sourceSystem: "Open States",
								stateName: "Utah"
							})
						],
						state: "UT",
						vintage: "Current_Current",
						zip5: "84601"
					};
				}

				return {
					benchmark: "Public_AR_Current",
					countyFips: "121",
					districtMatches: [
						{
							districtCode: "5",
							districtType: "congressional",
							id: "congressional:5",
							label: "Congressional District 5",
							sourceSystem: "U.S. Census Geocoder"
						},
						{
							districtCode: "36",
							districtType: "state-senate",
							id: "state-senate:36",
							label: "State Senate District 36",
							sourceSystem: "U.S. Census Geocoder"
						}
					],
					fromCache: false,
					latitude: 33.7479,
					longitude: -84.3902,
					normalizedAddress: "55 TRINITY AVE SW, ATLANTA, GA, 30303",
					representativeMatches: [
						buildRepresentativeMatch({
							districtLabel: "Senator Georgia",
							id: "ocd-person:test-senator",
							name: "Jon Ossoff",
							officeTitle: "Senator",
							openstatesUrl: "https://openstates.org/person/example",
							party: "Democratic",
							sourceSystem: "Open States",
							stateName: "Georgia"
						})
					],
					state: "GA",
					vintage: "Current_Current",
					zip5: "30303"
				};
			}
		},
		googleCivicClient: {
			async lookupVoterInfo(address) {
				if (/utah county|provo|84604/i.test(address)) {
					return {
						actions: [
							{
								badge: "Official",
								description: "Open the official voter portal returned for this address.",
								id: "google-civic:registration",
								kind: "official-verification",
								title: "Registration and voter status",
								url: "https://vote.utah.gov/voter-registration-portal/"
							}
						],
						logistics: null,
						note: "Google Civic accepted the address as 151 S University Ave, Provo, UT 84601.",
						verified: true
					};
				}

				return {
					actions: [
						{
							badge: "Official",
							description: "Open the official ballot or sample-ballot page returned for this address.",
							id: "google-civic:sample-ballot",
							kind: "official-verification",
							title: "Official ballot information",
							url: "https://example.org/ballot"
						}
					],
					logistics: null,
					note: "Google Civic accepted the address as 5600 Campbellton Fairburn Rd, Union City, GA 30213.",
					verified: true
				};
			}
		},
		congressClient: {
			async getMember(bioguideId) {
				if (bioguideId === "O000174") {
					return {
						addressInformation: {
							city: "Washington",
							district: "DC",
							officeAddress: "317 Hart Senate Office Building  Washington, DC 20510",
							phoneNumber: "(202) 224-3521",
							zipCode: 20510,
						},
						bioguideId,
						cosponsoredLegislationCount: 780,
						currentMember: true,
						directOrderName: "Jon Ossoff",
						firstName: "Jon",
						lastName: "Ossoff",
						officialWebsiteUrl: "https://www.ossoff.senate.gov",
						party: "Democratic",
						sponsoredLegislationCount: 216,
						state: "Georgia",
						terms: [
							{
								chamber: "Senate",
								congress: 119,
								memberType: "Senator",
								startYear: 2025,
								stateCode: "GA",
								stateName: "Georgia",
							},
						],
						updatedAt: "2026-03-08T10:32:15Z",
						url: "https://api.congress.gov/v3/member/O000174?format=json",
					};
				}

				if (bioguideId === "M001218") {
					return {
						addressInformation: {
							city: "Washington",
							district: "DC",
							officeAddress: "1719 Longworth House Office Building",
							phoneNumber: "(202) 225-4272",
							zipCode: 20515,
						},
						bioguideId,
						cosponsoredLegislationCount: 506,
						currentMember: true,
						district: 7,
						directOrderName: "Richard McCormick",
						firstName: "Richard",
						lastName: "McCormick",
						officialWebsiteUrl: "https://mccormick.house.gov",
						party: "Republican",
						sponsoredLegislationCount: 50,
						state: "Georgia",
						terms: [
							{
								chamber: "House of Representatives",
								congress: 119,
								district: 7,
								memberType: "Representative",
								startYear: 2025,
								stateCode: "GA",
								stateName: "Georgia",
							},
						],
						updatedAt: "2025-09-24T07:40:20Z",
						url: "https://api.congress.gov/v3/member/M001218?format=json",
					};
				}

				return null;
			},
			async listMembers() {
				return [
					{
						bioguideId: "O000174",
						currentMember: true,
						name: "Ossoff, Jon",
						party: "Democratic",
						state: "GA",
						updatedAt: "2026-03-08T10:32:15Z",
						url: "https://api.congress.gov/v3/member/O000174?format=json",
					},
					{
						bioguideId: "M001218",
						currentMember: true,
						district: 7,
						name: "McCormick, Richard",
						party: "Republican",
						state: "GA",
						updatedAt: "2025-09-24T07:40:20Z",
						url: "https://api.congress.gov/v3/member/M001218?format=json",
					},
				];
			},
			async listMembersByState(stateCode) {
				if (stateCode !== "GA")
					return [];

				return [
					{
						bioguideId: "O000174",
						currentMember: true,
						name: "Ossoff, Jon",
						party: "Democratic",
						state: "Georgia",
						updatedAt: "2026-03-08T10:32:15Z",
						url: "https://api.congress.gov/v3/member/O000174?format=json",
					},
					{
						bioguideId: "W000790",
						currentMember: true,
						name: "Warnock, Raphael G.",
						party: "Democratic",
						state: "Georgia",
						updatedAt: "2026-03-08T10:32:15Z",
						url: "https://api.congress.gov/v3/member/W000790?format=json",
					},
					{
						bioguideId: "M001218",
						currentMember: true,
						district: 7,
						name: "McCormick, Richard",
						party: "Republican",
						state: "Georgia",
						updatedAt: "2025-09-24T07:40:20Z",
						url: "https://api.congress.gov/v3/member/M001218?format=json",
					},
					{
						bioguideId: "R000000",
						currentMember: false,
						district: undefined,
						name: "Russell, Richard",
						party: "Democratic",
						state: "Georgia",
						updatedAt: "1971-01-21T00:00:00Z",
						url: "https://api.congress.gov/v3/member/R000000?format=json",
					},
					{
						bioguideId: "W000001",
						currentMember: false,
						district: 7,
						name: "Woodall, Rob",
						party: "Republican",
						state: "Georgia",
						updatedAt: "2021-01-03T00:00:00Z",
						url: "https://api.congress.gov/v3/member/W000001?format=json",
					},
				];
			},
		},
		openStatesClient: {
			async listPeopleByJurisdiction() {
				return [];
			},
			async lookupPeopleByCoordinates() {
				return [];
			},
			async searchPeopleByName(name) {
				if (name === "Quota Limited")
					throw new Error("Open States lookup failed: 429 Too Many Requests - {\"detail\":\"exceeded limit of 250/day: 252\"}");

				if (name === "Richard McCormick" || name === "Rich Mccormick" || name === "Rich McCormick")
					throw new Error("Open States lookup failed: 429 Too Many Requests - {\"detail\":\"exceeded limit of 250/day: 252\"}");

				if (name === "Jon Ossoff") {
					return [
						{
							currentRoleClassification: "upper",
							currentRoleDistrict: "Georgia",
							currentRoleDivisionId: "ocd-division/country:us/state:ga",
							districtLabel: "Senator Georgia",
							id: "ocd-person/4e48da38-17ab-5580-bced-2ea00b9b2843",
							jurisdictionName: "United States",
							name: "Jon Ossoff",
							officeTitle: "Senator",
							openstatesUrl: "https://openstates.org/person/jon-ossoff-2Nih6ATbzWQaex4isGpjSV/",
							party: "Democratic",
							updatedAt: "2026-04-04T08:14:07.724440+00:00",
						},
					];
				}

				if (name === "Tyler Clancy") {
					return [
						{
							currentRoleClassification: "lower",
							currentRoleDistrict: "60",
							currentRoleDivisionId: "ocd-division/country:us/state:ut/sldl:60",
							districtLabel: "Representative 60",
							id: "ocd-person/739625fa-268f-48d6-9ffa-b80fc19797d5",
							jurisdictionName: "Utah",
							name: "Tyler Clancy",
							officeTitle: "Representative",
							openstatesUrl: "https://openstates.org/person/tyler-clancy-3W6jbbmt1WAFbxzzxWeza9/",
							party: "Republican",
							updatedAt: "2025-07-18T02:37:12.444801+00:00",
						},
					];
				}

				if (name !== "Rich Mccormick" && name !== "Rich McCormick")
					return [];

				return [
					{
						currentRoleClassification: "lower",
						currentRoleDistrict: "GA-7",
						currentRoleDivisionId: "ocd-division/country:us/state:ga/cd:7",
						districtLabel: "Representative GA-7",
						id: "ocd-person/3056cc98-9ca1-5293-8064-fc12fd9c689f",
						jurisdictionName: "Georgia",
						name: "Rich McCormick",
						officeTitle: "Representative",
						openstatesUrl: "https://openstates.org/person/rich-mccormick-1TDIXW9alvLnVNfiuknTot/",
						party: "Republican",
						updatedAt: "2026-04-04T08:17:12.121999+00:00"
					}
				];
			}
		},
		ldaClient: {
			async listContributionReports({ contributionPayee, filingYear }) {
				if (contributionPayee === "JON OSSOFF FOR SENATE" && filingYear === 2025) {
					return [
						{
							contributionItems: [
								{
									amount: 2000,
									contributionType: "FECA",
									contributorName: "United Parcel Service",
									date: "2025-03-14",
									honoreeName: "Sen. Jon Ossoff",
									payeeName: "JON OSSOFF FOR SENATE",
								},
								{
									amount: 1000,
									contributionType: "FECA",
									contributorName: "Delta Air Lines",
									date: "2025-05-02",
									honoreeName: "Sen. Jon Ossoff",
									payeeName: "JON OSSOFF FOR US SENATE",
								},
							],
							filingDocumentUrl: "https://lda.senate.gov/filings/public/contribution/mock-jon-ossoff/print/",
							filingPeriodDisplay: "Mid-Year (Jan 1 - Jun 30)",
							filingUuid: "mock-jon-ossoff",
							filingYear: 2025,
							postedAt: "2025-07-03T12:00:00-04:00",
							registrantName: "UPS",
							url: "https://lda.senate.gov/api/v1/contributions/mock-jon-ossoff/",
						},
					];
				}

				if (contributionPayee === "MIKE KENNEDY FOR UTAH" && filingYear === 2025) {
					return [
						{
							contributionItems: [
								{
									amount: 2500,
									contributionType: "FECA",
									contributorName: "SELF",
									date: "2025-01-15",
									honoreeName: "Rep. Mike Kennedy",
									payeeName: "MIKE KENNEDY FOR UTAH"
								},
								{
									amount: 1750,
									contributionType: "FECA",
									contributorName: "SELF",
									date: "2025-02-02",
									honoreeName: "Rep. Mike Kennedy",
									payeeName: "MIKE KENNEDY FOR UTAH"
								}
							],
							filingDocumentUrl: "https://lda.senate.gov/filings/public/contribution/mock-mike-kennedy/print/",
							filingPeriodDisplay: "Mid-Year (Jan 1 - Jun 30)",
							filingUuid: "mock-mike-kennedy",
							filingYear: 2025,
							postedAt: "2025-07-04T12:11:12-04:00",
							registrantName: "Marshall Brachman",
							url: "https://lda.senate.gov/api/v1/contributions/mock-mike-kennedy/"
						}
					];
				}

				if (contributionPayee === "FRIENDS OF MCCORMICK" && filingYear === 2025) {
					return [
						{
							contributionItems: [
								{
									amount: 2500,
									contributionType: "FECA",
									contributorName: "AMERICAN ACADEMY OF DERMATOLOGY ASSOCIATION",
									date: "2025-04-03",
									honoreeName: "Rep. Rich McCormick",
									payeeName: "FRIENDS OF MCCORMICK"
								},
								{
									amount: 1500,
									contributionType: "FECA",
									contributorName: "AMERICAN MARITIME OFFICERS",
									date: "2025-06-11",
									honoreeName: "Rep. Rich McCormick",
									payeeName: "FRIENDS OF MCCORMICK"
								}
							],
							filingDocumentUrl: "https://lda.senate.gov/filings/public/contribution/mock-rich-mccormick/print/",
							filingPeriodDisplay: "Mid-Year (Jan 1 - Jun 30)",
							filingUuid: "mock-rich-mccormick",
							filingYear: 2025,
							postedAt: "2025-07-09T10:15:00-04:00",
							registrantName: "American Academy of Dermatology Association",
							url: "https://lda.senate.gov/api/v1/contributions/mock-rich-mccormick/"
						}
					];
				}

				return [];
			}
		},
		openFecClient: {
			async getCommitteeTotals(committeeId, cycle) {
				if (committeeId === "C00718866" && cycle === 2026) {
					return {
						candidateContribution: 0,
						cashOnHandBeginningPeriod: 575000,
						committeeId,
						committeeName: "JON OSSOFF FOR SENATE",
						contributions: 1845120.45,
						coverageEndDate: "2026-03-31",
						coverageStartDate: "2025-01-01",
						cycle,
						disbursements: 993002.12,
						individualContributions: 1324012.45,
						individualItemizedContributions: 1189012.45,
						individualUnitemizedContributions: 135000,
						lastCashOnHandEndPeriod: 1428118.33,
						lastReportYear: 2026,
						otherPoliticalCommitteeContributions: 40200,
						otherReceipts: 910.55,
						politicalPartyCommitteeContributions: 480997.45,
						receipts: 1845120.45,
						transfersFromOtherAuthorizedCommittee: 0,
					};
				}

				if (committeeId === "C00864488" && cycle === 2026) {
					return {
						candidateContribution: 0,
						cashOnHandBeginningPeriod: 210000,
						committeeId,
						committeeName: "MIKE KENNEDY FOR UTAH",
						contributions: 802218.94,
						coverageEndDate: "2026-04-05",
						coverageStartDate: "2025-01-01",
						cycle,
						disbursements: 556573.87,
						individualContributions: 481158.78,
						individualItemizedContributions: 381158.78,
						individualUnitemizedContributions: 100000,
						lastCashOnHandEndPeriod: 370846.88,
						lastReportYear: 2026,
						otherPoliticalCommitteeContributions: 372000,
						otherReceipts: 4918.94,
						politicalPartyCommitteeContributions: 25000,
						receipts: 802218.94,
						transfersFromOtherAuthorizedCommittee: 0
					};
				}

				if (committeeId === "C00706747" && cycle === 2026) {
					return {
						candidateContribution: 0,
						cashOnHandBeginningPeriod: 412345.12,
						committeeId,
						committeeName: "FRIENDS OF MCCORMICK",
						contributions: 954321.01,
						coverageEndDate: "2026-04-15",
						coverageStartDate: "2025-01-01",
						cycle,
						disbursements: 534221.44,
						individualContributions: 612000.55,
						individualItemizedContributions: 522000.55,
						individualUnitemizedContributions: 90000,
						lastCashOnHandEndPeriod: 820144.69,
						lastReportYear: 2026,
						otherPoliticalCommitteeContributions: 240000,
						otherReceipts: 1020.46,
						politicalPartyCommitteeContributions: 101300,
						receipts: 954321.01,
						transfersFromOtherAuthorizedCommittee: 0
					};
				}

				return null;
			},
			async searchCandidates({ district, name, office, state }) {
				if (name === "Jon Ossoff" && office === "S" && state === "GA") {
					return [
						{
							candidateId: "S8GA00180",
							cycles: [2020, 2022, 2024, 2026],
							district: "00",
							incumbentChallengeFull: "Incumbent",
							name: "OSSOFF, T. JONATHAN",
							office: "S",
							principalCommittees: [
								{
									committeeId: "C00718866",
									lastFileDate: "2026-04-15",
									name: "JON OSSOFF FOR SENATE",
									party: "Democratic",
								},
							],
							state: "GA",
						},
					];
				}

				if (name === "Mike Kennedy" && office === "H" && state === "UT" && district === "03") {
					return [
						{
							candidateId: "H4UT03260",
							cycles: [2024, 2026],
							district: "03",
							incumbentChallengeFull: "Incumbent",
							name: "KENNEDY, MIKE",
							office: "H",
							principalCommittees: [
								{
									committeeId: "C00864488",
									lastFileDate: "2026-04-15",
									name: "MIKE KENNEDY FOR UTAH",
									party: "Republican"
								}
							],
							state: "UT"
						}
					];
				}

				if ((name === "Rich McCormick" || name === "Richard McCormick") && office === "H" && state === "GA" && district === "07") {
					return [
						{
							candidateId: "H0GA07273",
							cycles: [2020, 2022, 2024, 2026],
							district: "07",
							incumbentChallengeFull: "Incumbent",
							name: "MCCORMICK, RICHARD DEAN DR.",
							office: "H",
							principalCommittees: [
								{
									committeeId: "C00706747",
									lastFileDate: "2026-04-15",
									name: "FRIENDS OF MCCORMICK",
									party: "Republican"
								}
							],
							state: "GA"
						}
					];
				}

				return [];
			}
		},
		sourceMonitorSeed,
		zipLocationService: {
			async lookupZip(zipCode) {
				if (zipCode === "84604") {
					return {
						postalCode: "84604",
						matches: [
							{
								countyFips: "049",
								countyName: "Utah County",
								districtMatches: [
									{
										districtCode: "3",
										districtType: "congressional",
										id: "congressional:3",
										label: "Congressional District 3",
										sourceSystem: "U.S. Census Geocoder"
									},
									{
										districtCode: "24",
										districtType: "state-senate",
										id: "state-senate:24",
										label: "State Senate District 24",
										sourceSystem: "U.S. Census Geocoder"
									},
									{
										districtCode: "60",
										districtType: "state-house",
										id: "state-house:60",
										label: "State House District 60",
										sourceSystem: "U.S. Census Geocoder"
									},
									{
										districtCode: "049",
										districtType: "county",
										id: "county:049",
										label: "Utah County",
										sourceSystem: "U.S. Census Geocoder"
									},
									{
										districtCode: "provo",
										districtType: "place",
										id: "place:provo",
										label: "Provo city",
										sourceSystem: "U.S. Census Geocoder"
									}
								],
								id: "zip:84604:provo-utah",
								latitude: 40.2607,
								locality: "Provo",
								longitude: -111.6549,
								postalCode: "84604",
								representativeMatches: [
									buildRepresentativeMatch({
										districtLabel: "Congressional District 3",
										id: "ocd-person:test-ut-rep",
										name: "Mike Kennedy",
										officeTitle: "Representative",
										openstatesUrl: "https://openstates.org/person/example-ut",
										party: "Republican",
										sourceSystem: "Open States",
										stateName: "Utah"
									})
								],
								sourceSystem: "Zippopotam.us + U.S. Census Geocoder",
								stateAbbreviation: "UT",
								stateName: "Utah"
							}
						]
					};
				}

				if (zipCode === "30303") {
					return {
						postalCode: "30303",
						matches: [
							{
								countyFips: "121",
								countyName: "Fulton County",
								districtMatches: [
									{
										districtCode: "5",
										districtType: "congressional",
										id: "congressional:5",
										label: "Congressional District 5",
										sourceSystem: "U.S. Census Geocoder"
									},
									{
										districtCode: "36",
										districtType: "state-senate",
										id: "state-senate:36",
										label: "State Senate District 36",
										sourceSystem: "U.S. Census Geocoder"
									}
								],
								id: "zip:30303:atlanta-georgia",
								latitude: 33.7525,
								locality: "Atlanta",
								longitude: -84.3928,
								postalCode: "30303",
								representativeMatches: [
									buildRepresentativeMatch({
										districtLabel: "Senator Georgia",
										id: "ocd-person:test-senator",
										name: "Jon Ossoff",
										officeTitle: "Senator",
										openstatesUrl: "https://openstates.org/person/example",
										party: "Democratic",
										sourceSystem: "Open States",
										stateName: "Georgia"
									})
								],
								sourceSystem: "Zippopotam.us + U.S. Census Geocoder",
								stateAbbreviation: "GA",
								stateName: "Georgia"
							}
						]
					};
				}

				if (zipCode === "30022") {
					return {
						postalCode: "30022",
						matches: [
							{
								countyFips: "121",
								countyName: "Fulton County",
								districtMatches: [
									{
										districtCode: "7",
										districtType: "congressional",
										id: "congressional:7",
										label: "Congressional District 7",
										sourceSystem: "U.S. Census Geocoder"
									},
									{
										districtCode: "48",
										districtType: "state-senate",
										id: "state-senate:48",
										label: "State Senate District 48",
										sourceSystem: "U.S. Census Geocoder"
									},
									{
										districtCode: "48",
										districtType: "state-house",
										id: "state-house:48",
										label: "State House District 48",
										sourceSystem: "U.S. Census Geocoder"
									},
									{
										districtCode: "121",
										districtType: "county",
										id: "county:121",
										label: "Fulton County",
										sourceSystem: "U.S. Census Geocoder"
									},
									{
										districtCode: "johns-creek",
										districtType: "place",
										id: "place:johns-creek",
										label: "Johns Creek city",
										sourceSystem: "U.S. Census Geocoder"
									}
								],
								id: "zip:30022:alpharetta-georgia",
								latitude: 34.0407,
								locality: "Alpharetta",
								longitude: -84.2376,
								postalCode: "30022",
								representativeMatches: [],
								sourceSystem: "Zippopotam.us + U.S. Census Geocoder",
								stateAbbreviation: "GA",
								stateName: "Georgia"
							}
						]
					};
				}

				if (zipCode === "84001") {
					return {
						postalCode: "84001",
						matches: [
							{
								countyFips: "049",
								countyName: "Utah County",
								districtMatches: [
									{
										districtCode: "3",
										districtType: "congressional",
										id: "congressional:3",
										label: "Congressional District 3",
										sourceSystem: "U.S. Census Geocoder"
									}
								],
								id: "zip:84001:provo-utah",
								latitude: 40.245,
								locality: "Provo",
								longitude: -111.64,
								postalCode: "84001",
								representativeMatches: [
									buildRepresentativeMatch({
										districtLabel: "Congressional District 3",
										id: "ocd-person:test-ut-rep",
										name: "Mike Kennedy",
										officeTitle: "Representative",
										openstatesUrl: "https://openstates.org/person/example-ut",
										party: "Republican",
										sourceSystem: "Open States",
										stateName: "Utah"
									})
								],
								sourceSystem: "Zippopotam.us + U.S. Census Geocoder",
								stateAbbreviation: "UT",
								stateName: "Utah"
							},
							{
								countyFips: "049",
								countyName: "Utah County",
								districtMatches: [
									{
										districtCode: "4",
										districtType: "congressional",
										id: "congressional:4",
										label: "Congressional District 4",
										sourceSystem: "U.S. Census Geocoder"
									}
								],
								id: "zip:84001:orem-utah",
								latitude: 40.2969,
								locality: "Orem",
								longitude: -111.6946,
								postalCode: "84001",
								representativeMatches: [
									buildRepresentativeMatch({
										districtLabel: "Congressional District 4",
										id: "ocd-person:test-ut-rep-4",
										name: "Burgess Owens",
										officeTitle: "Representative",
										openstatesUrl: "https://openstates.org/person/example-ut-4",
										party: "Republican",
										sourceSystem: "Open States",
										stateName: "Utah"
									})
								],
								sourceSystem: "Zippopotam.us + U.S. Census Geocoder",
								stateAbbreviation: "UT",
								stateName: "Utah"
							}
						]
					};
				}

				return null;
			}
		}
	})).listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address() as AddressInfo;
	baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
	if (server) {
		await new Promise<void>((resolve, reject) => {
			server.close(error => error ? reject(error) : resolve());
		});
	}

	if (previousAdminStoreDriver === undefined)
		delete process.env.ADMIN_STORE_DRIVER;
	else
		process.env.ADMIN_STORE_DRIVER = previousAdminStoreDriver;

	if (previousAdminDatabaseUrl === undefined)
		delete process.env.ADMIN_DATABASE_URL;
	else
		process.env.ADMIN_DATABASE_URL = previousAdminDatabaseUrl;

	if (previousDatabaseUrl === undefined)
		delete process.env.DATABASE_URL;
	else
		process.env.DATABASE_URL = previousDatabaseUrl;

	if (previousSourceAssetBaseUrl === undefined)
		delete process.env.SOURCE_ASSET_BASE_URL;
	else
		process.env.SOURCE_ASSET_BASE_URL = previousSourceAssetBaseUrl;
});

test("GET /health returns readiness and coverage metadata", async () => {
	const response = await fetch(`${baseUrl}/health`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.ok, true);
	assert.equal(body.ready, true);
	assert.equal(body.driver, "sqlite");
	assert.equal(body.coverageMode, "snapshot");
	assert.equal(body.assetMode, "public-mirror");
	assert.equal(body.providerSummary.total >= 6, true);
	assert.match(body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("default runtime stays empty instead of auto-seeding coverage and public ops data", async () => {
	const isolatedServer = (await createApp({
		adminApiKey,
		adminDbPath: ":memory:"
	})).listen(0, "127.0.0.1");

	await once(isolatedServer, "listening");
	const isolatedAddress = isolatedServer.address() as AddressInfo;
	const isolatedBaseUrl = `http://127.0.0.1:${isolatedAddress.port}`;

	try {
		const [electionsResponse, coverageResponse, statusResponse, sourcesResponse] = await Promise.all([
			fetch(`${isolatedBaseUrl}/api/elections`),
			fetch(`${isolatedBaseUrl}/api/coverage`),
			fetch(`${isolatedBaseUrl}/api/status`),
			fetch(`${isolatedBaseUrl}/api/sources`)
		]);
		const electionsBody = await electionsResponse.json();
		const coverageBody = await coverageResponse.json();
		const statusBody = await statusResponse.json();
		const sourcesBody = await sourcesResponse.json();

		assert.equal(electionsResponse.status, 200);
		assert.deepEqual(electionsBody.elections, []);
		assert.equal(coverageBody.coverageMode, "empty");
		assert.equal(coverageBody.launchTarget, undefined);
		assert.deepEqual(coverageBody.locationGuess, {
			canGuessOnLoad: false,
			mode: "disabled"
		});
		assert.match(coverageBody.currentState, /No published local coverage snapshot/i);
		assert.equal(statusBody.coverageMode, "empty");
		assert.equal(statusBody.overallStatus, "reviewing");
		assert.deepEqual(statusBody.sourceSummary, {
			"healthy": 0,
			"incident": 0,
			"review-soon": 0,
			"stale": 0
		});
		assert.deepEqual(statusBody.incidents, []);
		assert.deepEqual(statusBody.sources, []);
		assert.deepEqual(statusBody.notes, [
			"No published local coverage snapshot is active right now.",
			"Nationwide civic lookup is available across the public site.",
			"Local guide publication status remains generic until a verified local snapshot is published."
		]);
		assert.equal(sourcesResponse.status, 200);
		assert.ok(Array.isArray(sourcesBody.sources));
		assert.ok(sourcesBody.sources.length >= 8);
		assert.ok(sourcesBody.sources.some((item: { id: string; publicationKind: string }) => item.id === "open-states" && item.publicationKind === "curated-global"));
		assert.ok(sourcesBody.sources.some((item: { id: string }) => item.id === "official-state-voter-portals"));

		const ballotResponse = await fetch(`${isolatedBaseUrl}/api/ballot?election=2026-fulton-county-general`);
		const ballotBody = await ballotResponse.json();

		assert.equal(ballotResponse.status, 404);
		assert.match(ballotBody.message, /Ballot not found/i);
	}
	finally {
		await new Promise<void>((resolve, reject) => {
			isolatedServer.close(error => error ? reject(error) : resolve());
		});
	}
});

test("GET /api/status suppresses launch-specific source monitors when coverage mode is empty", async () => {
	const isolatedServer = (await createApp({
		adminApiKey,
		adminDbPath: ":memory:",
		sourceMonitorSeed
	})).listen(0, "127.0.0.1");

	await once(isolatedServer, "listening");
	const isolatedAddress = isolatedServer.address() as AddressInfo;
	const isolatedBaseUrl = `http://127.0.0.1:${isolatedAddress.port}`;

	try {
		const response = await fetch(`${isolatedBaseUrl}/api/status`);
		const body = await response.json();

		assert.equal(response.status, 200);
		assert.equal(body.coverageMode, "empty");
		assert.equal(body.overallStatus, "reviewing");
		assert.deepEqual(body.sourceSummary, {
			"healthy": 0,
			"incident": 0,
			"review-soon": 0,
			"stale": 0
		});
		assert.deepEqual(body.incidents, []);
		assert.deepEqual(body.sources, []);
		assert.ok(body.notes.every((note: string) => !/Fulton|Georgia/i.test(note)));
	}
	finally {
		await new Promise<void>((resolve, reject) => {
			isolatedServer.close(error => error ? reject(error) : resolve());
		});
	}
});

test("default runtime purges legacy demo public-status records from an existing admin store", async () => {
	const tempDir = mkdtempSync(join(tmpdir(), "ballot-clarity-admin-"));
	const adminDbPath = join(tempDir, "admin.sqlite");
	let seededServer: Server | null = null;
	let cleanedServer: Server | null = null;

	try {
		seededServer = (await createApp({
			adminApiKey,
			activitySeed,
			adminDbPath,
			contentSeed,
			correctionSeed,
			sourceMonitorSeed
		})).listen(0, "127.0.0.1");
		await once(seededServer, "listening");

		await new Promise<void>((resolve, reject) => {
			seededServer?.close(error => error ? reject(error) : resolve());
		});
		seededServer = null;

		cleanedServer = (await createApp({
			adminApiKey,
			adminDbPath
		})).listen(0, "127.0.0.1");
		await once(cleanedServer, "listening");

		const address = cleanedServer.address() as AddressInfo;
		const cleanedBaseUrl = `http://127.0.0.1:${address.port}`;
		const [statusResponse, correctionsResponse] = await Promise.all([
			fetch(`${cleanedBaseUrl}/api/status`),
			fetch(`${cleanedBaseUrl}/api/corrections`)
		]);
		const statusBody = await statusResponse.json();
		const correctionsBody = await correctionsResponse.json();

		assert.equal(statusResponse.status, 200);
		assert.equal(statusBody.coverageMode, "empty");
		assert.deepEqual(statusBody.sources, []);
		assert.equal(statusBody.incidents.length, 0);
		assert.ok(statusBody.notes.every((note: string) => !/Fulton|Georgia legislative crosswalk|Sandra Patel/i.test(note)));
		assert.equal(correctionsResponse.status, 200);
		assert.deepEqual(correctionsBody.corrections, []);
	}
	finally {
		if (seededServer) {
			await new Promise<void>((resolve, reject) => {
				seededServer?.close(error => error ? reject(error) : resolve());
			});
		}

		if (cleanedServer) {
			await new Promise<void>((resolve, reject) => {
				cleanedServer?.close(error => error ? reject(error) : resolve());
			});
		}

		rmSync(tempDir, { force: true, recursive: true });
	}
});

test("POST /api/location validates short lookups", async () => {
	const response = await fetch(`${baseUrl}/api/location`, {
		body: JSON.stringify({ q: "12" }),
		headers: {
			"Content-Type": "application/json"
		},
		method: "POST"
	});
	const body = await response.json();

	assert.equal(response.status, 400);
	assert.match(body.message, /Enter at least/);
});

test("POST /api/location validates incomplete numeric ZIP fragments", async () => {
	const response = await fetch(`${baseUrl}/api/location`, {
		body: JSON.stringify({ q: "3030" }),
		headers: {
			"Content-Type": "application/json"
		},
		method: "POST"
	});
	const body = await response.json();

	assert.equal(response.status, 400);
	assert.match(body.message, /full 5-digit ZIP code/i);
});

test("POST /api/location returns the supported Fulton coverage guide for ZIPs inside current coverage", async () => {
	const response = await fetch(`${baseUrl}/api/location`, {
		body: JSON.stringify({ q: "30303" }),
		headers: {
			"Content-Type": "application/json"
		},
		method: "POST"
	});
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(response.headers.get("cache-control"), "no-store");
	assert.equal(body.result, "resolved");
	assert.equal(body.guideAvailability, "published");
	assert.equal(body.inputKind, "zip");
	assert.equal(body.electionSlug, "2026-fulton-county-general");
	assert.equal(body.location.slug, "fulton-county-georgia");
	assert.equal(body.location.lookupMode, "zip-preview");
	assert.equal(body.actions.some((item: { kind: string; title: string }) => item.kind === "official-verification" && /My Voter Page/i.test(item.title)), true);
	assert.equal(body.availability.nationwideCivicResults.status, "available");
	assert.equal(body.availability.representatives.status, "available");
	assert.equal(body.availability.ballotCandidates.status, "available");
	assert.equal(body.availability.financeInfluence.status, "available");
	assert.equal(body.availability.fullLocalGuide.status, "available");
	assert.equal(body.representativeMatches[0].name, "Jon Ossoff");
	assert.match(body.note, /Atlanta, Georgia/i);
	assert.match(body.note, /single guide area/i);
});

test("POST /api/location filters former Congress members out of ZIP lookup representative fallback", async () => {
	const response = await fetch(`${baseUrl}/api/location`, {
		body: JSON.stringify({ q: "30022" }),
		headers: {
			"Content-Type": "application/json"
		},
		method: "POST"
	});
	const body = await response.json();
	const representativeNames = (body.representativeMatches ?? []).map((item: { name: string }) => item.name);
	const representativeSources = (body.representativeMatches ?? []).map((item: { sourceSystem?: string }) => item.sourceSystem ?? "");
	const representatives = (body.representativeMatches ?? []) as Array<{
		governmentLevel?: string;
		name: string;
		officeDisplayLabel?: string;
		officeType?: string;
	}>;
	const findRepresentative = (pattern: RegExp) => representatives.find(item => pattern.test(item.name));

	assert.equal(response.status, 200);
	assert.equal(body.result, "resolved");
	assert.equal(body.inputKind, "zip");
	assert.equal(body.availability.representatives.status, "available");
	assert.equal(body.availability.financeInfluence.status, "available");
	assert.equal(body.representativeMatches.length, 7);
	assert.match(body.note, /(Alpharetta|Fulton County), Georgia/i);
	assert.equal(representativeNames.includes("Jon Ossoff"), true);
	assert.equal(representativeNames.some((name: string) => /warnock/i.test(name)), true);
	assert.equal(representativeNames.some((name: string) => /mccormick/i.test(name)), true);
	assert.equal(representativeNames.includes("Richard Russell"), false);
	assert.equal(representativeNames.includes("Rob Woodall"), false);
	assert.equal(representativeSources.includes("Congress.gov"), true);
	assert.equal(findRepresentative(/^Jon Ossoff$/i)?.governmentLevel, "federal");
	assert.equal(findRepresentative(/^Jon Ossoff$/i)?.officeType, "us_senate");
	assert.equal(findRepresentative(/warnock/i)?.governmentLevel, "federal");
	assert.equal(findRepresentative(/warnock/i)?.officeType, "us_senate");
	assert.equal(findRepresentative(/mccormick/i)?.governmentLevel, "federal");
	assert.equal(findRepresentative(/mccormick/i)?.officeType, "us_house");
	assert.equal(findRepresentative(/^Scott Hilton$/i)?.governmentLevel, "state");
	assert.equal(findRepresentative(/^Scott Hilton$/i)?.officeType, "state_house");
	assert.equal(findRepresentative(/^Shawn Still$/i)?.governmentLevel, "state");
	assert.equal(findRepresentative(/^Shawn Still$/i)?.officeType, "state_senate");
	assert.equal(findRepresentative(/^Robb Pitts$/i)?.governmentLevel, "county");
	assert.equal(findRepresentative(/^Robb Pitts$/i)?.officeType, "county_commission");
	assert.equal(findRepresentative(/^John Bradberry$/i)?.governmentLevel, "city");
	assert.equal(findRepresentative(/^John Bradberry$/i)?.officeType, "mayor");
	assert.equal(findRepresentative(/^Jon Ossoff$/i)?.officeDisplayLabel, "U.S. Senator for Georgia");
	assert.equal(findRepresentative(/mccormick/i)?.officeDisplayLabel, "U.S. Representative for Georgia's 7th Congressional District");
	assert.equal(findRepresentative(/^Scott Hilton$/i)?.officeDisplayLabel, "Georgia State Representative for District 48");
	assert.equal(findRepresentative(/^Shawn Still$/i)?.officeDisplayLabel, "Georgia State Senator for District 48");
	assert.equal(findRepresentative(/^Robb Pitts$/i)?.officeDisplayLabel, "Fulton County Commission Chair");
	assert.equal(findRepresentative(/^John Bradberry$/i)?.officeDisplayLabel, "Mayor of Johns Creek");
});

test("POST /api/location returns district lookup results without a published guide for out-of-guide ZIPs", async () => {
	const response = await fetch(`${baseUrl}/api/location`, {
		body: JSON.stringify({ q: "84604" }),
		headers: {
			"Content-Type": "application/json"
		},
		method: "POST"
	});
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.result, "resolved");
	assert.equal(body.guideAvailability, "not-published");
	assert.equal(body.inputKind, "zip");
	assert.equal(body.actions.some((item: { kind: string }) => item.kind === "ballot-guide"), false);
	assert.equal(body.actions.some((item: { title: string }) => /Utah voter registration portal/i.test(item.title)), true);
	assert.equal(body.availability.nationwideCivicResults.status, "available");
	assert.equal(body.availability.representatives.status, "available");
	assert.equal(body.availability.ballotCandidates.status, "unavailable");
	assert.equal(body.availability.financeInfluence.status, "available");
	assert.match(body.availability.financeInfluence.detail, /matched representative pages now include person-level funding and influence modules/i);
	assert.doesNotMatch(body.availability.financeInfluence.detail, /source-backed local candidate records/i);
	assert.equal(body.availability.fullLocalGuide.status, "unavailable");
	assert.equal(body.location.displayName, "Provo, Utah");
	assert.equal(body.representativeMatches[0].name, "Mike Kennedy");
	assert.match(body.note, /Provo, Utah/i);
	assert.match(body.note, /nationwide civic result layers/i);
});

test("POST /api/location returns a selection panel when a ZIP resolves to multiple civic areas", async () => {
	const response = await fetch(`${baseUrl}/api/location`, {
		body: JSON.stringify({ q: "84001" }),
		headers: {
			"Content-Type": "application/json"
		},
		method: "POST"
	});
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.result, "resolved");
	assert.equal(body.guideAvailability, "not-published");
	assert.equal(body.inputKind, "zip");
	assert.equal(body.selectionOptions.length, 2);
	assert.match(body.note, /matched 2 possible civic areas/i);
	assert.match(body.availability.representatives.detail, /Choose one below/i);
	assert.equal(body.representativeMatches, undefined);
});

test("POST /api/location accepts a ZIP area selection and loads that area's districts and representatives", async () => {
	const selectionResponse = await fetch(`${baseUrl}/api/location`, {
		body: JSON.stringify({ q: "84001" }),
		headers: {
			"Content-Type": "application/json"
		},
		method: "POST"
	});
	const selectionBody = await selectionResponse.json();
	const chosenOption = selectionBody.selectionOptions[1];

	const response = await fetch(`${baseUrl}/api/location`, {
		body: JSON.stringify({ q: "84001", selectionId: chosenOption.id }),
		headers: {
			"Content-Type": "application/json"
		},
		method: "POST"
	});
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.result, "resolved");
	assert.equal(body.selectionOptions, undefined);
	assert.equal(body.location.displayName, "Orem, Utah");
	assert.equal(body.districtMatches[0].label, "Congressional District 4");
	assert.equal(body.representativeMatches[0].name, "Burgess Owens");
});

test("POST /api/location returns the current Fulton County launch location for full addresses", async () => {
	const response = await fetch(`${baseUrl}/api/location`, {
		body: JSON.stringify({ q: "5600 Campbellton Fairburn Road, Union City, GA 30213" }),
		headers: {
			"Content-Type": "application/json"
		},
		method: "POST"
	});
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(response.headers.get("cache-control"), "no-store");
	assert.equal(body.result, "resolved");
	assert.equal(body.guideAvailability, "published");
	assert.equal(body.inputKind, "address");
	assert.equal(body.electionSlug, "2026-fulton-county-general");
	assert.equal(body.location.slug, "fulton-county-georgia");
	assert.equal(body.location.lookupMode, "address-verified");
	assert.equal(body.location.requiresOfficialConfirmation, false);
	assert.equal(body.actions[0].kind, "official-verification");
	assert.match(body.note, /Google Civic accepted the address/i);
	assert.equal(body.location.lookupInput, "55 TRINITY AVE SW, ATLANTA, GA, 30303");
	assert.equal(body.normalizedAddress, "55 TRINITY AVE SW, ATLANTA, GA, 30303");
	assert.equal(body.districtMatches[0].label, "Congressional District 5");
	assert.equal(body.representativeMatches[0].name, "Jon Ossoff");
	assert.equal(body.availability.nationwideCivicResults.status, "available");
	assert.equal(body.availability.representatives.status, "available");
	assert.equal(body.availability.ballotCandidates.status, "available");
	assert.equal(body.availability.financeInfluence.status, "available");
	assert.equal(body.availability.fullLocalGuide.status, "available");
	assert.match(body.note, /Census geography matched/i);
	assert.match(body.note, /Ballot Clarity attached 2 current official matches for this address from Open States and Congress\.gov/i);
});

test("POST /api/location returns district lookup results without a published guide for out-of-guide full addresses", async () => {
	const response = await fetch(`${baseUrl}/api/location`, {
		body: JSON.stringify({ q: "151 S University Ave, Provo, UT 84601" }),
		headers: {
			"Content-Type": "application/json"
		},
		method: "POST"
	});
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.result, "resolved");
	assert.equal(body.guideAvailability, "not-published");
	assert.equal(body.inputKind, "address");
	assert.equal(body.location, undefined);
	assert.equal(body.electionSlug, undefined);
	assert.equal(body.actions.some((item: { kind: string }) => item.kind === "ballot-guide"), false);
	assert.equal(body.actions.some((item: { title: string }) => /Utah voter registration portal|Registration and voter status/i.test(item.title)), true);
	assert.equal(body.normalizedAddress, "151 S UNIVERSITY AVE, PROVO, UT, 84601");
	assert.equal(body.representativeMatches[0].name, "Mike Kennedy");
	assert.equal(body.availability.nationwideCivicResults.status, "available");
	assert.equal(body.availability.representatives.status, "available");
	assert.equal(body.availability.ballotCandidates.status, "unavailable");
	assert.equal(body.availability.financeInfluence.status, "available");
	assert.match(body.availability.financeInfluence.detail, /matched representative pages now include person-level funding and influence modules/i);
	assert.doesNotMatch(body.availability.financeInfluence.detail, /source-backed local candidate records/i);
	assert.equal(body.availability.fullLocalGuide.status, "unavailable");
	assert.match(body.note, /nationwide civic result layers/i);
	assert.match(body.note, /Census geography matched/i);
});

test("GET /api/location/guess uses configured proxy geo headers to load an IP-based nationwide result", async () => {
	const response = await fetch(`${baseUrl}/api/location/guess`, {
		headers: {
			"x-geo-city": "Provo",
			"x-geo-country": "US",
			"x-geo-postal-code": "84604",
			"x-geo-region": "UT"
		}
	});
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(response.headers.get("cache-control"), "no-store");
	assert.match(response.headers.get("vary") || "", /x-geo-postal-code/i);
	assert.equal(body.detectedFromIp, true);
	assert.equal(body.result, "resolved");
	assert.equal(body.guideAvailability, "not-published");
	assert.equal(body.inputKind, "zip");
	assert.match(body.note, /best-effort location guess from your IP address/i);
	assert.equal(body.actions.some((item: { title: string }) => /Utah voter registration portal/i.test(item.title)), true);
});

test("GET /api/location/guess returns 404 when configured proxy geo headers are unavailable", async () => {
	const response = await fetch(`${baseUrl}/api/location/guess`);
	const body = await response.json();

	assert.equal(response.status, 404);
	assert.match(body.message, /Automatic location guessing is not available/i);
});

test("GET /api/location/guess returns 404 when automatic location guessing is disabled", async () => {
	const isolatedServer = (await createApp({
		adminApiKey,
		adminDbPath: ":memory:",
		locationGuessOptions: {
			mode: "disabled"
		}
	})).listen(0, "127.0.0.1");

	await once(isolatedServer, "listening");
	const isolatedAddress = isolatedServer.address() as AddressInfo;
	const isolatedBaseUrl = `http://127.0.0.1:${isolatedAddress.port}`;

	try {
		const response = await fetch(`${isolatedBaseUrl}/api/location/guess`);
		const body = await response.json();

		assert.equal(response.status, 404);
		assert.match(body.message, /not configured for this host/i);
	}
	finally {
		await new Promise<void>((resolve, reject) => {
			isolatedServer.close(error => error ? reject(error) : resolve());
		});
	}
});

test("GET /api/ballot returns the election guide and contests", async () => {
	const response = await fetch(`${baseUrl}/api/ballot?election=2026-fulton-county-general`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.election.slug, "2026-fulton-county-general");
	assert.equal(body.election.jurisdictionSlug, "fulton-county-georgia");
	assert.equal(body.election.contests.length, 5);
	assert.equal(body.election.contests[0].title, "Federal Race");
	assert.equal(body.election.contests[0].roleGuide.decisionAreas.length, 3);
	assert.match(body.election.contests[0].roleGuide.summary, /federal law/i);
	assert.match(body.note, /latest imported civic-data snapshot/i);
	assert.match(body.election.name, /Fulton County/i);
});

test("GET /api/jurisdictions returns the demo jurisdiction summary", async () => {
	const response = await fetch(`${baseUrl}/api/jurisdictions`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.jurisdictions.length, 1);
	assert.equal(body.jurisdictions[0].slug, "fulton-county-georgia");
	assert.equal(body.jurisdictions[0].nextElectionSlug, "2026-fulton-county-general");
});

test("GET /api/data-sources returns the live-data roadmap and migration notes", async () => {
	const response = await fetch(`${baseUrl}/api/data-sources`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.ok(body.categories.length >= 5);
	assert.equal(body.categories[0].slug, "address-and-districts");
	assert.equal(body.categories[1].options[0].authority, "official-government");
	assert.match(body.categories[3].options[0].name, /FEC OpenFEC/i);
	assert.match(body.migrationWatch[0].title, /April 30, 2025/);
	assert.match(body.migrationWatch[1].title, /June 30, 2026/);
	assert.equal(body.roadmap.length, 6);
	assert.equal(body.launchTarget.displayName, "Fulton County, Georgia");
	assert.ok(body.categories[0].options[0].links.length >= 1);
	assert.equal(body.coverageMode, "snapshot");
	assert.equal(body.assetMode, "public-mirror");
});

test("GET /api/coverage returns the public launch profile for Fulton County, Georgia", async () => {
	const response = await fetch(`${baseUrl}/api/coverage`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.launchTarget.displayName, "Fulton County, Georgia");
	assert.equal(body.launchTarget.currentElectionDate, "2026-05-19");
	assert.equal(body.launchTarget.nextElectionDate, "2026-11-03");
	assert.deepEqual(body.locationGuess, {
		canGuessOnLoad: true,
		mode: "proxy_headers"
	});
	assert.equal(body.supportedContentTypes.length, 5);
	assert.equal(body.collections[0].href, "/coverage");
	assert.equal(body.coverageMode, "snapshot");
});

test("GET /api/status returns public source-health and launch notices", async () => {
	const response = await fetch(`${baseUrl}/api/status`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.overallStatus, "degraded");
	assert.equal(body.coverageMode, "snapshot");
	assert.equal(body.sourceSummary.healthy, 1);
	assert.equal(body.sourceSummary.incident, 1);
	assert.ok(body.notes.length >= 2);
	assert.ok(body.notes.some((note: string) => /Public pages are serving an imported coverage snapshot/i.test(note)));
	assert.ok(body.notes.some((note: string) => /Fulton County elections office|Georgia legislative crosswalk/i.test(note)));
	assert.ok(body.sources.some((item: { label: string }) => item.label === "Fulton County Registration and Elections site"));
});

test("GET /api/status stays global after a successful nationwide lookup", async () => {
	const lookupResponse = await fetch(`${baseUrl}/api/location`, {
		body: JSON.stringify({ q: "84604" }),
		headers: {
			"Content-Type": "application/json"
		},
		method: "POST"
	});
	const lookupBody = await lookupResponse.json();
	const statusResponse = await fetch(`${baseUrl}/api/status`);
	const statusBody = await statusResponse.json();

	assert.equal(lookupResponse.status, 200);
	assert.equal(lookupBody.result, "resolved");
	assert.equal(lookupBody.guideAvailability, "not-published");
	assert.equal(statusResponse.status, 200);
	assert.equal(statusBody.coverageMode, "snapshot");
	assert.ok(statusBody.sources.some((item: { label: string }) => item.label === "Fulton County Registration and Elections site"));
	assert.ok(statusBody.notes.every((note: string) => !/Provo|Utah|84604/i.test(note)));
});

test("GET /api/corrections returns the public corrections log", async () => {
	const response = await fetch(`${baseUrl}/api/corrections`);
	const body = await response.json();
	const coverageItem = body.corrections.find((item: { pageUrl?: string }) => item.pageUrl === "/coverage");

	assert.equal(response.status, 200);
	assert.equal(body.corrections.length, 3);
	assert.ok(coverageItem);
	assert.ok(body.corrections.some((item: { outcome: string }) => /launch state explicit/i.test(item.outcome)));
});

test("GET /api/jurisdictions/:slug returns the official office and voting-method data", async () => {
	const response = await fetch(`${baseUrl}/api/jurisdictions/fulton-county-georgia`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.officialOffice.name, "Fulton County Registration and Elections");
	assert.equal(body.votingMethods.length, 3);
	assert.ok(body.officialResources.length >= 3);
	assert.equal(body.officialResources[0].authority, "official-government");
	assert.match(body.officialResources[0].sourceSystem, /Fulton County elections contacts/i);
});

test("GET /api/contests/:slug returns a canonical contest page payload with sources", async () => {
	const response = await fetch(`${baseUrl}/api/contests/us-house-district-7`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.contest.slug, "us-house-district-7");
	assert.equal(body.election.slug, "2026-fulton-county-general");
	assert.equal(body.jurisdiction.slug, "fulton-county-georgia");
	assert.ok(body.sourceCount >= 4);
	assert.ok(body.relatedContests.length >= 1);
	assert.equal(body.sources[0].authority, "official-government");
});

test("GET /api/districts and /api/districts/:slug return district-first ballot surfaces", async () => {
	const listResponse = await fetch(`${baseUrl}/api/districts`);
	const listBody = await listResponse.json();

	assert.equal(listResponse.status, 200);
	assert.ok(listBody.districts.some((item: { slug: string }) => item.slug === "us-house-district-7"));

	const districtResponse = await fetch(`${baseUrl}/api/districts/us-house-district-7`);
	const districtBody = await districtResponse.json();

	assert.equal(districtResponse.status, 200);
	assert.equal(districtBody.district.slug, "us-house-district-7");
	assert.equal(districtBody.representatives[0].slug, "daniel-brooks");
	assert.equal(districtBody.candidates.length, 2);
	assert.ok(districtBody.sources.length >= 4);
	assert.match(districtBody.note, /district pages group/i);
});

test("active nationwide lookup cookie backs /api/districts and /api/districts/:slug", async () => {
	const lookupResponse = await fetch(`${baseUrl}/api/location`, {
		body: JSON.stringify({ q: "84604" }),
		headers: {
			"Content-Type": "application/json"
		},
		method: "POST"
	});
	const lookupBody = await lookupResponse.json();
	const cookie = lookupResponse.headers.get("set-cookie")?.split(";")[0];

	assert.equal(lookupResponse.status, 200);
	assert.equal(lookupBody.result, "resolved");
	assert.equal(lookupBody.guideAvailability, "not-published");
	assert.ok(cookie);

	const listResponse = await fetch(`${baseUrl}/api/districts`, {
		headers: {
			cookie: cookie || ""
		}
	});
	const listBody = await listResponse.json();

	assert.equal(listResponse.status, 200);
	assert.equal(listBody.mode, "nationwide");
	assert.ok(listBody.districts.some((item: { slug: string; representativeCount: number }) => item.slug === "congressional-3" && item.representativeCount === 1));
	assert.ok(listBody.districts.some((item: { slug: string; representativeCount: number }) => item.slug === "state-senate-24" && item.representativeCount === 1));
	assert.ok(listBody.districts.some((item: { slug: string; representativeCount: number }) => item.slug === "state-house-60" && item.representativeCount === 1));
	assert.ok(listBody.districts.some((item: { slug: string; representativeCount: number }) => item.slug === "utah-county" && item.representativeCount === 1));
	assert.ok(listBody.districts.some((item: { slug: string; representativeCount: number }) => item.slug === "provo-city" && item.representativeCount === 1));

	const districtResponse = await fetch(`${baseUrl}/api/districts/congressional-3`, {
		headers: {
			cookie: cookie || ""
		}
	});
	const districtBody = await districtResponse.json();

	assert.equal(districtResponse.status, 200);
	assert.equal(districtBody.mode, "nationwide");
	assert.equal(districtBody.district.slug, "congressional-3");
	assert.equal(districtBody.representatives[0].slug, "mike-kennedy");
	assert.equal(districtBody.representatives[0].fundingAvailable, true);
	assert.equal(districtBody.representatives[0].influenceAvailable, true);
	assert.ok(districtBody.officialResources.length >= 1);
	assert.match(districtBody.note, /API-backed nationwide district detail/i);
});

test("direct state and local district routes attach reviewed officeholder records instead of generic zero-state placeholders", async () => {
	const [stateDistrictResponse, localDistrictResponse] = await Promise.all([
		fetch(`${baseUrl}/api/districts/state-house-60`),
		fetch(`${baseUrl}/api/districts/provo-city`),
	]);
	const [stateDistrictBody, localDistrictBody] = await Promise.all([
		stateDistrictResponse.json(),
		localDistrictResponse.json(),
	]);

	assert.equal(stateDistrictResponse.status, 200);
	assert.equal(stateDistrictBody.district.slug, "state-house-60");
	assert.equal(stateDistrictBody.districtOriginLabel, "Reviewed state officeholder record");
	assert.equal(stateDistrictBody.representatives[0]?.slug, "tyler-clancy");
	assert.match(stateDistrictBody.representativeAvailabilityNote, /reviewed state officeholder record/i);
	assert.ok(stateDistrictBody.officialResources.length >= 1);

	assert.equal(localDistrictResponse.status, 200);
	assert.equal(localDistrictBody.district.slug, "provo-city");
	assert.equal(localDistrictBody.districtOriginLabel, "Reviewed local officeholder record");
	assert.equal(localDistrictBody.representatives[0]?.slug, "marsha-judkins");
	assert.match(localDistrictBody.representativeAvailabilityNote, /reviewed local officeholder record/i);
	assert.ok(localDistrictBody.officialResources.length >= 1);
});

test("lookup query backs /api/districts/:slug without relying on a saved cookie", async () => {
	const response = await fetch(`${baseUrl}/api/districts/congressional-3?lookup=84604`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.mode, "nationwide");
	assert.equal(body.district.slug, "congressional-3");
	assert.equal(body.representatives[0].slug, "mike-kennedy");
	assert.match(body.note, /API-backed nationwide district detail/i);
});

test("direct district routes return a canonical public record instead of a lookup-required placeholder", async () => {
	const response = await fetch(`${baseUrl}/api/districts/congressional-7`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.mode, "nationwide");
	assert.equal(body.district.slug, "congressional-7");
	assert.equal(body.districtOriginLabel, "Canonical district route");
	assert.match(body.district.title, /Congressional District 7/i);
	assert.doesNotMatch(body.districtOriginNote, /lookup context required/i);
});

test("provider-style statewide district routes return a public district identity instead of a lookup-required placeholder", async () => {
	const response = await fetch(`${baseUrl}/api/districts/senator-utah`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.mode, "nationwide");
	assert.equal(body.district.slug, "senator-utah");
	assert.equal(body.districtOriginLabel, "Provider-qualified district route");
	assert.match(body.district.title, /Utah statewide Senate seat/i);
	assert.equal(body.election.locationName, "Utah");
	assert.equal(body.officialResources.length, 2);
	assert.doesNotMatch(body.districtOriginNote, /lookup context required/i);
});

test("GET /api/representatives returns incumbents tied to district pages", async () => {
	const response = await fetch(`${baseUrl}/api/representatives`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.ok(body.representatives.some((item: { districtSlug: string; slug: string }) => item.districtSlug === "us-house-district-7" && item.slug === "daniel-brooks"));
	assert.ok(body.representatives.some((item: { href: string; slug: string }) => item.slug === "daniel-brooks" && item.href === "/representatives/daniel-brooks"));
	assert.ok(body.representatives.some((item: { slug: string; sourceCount: number; sources: Array<{ id: string }> }) => item.slug === "daniel-brooks" && item.sourceCount >= 1 && item.sources.length >= 1));
	assert.ok(body.districts.some((item: { href: string }) => item.href === "/districts/state-senate-district-12"));
	assert.match(body.note, /currently serving officials/i);
});

test("active nationwide lookup cookie backs /api/representatives and /api/representatives/:slug", async () => {
	const lookupResponse = await fetch(`${baseUrl}/api/location`, {
		body: JSON.stringify({ q: "84604" }),
		headers: {
			"Content-Type": "application/json"
		},
		method: "POST"
	});
	const cookie = lookupResponse.headers.get("set-cookie")?.split(";")[0];

	assert.equal(lookupResponse.status, 200);
	assert.ok(cookie);

	const listResponse = await fetch(`${baseUrl}/api/representatives`, {
		headers: {
			cookie: cookie || ""
		}
	});
	const listBody = await listResponse.json();

	assert.equal(listResponse.status, 200);
	assert.equal(listBody.mode, "nationwide");
	assert.ok(listBody.representatives.some((item: { fundingAvailable: boolean; href: string; influenceAvailable: boolean; slug: string }) => item.slug === "mike-kennedy" && item.href === "/representatives/mike-kennedy" && item.fundingAvailable && item.influenceAvailable));

	const representativeResponse = await fetch(`${baseUrl}/api/representatives/mike-kennedy`, {
		headers: {
			cookie: cookie || ""
		}
	});
	const representativeBody = await representativeResponse.json();

	assert.equal(representativeResponse.status, 200);
	assert.equal(representativeBody.person.slug, "mike-kennedy");
	assert.equal(representativeBody.person.provenance.source, "lookup");
	assert.ok(representativeBody.person.funding);
	assert.match(representativeBody.person.funding.summary, /MIKE KENNEDY FOR UTAH/i);
	assert.ok(representativeBody.person.lobbyingContext.length >= 1);
	assert.match(representativeBody.note, /active nationwide lookup context/i);
});

test("lookup query backs /api/representatives/:slug without relying on a saved cookie", async () => {
	const response = await fetch(`${baseUrl}/api/representatives/mike-kennedy?lookup=84604`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.person.slug, "mike-kennedy");
	assert.equal(body.person.provenance.source, "lookup");
	assert.ok(body.person.funding);
	assert.ok(body.person.lobbyingContext.length >= 1);
	assert.match(body.note, /active nationwide lookup context/i);
});

test("representatives without a reliable finance or influence crosswalk still return an honest unavailable profile state", async () => {
	const response = await fetch(`${baseUrl}/api/representatives/burgess-owens?lookup=84001&selection=zip:84001:orem-utah`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.person.slug, "burgess-owens");
	assert.equal(body.person.funding, null);
	assert.deepEqual(body.person.lobbyingContext, []);
	assert.match(body.person.whatWeDoNotKnow[0]?.text ?? "", /Finance and influence modules appear only when Ballot Clarity can verify a reliable person-level linkage/i);
});

test("direct representative routes return a stable provider-backed identity record instead of a lookup-required placeholder", async () => {
	const response = await fetch(`${baseUrl}/api/representatives/rich-mccormick`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.person.slug, "rich-mccormick");
	assert.equal(body.person.provenance.status, "crosswalked");
	assert.equal(body.person.provenance.label, "Congress.gov current officeholder record");
	assert.match(body.person.officeSought, /U\.S\. House, District 7/i);
	assert.match(body.person.districtLabel, /Congressional District 7/i);
	assert.doesNotMatch(body.person.officeholderLabel, /pending lookup context/i);
	assert.ok(body.person.funding);
	assert.match(body.person.funding.summary, /FRIENDS OF MCCORMICK/i);
	assert.equal(typeof body.person.funding.totalSpent, "number");
	assert.ok((body.person.funding.receiptBreakdown?.length ?? 0) > 0);
	assert.match(body.person.funding.coverageLabel ?? "", /cycle/i);
	assert.ok(body.person.lobbyingContext.length > 0);
	assert.match(body.person.lobbyingContext[0].summary, /LD-203/i);
	assert.ok(body.person.influence);
	assert.equal(typeof body.person.influence.totalMatched, "number");
	assert.ok((body.person.influence.topRegistrants?.length ?? 0) > 0);
	assert.ok(body.person.officeContext);
	assert.match(body.person.officeContext.currentTermLabel ?? "", /Congress/i);
	assert.ok((body.person.officeContext.referenceLinks?.length ?? 0) >= 2);
	assert.equal(body.person.enrichmentStatus?.funding.reasonCode, "attached");
	assert.equal(body.person.enrichmentStatus?.influence.reasonCode, "attached");
});

test("direct representative routes can resolve from federal providers even when Open States name lookup does not return a route match", async () => {
	const response = await fetch(`${baseUrl}/api/representatives/richard-mccormick`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.person.slug, "richard-mccormick");
	assert.equal(body.person.provenance.label, "Congress.gov current officeholder record");
	assert.equal(body.person.provenance.status, "crosswalked");
	assert.match(body.person.officeSought, /U\.S\. House, District 7/i);
	assert.match(body.person.districtLabel, /Congressional District 7/i);
	assert.ok(body.person.funding);
	assert.ok(body.person.lobbyingContext.length > 0);
	assert.equal(body.person.enrichmentStatus?.funding.reasonCode, "attached");
	assert.equal(body.person.enrichmentStatus?.influence.reasonCode, "attached");
});

test("direct senator routes attach federal funding, influence, and Congress office context when the crosswalk is reliable", async () => {
	const response = await fetch(`${baseUrl}/api/representatives/jon-ossoff`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.person.slug, "jon-ossoff");
	assert.equal(body.person.officialWebsiteUrl, "https://www.ossoff.senate.gov");
	assert.ok(body.person.funding);
	assert.match(body.person.funding.summary, /JON OSSOFF FOR SENATE/i);
	assert.ok(body.person.lobbyingContext.length > 0);
	assert.match(body.person.biography.map((item: { title: string }) => item.title).join(" "), /Congress\.gov office context/i);
	assert.ok(body.person.officeContext);
	assert.equal(body.person.officeContext.chamberLabel, "Senate");
	assert.equal(body.person.officeContext.jurisdictionLabel, "Georgia");
	assert.ok(body.person.officeContext.referenceLinks.some((item: { label: string }) => ["Congress member record", "Official office website"].includes(item.label)));
	assert.equal(body.person.enrichmentStatus?.funding.reasonCode, "attached");
	assert.equal(body.person.enrichmentStatus?.influence.reasonCode, "attached");
	assert.equal(body.person.enrichmentStatus?.legislativeContext.reasonCode, "attached");
});

test("state legislators expose a precise unavailable reason when federal finance and influence providers do not apply", async () => {
	const response = await fetch(`${baseUrl}/api/representatives/tyler-clancy`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.person.slug, "tyler-clancy");
	assert.equal(body.person.funding, null);
	assert.deepEqual(body.person.lobbyingContext, []);
	assert.equal(body.person.officeSought, "State House District 60");
	assert.equal(body.person.districtLabel, "State House District 60");
	assert.ok(body.person.officeContext);
	assert.equal(body.person.officeContext.chamberLabel, "State House");
	assert.equal(body.person.officeContext.districtLabel, "State House District 60");
	assert.equal(body.person.officeContext.jurisdictionLabel, "Utah");
	assert.equal(body.person.enrichmentStatus?.funding.reasonCode, "no_state_finance_source");
	assert.equal(body.person.enrichmentStatus?.influence.reasonCode, "no_state_disclosure_source");
	assert.equal(body.person.enrichmentStatus?.legislativeContext.reasonCode, "identity_only_provider");
	assert.equal(body.person.enrichmentStatus?.officeContext.reasonCode, "attached");
	assert.match(body.person.enrichmentStatus?.funding.summary ?? "", /state campaign-finance source configured/i);
	assert.match(body.person.enrichmentStatus?.legislativeContext.summary ?? "", /identity, chamber, party, and district context/i);
});

test("supplemental state and local officeholder routes resolve as stable public person records with precise unavailable-state reasons", async () => {
	const [stateResponse, localResponse] = await Promise.all([
		fetch(`${baseUrl}/api/representatives/keven-stratton`),
		fetch(`${baseUrl}/api/representatives/marsha-judkins`),
	]);
	const [stateBody, localBody] = await Promise.all([
		stateResponse.json(),
		localResponse.json(),
	]);

	assert.equal(stateResponse.status, 200);
	assert.equal(stateBody.person.slug, "keven-stratton");
	assert.match(stateBody.person.provenance.label, /Reviewed Open States officeholder snapshot/i);
	assert.equal(stateBody.person.officeSought, "State Senate District 24");
	assert.equal(stateBody.person.districtLabel, "State Senate District 24");
	assert.equal(stateBody.person.enrichmentStatus?.funding.reasonCode, "no_state_finance_source");
	assert.equal(stateBody.person.enrichmentStatus?.influence.reasonCode, "no_state_disclosure_source");
	assert.ok(["identity_only_provider", "no_state_legislative_source"].includes(stateBody.person.enrichmentStatus?.legislativeContext.reasonCode));
	assert.ok(stateBody.person.officeContext);
	assert.equal(stateBody.person.officeContext.chamberLabel, "State Senate");
	assert.equal(stateBody.person.officeContext.districtLabel, "State Senate District 24");
	assert.equal(stateBody.person.officeContext.jurisdictionLabel, "Utah");
	assert.equal(stateBody.person.officialWebsiteUrl, undefined);
	assert.match(stateBody.person.summary, /Utah Senate District 24/i);
	assert.ok(stateBody.person.biography.some((item: { title: string }) => /reviewed/i.test(item.title)));
	assert.ok(stateBody.person.sources.some((item: { sourceSystem?: string }) => /Open States officeholder snapshot/i.test(item.sourceSystem ?? "")));

	assert.equal(localResponse.status, 200);
	assert.equal(localBody.person.slug, "marsha-judkins");
	assert.equal(localBody.person.provenance.label, "Official mayor's office page");
	assert.equal(localBody.person.officeSought, "Mayor");
	assert.equal(localBody.person.districtLabel, "Provo city");
	assert.ok(localBody.person.officeContext);
	assert.equal(localBody.person.officeContext.chamberLabel, "City government");
	assert.equal(localBody.person.officeContext.jurisdictionLabel, "Provo, Utah");
	assert.match(localBody.person.officeContext.currentTermLabel ?? "", /January 2026/i);
	assert.equal(localBody.person.officialWebsiteUrl, "https://www.provo.gov/433/Mayors-Office");
	assert.equal(localBody.person.enrichmentStatus?.funding.reasonCode, "attached");
	assert.equal(localBody.person.enrichmentStatus?.influence.reasonCode, "no_local_disclosure_source");
	assert.equal(localBody.person.enrichmentStatus?.legislativeContext.reasonCode, "attached");
	assert.ok(localBody.person.funding);
	assert.equal(localBody.person.funding.totalRaised, 63522.39);
	assert.equal(localBody.person.funding.cashOnHand, 954.76);
	assert.ok(localBody.person.keyActions.length > 0);
	assert.match(localBody.person.summary, /current Provo mayor/i);
});

test("state representative routes merge reviewed state-officeholder sources into the public profile", async () => {
	const response = await fetch(`${baseUrl}/api/representatives/scott-hilton`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.person.slug, "scott-hilton");
	assert.equal(body.person.governmentLevel, "state");
	assert.equal(body.person.officeType, "state_house");
	assert.equal(body.person.officeDisplayLabel, "Georgia State Representative for District 48");
	assert.equal(body.person.officeSought, "State House District 48");
	assert.equal(body.person.districtLabel, "State House District 48");
	assert.ok(body.person.officeContext);
	assert.equal(body.person.officeContext.chamberLabel, "State House");
	assert.equal(body.person.officeContext.jurisdictionLabel, "Georgia");
	assert.equal(body.person.enrichmentStatus?.funding.reasonCode, "no_state_finance_source");
	assert.equal(body.person.enrichmentStatus?.influence.reasonCode, "attached");
	assert.equal(body.person.enrichmentStatus?.legislativeContext.reasonCode, "attached");
	assert.ok(body.person.keyActions.length >= 2);
	assert.ok(body.person.lobbyingContext.length > 0);
	assert.ok(body.person.influence);
	assert.ok(body.person.officeContext.committeeMemberships?.includes("Chairman, Information & Audits"));
	assert.ok(body.person.biography.some((item: { title: string }) => /reviewed/i.test(item.title)));
	assert.ok(
		body.person.provenance.label.toLowerCase().includes("reviewed")
		|| body.person.freshness.statusLabel.toLowerCase().includes("reviewed"),
	);
});

test("state senator routes merge reviewed official state sources without drifting into the federal route model", async () => {
	const response = await fetch(`${baseUrl}/api/representatives/shawn-still`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.person.slug, "shawn-still");
	assert.equal(body.person.governmentLevel, "state");
	assert.equal(body.person.officeType, "state_senate");
	assert.equal(body.person.officeDisplayLabel, "Georgia State Senator for District 48");
	assert.equal(body.person.officeSought, "State Senate District 48");
	assert.equal(body.person.districtLabel, "State Senate District 48");
	assert.ok(body.person.officeContext);
	assert.equal(body.person.officeContext.chamberLabel, "State Senate");
	assert.equal(body.person.officeContext.jurisdictionLabel, "Georgia");
	assert.equal(body.person.enrichmentStatus?.funding.reasonCode, "no_state_finance_source");
	assert.equal(body.person.enrichmentStatus?.influence.reasonCode, "no_state_disclosure_source");
	assert.equal(body.person.enrichmentStatus?.legislativeContext.reasonCode, "attached");
	assert.ok(body.person.keyActions.length >= 2);
	assert.ok(body.person.topIssues.length >= 2);
	assert.ok(body.person.officeContext.committeeMemberships?.includes("Judiciary"));
	assert.ok(body.person.biography.some((item: { title: string }) => /reviewed/i.test(item.title)));
	assert.ok(body.person.sources.some((item: { sourceSystem?: string }) => /Georgia General Assembly member bio/i.test(item.sourceSystem ?? "")));
	assert.doesNotMatch(body.person.officeSought, /U\.S\. Senate/i);
});

test("county and city officeholder routes expose normalized office context and precise local unavailable reasons", async () => {
	const [countyResponse, cityResponse] = await Promise.all([
		fetch(`${baseUrl}/api/representatives/robb-pitts`),
		fetch(`${baseUrl}/api/representatives/john-bradberry`),
	]);
	const [countyBody, cityBody] = await Promise.all([countyResponse.json(), cityResponse.json()]);

	assert.equal(countyResponse.status, 200);
	assert.equal(countyBody.person.slug, "robb-pitts");
	assert.equal(countyBody.person.governmentLevel, "county");
	assert.equal(countyBody.person.officeType, "county_commission");
	assert.equal(countyBody.person.officeDisplayLabel, "Fulton County Commission Chair");
	assert.ok(countyBody.person.officeContext);
	assert.equal(countyBody.person.officeContext.chamberLabel, "County commission");
	assert.equal(countyBody.person.officeContext.jurisdictionLabel, "Fulton County, Georgia");
	assert.equal(countyBody.person.enrichmentStatus?.funding.reasonCode, "no_local_finance_source");
	assert.equal(countyBody.person.enrichmentStatus?.influence.reasonCode, "no_local_disclosure_source");
	assert.equal(countyBody.person.enrichmentStatus?.legislativeContext.reasonCode, "attached");
	assert.ok(countyBody.person.keyActions.length >= 2);
	assert.match(countyBody.person.officeContext.currentTermLabel ?? "", /2023/);

	assert.equal(cityResponse.status, 200);
	assert.equal(cityBody.person.slug, "john-bradberry");
	assert.equal(cityBody.person.governmentLevel, "city");
	assert.equal(cityBody.person.officeType, "mayor");
	assert.equal(cityBody.person.officeDisplayLabel, "Mayor of Johns Creek");
	assert.ok(cityBody.person.officeContext);
	assert.equal(cityBody.person.officeContext.chamberLabel, "City government");
	assert.equal(cityBody.person.officeContext.jurisdictionLabel, "Johns Creek, Georgia");
	assert.equal(cityBody.person.enrichmentStatus?.legislativeContext.reasonCode, "attached");
	assert.equal(cityBody.person.enrichmentStatus?.funding.reasonCode, "no_local_finance_source");
	assert.equal(cityBody.person.enrichmentStatus?.influence.reasonCode, "no_local_disclosure_source");
	assert.ok(cityBody.person.keyActions.length >= 2);
});

test("direct representative routes degrade to a public fallback instead of 500 when the provider route lookup fails", async () => {
	const response = await fetch(`${baseUrl}/api/representatives/quota-limited`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.person.slug, "quota-limited");
	assert.equal(body.person.funding, null);
	assert.deepEqual(body.person.lobbyingContext, []);
	assert.equal(body.person.provenance.status, "inferred");
	assert.match(body.person.summary, /keeps the person identity stable/i);
	assert.match(body.person.whatWeKnow[0]?.text ?? "", /identity-stable/i);
});

test("GET /api/representatives/:slug returns a source-backed representative profile", async () => {
	const response = await fetch(`${baseUrl}/api/representatives/daniel-brooks`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.person.slug, "daniel-brooks");
	assert.equal(body.person.officeholderLabel, "Current officeholder");
	assert.equal(body.person.provenance.status, "direct");
	assert.equal(body.person.funding.provenanceLabel, "Source-backed published filing summary");
	assert.ok(body.person.lobbyingContext.length >= 1);
	assert.ok(body.person.sources.length >= body.person.funding.sources.length);
});

test("GET /api/ballot returns 404 for unknown elections", async () => {
	const response = await fetch(`${baseUrl}/api/ballot?election=not-real`);
	const body = await response.json();

	assert.equal(response.status, 404);
	assert.match(body.message, /Ballot not found/);
});

test("GET /api/candidates/:slug returns a source-backed candidate profile", async () => {
	const response = await fetch(`${baseUrl}/api/candidates/elena-torres`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.slug, "elena-torres");
	assert.equal(body.officeSought, "U.S. House, District 7");
	assert.ok(body.sources.length >= 4);
	assert.equal(body.freshness.status, "up-to-date");
	assert.equal(body.whatWeKnow.length, 2);
	assert.ok(body.whatWeKnow[0].sources.length >= 1);
	assert.equal(body.sources[0].authority, "official-government");
	assert.ok(body.sources[0].sourceSystem);
});

test("GET /api/measures/:slug returns a ballot measure profile", async () => {
	const response = await fetch(`${baseUrl}/api/measures/charter-amendment-a`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.slug, "charter-amendment-a");
	assert.match(body.yesMeaning, /YES vote/);
	assert.match(body.currentLawOverview, /state public-records law/i);
	assert.equal(body.currentPractice.length, 2);
	assert.equal(body.proposedChanges.length, 3);
	assert.equal(body.yesHighlights.length, 3);
	assert.equal(body.noHighlights.length, 3);
	assert.equal(body.implementationTimeline.length, 3);
	assert.equal(body.fiscalSummary.length, 3);
	assert.equal(body.supportArguments.length, 2);
	assert.equal(body.opposeArguments.length, 2);
	assert.match(body.supportArguments[0].attribution, /Supporters/);
	assert.match(body.argumentsDisclaimer, /not Ballot Clarity endorsements/i);
	assert.equal(body.freshness.status, "up-to-date");
	assert.equal(body.whatWeDoNotKnow.length, 2);
});

test("GET /api/compare limits compare results and preserves a shared office when applicable", async () => {
	const response = await fetch(`${baseUrl}/api/compare?slugs=elena-torres,daniel-brooks,sandra-patel,naomi-park`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.deepEqual(body.requestedSlugs, ["elena-torres", "daniel-brooks", "sandra-patel"]);
	assert.equal(body.candidates.length, 3);
	assert.equal(body.sameContest, false);
	assert.equal(body.contestSlug, null);
	assert.equal(body.office, null);
	assert.match(body.note, /informational only/i);
});

test("GET /api/compare returns a same-contest questionnaire-first comparison payload", async () => {
	const response = await fetch(`${baseUrl}/api/compare?slugs=elena-torres,daniel-brooks`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.deepEqual(body.requestedSlugs, ["elena-torres", "daniel-brooks"]);
	assert.equal(body.sameContest, true);
	assert.equal(body.contestSlug, "us-house-district-7");
	assert.equal(body.office, "U.S. House, District 7");
	assert.equal(body.candidates.length, 2);
	assert.equal(body.candidates[0].comparison.ballotStatus.label, "On ballot (verified)");
	assert.equal(body.candidates[0].comparison.questionnaireResponses.length, 3);
	assert.equal(body.candidates[1].comparison.questionnaireResponses[2].responseStatus, "no-response");
	assert.match(body.note, /do not rank candidates/i);
});

test("GET /api/search includes contest results when a contest office matches", async () => {
	const response = await fetch(`${baseUrl}/api/search?q=School Board`);
	const body = await response.json();
	const contestGroup = body.groups.find((group: { type: string }) => group.type === "contest");

	assert.equal(response.status, 200);
	assert.ok(contestGroup);
	assert.ok(contestGroup.items.some((item: { href: string }) => item.href === "/contest/county-school-board-at-large"));
});

test("GET /api/search includes district results when a district office matches", async () => {
	const response = await fetch(`${baseUrl}/api/search?q=District 7`);
	const body = await response.json();
	const districtGroup = body.groups.find((group: { type: string }) => group.type === "district");

	assert.equal(response.status, 200);
	assert.ok(districtGroup);
	assert.ok(districtGroup.items.some((item: { href: string }) => item.href === "/districts/us-house-district-7"));
});

test("GET /api/sources and /api/sources/:id include contest citations", async () => {
	const directoryResponse = await fetch(`${baseUrl}/api/sources`);
	const directoryBody = await directoryResponse.json();
	const sourceWithContestCitation = directoryBody.sources.find((item: { citedBy: Array<{ type: string }> }) => item.citedBy.some(citation => citation.type === "contest"));

	assert.equal(directoryResponse.status, 200);
	assert.ok(sourceWithContestCitation);

	const recordResponse = await fetch(`${baseUrl}/api/sources/${sourceWithContestCitation.id}`);
	const recordBody = await recordResponse.json();

	assert.equal(recordResponse.status, 200);
	assert.ok(recordBody.source.citedBy.some((citation: { type: string }) => citation.type === "contest"));
});

test("GET /api/sources publishes stable representative and district route provenance records", async () => {
	const directoryResponse = await fetch(`${baseUrl}/api/sources`);
	const directoryBody = await directoryResponse.json();
	const shawnSource = directoryBody.sources.find((item: { id: string }) => item.id === "supplemental:shawn-still:bio");
	const districtIdentitySource = directoryBody.sources.find((item: { id: string }) => item.id === "district:state-senate-48:identity");

	assert.equal(directoryResponse.status, 200);
	assert.ok(shawnSource);
	assert.equal(shawnSource.publicationKind, "published-provenance");
	assert.ok(shawnSource.citedBy.some((citation: { href: string }) => citation.href === "/representatives/shawn-still"));
	assert.ok(shawnSource.citedBy.some((citation: { href: string }) => citation.href === "/districts/state-senate-48"));

	assert.ok(districtIdentitySource);
	assert.equal(districtIdentitySource.publicationKind, "published-provenance");
	assert.ok(districtIdentitySource.citedBy.some((citation: { href: string }) => citation.href === "/districts/state-senate-48"));
});

test("GET /api/sources/:id resolves curated global source records", async () => {
	const response = await fetch(`${baseUrl}/api/sources/open-states`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.source.id, "open-states");
	assert.equal(body.source.publicationKind, "curated-global");
	assert.equal(body.source.publisherType, "public-interest");
	assert.ok(body.source.routeFamilies.includes("Representative pages"));
	assert.ok(body.source.limitations.length > 0);
});

test("GET /api/sources/:id resolves intentionally published route-backed provenance records", async () => {
	const response = await fetch(`${baseUrl}/api/sources/supplemental:shawn-still:bio`);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.source.id, "supplemental:shawn-still:bio");
	assert.equal(body.source.publicationKind, "published-provenance");
	assert.ok(body.source.citedBy.some((citation: { href: string }) => citation.href === "/representatives/shawn-still"));
	assert.ok(body.source.citedBy.some((citation: { href: string }) => citation.href === "/districts/state-senate-48"));
});

test("GET /api/sources/:id returns 404 for unpublished district provenance ids", async () => {
	const response = await fetch(`${baseUrl}/api/sources/district:state-senate-48`);
	const body = await response.json();

	assert.equal(response.status, 404);
	assert.match(body.message, /Source record not found/i);
});

test("GET /api/sources only lists ids that resolve as public source records", async () => {
	const directoryResponse = await fetch(`${baseUrl}/api/sources`);
	const directoryBody = await directoryResponse.json();

	assert.equal(directoryResponse.status, 200);
	assert.ok(Array.isArray(directoryBody.sources));
	assert.ok(directoryBody.sources.some((item: { id: string }) => item.id === "census-geocoder"));
	assert.ok(!directoryBody.sources.some((item: { id: string }) => item.id === "district:state-senate-48"));

	for (const item of directoryBody.sources as Array<{ id: string }>) {
		const recordResponse = await fetch(`${baseUrl}/api/sources/${item.id}`);

		assert.equal(recordResponse.status, 200, `expected published source ${item.id} to resolve`);
	}
});

test("GET /api/admin/overview rejects unauthenticated access", async () => {
	const response = await fetch(`${baseUrl}/api/admin/overview`);
	const body = await response.json();

	assert.equal(response.status, 401);
	assert.match(body.message, /Unauthorized admin request/i);
});

test("GET /api/admin/overview returns operational metrics for authorized requests", async () => {
	const response = await fetch(`${baseUrl}/api/admin/overview`, {
		headers: {
			"x-admin-api-key": adminApiKey
		}
	});
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.metrics.length, 4);
	assert.equal(body.metrics[0].label, "Open corrections");
	assert.ok(body.needsAttention.length >= 2);
	assert.equal(body.recentActivity[0].type, "publish");
});

test("GET /api/admin/review and /api/admin/sources return protected operational queues", async () => {
	const [reviewResponse, sourcesResponse] = await Promise.all([
		fetch(`${baseUrl}/api/admin/review`, {
			headers: {
				"x-admin-api-key": adminApiKey
			}
		}),
		fetch(`${baseUrl}/api/admin/sources`, {
			headers: {
				"x-admin-api-key": adminApiKey
			}
		})
	]);
	const reviewBody = await reviewResponse.json();
	const sourcesBody = await sourcesResponse.json();
	const electionItem = reviewBody.items.find((item: { entityType: string; title: string }) => item.entityType === "election");
	const blockedCandidate = reviewBody.items.find((item: { blocker?: string; entityType: string }) => item.entityType === "candidate" && item.blocker);
	const officialSourceLabels = sourcesBody.sources
		.filter((item: { authority: string }) => item.authority === "official-government")
		.map((item: { label: string }) => item.label);
	const incidentSource = sourcesBody.sources.find((item: { health: string }) => item.health === "incident");

	assert.equal(reviewResponse.status, 200);
	assert.equal(sourcesResponse.status, 200);
	assert.equal(electionItem?.title, "Fulton County launch coverage profile");
	assert.match(blockedCandidate?.blocker || "", /crosswalk/i);
	assert.ok(officialSourceLabels.includes("Fulton County Registration and Elections site"));
	assert.equal(incidentSource?.health, "incident");
});

test("PATCH /api/admin/content updates public content fields and publish gating", async () => {
	const isolatedServer = (await createApp({
		adminApiKey,
		activitySeed,
		adminDbPath: ":memory:",
		contentSeed,
		coverageRepository: {
			data: coverageSnapshot,
			getCandidateBySlug(slug) {
				return coverageSnapshot.candidates.find(candidate => candidate.slug === slug) ?? null;
			},
			getCandidatesBySlugs(slugs) {
				const requested = new Set(slugs);
				return coverageSnapshot.candidates.filter(candidate => requested.has(candidate.slug));
			},
			getElectionBySlug(slug) {
				return coverageSnapshot.election?.slug === slug ? coverageSnapshot.election : null;
			},
			getJurisdictionBySlug(slug) {
				return coverageSnapshot.jurisdiction?.slug === slug ? coverageSnapshot.jurisdiction : null;
			},
			getMeasureBySlug(slug) {
				return coverageSnapshot.measures.find(measure => measure.slug === slug) ?? null;
			},
			getSourceById(id) {
				return coverageSnapshot.sources.find(source => source.id === id) ?? null;
			},
			mode: "snapshot",
			snapshotPath: ":memory:"
		},
		correctionSeed,
		sourceMonitorSeed
	})).listen(0, "127.0.0.1");

	await once(isolatedServer, "listening");
	const isolatedAddress = isolatedServer.address() as AddressInfo;
	const isolatedBaseUrl = `http://127.0.0.1:${isolatedAddress.port}`;

	try {
		const contentResponse = await fetch(`${isolatedBaseUrl}/api/admin/content`, {
			headers: {
				"x-admin-api-key": adminApiKey
			}
		});
		const contentBody = await contentResponse.json();
		const elenaRecord = contentBody.items.find((item: { entitySlug: string }) => item.entitySlug === "elena-torres");

		assert.equal(contentResponse.status, 200);
		assert.equal(typeof elenaRecord?.publicSummary, "string");
		assert.equal(typeof elenaRecord?.publicBallotSummary, "string");

		const updatedSummary = "Updated public summary for production editorial testing.";
		const updatedBallotSummary = "Updated short ballot summary for editorial control.";

		const patchResponse = await fetch(`${isolatedBaseUrl}/api/admin/content/content-elena-torres`, {
			body: JSON.stringify({
				publicBallotSummary: updatedBallotSummary,
				publicSummary: updatedSummary,
				published: true,
				status: "published"
			}),
			headers: {
				"Content-Type": "application/json",
				"x-admin-api-key": adminApiKey
			},
			method: "PATCH"
		});

		assert.equal(patchResponse.status, 200);

		const candidateResponse = await fetch(`${isolatedBaseUrl}/api/candidates/elena-torres`);
		const candidateBody = await candidateResponse.json();

		assert.equal(candidateResponse.status, 200);
		assert.equal(candidateBody.summary, updatedSummary);
		assert.equal(candidateBody.ballotSummary, updatedBallotSummary);

		const unpublishResponse = await fetch(`${isolatedBaseUrl}/api/admin/content/content-elena-torres`, {
			body: JSON.stringify({
				published: false,
				status: "draft"
			}),
			headers: {
				"Content-Type": "application/json",
				"x-admin-api-key": adminApiKey
			},
			method: "PATCH"
		});

		assert.equal(unpublishResponse.status, 200);

		const hiddenCandidateResponse = await fetch(`${isolatedBaseUrl}/api/candidates/elena-torres`);
		const ballotResponse = await fetch(`${isolatedBaseUrl}/api/ballot?election=2026-fulton-county-general`);
		const ballotBody = await ballotResponse.json();
		const houseContest = ballotBody.election.contests.find((contest: { slug: string }) => contest.slug === "us-house-district-7");

		assert.equal(hiddenCandidateResponse.status, 404);
		assert.equal(ballotResponse.status, 200);
		assert.equal(houseContest.candidates.length, 1);
		assert.equal(houseContest.candidates[0].slug, "daniel-brooks");
	}
	finally {
		await new Promise<void>((resolve, reject) => {
			isolatedServer.close(error => error ? reject(error) : resolve());
		});
	}
});

test("POST /api/admin/auth/login authenticates a configured user and throttles repeated failures", async () => {
	const isolatedServer = (await createApp({
		adminApiKey,
		adminDbPath: ":memory:",
		bootstrapDisplayName: "Operations Admin",
		bootstrapPassword: "correct-horse-battery-staple",
		bootstrapUsername: "ops-admin"
	})).listen(0, "127.0.0.1");

	await once(isolatedServer, "listening");
	const isolatedAddress = isolatedServer.address() as AddressInfo;
	const isolatedBaseUrl = `http://127.0.0.1:${isolatedAddress.port}`;

	try {
		const successResponse = await fetch(`${isolatedBaseUrl}/api/admin/auth/login`, {
			body: JSON.stringify({
				password: "correct-horse-battery-staple",
				username: "ops-admin"
			}),
			headers: {
				"Content-Type": "application/json",
				"x-forwarded-for": "203.0.113.10"
			},
			method: "POST"
		});
		const successBody = await successResponse.json();

		assert.equal(successResponse.status, 200);
		assert.equal(successBody.authenticated, true);
		assert.equal(successBody.username, "ops-admin");

		for (let index = 0; index < 5; index += 1) {
			const failureResponse = await fetch(`${isolatedBaseUrl}/api/admin/auth/login`, {
				body: JSON.stringify({
					password: "wrong-password",
					username: "ops-admin"
				}),
				headers: {
					"Content-Type": "application/json",
					"x-forwarded-for": "203.0.113.10"
				},
				method: "POST"
			});

			assert.equal(failureResponse.status, 401);
		}

		const throttledResponse = await fetch(`${isolatedBaseUrl}/api/admin/auth/login`, {
			body: JSON.stringify({
				password: "wrong-password",
				username: "ops-admin"
			}),
			headers: {
				"Content-Type": "application/json",
				"x-forwarded-for": "203.0.113.10"
			},
			method: "POST"
		});
		const throttledBody = await throttledResponse.json();

		assert.equal(throttledResponse.status, 429);
		assert.match(throttledBody.message, /Too many failed admin login attempts/i);
		assert.ok(Number(throttledResponse.headers.get("retry-after")) >= 1);
	}
	finally {
		await new Promise<void>((resolve, reject) => {
			isolatedServer.close(error => error ? reject(error) : resolve());
		});
	}
});
