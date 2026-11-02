import type { ElectionDocumentRobotsLayout } from "../src/election-document-robots-layout.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { electionDocumentRobotsPolicy } from "../src/election-document-collection.js";
import { reviewedRestrictiveRobotsGroups, validateReviewedRobotsLayout } from "../src/election-document-robots-layout.js";

const layout: ElectionDocumentRobotsLayout = { restrictiveGroups: [{ agents: ["Baiduspider"], unrelated: true }, { agents: ["*"] }, { agents: ["GPTBot", "OAI-SearchBot"] }, { agents: ["Siteimprovebot"], unrelated: true }] };
const body = "User-agent: Baiduspider\nDisallow: /\nUser-agent: *\nDisallow: /admin\nAllow: /admin/public$\nDisallow: /private\nCrawl-delay: 10\nUser-agent: GPTBot\nUser-agent: OAI-SearchBot\nDisallow: /admin/public\nAllow: /private/open$\nDisallow: /search\nUser-agent: Siteimprovebot\nCrawl-delay: 20\n";
const policy = (text = body) => electionDocumentRobotsPolicy(Buffer.from(text), [], [], undefined, undefined, layout);

test("reviewed grouped rules intersect wildcard and named restrictions instead of overriding them", () => {
	const result = policy();
	assert.equal(result.delay, 20_000);
	for (const path of ["/admin", "/admin/public", "/private/open", "/search?q=test"]) assert.equal(result.allowed(`https://example.org${path}`), false, path);
	assert.equal(result.allowed("https://example.org/profile"), true);
	assert.throws(() => electionDocumentRobotsPolicy(Buffer.from(body)), /group-review-required/u);
	assert.equal(reviewedRestrictiveRobotsGroups(body, layout).length, 4);
});

test("a universal named restriction remains a universal denial", () => {
	const result = policy(body.replace("Disallow: /search", "Disallow: /"));
	assert.equal(result.allowed("https://example.org/profile"), false);
});

test("reviewed groups retain every header and reject additions, removals, duplicates and reordered identities", () => {
	for (const changed of [body.replace("GPTBot", "OtherBot"), body.replace("User-agent: OAI-SearchBot\n", ""), body.replace("OAI-SearchBot", "GPTBot"), body.replace("User-agent: GPTBot\nUser-agent: OAI-SearchBot", "User-agent: OAI-SearchBot\nUser-agent: GPTBot"), `${body}User-agent: ExtraBot\nDisallow: /\n`]) assert.throws(() => policy(changed), /restrictive-group-changed/u);
	assert.equal(policy(body.replaceAll("User-agent:", "USER-AGENT:")).allowed("https://example.org/profile"), true);
});

test("AI, wildcard and unknown agents cannot be declared unrelated", () => {
	for (const agent of ["*", "GPTBot", "OAI-SearchBot", "ClaudeBot", "meta-webindexer", "NewBot"]) assert.throws(() => validateReviewedRobotsLayout({ restrictiveGroups: [{ agents: ["*"] }, { agents: [agent], unrelated: true }] }), /restrictive-group-review-required/u);
	for (const agent of ["Baiduspider", "Yandex", "Siteimprove", "Siteimprovebot", "Siteimprovebot-crawler"]) validateReviewedRobotsLayout({ restrictiveGroups: [{ agents: ["*"] }, { agents: [agent], unrelated: true }] });
});

test("group review rejects malformed configuration and ambiguous legacy combinations", () => {
	for (const value of [{ restrictiveGroups: [] }, { restrictiveGroups: [{ agents: ["GPTBot"] }] }, { restrictiveGroups: [{ agents: ["*"] }, { agents: ["*"] }] }, { restrictiveGroups: [{ agents: ["*"], unrelated: false }] }, { restrictiveGroups: [{ agents: ["*"], apply: false }] }, { restrictiveGroups: [{ agents: ["*"] }], sharedWildcardAgents: ["GPTBot"] }]) assert.throws(() => validateReviewedRobotsLayout(value as ElectionDocumentRobotsLayout), /restrictive-group-review-required/u);
	for (const args of [["Yandex"], []]) assert.throws(() => electionDocumentRobotsPolicy(Buffer.from(body), args, [], true, undefined, layout), /group-review-required/u);
});

test("invalid rules and excessive delays in unrelated groups still fail closed", () => {
	for (const changed of [body.replace("Crawl-delay: 20", "Crawl-delay: 301"), body.replace("Crawl-delay: 20", "Crawl-delay: invalid"), body.replace("Disallow: /\n", "Disallow: relative\n"), body.replace("Crawl-delay: 20", "Unsupported: /"), body.replace("Crawl-delay: 20\n", "")]) assert.throws(() => policy(changed), /group-review-required|format-changed|restrictive-group-changed/u);
});
