import { useQuery } from "@tanstack/react-query";

import type { MeResponse } from "@/features/user/types/me";

import { authClient } from "@/lib/auth/client";

export const meQueryKey = ["me"] as const;

async function fetchMe(): Promise<MeResponse> {
	const res = await fetch("/api/me", { credentials: "include" });
	if (res.status === 401) {
		throw new Error("Unauthorized");
	}
	if (!res.ok) {
		throw new Error("Failed to load profile");
	}
	return res.json() as Promise<MeResponse>;
}

/**
 * Authenticated user profile (plan, credits) from `/api/me`.
 * Only runs when a session exists so public routes do not hit this endpoint.
 * Under `/dashboard/*`, prefer `useDashboardRouteContext()` — session user includes
 * `user.additionalFields` (plan, credits) from Better Auth.
 */
export function useMe() {
	const { data: session, isPending: sessionPending } = authClient.useSession();

	return useQuery({
		queryKey: meQueryKey,
		queryFn: fetchMe,
		enabled: !sessionPending && !!session?.user,
		staleTime: 60_000,
	});
}
