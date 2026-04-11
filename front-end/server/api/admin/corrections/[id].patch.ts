import { createError, defineEventHandler, readBody } from "h3";
import { updateAdminCorrection } from "../../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	const id = event.context.params?.id;

	if (!id) {
		throw createError({
			statusCode: 400,
			statusMessage: "Correction record id is required."
		});
	}

	const body = await readBody<Record<string, unknown>>(event);

	return await updateAdminCorrection(event, id, body);
});
