import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function getEnvironment() {
	return process.env.NODE_ENV === "production" ? "production" : "qa";
}

export function isDefined<T>(value: T | undefined | null): value is T {
	return (
		value !== null &&
		value !== undefined &&
		(Array.isArray(value)
			? value.length > 0
			: typeof value === "object"
				? Object.keys(value).length > 0
				: true)
	);
}
