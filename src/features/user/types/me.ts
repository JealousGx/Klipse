import { z } from "zod";

export const planSchema = z.enum(["free", "starter", "creator", "empire"]);

export const meResponseSchema = z.object({
	id: z.string(),
	email: z.email(),
	name: z.string(),
	plan: planSchema,
	creditsRemaining: z.number().int(),
	creditsUsed: z.number().int(),
	freeVideoConsumed: z.boolean(),
	image: z.string().nullable().optional(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
