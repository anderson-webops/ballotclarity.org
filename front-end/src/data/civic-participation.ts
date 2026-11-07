export interface ParticipationResource {
	href: string;
	label: string;
	publisher: string;
}

export interface ParticipationSection {
	id: string;
	links: ParticipationResource[];
	steps: string[];
	summary: string;
	title: string;
}

export interface ParticipationGuide {
	groups: Array<{
		sections: ParticipationSection[];
		title: string;
	}>;
	slug: string;
	summary: string;
	title: string;
}

export const participationReviewedAt = "2026-11-06T23:58:10Z";

export const participationResources = {
	boards: {
		href: "https://fultoncountyga.gov/home/commissioners/clerk-to-the-commission/boards-and-authorities",
		label: "Boards directory",
		publisher: "Fulton County"
	},
	democrats: {
		href: "https://fultondems.org/our-party/",
		label: "Membership and bylaws",
		publisher: "Fulton County Democrats"
	},
	democratEvents: {
		href: "https://fultondems.org/events/",
		label: "Meeting calendar",
		publisher: "Fulton County Democrats"
	},
	democratRegions: {
		href: "https://fultondems.org/regions/",
		label: "Regional chapters",
		publisher: "Fulton County Democrats"
	},
	electionOffice: {
		href: "https://www.usa.gov/state-election-office",
		label: "Find your election office",
		publisher: "USAGov"
	},
	federalCandidates: {
		href: "https://www.fec.gov/help-candidates-and-committees/registering-candidate/",
		label: "Federal candidate requirements",
		publisher: "Federal Election Commission"
	},
	fultonAgendas: {
		href: "https://fultoncountyga.gov/Commissioners/Agenda-Minutes",
		label: "Agendas and minutes",
		publisher: "Fulton County"
	},
	fultonMeetings: {
		href: "https://fultoncountyga.gov/Commissioners/Clerk-to-the-Commission/Board-of-Commissioners-Meeting-Schedule",
		label: "Commission meeting schedule",
		publisher: "Fulton County"
	},
	fultonParticipation: {
		href: "https://www.fultoncountyga.gov/commissioners",
		label: "Public comment rules",
		publisher: "Fulton County"
	},
	fultonPollWorkers: {
		href: "https://fultoncountyga.gov/Inside-Fulton-County/Fulton-County-Departments/Registration-and-Elections/Become-a-Poll-Worker",
		label: "Poll worker application",
		publisher: "Fulton County"
	},
	georgiaCandidates: {
		href: "https://sos.ga.gov/candidate-qualifying-elected-office",
		label: "Candidate qualifying",
		publisher: "Georgia Secretary of State"
	},
	libertarians: {
		href: "https://lpgeorgia.com/about/affiliates/fulton/",
		label: "Fulton affiliate contact",
		publisher: "Libertarian Party of Georgia"
	},
	libertarianEvents: {
		href: "https://lpgeorgia.com/get-involved/events/",
		label: "Event calendar",
		publisher: "Libertarian Party of Georgia"
	},
	localGovernment: {
		href: "https://www.usa.gov/local-governments",
		label: "Find your local government",
		publisher: "USAGov"
	},
	pollWorkers: {
		href: "https://www.eac.gov/help-america-vote",
		label: "Poll worker requirements",
		publisher: "U.S. Election Assistance Commission"
	},
	precinct: {
		href: "https://mvp.sos.ga.gov/s/",
		label: "Find your precinct",
		publisher: "Georgia Secretary of State"
	},
	republicans: {
		href: "https://fultongagop.org/conventions",
		label: "Precinct and convention process",
		publisher: "Fulton County Republican Party"
	},
	republicanEvents: {
		href: "https://fultongagop.org/events",
		label: "Event calendar",
		publisher: "Fulton County Republican Party"
	}
} satisfies Record<string, ParticipationResource>;

const resources = participationResources;

