import { createFileRoute } from "@tanstack/react-router";

import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/terms")({
	component: TermsPage,
});

function TermsPage() {
	return (
		<main className="page-wrap px-4 pb-16 pt-12">
			<div className="island-shell max-w-3xl rounded-2xl p-8 sm:p-10">
				<h1 className="mb-4 text-3xl font-bold text-[var(--sea-ink)]">
					Terms of Service
				</h1>
				<p className="text-sm leading-relaxed text-[var(--sea-ink-soft)]">
					Placeholder terms for {siteConfig.name}. Replace with counsel-approved
					legal text before launch.
				</p>
			</div>
		</main>
	);
}
