import { Share2 } from "lucide-react"
import { type ComponentType, useState } from "react"

import { cn } from "@/lib/utils"

type Size = "sm" | "md"

const sizeClass: Record<Size, string> = {
	sm: "size-10 rounded-xl text-[13px]",
	md: "size-12 rounded-xl text-base",
}

export function PublishingChannelThumbnail({
	className,
	src,
	alt,
	size = "sm",
	fallbackIcon: FallbackIcon = Share2,
}: {
	className?: string
	src: string | null | undefined
	alt: string
	size?: Size
	fallbackIcon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
}) {
	const [failed, setFailed] = useState(false)
	const showImg = Boolean(src?.trim()) && !failed

	return (
		<div
			className={cn(
				"relative flex shrink-0 items-center justify-center overflow-hidden bg-muted/60 text-muted-foreground",
				sizeClass[size],
				className,
			)}
		>
			{showImg ? (
				<img
					src={src as string}
					alt={alt}
					className="size-full object-cover"
					referrerPolicy="no-referrer"
					onError={() => setFailed(true)}
				/>
			) : (
				<FallbackIcon className="size-[42%] opacity-80" aria-hidden />
			)}
		</div>
	)
}
