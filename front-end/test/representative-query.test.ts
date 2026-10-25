import type { WatchSource } from "vue";
import assert from "node:assert/strict";
import test from "node:test";
import { computed, effectScope, nextTick, ref, toValue, watch } from "vue";
import { useRepresentative } from "../src/composables/useRepresentative.ts";

test("representative fetch watches location values rather than recreated query objects", async () => {
	const captured: { key?: () => string; watch?: WatchSource[] } = {};
	const globals = {
		computed,
		toValue,
		useApiClient: () => async () => null,
		useAsyncData: (key: () => string, _handler: unknown, options: { watch: WatchSource[] }) => {
			captured.key = key;
			captured.watch = options.watch;
		}
	};
	const descriptors = Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
	Object.assign(globalThis, globals);
	const scope = effectScope();
	try {
		const slug = ref("raphael-warnock");
		const query = ref<{ lookup: string; selection?: string }>();
		query.value = { lookup: "30022" };
		scope.run(() => useRepresentative(slug, query));
		assert.ok(captured.watch);
		assert.ok(captured.key);
		let refreshes = 0;
		scope.run(() => watch(captured.watch!, () => refreshes++));

		query.value = { lookup: "30022" };
		await nextTick();
		assert.equal(refreshes, 0);
		assert.equal(captured.key(), "representative:raphael-warnock:30022:none");

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
		assert.equal(captured.key(), "representative:another-official:98101:zip:98101:fixture");
		query.value = undefined;
		await nextTick();
		assert.equal(refreshes, 4);
	}
	finally {
		scope.stop();
		for (const [key, descriptor] of descriptors) {
			if (descriptor)
				Object.defineProperty(globalThis, key, descriptor);
			else
				Reflect.deleteProperty(globalThis, key);
		}
	}
});
