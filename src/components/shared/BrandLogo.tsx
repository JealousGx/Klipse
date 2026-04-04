import { useState } from "react";

import { Link } from "@/components/ui/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

import { OptimizedImage } from "./OptimizedImage";

export interface BrandLogoProps {
	size?: "sm" | "md" | "lg" | "xl";
	withText?: boolean;
	className?: string;
	to?: "/" | "/dashboard";
	wordmarkClassName?: string;
	priority?: boolean;
}

const sizeConfig = {
	sm: {
		icon: 18,
		imgClass: "h-[18px] w-[18px] min-h-[18px] min-w-[18px]",
		text: "text-xs",
		rounded: "rounded-md",
	},
	md: {
		icon: 24,
		imgClass: "h-6 w-6 min-h-6 min-w-6",
		text: "text-base",
		rounded: "rounded-lg",
	},
	lg: {
		icon: 30,
		imgClass: "h-[30px] w-[30px] min-h-[30px] min-w-[30px]",
		text: "text-xl",
		rounded: "rounded-xl",
	},
	xl: {
		icon: 40,
		imgClass: "h-10 w-10 min-h-10 min-w-10",
		text: "text-2xl sm:text-[1.75rem]",
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

	const logoLinkClass = cn(
		"inline-flex !h-auto min-h-0 !justify-start gap-0 !rounded-none !bg-transparent !p-0 !shadow-none hover:!bg-transparent dark:hover:!bg-transparent",
		!withText && "shrink-0",
		withText &&
			"items-center font-heading font-bold tracking-tight text-foreground",
		className,
	);

	if (!withText) {
		return (
			<Link
				to={to}
				variant="ghost"
				className={logoLinkClass}
				aria-label={`${siteConfig.name} home`}
			>
				{mark}
			</Link>
		);
	}

	return (
		<Link to={to} variant="ghost" className={logoLinkClass}>
			{mark}
			<span className={cn("font-semibold tracking-tight", config.text)}>
				<span className={cn("text-primary", wordmarkClassName)}>
					{siteConfig.name.slice(1)}
				</span>
			</span>
		</Link>
	);
}
