import "@tanstack/react-start/server-only";

import { getRequest } from "@tanstack/react-start/server";

import { auth } from "@/lib/auth";

/** Server-only session read (cookies via current request). */
export async function getServerSession() {
	const request = getRequest();
	return auth.api.getSession({ headers: request.headers });
}
