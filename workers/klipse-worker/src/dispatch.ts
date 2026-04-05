import type { QueueMessage } from "@klipse/worker-contracts";

import { callMainAppDrain } from "./call-main-drain";
import type { Env } from "./env";

const DEFAULT_LIMIT = 25;

/** Route queue payloads to handlers — extend with new `kind` branches as jobs are added. */
export async function dispatchQueueMessage(
	body: QueueMessage,
	env: Env,
): Promise<void> {
	await callMainAppDrain(env, body.limit ?? DEFAULT_LIMIT);
}
