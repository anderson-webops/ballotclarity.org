import type { ChildProcessWithoutNullStreams } from "node:child_process";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import process from "node:process";
import test, { after, before } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

const repoRoot = process.cwd();

let apiProcess: ChildProcessWithoutNullStreams | null = null;
let appProcess: ChildProcessWithoutNullStreams | null = null;
let apiBaseUrl = "";
let appBaseUrl = "";

async function getFreePort() {
	return await new Promise<number>((resolve, reject) => {
		const server = createServer();

		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();

			if (!address || typeof address === "string") {
				server.close();
				reject(new Error("Unable to resolve a free port."));
				return;
			}

			server.close(error => error ? reject(error) : resolve(address.port));
		});
	});
}

function startProcess(command: string, args: string[], env: NodeJS.ProcessEnv) {
	const child = spawn(command, args, {
		cwd: repoRoot,
		env,
		stdio: ["ignore", "pipe", "pipe"]
	});

	const output: string[] = [];
	const collect = (chunk: Buffer) => output.push(chunk.toString());

	child.stdout.on("data", collect);
	child.stderr.on("data", collect);

	return {
		child,
		getOutput: () => output.join("")
	};
}

async function waitForUrl(url: string, label: string) {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		try {
			const response = await fetch(url);

			if (response.ok)
				return;
		}
		catch {
			// Keep polling until the process is ready.
		}

		await delay(500);
	}

	throw new Error(`Timed out waiting for ${label} at ${url}`);
}

async function stopProcess(processHandle: ChildProcessWithoutNullStreams | null) {
	if (!processHandle || processHandle.exitCode !== null)
		return;

	processHandle.kill("SIGTERM");
	await once(processHandle, "exit");
}

before(async () => {
	const apiPort = await getFreePort();
	const appPort = await getFreePort();

	apiBaseUrl = `http://127.0.0.1:${apiPort}`;
	appBaseUrl = `http://127.0.0.1:${appPort}`;

	const api = startProcess(process.execPath, ["back-end/dist/server.js"], {
		...process.env,
		PORT: String(apiPort)
	});
	apiProcess = api.child;

	await waitForUrl(`${apiBaseUrl}/health`, "demo API");

	const app = startProcess(process.execPath, ["front-end/.output/server/index.mjs"], {
		...process.env,
		PORT: String(appPort),
		NUXT_PUBLIC_API_BASE: `${apiBaseUrl}/api`
	});
	appProcess = app.child;

	try {
		await waitForUrl(`${appBaseUrl}/`, "Nuxt application");
	}
	catch (error) {
		throw new Error(`${String(error)}\n\nAPI output:\n${api.getOutput()}\n\nApp output:\n${app.getOutput()}`);
	}
});

after(async () => {
	await Promise.all([
		stopProcess(appProcess),
		stopProcess(apiProcess)
	]);
});

