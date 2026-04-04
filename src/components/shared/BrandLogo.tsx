import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

import { OptimizedImage } from "./OptimizedImage";

export interface BrandLogoProps {
	size?: "sm" | "md" | "lg";
	withText?: boolean;
	className?: string;
	to?: "/" | "/dashboard" | (string & {});
	wordmarkClassName?: string;
	/** Marketing / LCP: high fetch priority. App chrome: omit. */
	priority?: boolean;
}

/** Display size for the mark (keeps layout consistent even with large source PNGs). */
const sizeConfig = {
	sm: {
		icon: 18,
		imgClass: "h-[18px] w-[18px] min-h-[18px] min-w-[18px]",
		text: "text-xs",
		gap: "gap-1.5",
		rounded: "rounded-md",
	},
	md: {
		icon: 24,
		imgClass: "h-6 w-6 min-h-6 min-w-6",
		text: "text-base",
		gap: "gap-2",
		rounded: "rounded-lg",
	},
	lg: {
		icon: 30,
		imgClass: "h-[30px] w-[30px] min-h-[30px] min-w-[30px]",
		text: "text-xl",
		gap: "gap-2.5",
		rounded: "rounded-xl",
	},
} as const;

export function BrandLogo({
	size = "md",
	withText = false,
	className,
	to = "/",
	wordmarkClassName,
	priority = false,
}: BrandLogoProps) {
	const config = sizeConfig[size];
	const [imgFailed, setImgFailed] = useState(false);

	const mark = imgFailed ? (
		<div
			className={cn(
				"flex shrink-0 items-center justify-center bg-linear-to-br from-primary to-chart-2 font-bold text-primary-foreground shadow-sm",
				config.rounded,
			)}
			style={{
				width: config.icon,
				height: config.icon,
				fontSize: Math.max(12, config.icon * 0.38),
			}}
			aria-hidden
		>
			{siteConfig.name.charAt(0).toUpperCase()}
		</div>
	) : (
		<OptimizedImage
			src="/logo.png"
			alt=""
			width={config.icon}
			height={config.icon}
			className={cn(
				"shrink-0 object-contain object-center",
				config.imgClass,
				config.rounded,
			)}
			loading="eager"
			priority={priority}
			onError={() => setImgFailed(true)}
		/>
	);

	if (!withText) {
		return (
			<Link
				to={to}
				className={cn("inline-flex shrink-0", className)}
				aria-label={`${siteConfig.name} home`}
			>
				{mark}
			</Link>
		);
	}

	return (
		<Link
			to={to}
			className={cn(
				"inline-flex items-center font-heading font-bold tracking-tight text-foreground",
				config.gap,
				className,
			)}
		>
			{mark}
			<span className={cn("font-semibold tracking-tight", config.text)}>
				<span className={cn("text-primary", wordmarkClassName)}>
					{siteConfig.name.slice(1)}
				</span>
			</span>
		</Link>
	);
}
