import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { meQueryKey } from "@/features/user/hooks/use-me";

import { authClient } from "@/lib/auth/client";

/**
 * Keeps TanStack Query in sync with Better Auth: refetch `/api/me` on sign-in / account
 * switch, and drop cached profile on sign-out.
 */
export function AuthQuerySync() {
	const queryClient = useQueryClient();
	const { data: session, isPending } = authClient.useSession();
	const lastUserId = useRef<string | undefined>(undefined);

	useEffect(() => {
		if (isPending) {
			return;
		}
		const id = session?.user?.id;
		if (id === lastUserId.current) {
			return;
		}
		lastUserId.current = id;
		if (id) {
			void queryClient.invalidateQueries({ queryKey: meQueryKey });
		} else {
			queryClient.removeQueries({ queryKey: meQueryKey });
		}
	}, [isPending, queryClient, session?.user?.id]);

	return null;
}
