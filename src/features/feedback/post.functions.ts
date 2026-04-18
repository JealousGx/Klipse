import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { submitBugReport } from "@/features/feedback/post.server";

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const bugReportSchema = z.object({
	title: z.string().min(5, "Title must be at least 5 characters").max(100),
	what: z
		.string()
		.min(10, "Please describe what happened (min 10 chars)")
		.max(1000),
	steps: z.string().max(1000).optional(),
	expected: z.string().max(500).optional(),
	severity: z.enum(["low", "medium", "high", "critical"]),
	page: z.string().max(200).optional(),
});

export type BugReportInput = z.infer<typeof bugReportSchema>;

// ---------------------------------------------------------------------------
// submitBug
// ---------------------------------------------------------------------------

export const submitBug = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => bugReportSchema.parse(raw))
	.handler(async ({ data }) => {
		return submitBugReport(getRequest(), data);
	});
