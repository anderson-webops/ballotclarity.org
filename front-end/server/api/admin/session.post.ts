import { createError, defineEventHandler, readBody } from "h3";
import { createAdminSession } from "../../utils/admin-auth";

interface AdminLoginBody {
	password?: string;
	username?: string;
}

export default defineEventHandler(async (event) => {
	const body = await readBody<AdminLoginBody>(event);
	const username = typeof body?.username === "string" ? body.username.trim() : "";
	const password = typeof body?.password === "string" ? body.password : "";

	if (!username || !password) {
		throw createError({
			statusCode: 400,
			statusMessage: "Username and password are required."
		});
	}

	return await createAdminSession(event, username, password);
});
