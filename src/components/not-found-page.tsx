import { Link } from "@tanstack/react-router";
import { ArrowLeft, SearchX } from "lucide-react";

export function NotFoundPage() {
	return (
		<div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-center">
			<div className="relative mb-8">
				<div className="absolute inset-0 rounded-full bg-primary/10 blur-3xl" />
				<div className="relative flex size-24 items-center justify-center rounded-2xl border border-border bg-card shadow-lg">
					<SearchX className="size-10 text-muted-foreground" />
				</div>
			</div>

			<p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
				404
			</p>
			<h1 className="mb-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
				Page not found
			</h1>
			<p className="mb-8 max-w-sm text-base text-muted-foreground">
				This page doesn't exist or you don't have permission to view it.
			</p>

			<Link
				to="/"
				className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
			>
				<ArrowLeft className="size-4" />
				Back to home
			</Link>
		</div>
	);
}
