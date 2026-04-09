import { useRouter } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

interface ErrorPageProps {
	error?: unknown;
	reset?: () => void;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "An unexpected error occurred.";
}

export function ErrorPage({ error, reset }: ErrorPageProps) {
	const router = useRouter();
	const message = getErrorMessage(error);

	return (
		<div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-center">
			<div className="relative mb-8">
				<div className="absolute inset-0 rounded-full bg-destructive/10 blur-3xl" />
				<div className="relative flex size-24 items-center justify-center rounded-2xl border border-destructive/20 bg-card shadow-lg">
					<AlertTriangle className="size-10 text-destructive" />
				</div>
			</div>

			<p className="mb-2 text-xs font-semibold uppercase tracking-widest text-destructive">
				Error
			</p>
			<h1 className="mb-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
				Something went wrong
			</h1>
			<p className="mb-2 max-w-sm text-base text-muted-foreground">
				{message}
			</p>
			<p className="mb-8 text-xs text-muted-foreground/60">
				If this keeps happening, please contact support.
			</p>

			<div className="flex flex-wrap items-center justify-center gap-3">
				{reset && (
					<button
						type="button"
						onClick={reset}
						className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
					>
						<RefreshCw className="size-4" />
						Try again
					</button>
				)}
				<button
					type="button"
					onClick={() => router.history.back()}
					className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent"
				>
					<ArrowLeft className="size-4" />
					Go back
				</button>
			</div>
		</div>
	);
}
