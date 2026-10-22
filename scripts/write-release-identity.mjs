import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";

const projectRoot = resolve(import.meta.dirname, "..");
const phase = process.argv[2];
const versionPattern = /^v[0-9]+\.[0-9]+\.[0-9]+$/u;
const commitPattern = /^[0-9a-f]{40}$/u;

function git(...args) {
	return execFileSync("git", args, {
		cwd: projectRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	}).trim();
}

const commit = git("rev-parse", "HEAD");
const dirty = Boolean(git("status", "--porcelain=v1", "--untracked-files=all"));
const releaseTags = git("tag", "--points-at", "HEAD").split("\n").filter(tag => versionPattern.test(tag));

if (!commitPattern.test(commit) || releaseTags.length > 1)
	throw new Error("Release source identity is ambiguous.");

const tag = dirty ? undefined : releaseTags[0];

if (tag && git("cat-file", "-t", `refs/tags/${tag}`) !== "tag")
	throw new Error("A release version requires an annotated tag.");

if (process.env.GITHUB_REF_TYPE === "tag" && tag !== process.env.GITHUB_REF_NAME)
	throw new Error("The release build does not match its exact annotated tag.");

if (phase !== "public" && phase !== "backend")
	throw new Error("Specify public or backend release identity generation.");

const identity = {
	version: tag ? tag.slice(1) : "development",
	commit,
};
const bytes = `${JSON.stringify(identity)}\n`;

const relativePath = phase === "public"
	? "front-end/public/deployment.json"
	: "back-end/dist/release-identity.json";
const target = resolve(projectRoot, relativePath);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, bytes, { mode: 0o644 });

console.log(`Embedded ${identity.version} at ${identity.commit} for ${phase}.`);
