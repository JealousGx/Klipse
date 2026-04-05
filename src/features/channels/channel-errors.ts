/** Shared error types (client-safe) for channel flows. */

export class ChannelNotFoundError extends Error {
	constructor() {
		super("Channel not found.");
		this.name = "ChannelNotFoundError";
	}
}

export class ChannelLimitError extends Error {
	constructor(
		public readonly max: number,
		public readonly plan: string,
	) {
		super(`You can have up to ${max} channel(s) on the ${plan} plan.`);
		this.name = "ChannelLimitError";
	}
}
