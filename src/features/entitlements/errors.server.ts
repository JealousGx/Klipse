/**
 * Thrown when a free-plan user already consumed their one successful assembly / content pipeline video.
 */
export class FreeTierVideoQuotaExhaustedError extends Error {
	override readonly name = "FreeTierVideoQuotaExhaustedError"
	constructor() {
		super("FREE_TIER_VIDEO_QUOTA_EXHAUSTED")
		Object.setPrototypeOf(this, new.target.prototype)
	}
}