export const participationGuides: ParticipationGuide[] = [
	{
		slug: "meetings",
		summary: "Public meetings, party gatherings, and ways to speak.",
		title: "Attend a meeting",
		groups: [
			{
				title: "Anywhere in the U.S.",
				sections: [{
					id: "public-meetings",
					title: "Public meetings",
					summary: "City councils, county commissions, and school boards discuss and decide local issues.",
					steps: [
						"Find the body responsible for your issue and open its current meeting notice and agenda.",
						"Check the venue or online access, accessibility arrangements, and public-comment registration deadline.",
						"To speak, follow that body’s registration and time limits. Identify the agenda item and the action you want considered.",
						"Follow the decision through the minutes, recording, and next agenda."
					],
					links: [resources.localGovernment]
				}]
			},
			{
				title: "Fulton County, Georgia",
				sections: [
					{
						id: "county-commission",
						title: "County commission",
						summary: "Residents can comment in person or virtually. The county requires requests before the meeting is called to order.",
						steps: ["Use the dated meeting notice for the location and start time, then the public-comment rules to register."],
						links: [resources.fultonMeetings, resources.fultonParticipation, resources.fultonAgendas]
					},
					{
						id: "democratic-meetings",
						title: "Democratic meetings",
						summary: "General members can attend and contribute; voting committee seats follow a separate selection process.",
						steps: ["Find your regional chapter and a dated event notice. Check visitor access and RSVP requirements with the organizer."],
						links: [resources.democratEvents, resources.democratRegions]
					},
					{
						id: "libertarian-meetings",
						title: "Libertarian meetings",
						summary: "The state party lists a Fulton affiliate with a local contact and event calendar.",
						steps: ["Use the event notice for the date, venue, and admission rules. Ask the affiliate about membership and local business meetings."],
						links: [resources.libertarianEvents, resources.libertarians]
					},
					{
						id: "republican-meetings",
						title: "Republican meetings",
						summary: "The calendar includes social events and party business. Precinct officer and delegate selection require the appropriate meeting call.",
						steps: ["Check the notice for registration, guest access, any charge, and whether officers or delegates will be selected."],
						links: [resources.republicanEvents, resources.republicans]
					}
				]
			}
		]
	},
	{
		slug: "serve",
		summary: "Party committees, government boards, and election work.",
		title: "Serve locally",
		groups: [
			{
				title: "Anywhere in the U.S.",
				sections: [{
					id: "election-worker",
					title: "Election worker",
					summary: "Help the election office prepare polling places, check in voters, and issue ballots.",
					steps: [
						"Use the recruitment lookup for local eligibility, training, hours, and pay, then apply to the election office.",
						"Complete the required training and assigned shifts. Follow the office’s procedures for assisting voters and handling election materials."
					],
					links: [resources.pollWorkers]
				}]
			},
			{
				title: "Fulton County, Georgia",
				sections: [
					{
						id: "democratic-post-seats",
						title: "Democratic post seats",
						summary: "Post seat holders are voting members of the county party committee, representing commission districts or the at-large district.",
						steps: [
							"Ask the county party which post covers your district and for current residence, membership, and nomination requirements.",
							"Follow the announced caucus process or ask about a vacant seat. General membership alone does not confer a committee vote.",
							"If selected, confirm your term and attendance duties, participate in committee votes, and learn the agenda and resolution procedures."
						],
						links: [resources.democrats]
					},
					{
						id: "libertarian-roles",
						title: "Libertarian party roles",
						summary: "The Fulton affiliate lists local officers and a contact form.",
						steps: [
							"Ask the affiliate about volunteer assignments or officer positions, eligibility, membership or dues, and its current selection rules.",
							"Before accepting a role, confirm the selection meeting, nomination process, term, meeting attendance, and assigned work."
						],
						links: [resources.libertarians]
					},
					{
						id: "republican-precincts",
						title: "Republican precinct roles",
						summary: "Precinct officers organize the local party. Convention delegates vote on party business and select delegates for later conventions.",
						steps: [
							"Find your precinct and request the current mass-meeting call. The county’s process requires party officers to be registered Fulton voters and dues-paying members.",
							"Confirm registration, affiliation requirements, and nominations. Officers and county-convention delegates are selected at precinct meetings; later delegate selection occurs at the county convention.",
							"If selected, confirm the term, meeting calendar, credentialing, and duties for your particular office or convention."
						],
						links: [resources.republicans, resources.precinct]
					},
					{
						id: "government-board",
						title: "Government boards",
						summary: "Serve on a board or authority with responsibilities set by its governing rules.",
						steps: [
							"Choose a body in the county directory. Ask its contact or the clerk about a current vacancy, the appointing authority, qualifications, and application.",
							"Confirm the term, meeting schedule, preparation time, and disclosure or conflict-of-interest duties before accepting an appointment."
						],
						links: [resources.boards]
					},
					{
						id: "fulton-poll-worker",
						title: "Fulton election work",
						summary: "Apply through the county election department for election-worker assignments and training.",
						steps: ["Confirm eligibility, training dates, pay, and the full shift commitment with the county before accepting an assignment."],
						links: [resources.fultonPollWorkers]
					}
				]
			}
		]
	},
	{
		slug: "run",
		summary: "Office qualifications, ballot access, and campaign obligations.",
		title: "Run for office",
		groups: [
			{
				title: "Anywhere in the U.S.",
				sections: [
					{
						id: "choose-office",
						title: "Choose the office",
						summary: "An elected government office has its own qualifications, election schedule, and filing authority.",
						steps: [
							"Identify the office, district, term, and next election with the responsible election authority.",
							"Confirm residence, age, and other qualifications. Obtain the current candidate packet and identify the party, independent, nonpartisan, or write-in route that applies.",
							"Record the required forms, filing location, fees or petitions, and deadlines. Submit the required materials and keep confirmation of receipt."
						],
						links: [resources.electionOffice]
					},
					{
						id: "federal-campaigns",
						title: "Federal campaigns",
						summary: "Federal candidates have FEC registration and reporting obligations alongside state ballot-access requirements.",
						steps: ["Review committee, treasurer, recordkeeping, and reporting requirements before raising or spending campaign funds."],
						links: [resources.federalCandidates]
					}
				]
			},
			{
				title: "Georgia",
				sections: [{
					id: "georgia-qualifying",
					title: "Qualifying and disclosure",
					summary: "The Secretary of State links office qualifications, filing locations, fees, petitions, and candidate forms.",
					steps: [
						"Confirm the requirements and next qualifying period for your specific office with the listed authority.",
						"Use the linked State Ethics Commission guidance for applicable declarations, contribution reports, and financial disclosures.",
						"Plan for continuing reports and recordkeeping during the campaign and any required reporting after it ends. Obtain legal advice for questions about your eligibility or obligations."
					],
					links: [resources.georgiaCandidates]
				}]
			}
		]
	}
];

export function findParticipationGuide(slug: unknown) {
	return participationGuides.find(guide => guide.slug === slug);
}
