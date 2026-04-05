import { createFileRoute } from "@tanstack/react-router";

import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/refund")({
	component: RefundPage,
});

function RefundPage() {
	return (
		<main className="page-wrap px-4 pb-16 pt-12">
			<div className="island-shell max-w-3xl rounded-2xl p-8 sm:p-10">
				<h1 className="mb-4 text-3xl font-bold text-[var(--sea-ink)]">
					Refund Policy
				</h1>
				<p className="text-sm leading-relaxed text-[var(--sea-ink-soft)]">
					{siteConfig.name} does not offer refunds on subscriptions or credit
					purchases except where required by law. This page is a placeholder;
					align with your payment provider and counsel.
				</p>
			</div>
		</main>
	);
}
