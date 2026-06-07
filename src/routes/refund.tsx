import { createFileRoute, Link } from "@tanstack/react-router"

import { LegalArticle } from "@/components/LegalArticle"
import { siteConfig } from "@/config/site"

export const Route = createFileRoute("/refund")({
	head: () => ({
		meta: [
			{ title: `Refund Policy — ${siteConfig.name}` },
			{
				name: "description",
				content: `Refund Policy for ${siteConfig.name}. All purchases are final. Read before buying credits or a subscription.`,
			},
		],
		links: [{ rel: "canonical", href: `${siteConfig.origin}/refund` }],
	}),
	component: RefundPage,
})

const LAST_UPDATED = "April 16, 2026"

function RefundPage() {
	return (
		<main className="page-wrap px-4 pb-16 pt-12">
			<div className="island-shell max-w-3xl rounded-2xl p-8 sm:p-10">
				<LegalArticle>
					<h1>Refund Policy</h1>
					<p className="lead">Last updated: {LAST_UPDATED}</p>

					<h2>1. All Sales Are Final — No Exceptions</h2>
					<p>
						ALL PURCHASES ON {siteConfig.name.toUpperCase()} — INCLUDING
						SUBSCRIPTIONS AND CREDIT PACKS — ARE{" "}
						<strong>FINAL, NON-REFUNDABLE, AND NON-REVERSIBLE</strong>. BY
						COMPLETING A PURCHASE YOU EXPLICITLY ACKNOWLEDGE AND AGREE THAT NO
						REFUNDS WILL BE ISSUED UNDER ANY CIRCUMSTANCES WHATSOEVER, INCLUDING
						BUT NOT LIMITED TO:
					</p>
					<ul>
						<li>Unused, partially used, or expired credits.</li>
						<li>
							Dissatisfaction with AI-generated video outputs, quality, style,
							or results of any kind.
						</li>
						<li>Accidental, mistaken, or duplicate purchases.</li>
						<li>Change of mind after purchase, for any reason.</li>
						<li>
							Account deletion or closure with remaining credits or an active
							subscription.
						</li>
						<li>
							Subscription cancellation — access continues until the end of the
							current billing period; no prorated or partial refund is issued
							under any circumstances.
						</li>
						<li>
							Third-party platform actions (e.g., YouTube removing a published
							video, account strikes, demonetization, channel suspension or
							termination).
						</li>
						<li>
							Service downtime, outages, degraded performance, or AI provider
							failures.
						</li>
						<li>
							Failure of any third-party integration (OAuth, publishing APIs, AI
							model providers).
						</li>
						<li>
							Regulatory, legal, or platform-policy changes that affect your
							ability to use the Service.
						</li>
					</ul>

					<h2>2. Why We Have a Strict No-Refund Policy</h2>
					<p>
						{siteConfig.name} delivers AI-powered video generation services that
						consume substantial computational resources — including AI model API
						calls, video encoding infrastructure, and cloud storage —
						immediately and irreversibly upon use. These costs are incurred the
						moment a generation job is initiated, regardless of the outcome.
						Credits and subscription access provide instant access to this
						infrastructure that cannot be &quot;returned&quot; once provisioned.
						This policy is necessary to keep the platform sustainable and
						pricing fair for all users.
					</p>

					<h2>3. Free Tier and Trial</h2>
					<p>
						Every new account receives access to a free tier with limited
						generation capacity at no charge. We strongly encourage you to use
						the free tier to fully evaluate the Service — including output
						quality, and workflow fit — before making any purchase. By
						purchasing, you acknowledge that you have had the opportunity to
						evaluate the Service and that you accept these terms.
					</p>

					<h2>4. Pre-Purchase Responsibility</h2>
					<p>
						You are solely responsible for understanding what you are
						purchasing. Before buying any subscription or credit pack, you must:
					</p>
					<ul>
						<li>
							Review the plan details, pricing, and included features on our
							pricing page.
						</li>
						<li>Understand how credits are consumed per generation job.</li>
						<li>
							Test the Service using the free tier to verify it meets your
							requirements before upgrading.
						</li>
					</ul>
					<p>
						Claiming lack of knowledge of these terms is not a valid basis for a
						refund request.
					</p>

					<h2>5. Payment or Delivery Errors</h2>
					<p>
						If you experience a verified technical error where payment was
						successfully collected by us but credits or subscription access were
						definitively not applied to your account, contact us at{" "}
						<a href={`mailto:${siteConfig.supportEmail}`}>
							{siteConfig.supportEmail}
						</a>{" "}
						with documentation. We will investigate and, if the error is
						confirmed on our end, ensure your account is properly credited. This
						is a delivery error correction only — no monetary refund will be
						issued under any circumstances.
					</p>

					<h2>6. Chargebacks and Payment Disputes</h2>
					<p>
						Filing a chargeback, payment dispute, or reversal with your bank,
						card issuer, or payment processor without first contacting us and
						allowing us a reasonable opportunity to resolve the issue will
						result in:
					</p>
					<ul>
						<li>
							<strong>Immediate and permanent account suspension</strong> upon
							initiation of the dispute;
						</li>
						<li>
							Forfeiture of all remaining credits and subscription access;
						</li>
						<li>
							Potential legal action to recover disputed amounts plus costs and
							fees.
						</li>
					</ul>
					<p>
						If you believe there has been a genuine billing error, you{" "}
						<strong>must</strong> contact us directly at{" "}
						<a href={`mailto:${siteConfig.supportEmail}`}>
							{siteConfig.supportEmail}
						</a>{" "}
						before initiating any dispute process. We will make reasonable
						efforts to resolve legitimate billing errors promptly.
					</p>

					<h2>7. No Liability for Dissatisfaction</h2>
					<p>
						TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW,{" "}
						{siteConfig.name.toUpperCase()} SHALL NOT BE LIABLE FOR ANY LOSSES,
						DAMAGES, OR CLAIMS ARISING FROM DISSATISFACTION WITH AI-GENERATED
						OUTPUTS, FAILURE OF CONTENT TO ACHIEVE DESIRED RESULTS ON ANY
						PLATFORM, OR ANY OTHER OUTCOME OF USING THE SERVICE. YOUR SOLE
						REMEDY FOR DISSATISFACTION IS TO STOP USING THE SERVICE.
					</p>

					<h2>8. Changes to This Policy</h2>
					<p>
						We may update this Refund Policy at any time. Changes will be posted
						on this page with an updated &quot;Last updated&quot; date and apply
						to all purchases made after the effective date of the change. Your
						continued use of the Service after any update constitutes acceptance
						of the revised policy.
					</p>

					<h2>9. Contact Us</h2>
					<p>
						For billing questions or to report a payment delivery error, contact
						us at{" "}
						<a href={`mailto:${siteConfig.supportEmail}`}>
							{siteConfig.supportEmail}
						</a>
						.
					</p>

					<hr />

					<p className="text-sm text-muted-foreground">
						See also: <Link to="/terms">Terms of Service</Link> &middot;{" "}
						<Link to="/privacy">Privacy Policy</Link>
					</p>
				</LegalArticle>
			</div>
		</main>
	)
}
