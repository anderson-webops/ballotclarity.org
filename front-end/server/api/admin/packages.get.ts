import { defineEventHandler } from "h3";
import { getAdminGuidePackages } from "../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	return await getAdminGuidePackages(event);
});
