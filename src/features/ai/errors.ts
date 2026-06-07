/** Thrown when script generation exhausts Pollinations → Gemini with no success. */
export class ScriptGenerationFailedError extends Error {
	override readonly name = "ScriptGenerationFailedError"
	constructor(
		message: string,
		readonly attempts: readonly string[],
	) {
		super(message)
		Object.setPrototypeOf(this, new.target.prototype)
	}
}
