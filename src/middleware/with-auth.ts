import { createMiddleware } from "@tanstack/react-start"

import { auth } from "@/lib/auth"

export const withAuth = createMiddleware().server(async ({ next, request }) => {
	const session = await auth.api.getSession({ headers: request.headers })

	if (!session?.user) {
		throw new Response("unauthorized", { status: 401 })
	}

	return next({
		context: {
			user: session.user,
		},
	})
})
