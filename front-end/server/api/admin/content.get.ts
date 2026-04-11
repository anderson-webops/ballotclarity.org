import { defineEventHandler } from "h3";
import { getAdminContent } from "../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	return await getAdminContent(event);
});
