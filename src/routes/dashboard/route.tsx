import { createFileRoute, redirect } from "@tanstack/react-router";
import React from "react";

import { PolarCheckoutIntent } from "@/features/billing/polar-checkout-intent";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import {
	channelsQueryOptions,
	videoJobsQueryOptions,
} from "@/lib/queries/dashboard-queries";

export const Route = createFileRoute("/dashboard")({
	beforeLoad: ({ context }) => {
		const { session } = context;
		if (!session?.user) {
			throw redirect({
				to: "/",
				search: { auth: "login" },
			});
		}

		void context.queryClient.ensureQueryData(channelsQueryOptions);
		void context.queryClient.ensureQueryData(videoJobsQueryOptions);

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
	);
}
