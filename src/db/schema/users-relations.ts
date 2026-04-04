import { relations } from "drizzle-orm";

import { accounts } from "./accounts";
import { channels } from "./channels";
import { creditTransactions } from "./credit-transactions";
import { polarUsageSync } from "./polar-usage-sync";
import { sessions } from "./sessions";
import { usageIdempotency } from "./usage-idempotency";
import { users } from "./users";
import { videoJobs } from "./video-jobs";

export const usersRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	accounts: many(accounts),
	channels: many(channels),
	videoJobs: many(videoJobs),
	creditTransactions: many(creditTransactions),
	polarUsageSyncRows: many(polarUsageSync),
	usageIdempotencyRows: many(usageIdempotency),
}));
