import {
	QUEUE_MESSAGE_KIND,
	type QueueMessage,
} from "@klipse/worker-contracts";
import { callMainAppDrain } from "./call-main-drain";
import { callMainAppVideoJobDispatch } from "./call-main-video-job";
import type { Env } from "./env";

const DEFAULT_LIMIT = 25;

/** Route queue payloads to handlers — extend with new `kind` branches as jobs are added. */
export async function dispatchQueueMessage(
	body: QueueMessage,
	env: Env,
): Promise<void> {
	switch (body.kind) {
		case QUEUE_MESSAGE_KIND.polarUsageSyncDrain:
			await callMainAppDrain(env, body.limit ?? DEFAULT_LIMIT);
			return;
		case QUEUE_MESSAGE_KIND.videoJobDispatch:
			await callMainAppVideoJobDispatch(env, body);
			return;
		default: {
			const _exhaustive: never = body;
			return _exhaustive;
		}
	}
}
