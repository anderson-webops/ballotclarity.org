import { createError, defineEventHandler } from "h3";
import { readAdminRequestBody, updateAdminCorrection } from "../../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	const id = event.context.params?.id;

	if (!id) {
		throw createError({
			statusCode: 400,
			statusMessage: "Correction record id is required."
		});
	}

	const body = await readAdminRequestBody(event);

	return await updateAdminCorrection(event, id, body);
});
