import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { auth } from "@/lib/auth";

import { listVideoJobsForUser } from "./video-jobs.service.server";

export type ListJobsResult =
	| { ok: true; jobs: Awaited<ReturnType<typeof listVideoJobsForUser>> }
	| { ok: false; code: "unauthorized" };

export const listVideoJobsFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<ListJobsResult> => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return { ok: false, code: "unauthorized" };
		}
		const jobs = await listVideoJobsForUser(session.user.id);
		return { ok: true, jobs };
	},
);
