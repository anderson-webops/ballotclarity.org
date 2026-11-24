import type { WatchSource } from "vue";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
import { effectScope, nextTick, ref, watch } from "vue";

const representativePath = "../src/composables/useRepresentative.ts";
const representativeUrl = new URL(representativePath, import.meta.url).href;

export const useApiClient = () => async () => null;
export const useAsyncData = mock.fn((_key: () => string, _handler: unknown, _options: { watch: WatchSource[] }) => undefined);

test("representative fetch watches location values rather than recreated query objects", async () => {
	const hooks = registerHooks({
		resolve(specifier, context, nextResolve) {
			if (context.parentURL === representativeUrl && (specifier === "#app" || specifier === "~/composables/useApiClient"))
				return { url: import.meta.url, shortCircuit: true };

			return nextResolve(specifier, context);
		}
	});
	const scope = effectScope();
	try {
		const { useRepresentative } = await import("../src/composables/useRepresentative.ts");
		const slug = ref("raphael-warnock");
		const query = ref<{ lookup: string; selection?: string }>();
		query.value = { lookup: "30022" };
		scope.run(() => useRepresentative(slug, query));
		assert.equal(useAsyncData.mock.callCount(), 1);
		const [key, , options] = useAsyncData.mock.calls[0]!.arguments;
		let refreshes = 0;
		scope.run(() => watch(options.watch, () => refreshes++));

		query.value = { lookup: "30022" };
		await nextTick();
		assert.equal(refreshes, 0);
		assert.equal(key(), "representative:raphael-warnock:30022:none");

		query.value = { lookup: "98101" };
		await nextTick();
		assert.equal(refreshes, 1);
		query.value = { lookup: "98101", selection: "zip:98101:fixture" };
		await nextTick();
		assert.equal(refreshes, 2);
		query.value = { ...query.value };
		await nextTick();
		assert.equal(refreshes, 2);
		slug.value = "another-official";
		await nextTick();
		assert.equal(refreshes, 3);
		assert.equal(key(), "representative:another-official:98101:zip:98101:fixture");
		query.value = undefined;
		await nextTick();
		assert.equal(refreshes, 4);
	}
	finally {
		hooks.deregister();
		scope.stop();
	}
});
