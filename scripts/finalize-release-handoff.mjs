import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { verifyPublishedReceipt } from "./runtime-release-receipt.mjs";
import {
	buildHandoff,
	deliverHandoffWithReceipt,
	loadHandoffProfile
} from "../back-end/dist/private-handoff-client.js";

const { values } = parseArgs({
	options: {
		assets: { type: "string" },
		active: { type: "string" },
		profile: { type: "string" },
		receipts: { type: "string" },
		tag: { type: "string" },
		commit: { type: "string" }
	},
	strict: true
});
assert(
	values.assets && values.active && values.receipts && values.tag && values.commit,
	"Provide --assets, --active, --receipts, --tag and --commit."
);
assert.match(values.tag, /^v1\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u);
assert.match(values.commit, /^[a-f\d]{40}$/u);
const assets = resolve(values.assets),
	accepted = verifyPublishedReceipt(assets, values.commit);
const published = JSON.parse(
	execFileSync(
		"gh",
		[
			"release",
			"view",
			values.tag,
			"--repo",
			"anderson-webops/ballotclarity.org",
			"--json",
			"tagName,isDraft,isPrerelease,assets"
		],
		{ encoding: "utf8" }
	)
);
assert.equal(published.tagName, values.tag);
assert.equal(published.isDraft, false);
assert.equal(published.isPrerelease, false);
assert.equal(published.assets.length, 5);
execFileSync(
	"gh",
	[
		"attestation",
		"verify",
		resolve(assets, accepted.archive.name),
		"--bundle",
		resolve(assets, "attestation-bundle.jsonl"),
		"--repo",
		"anderson-webops/ballotclarity.org",
		"--signer-workflow",
		"anderson-webops/ballotclarity.org/.github/workflows/ci.yml",
		"--source-digest",
		values.commit,
		"--source-ref",
		`refs/tags/${values.tag}`
	],
	{ stdio: ["ignore", "ignore", "inherit"] }
);
const profile = await loadHandoffProfile(
	values.profile ?? resolve(homedir(), "Library/Application Support/BallotClarity/release-handoff/profile.json")
);
const packet = await buildHandoff(resolve(values.active), profile.audience, {
	tag: values.tag,
	commit: values.commit,
	archiveSha256: accepted.archive.sha256
});
const result = await deliverHandoffWithReceipt({
	...profile,
	body: packet.body,
	receiptsDirectory: resolve(values.receipts)
});
console.log(
	JSON.stringify({
		status: "received",
		tag: values.tag,
		commit: values.commit,
		receiptId: result.receipt.id,
		payloadSha256: result.receipt.payloadSha256,
		files: result.receipt.files.length,
		custodyOnly: true
	})
);
