import { defineEventHandler } from "h3";
import { getAdminAudit } from "../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	return await getAdminAudit(event);
});
