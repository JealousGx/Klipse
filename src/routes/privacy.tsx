import { createFileRoute } from "@tanstack/react-router";

import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/privacy")({
	component: PrivacyPage,
});

function PrivacyPage() {
	return (
		<main className="page-wrap px-4 pb-16 pt-12">
			<div className="island-shell max-w-3xl rounded-2xl p-8 sm:p-10">
				<h1 className="mb-4 text-3xl font-bold text-[var(--sea-ink)]">
					Privacy Policy
				</h1>
				<p className="text-sm leading-relaxed text-[var(--sea-ink-soft)]">
					Placeholder privacy policy for {siteConfig.name}. Replace with a
					complete policy describing data processing, AI providers, and
					retention.
				</p>
			</div>
		</main>
	);
}
