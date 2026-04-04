import { z } from "zod";

export const rootSearchSchema = z.object({
	auth: z.enum(["login", "signup"]).optional(),
});

export type RootSearch = z.infer<typeof rootSearchSchema>;
