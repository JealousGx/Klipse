/**
 * Fixed-capacity FIFO set — evicts the oldest entry when full.
 * Prevents unbounded memory growth on long-lived Cloud Run instances.
 */
export class BoundedSet {
	private readonly map = new Map<string, true>();

	constructor(private readonly maxSize: number = 2_000) {}

	has(id: string): boolean {
		return this.map.has(id);
	}

	add(id: string): void {
		if (this.map.has(id)) return;
		if (this.map.size >= this.maxSize) {
			// Map preserves insertion order — first key is the oldest.
			const oldest = this.map.keys().next().value;
			if (oldest !== undefined) this.map.delete(oldest);
		}
		this.map.set(id, true);
	}

	delete(id: string): void {
		this.map.delete(id);
	}
}
