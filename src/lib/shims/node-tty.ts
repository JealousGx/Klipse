// No-op shim for node:tty — not available in CF Workers runtime.

export function isatty(_fd: number): boolean {
	return false;
}

export class ReadStream extends EventTarget {
	isTTY = false;
	isRaw = false;
	setRawMode(_mode: boolean): this {
		return this;
	}
}

export class WriteStream extends EventTarget {
	isTTY = false;
	columns = 80;
	rows = 24;
	getColorDepth(_env?: object): number {
		return 1;
	}
	hasColors(_count?: number, _env?: object): boolean {
		return false;
	}
	getWindowSize(): [number, number] {
		return [this.columns, this.rows];
	}
	clearLine(_dir: number, _cb?: () => void): boolean {
		return false;
	}
	clearScreenDown(_cb?: () => void): boolean {
		return false;
	}
	cursorTo(_x: number, _y?: number, _cb?: () => void): boolean {
		return false;
	}
	moveCursor(_dx: number, _dy: number, _cb?: () => void): boolean {
		return false;
	}
}

export default { isatty, ReadStream, WriteStream };
