import type { ImgHTMLAttributes } from "react"

import { cn } from "@/lib/utils"

export type OptimizedImageProps = Omit<
	ImgHTMLAttributes<HTMLImageElement>,
	"decoding" | "loading"
> & {
	/**
	 * Above-the-fold / LCP — `loading="eager"` and `fetchPriority="high"`.
	 * Omit for below-fold or decorative chrome where defaults apply.
	 */
	priority?: boolean
	/** Defaults to `async` (non-blocking decode). */
	decoding?: "async" | "sync" | "auto"
	/**
	 * Explicit loading hint. If omitted: `lazy` unless `priority` is true (then `eager`).
	 */
	loading?: "lazy" | "eager"
}

/**
 * Standard `<img>` defaults for performance: async decode, lazy load unless
 * `priority`, and high fetch priority only when marked LCP-critical.
 */
export function OptimizedImage({
	priority = false,
	decoding = "async",
	loading: loadingProp,
	className,
	alt,
	...rest
}: OptimizedImageProps) {
	const loading = loadingProp ?? (priority ? "eager" : "lazy")

	return (
		<img
			{...rest}
			alt={alt ?? ""}
			className={cn(className)}
			decoding={decoding}
			fetchPriority={priority ? "high" : undefined}
			loading={loading}
		/>
	)
}
