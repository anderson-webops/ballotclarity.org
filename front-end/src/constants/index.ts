export const appName = "Ballot Clarity";
export const appDescription = "A nonpartisan civic-information platform that helps voters review ballot choices, candidate records, ballot measures, and source material without overload.";
// The dedicated and central Umami databases intentionally share this Ballot Clarity website UUID.
export const analyticsTrackers = [
	{
		domain: "analytics.ballotclarity.org",
		label: "dedicated",
		websiteId: "98d97870-5812-4931-9e2d-4ae2f55484cb"
	},
	{
		domain: "analytics.jacobdanderson.net",
		label: "central",
		websiteId: "98d97870-5812-4931-9e2d-4ae2f55484cb"
	}
] as const;
export const analyticsDomain = analyticsTrackers[0].domain;
export const analyticsWebsiteId = analyticsTrackers[0].websiteId;
export const centralAnalyticsDomain = analyticsTrackers[1].domain;
export const centralAnalyticsWebsiteId = analyticsTrackers[1].websiteId;
