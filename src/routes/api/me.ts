import { createFileRoute } from "@tanstack/react-router";

import { getUserProfileById } from "@/features/user/services/user-profile";
import { requireSession } from "@/lib/auth/require-session.server";

export const Route = createFileRoute("/api/me")({
	server: {
		handlers: {
			GET: async () => {
				const session = await requireSession();
				const row = await getUserProfileById(session.user.id);
				if (!row) {
					return Response.json({ error: "User not found" }, { status: 404 });
				}
				return Response.json({
					id: row.id,
					email: row.email,
					name: row.name,
					plan: row.plan,
					creditsRemaining: row.creditsRemaining,
					creditsUsed: row.creditsUsed,
					freeVideoConsumed: row.freeVideoConsumed,
					image: row.image ?? null,
				});
			},
		},
	},
});
