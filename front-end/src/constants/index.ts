export const appName = "Ballot Clarity";
export const appDescription = "A nonpartisan civic-information site for looking up current representatives, election resources, published ballot records, and source material without overload.";
export const appSocialImagePath = "/social-card.svg";
export const appSocialImageAlt = "Ballot Clarity preview card with the site name and a short civic-information summary.";
export const analyticsTrackers = [
	{
		domain: "analytics.ballotclarity.org",
		label: "dedicated",
		websiteId: "98d97870-5812-4931-9e2d-4ae2f55484cb"
	}
] as const;
export const analyticsDomain = analyticsTrackers[0].domain;
export const analyticsWebsiteId = analyticsTrackers[0].websiteId;
