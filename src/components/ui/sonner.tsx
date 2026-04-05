"use client";

import { useSyncExternalStore } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { cn } from "@/lib/utils";

function subscribeToHtmlClass(onStoreChange: () => void) {
	const el = document.documentElement;
	const observer = new MutationObserver(() => {
		onStoreChange();
	});
	observer.observe(el, { attributes: true, attributeFilter: ["class"] });
	return () => {
		observer.disconnect();
	};
}

function getSnapshotTheme(): "light" | "dark" {
	return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerTheme(): "light" | "dark" {
	return "light";
}

function useHtmlTheme() {
	return useSyncExternalStore(
		subscribeToHtmlClass,
		getSnapshotTheme,
		getServerTheme,
	);
}

export function Toaster(props: ToasterProps) {
	const theme = useHtmlTheme();

	return (
		<Sonner
			{...props}
			theme={theme}
			richColors
			className={cn("toaster group", props.className)}
			position={props.position ?? "top-center"}
			closeButton={props.closeButton ?? true}
		/>
	);
}
