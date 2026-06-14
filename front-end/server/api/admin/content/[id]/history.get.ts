import { createError, defineEventHandler } from "h3";
import { getAdminContentHistory } from "../../../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	const id = event.context.params?.id;

	if (!id) {
		throw createError({
			statusCode: 400,
			statusMessage: "Content record id is required."
		});
	}

	return await getAdminContentHistory(event, id);
});