test("built app renders the key ballot guide pages against the built API", async () => {
	const ballotResponse = await fetch(`${apiBaseUrl}/api/ballot?election=2026-metro-county-general`);
	const ballot = await ballotResponse.json();
	const homePage = await fetch(`${appBaseUrl}/`);
	const homeHtml = await homePage.text();
	const ballotPage = await fetch(`${appBaseUrl}/ballot/2026-metro-county-general`);
	const ballotHtml = await ballotPage.text();
	const electionPage = await fetch(`${appBaseUrl}/elections/2026-metro-county-general`);
	const electionHtml = await electionPage.text();
	const locationPage = await fetch(`${appBaseUrl}/locations/metro-county-franklin`);
	const locationHtml = await locationPage.text();
	const dataSourcesPage = await fetch(`${appBaseUrl}/data-sources`);
	const dataSourcesHtml = await dataSourcesPage.text();
	const candidatePage = await fetch(`${appBaseUrl}/candidate/elena-torres`);
	const candidateHtml = await candidatePage.text();
	const measurePage = await fetch(`${appBaseUrl}/measure/charter-amendment-a`);
	const measureHtml = await measurePage.text();
	const helpPage = await fetch(`${appBaseUrl}/help`);
	const helpHtml = await helpPage.text();
	const methodologyPage = await fetch(`${appBaseUrl}/methodology`);
	const methodologyHtml = await methodologyPage.text();
	const neutralityPage = await fetch(`${appBaseUrl}/neutrality`);
	const neutralityHtml = await neutralityPage.text();
	const accessibilityPage = await fetch(`${appBaseUrl}/accessibility`);
	const accessibilityHtml = await accessibilityPage.text();
	const privacyPage = await fetch(`${appBaseUrl}/privacy`);
	const privacyHtml = await privacyPage.text();
	const termsPage = await fetch(`${appBaseUrl}/terms`);
	const termsHtml = await termsPage.text();
	const contactPage = await fetch(`${appBaseUrl}/contact`);
	const contactHtml = await contactPage.text();
	const planPage = await fetch(`${appBaseUrl}/plan`);
	const planHtml = await planPage.text();
	const comparePage = await fetch(`${appBaseUrl}/compare?slugs=elena-torres,daniel-brooks`);
	const compareHtml = await comparePage.text();

	assert.equal(ballotResponse.status, 200);
	assert.equal(ballot.demo, true);
	assert.equal(homePage.status, 200);
	assert.match(homeHtml, /Understand your ballot without the overload/);
	assert.match(homeHtml, /Demo ballot preview/);
	assert.match(homeHtml, /Start from a location hub/);
	assert.match(homeHtml, /Live data roadmap/);
	assert.match(homeHtml, /Use official sources where they are authoritative, then normalize the rest/);
	assert.match(homeHtml, /Why we ask for your address/);
	assert.match(homeHtml, /Data use: your lookup is sent to the Ballot Clarity demo API only to match a sample ballot/);
	assert.match(ballotHtml, /Questions to ask before you vote/);
	assert.match(ballotHtml, /Key dates and official links/);
	assert.match(ballotHtml, /Guide freshness and review status/);
	assert.match(ballotHtml, /Ballot at a glance/);
	assert.match(ballotHtml, /Showing contests for your districts/);
	assert.match(ballotHtml, /Need a page reviewed/);
	assert.match(ballotHtml, /Build a booth-ready plan/);
	assert.match(ballotHtml, /Reading mode/);
	assert.match(ballotHtml, /Quick view/);
	assert.match(ballotHtml, /Next review/);
	assert.match(ballotHtml, /Metro County, Franklin/);
	assert.match(ballotHtml, /Demo data/i);
	assert.match(electionHtml, /Official links and notices/);
	assert.match(electionHtml, /Contest index/);
	assert.match(electionHtml, /Data sources roadmap/);
	assert.match(locationHtml, /Official election office/);
	assert.match(locationHtml, /Voting methods in this demo jurisdiction/);
	assert.match(locationHtml, /Data sources roadmap/);
	assert.equal(dataSourcesPage.status, 200);
	assert.match(dataSourcesHtml, /Data sources and live API roadmap/);
	assert.match(dataSourcesHtml, /Census Geocoder with geoLookup/);
	assert.match(dataSourcesHtml, /FEC OpenFEC API and bulk files/);
	assert.match(dataSourcesHtml, /Google Representatives API ended on April 30, 2025/);
	assert.match(dataSourcesHtml, /June 30, 2026/);
	assert.match(candidateHtml, /Elena Torres/);
	assert.match(candidateHtml, /At a glance/);
	assert.match(candidateHtml, /Jump to section/);
	assert.match(candidateHtml, /What we know/);
	assert.match(candidateHtml, /What we(?:&#39;|’|')re still checking/);
	assert.match(candidateHtml, /Issue positions/);
	assert.match(candidateHtml, /Context and terms/);
	assert.match(candidateHtml, /Votes(?:\s*&amp;\s*|\s*&\s*|\s*&#38;\s*)actions/);
	assert.match(candidateHtml, /How this page is built/);
	assert.match(candidateHtml, /Evidence(?:\s*&amp;\s*|\s*&\s*|\s*&#38;\s*)sources/);
	assert.match(candidateHtml, /Download JSON/);
	assert.match(candidateHtml, /Report an issue/);
	assert.match(candidateHtml, /Save to my plan/);
	assert.match(candidateHtml, /Campaign funding overview/);
	assert.match(measureHtml, /Official ballot summary/);
	assert.match(measureHtml, /Current law and proposed change/);
	assert.match(measureHtml, /What exists now, and what this measure would change/);
	assert.match(measureHtml, /Implementation timeline/);
	assert.match(measureHtml, /If you vote YES/);
	assert.match(measureHtml, /If you vote NO/);
	assert.match(measureHtml, /Arguments are attributed, not adopted/);
	assert.match(measureHtml, /Arguments emphasizing approval/);
	assert.match(measureHtml, /Full text and official sources/);
	assert.match(measureHtml, /Report an issue/);
	assert.match(measureHtml, /How this page is built/);
	assert.match(measureHtml, /How this explainer stays readable/);
	assert.match(measureHtml, /What we(?:&#39;|’|')re still checking/);
	assert.match(measureHtml, /Review later/);
	assert.match(helpHtml, /Voting help and ballot basics/);
	assert.match(helpHtml, /What is the difference between a sample ballot and a voter guide/);
	assert.match(helpHtml, /What happens to the address or ZIP code I enter/);
	assert.match(helpHtml, /Read neutrality policy/);
	assert.match(helpHtml, /Read accessibility standards/);
	assert.match(neutralityHtml, /How Ballot Clarity operationalizes neutrality/);
	assert.match(neutralityHtml, /Source hierarchy/);
	assert.match(neutralityHtml, /Red-flag review/);
	assert.match(neutralityHtml, /Claims that need extra scrutiny/);
	assert.match(neutralityHtml, /Guardrails around candidate and measure coverage/);
	assert.equal(accessibilityPage.status, 200);
	assert.match(accessibilityHtml, /Accessibility and print standards/);
	assert.match(accessibilityHtml, /WCAG 2\.2 Level AA/);
	assert.match(accessibilityHtml, /44 by 44 pixel minimum target|44 x 44 pixel minimum target|44 x 44 px/);
	assert.match(accessibilityHtml, /does not yet generate a downloadable tagged PDF/);
	assert.match(methodologyHtml, /How the demo layer is meant to be replaced/);
	assert.match(methodologyHtml, /Open data sources roadmap/);
	assert.equal(privacyPage.status, 200);
	assert.match(privacyHtml, /Privacy Policy/);
	assert.match(privacyHtml, /What data Ballot Clarity handles today/);
	assert.match(privacyHtml, /The application is designed not to publish the raw lookup text/);
	assert.match(privacyHtml, /No sale, sharing, or targeted advertising in the current MVP/);
	assert.match(privacyHtml, /Rights requests and limits in a no-account MVP/);
	assert.match(privacyHtml, /Children(?:&#39;|&apos;|’|')s privacy/);
	assert.equal(termsPage.status, 200);
	assert.match(termsHtml, /Terms of Service/);
	assert.match(termsHtml, /How the service may and may not be used/);
	assert.match(termsHtml, /Permitted use and limited license/);
	assert.match(termsHtml, /By accessing or using the Ballot Clarity website/);
	assert.match(termsHtml, /The site is not an official government election website/);
	assert.match(termsHtml, /The site is provided on an (?:\"|&quot;)as is(?:\"|&quot;) and (?:\"|&quot;)as available(?:\"|&quot;) basis/);
	assert.match(contactHtml, /Contact and correction requests/);
	assert.match(contactHtml, /acknowledge correction requests within 2 business days/);
	assert.match(contactHtml, /How a request can be resolved/);
	assert.match(planHtml, /My ballot plan/);
	assert.match(planHtml, /Print this plan/);
	assert.match(planHtml, /No contests saved yet/);
	assert.match(compareHtml, /Compare candidates side by side/);
	assert.match(compareHtml, /candidate-provided statements by attribute/i);
	assert.match(compareHtml, /Use compare to eliminate, then save a choice/);
	assert.match(compareHtml, /Show only questions answered by all selected candidates/);
	assert.match(compareHtml, /Would you support expanding federal transportation and clinic-access grants in District 7/);
	assert.match(compareHtml, /No response submitted/);
});
