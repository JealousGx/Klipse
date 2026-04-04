import { useRouteContext } from "@tanstack/react-router";

/**
 *
 * @returns
 */
export function useDashboardRouteContext() {
	return useRouteContext({ from: "/dashboard" });
}
