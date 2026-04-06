import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { auth } from "@/lib/auth";

import {
	listVideoJobsForUser,
	setPublishApprovalForUser,
} from "./video-jobs.service.server";

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

const publishApprovalSchema = z.object({
	jobId: z.string().trim().min(1).max(64),
	decision: z.enum(["approved", "rejected"]),
});

export type PublishVideoJobApprovalResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" }
	| { ok: false; code: "not_found" | "invalid_state" };

export const publishVideoJobApprovalFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => publishApprovalSchema.parse(raw))
	.handler(async ({ data }): Promise<PublishVideoJobApprovalResult> => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return { ok: false, code: "unauthorized" };
		}
		const result = await setPublishApprovalForUser({
			userId: session.user.id,
			jobId: data.jobId,
			decision: data.decision,
		});
		if (!result.ok) {
			return { ok: false, code: result.code };
		}
		return { ok: true };
	});
