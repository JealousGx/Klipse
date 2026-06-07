/** Shared error types (client-safe) for channel flows. */

/**
 * Thrown when a TikTok channel is missing required posting configuration
 * (default privacy level, music usage confirmation, or incomplete disclosure).
 * Raised before credits are charged so no usage is wasted.
 */
export class TiktokChannelConfigIncompleteError extends Error {
	constructor(public readonly reason: string) {
		super(`TikTok channel config incomplete: ${reason}`)
		this.name = "TiktokChannelConfigIncompleteError"
	}
}

export class ChannelNotFoundError extends Error {
	constructor() {
		super("Channel not found.")
		this.name = "ChannelNotFoundError"
	}
}

export class ChannelLimitError extends Error {
	constructor(
		public readonly max: number,
		public readonly plan: string,
	) {
		super(`You can have up to ${max} channel(s) on the ${plan} plan.`)
		this.name = "ChannelLimitError"
	}
}
