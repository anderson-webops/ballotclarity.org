import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import merge from "deepmerge";

const payload = () => JSON.parse("{\"__proto__\":{\"isAdmin\":true},\"safe\":1}");
function assertSafe(value: Record<string, unknown>) {
	assert.equal(Object.getPrototypeOf(value), Object.prototype);
	assert.equal(value.isAdmin, undefined);
	assert.equal(Object.hasOwn(value, "__proto__"), false);
	assert.equal(({} as Record<string, unknown>).isAdmin, undefined);
}

test("the installed deepmerge package resolves to the locally hardened implementation", () => {
	const require = createRequire(import.meta.url);
	assert.match(require.resolve("deepmerge"), /vendor[/\\]deepmerge[/\\]index\.cjs$/u);
});

test("neither target nor source keys can poison a returned merge object's prototype", () => {
	for (const target of [{}, Object.create(null), payload(), { nested: null }, { nested: 0 }, { nested: "" }]) {
		const result = merge(target, payload());
		assertSafe(result);
		assert.equal(result.safe, 1);
		assertSafe(merge(payload(), target));
	}
});

test("nested null, primitive, array and merge-all paths keep safe result prototypes", () => {
	for (const placeholder of [null, undefined, 0, false, "", Object.create(null), payload()]) {
		const result = merge({ session: placeholder }, { session: payload() });
		assertSafe(result.session);
		assert.equal(result.session.safe, 1);
	}
	assertSafe(merge([], [payload()])[0]);
	assertSafe(merge.all([Object.create(null), payload()]));
	assertSafe(merge(JSON.parse("{\"\\u005f\\u005fproto\\u005f\\u005f\":{\"isAdmin\":true}}"), {}));
	for (const clone of [true, false]) assertSafe(merge(payload(), payload(), { clone }));
});

test("dangerous getters are never read and ordinary result properties use data descriptors", () => {
	let reads = 0;
	const source = Object.defineProperty({}, "__proto__", { enumerable: true, get() {
		reads++;
		throw new Error("Unsafe getter");
	} });
	assertSafe(merge(source, {}));
	assertSafe(merge(Object.create(null), source));
	assert.equal(reads, 0);
	assert.deepEqual(Object.getOwnPropertyDescriptor(merge({ safe: 1 }, { safe: 2 }), "safe"), { value: 2, enumerable: true, writable: true, configurable: true });
});

test("ordinary merge controls retain arrays, symbols, special values and caller options", () => {
	assert.deepEqual(merge({ list: [1], nested: { first: 1 } }, { list: [2], nested: { second: 2 } }), { list: [1, 2], nested: { first: 1, second: 2 } });
	const symbol = Symbol("ordinary");
	const date = new Date("2026-10-27");
	const original = { [symbol]: { value: 1 }, date, pattern: /ordinary/u };
	const cloned = merge(original, {});
	assert.notEqual(cloned[symbol], original[symbol]);
	assert.equal(cloned.date, date);
	assert.equal(cloned.pattern, original.pattern);
	assert.equal(merge(original, {}, { clone: false })[symbol], original[symbol]);
	assert.deepEqual(merge({ list: [1] }, { list: [2] }, { arrayMerge: (_target, source) => source }), { list: [2] });
	assert.deepEqual(merge({ value: 2 }, { value: { count: 3 } }, { customMerge: key => key === "value" ? (target, source) => ({ total: target + source.count }) : undefined }), { value: { total: 5 } });
	assert.deepEqual(merge.all([{ first: 1 }, { second: 2 }]), { first: 1, second: 2 });
	assert.throws(() => merge.all({} as object[]), /array/u);
});
