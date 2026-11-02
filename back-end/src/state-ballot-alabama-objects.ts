import type { AlabamaObjectProof, AlabamaPdfObject } from "./state-ballot-alabama-types.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";

function plain(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
export function inspectAlabamaObjects(document: unknown): AlabamaObjectProof {
	if (
		!plain(document)
		|| Buffer.byteLength(JSON.stringify(document)) > 16 * 1024 * 1024
		|| document.version !== 2
		|| !Array.isArray(document.qpdf)
		|| document.qpdf.length !== 2
		|| document.qpdf[0]?.jsonversion !== 2
		|| document.qpdf[0].calledgetallpages !== true
		|| !plain(document.qpdf[1])
	) {
		throw new Error("The Alabama native object envelope requires review.");
	}
	if (
		!plain(document.encrypt)
		|| document.encrypt.encrypted !== false
		|| !plain(document.attachments)
		|| Object.keys(document.attachments).length
		|| !plain(document.acroform)
		|| document.acroform.needappearances !== false
		|| !Array.isArray(document.acroform.fields)
		|| document.acroform.fields.length
		|| !Array.isArray(document.pages)
		|| document.pages.length !== 1
	) {
		throw new Error("The Alabama native page or appearance inventory requires review.");
	}
	const objects = document.qpdf[1] as Record<string, AlabamaPdfObject>;
	if (Object.keys(objects).length > 12000) throw new Error("The Alabama native object inventory exceeds its bounds.");
	const resolved = (value: unknown): unknown => {
		if (typeof value !== "string" || !/^\d+ 0 R$/u.test(value)) return value;
		const object = objects[`obj:${value}`];
		if (!plain(object) || !("value" in object) || object.value === null)
			throw new Error("An Alabama native object reference is unresolved.");
		return object.value;
	};
	const forbidden = new Set([
		"/OpenAction",
		"/AA",
		"/JS",
		"/JavaScript",
		"/EmbeddedFiles",
		"/XFA",
		"/Encrypt",
		"/Annots",
		"/AP",
		"/OCProperties",
		"/OC",
		"/RichMediaContent",
		"/Collection",
		"/PresSteps"
	]);
	const pending: {
		value: unknown;
		depth: number;
	}[] = [{ value: document, depth: 0 }];
	let visited = 0;
	let streamBytes = 0;
	while (pending.length) {
		const { value, depth } = pending.pop()!;
		if (++visited > 200000 || depth > 64) throw new Error("The Alabama native object graph exceeds its bounds.");
		if (Array.isArray(value)) {
			for (const child of value) pending.push({ value: child, depth: depth + 1 });
		}
		else if (plain(value)) {
			if (Object.keys(value).some(key => forbidden.has(key)))
				throw new Error("An Alabama native action, annotation or optional appearance requires review.");
			if (plain(value.stream)) {
				const data = value.stream.data;
				if (typeof data !== "string" || data.length > 16 * 1024 * 1024 || !/^[A-Za-z\d+/]*={0,2}$/u.test(data))
					throw new Error("An Alabama native stream requires review.");
				const bytes = Buffer.from(data, "base64");
				if (bytes.toString("base64") !== data || !plain(value.stream.dict))
					throw new Error("An Alabama native stream encoding is not canonical.");
				streamBytes += bytes.length;
				if (streamBytes > 12 * 1024 * 1024)
					throw new Error("The Alabama decoded stream inventory exceeds its bounds.");
			}
			for (const child of Object.values(value)) pending.push({ value: child, depth: depth + 1 });
		}
	}
	const pageRecord = document.pages[0];
	const page = resolved(pageRecord.object);
	if (
		!plain(page)
		|| page["/Type"] !== "/Page"
		|| page["/Rotate"] !== 0
		|| page["/Group"] !== undefined
		|| (page["/UserUnit"] !== undefined && page["/UserUnit"] !== 1)
	) {
		throw new Error("The Alabama native page transform or transparency group requires review.");
	}
	assert.deepEqual(page["/MediaBox"], [0, 0, 1224, 792]);
	assert.deepEqual(page["/CropBox"], page["/MediaBox"]);
	if (
		!Array.isArray(pageRecord.contents)
		|| !pageRecord.contents.length
		|| pageRecord.contents.length > 256
		|| new Set(pageRecord.contents).size !== pageRecord.contents.length
	) {
		throw new Error("The Alabama native content-stream order requires review.");
	}
	assert.deepEqual(page["/Contents"], pageRecord.contents);
	for (const reference of pageRecord.contents) {
		if (
			typeof reference !== "string"
			|| !/^\d+ 0 R$/u.test(reference)
			|| !plain(objects[`obj:${reference}`]?.stream)
		) {
			throw new Error("An Alabama native content stream is missing.");
		}
	}
	const resources = resolved(page["/Resources"]);
	if (!plain(resources) || resources["/Pattern"] || resources["/Shading"])
		throw new Error("The Alabama native page resources require review.");
	if (resources["/Properties"]) {
		const properties = resolved(resources["/Properties"]);
		if (!plain(properties) || Object.keys(properties).length > 64)
			throw new Error("The Alabama marked-content inventory requires review.");
		for (const [name, reference] of Object.entries(properties)) {
			const property = resolved(reference);
			const metadata = plain(property) ? objects[`obj:${property["/Metadata"]}`]?.stream : undefined;
			if (
				!/^\/MC\d{1,2}$/u.test(name)
				|| !plain(property)
				|| JSON.stringify(Object.keys(property)) !== "[\"/Metadata\"]"
				|| !plain(metadata)
				|| metadata.dict["/Type"] !== "/Metadata"
				|| metadata.dict["/Subtype"] !== "/XML"
			) {
				throw new Error("An Alabama marked-content property can affect an unreviewed appearance.");
			}
		}
	}
	const fonts = resolved(resources["/Font"]);
	if (!plain(fonts) || !Object.keys(fonts).length || Object.keys(fonts).length > 128)
		throw new Error("The Alabama native font inventory requires review.");
	const catalogs = Object.values(objects)
		.map(item => item?.value)
		.filter((value): value is Record<string, unknown> => plain(value) && value["/Type"] === "/Catalog");
	if (catalogs.length !== 1) throw new Error("The Alabama native catalog is ambiguous.");
	const catalog = catalogs[0];
	const pages = resolved(catalog["/Pages"]);
	if (
		!plain(pages)
		|| pages["/Type"] !== "/Pages"
		|| pages["/Count"] !== 1
		|| JSON.stringify(pages["/Kids"]) !== JSON.stringify([pageRecord.object])
		|| page["/Parent"] !== catalog["/Pages"]
	) {
		throw new Error("The Alabama native page tree requires review.");
	}
	if (catalog["/AcroForm"]) {
		const form = resolved(catalog["/AcroForm"]);
		if (
			!plain(form)
			|| !Array.isArray(form["/Fields"])
			|| form["/Fields"].length
			|| (form["/NeedAppearances"] !== undefined && form["/NeedAppearances"] !== false)
			|| Object.keys(form).some(key => !["/Fields", "/DA", "/DR", "/NeedAppearances"].includes(key))
		) {
			throw new Error("The Alabama empty-form appearance requires review.");
		}
	}
	return {
		objects: Object.keys(objects).length,
		visited,
		decodedStreamBytes: streamBytes,
		pageCount: 1,
		fontResources: Object.keys(fonts).length,
		emptyFormVerified: Boolean(catalog["/AcroForm"]),
		actionsAndAnnotationsAbsent: true
	};
}
