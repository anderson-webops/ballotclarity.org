import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { electionDocumentRobotsPolicy } from "../src/election-document-collection.js";
import { reviewedWildcardRobotsAgents, reviewedWildcardRobotsGroup } from "../src/election-document-robots-layout.js";

const layout = { sharedWildcardAgents: ["AI2Bot", "GPTBot", "ClaudeBot", "AdsBot-Google"] };
const prefix = [...layout.sharedWildcardAgents.map(agent => `User-agent: ${agent}`), "User-agent: *"].join("\n");
const body = `${prefix}\nDisallow: /account/\nDisallow: /*?format=json\nAllow: /account/public$\nCrawl-delay: 20\n`;

test("explicit shared-agent groups preserve the wildcard restrictions for every listed agent", () => {
	assert.throws(() => electionDocumentRobotsPolicy(Buffer.from(body)), /robots-group-review-required/u);
	const policy = electionDocumentRobotsPolicy(Buffer.from(body), [], [], undefined, undefined, layout);
	assert.equal(policy.delay, 20000);
	assert.equal(policy.allowed("https://example.org/account/private"), false);
	assert.equal(policy.allowed("https://example.org/account/public"), true);
	assert.equal(policy.allowed("https://example.org/about?format=json"), false);
	assert.equal(policy.allowed("https://example.org/about"), true);
	assert.equal(reviewedWildcardRobotsGroup(body, layout), "User-agent: *\nDisallow: /account/\nDisallow: /*?format=json\nAllow: /account/public$\nCrawl-delay: 20\n");
});

test("a separate restrictive AI group can never be collapsed into wildcard permission", () => {
	for (const changed of [body.replace("User-agent: GPTBot", "User-agent: GPTBot\nDisallow: /"), `${body}\nUser-agent: GPTBot\nDisallow: /\n`, body.replace("User-agent: *", "Disallow: /\nUser-agent: *"), body.replace("User-agent: GPTBot", "User-agent: UnknownBot"), body.replace("User-agent: *", "User-agent: GPTBot")]) assert.throws(() => electionDocumentRobotsPolicy(Buffer.from(changed), [], [], undefined, undefined, layout), /robots-shared-group-changed/u);
	const denied = electionDocumentRobotsPolicy(Buffer.from(`${prefix}\nDisallow: /\n`), [], [], undefined, undefined, layout);
	assert.equal(denied.allowed("https://example.org/about"), false);
});

test("only the exact reviewed consecutive group is supported, not a broadened agent allowlist", () => {
	for (const changed of [body.replace("AI2Bot", "AI3Bot"), body.replace("AI2Bot", "GPTBot"), body.replace("User-agent: AI2Bot\n", ""), body.replace("User-agent: AI2Bot", "Sitemap: https://example.org/sitemap.xml\nUser-agent: AI2Bot"), body.replace("User-agent: AI2Bot\nUser-agent: GPTBot", "User-agent: GPTBot\nUser-agent: AI2Bot")]) assert.throws(() => reviewedWildcardRobotsGroup(changed, layout), /shared-group-changed/u);
	assert.throws(() => electionDocumentRobotsPolicy(Buffer.from(body), ["otherbot"], [], undefined, undefined, layout), /group-review-required/u);
	assert.throws(() => electionDocumentRobotsPolicy(Buffer.from(body), [], [], true, undefined, layout), /group-review-required/u);
	assert.throws(() => electionDocumentRobotsPolicy(Buffer.from(body), [], [], undefined, true, layout), /group-review-required/u);
});

test("comments and line endings do not remove directive or review checks", () => {
	const changed = `# Shared policy\r\n${body.replaceAll("\n", "\r\n").replace("GPTBot", "GPTBot # shared restrictions")}`;
	assert.equal(electionDocumentRobotsPolicy(Buffer.from(changed), [], [], undefined, undefined, layout).allowed("https://example.org/account/private"), false);
	assert.throws(() => electionDocumentRobotsPolicy(Buffer.from(`${body}\nContent-Signal: ai-input=no\n`), [], [], undefined, undefined, layout), /robots-format-changed/u);
	assert.equal(reviewedWildcardRobotsGroup(body), body);
});

test("layout configuration is bounded, unique and free of wildcard or directive injection", () => {
	for (const agents of [[], ["GPTBot", "gptbot"], ["*"], ["GPTBot\nAllow: /"], ["Unknown*"], Array.from({ length: 51 }, (_, index) => `bot${index}`)]) assert.throws(() => reviewedWildcardRobotsAgents({ sharedWildcardAgents: agents }), /shared-group-review-required/u);
	assert.deepEqual(reviewedWildcardRobotsAgents(layout), ["ai2bot", "gptbot", "claudebot", "adsbot-google"]);
});
