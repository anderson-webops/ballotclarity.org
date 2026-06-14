import { defineEventHandler } from "h3";
import { createAdminMfaSetup } from "../../../../utils/admin-auth";

export default defineEventHandler(async (event) => {
	return await createAdminMfaSetup(event);
});
