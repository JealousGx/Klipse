import { z } from "zod";

export const publishingDestinationSearchSchema = z.object({
	youtube: z.enum(["connected", "error"]).optional(),
	reason: z.string().optional(),
});

export type PublishingDestinationSearch = z.infer<
	typeof publishingDestinationSearchSchema
>;
