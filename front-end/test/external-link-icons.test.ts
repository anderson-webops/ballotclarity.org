import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));

function vueFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
		? vueFiles(join(directory, entry.name))
		: entry.name.endsWith(".vue") ? [join(directory, entry.name)] : []);
}

test("launch icons are rendered only by the destination-aware shared link", () => {
	const files = vueFiles(sourceRoot).filter(path => readFileSync(path, "utf8").includes("i-carbon-launch"));
	assert.deepEqual(files.map(path => relative(sourceRoot, path)), ["components/SafeExternalLink.vue"]);
	const link = readFileSync(files[0]!, "utf8");
	assert.match(link, /v-if="props.externalIcon && link.external"/u);
	assert.match(link, /aria-hidden="true"/u);
	assert.match(link, /resolvePublicLink\(props.href, siteUrl\)/u);
});

test("same-site links never inherit the default new-tab behavior", () => {
	const link = readFileSync(join(sourceRoot, "components/SafeExternalLink.vue"), "utf8");
	assert.match(link, /const opensNewTab = computed\(\(\) => link.value.external && props.newTab\)/u);
	assert.match(link, /:target="opensNewTab \? '_blank' : undefined"/u);
	assert.match(link, /:rel="opensNewTab \? 'noopener noreferrer' : undefined"/u);
	const sources = readFileSync(join(sourceRoot, "components/SourceList.vue"), "utf8");
	assert.match(sources, /:href="source.url" external-icon/u);
});
