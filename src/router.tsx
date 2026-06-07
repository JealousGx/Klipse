import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"

import "@/types/tanstack-router"

import { getContext } from "./integrations/tanstack-query/root-provider"
import { initSentryClient } from "./lib/sentry"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
	const context = getContext()

	const router = createTanStackRouter({
		routeTree,
		context,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
	})

	if (!router.isServer) {
		initSentryClient(router)
	}

	setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

	return router
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>
	}
}
