import { createFileRoute, redirect } from "@tanstack/react-router";
import React from "react";

import { PolarCheckoutIntent } from "@/features/billing/polar-checkout-intent";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import {
	channelsQueryOptions,
	videoJobsQueryOptions,
} from "@/lib/queries/dashboard-queries";

export const Route = createFileRoute("/_authed/dashboard")({
	beforeLoad: async ({ context }) => {
		const { session } = context;
		if (!session?.user) {
			throw redirect({
				to: "/",
				search: { auth: "login" },
			})
		}

		/** Await so SSR output matches client hydration (same query state as `useQuery`). */
		await context.queryClient.ensureQueryData(channelsQueryOptions);
		await context.queryClient.ensureQueryData(videoJobsQueryOptions);

		return { session };
	},
	component: DashboardLayout,
});

function DashboardLayout() {
	return (
		<React.Fragment>
			<PolarCheckoutIntent />
			<DashboardShell />
		</React.Fragment>
	)
}
