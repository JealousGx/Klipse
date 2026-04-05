import { createFileRoute, redirect } from "@tanstack/react-router";
import React from "react";

import { PolarCheckoutIntent } from "@/features/billing/polar-checkout-intent";
import { DashboardShell } from "@/features/shell/dashboard-shell";

export const Route = createFileRoute("/dashboard")({
	beforeLoad: async ({ context }) => {
		const { session } = context;
		if (!session?.user) {
			throw redirect({
				to: "/",
				search: { auth: "login" },
			});
		}

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
