import "@tanstack/react-start/server-only"

/**
 * Round-robin key selection for multi-key lists (from DB rows or comma-separated env).
 */
export class ApiKeyPool {
	private readonly keys: string[]
	private i = 0

	constructor(raw: string | string[] | undefined) {
		if (Array.isArray(raw)) {
			this.keys = raw.map((k) => k.trim()).filter(Boolean)
		} else {
			this.keys = (raw ?? "")
				.split(",")
				.map((k) => k.trim())
				.filter(Boolean)
		}
	}

	/** True when at least one key is configured. */
	hasKeys(): boolean {
		return this.keys.length > 0
	}

	next(): string | undefined {
		if (this.keys.length === 0) {
			return undefined
		}
		const key = this.keys[this.i % this.keys.length]
		this.i += 1
		return key
	}
}

/** Same round-robin order as `ApiKeyPool`, for arbitrary items (e.g. credential objects). */
export class RoundRobinPool<T> {
	private readonly items: readonly T[]
	private i = 0

	constructor(items: readonly T[]) {
		this.items = items
	}

	next(): T | undefined {
		if (this.items.length === 0) {
			return undefined
		}
		const item = this.items[this.i % this.items.length]
		this.i += 1
		return item
	}
}
