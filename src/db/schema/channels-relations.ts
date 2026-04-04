import { relations } from "drizzle-orm";

import { channels } from "./channels";
import { users } from "./users";
import { videoJobs } from "./video-jobs";

export const channelsRelations = relations(channels, ({ one, many }) => ({
	user: one(users, {
		fields: [channels.userId],
		references: [users.id],
	}),
	videoJobs: many(videoJobs),
}));
