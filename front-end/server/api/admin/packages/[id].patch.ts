import { createError, defineEventHandler, readBody } from "h3";
import { updateAdminGuidePackage } from "../../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	const id = event.context.params?.id;

	if (!id) {
		throw createError({
			statusCode: 400,
			statusMessage: "Guide package id is required."
		});
	}

	const body = await readBody<Record<string, unknown>>(event);
	return await updateAdminGuidePackage(event, id, body);
});
