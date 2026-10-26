import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import test from "node:test";
import { electionDocumentRobotsPolicy } from "../src/election-document-collection.js";
import { eastGreenwichRobotsPolicy } from "../src/state-ballot-east-greenwich-policy.js";

const body = readFileSync(new URL("./fixtures/east-greenwich-robots.txt", import.meta.url));
test("East Greenwich enforces wildcard and all named AI restrictions without an identity override", () => {
	const policy = eastGreenwichRobotsPolicy(body);
	assert.equal(policy.delay, 11000);
	for (const path of ["/192/Voter-Registration-Elections", "/DocumentCenter/View/9035/General-Election-Precinct-0901-Sample-Ballot-PDF", "/Site/Privacy", "/Site"]) assert.equal(policy.allowed(`https://www.eastgreenwichri.gov${path}`), true);
	for (const path of ["/admin", "/Search", "/RSS.aspx", "/calendar.aspx", "/CivicAlerts.aspx", "/bids.aspx", "/FAQ.aspx", "/common/modules/icalendar/"]) assert.equal(policy.allowed(`https://www.eastgreenwichri.gov${path}`), false);
	for (const url of ["https://eastgreenwichri.gov/192/Voter-Registration-Elections", "http://www.eastgreenwichri.gov/192/Voter-Registration-Elections", "https://www.eastgreenwichri.gov/%61dmin", "https://www.eastgreenwichri.gov:8443/Site", "https://user@www.eastgreenwichri.gov/Site", "https://www.eastgreenwichri.gov/Site#fragment"]) assert.equal(policy.allowed(url), false);
	assert.throws(() => electionDocumentRobotsPolicy(body), /robots-group-review-required/u);
});
test("East Greenwich refuses policy changes, new restrictions and malformed bodies", () => {
	for (const value of [`${body.toString()}Disallow: /192\n`, body.toString().replace("Disallow: /calendar.aspx", "Disallow: /"), body.toString().replace("Crawl-delay: 10", "Crawl-delay: 30"), body.toString().replace("GPTBot", "DifferentBot"), "", "x".repeat(32001), "\u0000"]) assert.throws(() => eastGreenwichRobotsPolicy(Buffer.from(value)), /requires review/u);
	assert.throws(() => eastGreenwichRobotsPolicy(Buffer.from([0xFF])), /encoded data/u);
	assert.equal(eastGreenwichRobotsPolicy(Buffer.from(body.toString().replace(/\n/gu, "\r\n"))).delay, 11000);
});
