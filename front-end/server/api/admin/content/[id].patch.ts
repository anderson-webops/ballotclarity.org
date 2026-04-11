import { createError, defineEventHandler, readBody } from "h3";
import { updateAdminContent } from "../../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	const id = event.context.params?.id;

	if (!id) {
		throw createError({
			statusCode: 400,
			statusMessage: "Content record id is required."
		});
	}

	const body = await readBody<Record<string, unknown>>(event);

	return await updateAdminContent(event, id, body);
});
