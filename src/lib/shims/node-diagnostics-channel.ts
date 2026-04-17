// No-op shim for node:diagnostics_channel — CF Workers polyfill is incomplete
// and causes "Failed to publish diagnostics channel message" errors from Better Auth.

class Channel {
	readonly name: string | symbol;
	readonly hasSubscribers = false;
	constructor(name: string | symbol) {
		this.name = name;
	}
	publish(_message: unknown): void {}
	subscribe(_fn: (...args: unknown[]) => void): void {}
	unsubscribe(_fn: (...args: unknown[]) => void): boolean {
		return false;
	}
	bindStore(_store: unknown, _transform?: unknown): void {}
	unbindStore(_store: unknown): boolean {
		return false;
	}
	runStores(_context: unknown, _fn: () => void): void {
		_fn();
	}
}

const channels = new Map<string | symbol, Channel>();

export function channel(name: string | symbol): Channel {
	if (!channels.has(name)) channels.set(name, new Channel(name));
	return channels.get(name)!;
}
export function subscribe(_name: string | symbol, _fn: unknown): void {}
export function unsubscribe(_name: string | symbol, _fn: unknown): boolean {
	return false;
}
export function hasSubscribers(_name: string | symbol): boolean {
	return false;
}
export function tracingChannel(_name: string | symbol) {
	return {
		start: new Channel(`${String(_name)}:start`),
		end: new Channel(`${String(_name)}:end`),
		asyncStart: new Channel(`${String(_name)}:asyncStart`),
		asyncEnd: new Channel(`${String(_name)}:asyncEnd`),
		error: new Channel(`${String(_name)}:error`),
		traceSync: (_fn: () => void) => _fn(),
		tracePromise: async (_fn: () => Promise<unknown>) => _fn(),
		traceCallback: (_fn: (...args: unknown[]) => void, ...args: unknown[]) =>
			_fn(...args),
	};
}

export default { channel, subscribe, unsubscribe, hasSubscribers, tracingChannel };
