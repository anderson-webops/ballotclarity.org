import { defineEventHandler } from "h3";
import { getAdminOverview } from "../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	return await getAdminOverview(event);
});
