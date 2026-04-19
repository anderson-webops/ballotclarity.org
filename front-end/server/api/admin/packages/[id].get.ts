import { createError, defineEventHandler } from "h3";
import { getAdminGuidePackage } from "../../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	const id = event.context.params?.id;

	if (!id) {
		throw createError({
			statusCode: 400,
			statusMessage: "Guide package id is required."
		});
	}

	return await getAdminGuidePackage(event, id);
});
