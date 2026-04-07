import type { QueueMessage } from "@klipse/worker-contracts";
import { callMainAppVideoJobDispatch } from "./call-main-video-job";
import type { Env } from "./env";

/** Route queue payloads to handlers — extend with new `kind` branches as jobs are added. */
export async function dispatchQueueMessage(
	body: QueueMessage,
	env: Env,
): Promise<void> {
	await callMainAppVideoJobDispatch(env, body);
}
