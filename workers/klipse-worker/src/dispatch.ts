import {
	QUEUE_MESSAGE_KIND,
	type QueueMessage,
} from "@klipse/worker-contracts";
import { callMainAppPlatformPublish } from "./call-main-platform-publish";
import { callMainAppVideoJobDispatch } from "./call-main-video-job";
import type { Env } from "./env";

/** Route queue payloads to handlers — extend with new `kind` branches as jobs are added. */
export async function dispatchQueueMessage(
	body: QueueMessage,
	env: Env,
): Promise<void> {
	if (body.kind === QUEUE_MESSAGE_KIND.platformPublish) {
		await callMainAppPlatformPublish(env, body);
		return;
	}
	await callMainAppVideoJobDispatch(env, body);
}
