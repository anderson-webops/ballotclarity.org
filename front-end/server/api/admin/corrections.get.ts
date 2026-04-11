import { defineEventHandler } from "h3";
import { getAdminCorrections } from "../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	return await getAdminCorrections(event);
});
