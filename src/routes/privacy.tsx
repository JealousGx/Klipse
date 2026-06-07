import { createFileRoute, Link } from "@tanstack/react-router"

import { LegalArticle } from "@/components/LegalArticle"
import { siteConfig } from "@/config/site"

export const Route = createFileRoute("/privacy")({
	head: () => ({
		meta: [
			{ title: `Privacy Policy — ${siteConfig.name}` },
			{
				name: "description",
				content: `Privacy Policy for ${siteConfig.name}. Learn how we collect, use, and protect your data.`,
			},
		],
		links: [{ rel: "canonical", href: `${siteConfig.origin}/privacy` }],
	}),
	component: PrivacyPage,
})

const LAST_UPDATED = "April 16, 2026"

function PrivacyPage() {
	return (
		<main className="page-wrap px-4 pb-16 pt-12">
			<div className="island-shell max-w-3xl rounded-2xl p-8 sm:p-10">
				<LegalArticle>
					<h1>Privacy Policy</h1>
					<p className="lead">Last updated: {LAST_UPDATED}</p>

					<p>
						{siteConfig.name} (&quot;we,&quot; &quot;us,&quot; or
						&quot;our&quot;) operates the {siteConfig.name} platform (the
						&quot;Service&quot;). This Privacy Policy explains how we collect,
						use, disclose, and safeguard your information when you use our
						Service. By using the Service, you consent to the practices
						described in this policy.
					</p>

					<h2>1. Information We Collect</h2>

					<h3>1.1 Personal Information You Provide</h3>
					<ul>
						<li>
							<strong>Account data:</strong> Name, email address, and profile
							picture when you create an account.
						</li>
						<li>
							<strong>Authentication data:</strong> Passwords (hashed and never
							stored in plaintext), OAuth tokens from third-party providers
							(e.g., Google, YouTube), and one-time passcodes.
						</li>
						<li>
							<strong>Payment data:</strong> Billing information processed
							through our payment provider, Polar.sh. We do not store full
							credit card numbers on our servers.
						</li>
						<li>
							<strong>Content data:</strong> Video ideas, channel configuration,
							and publishing preferences you submit to generate videos.
						</li>
						<li>
							<strong>Connected accounts:</strong> OAuth tokens for third-party
							publishing platforms (YouTube, TikTok, etc.) that you choose to
							connect.
						</li>
					</ul>

					<h3>1.2 Information Collected Automatically</h3>
					<ul>
						<li>
							<strong>Usage data:</strong> Pages visited, features used, credit
							consumption, video generation jobs, and interaction patterns.
						</li>
						<li>
							<strong>Device data:</strong> IP address, browser type, operating
							system, and device identifiers.
						</li>
						<li>
							<strong>Cookies:</strong> Session cookies for authentication and
							preferences. We use essential cookies only — no advertising or
							third-party tracking cookies.
						</li>
					</ul>

					<h2>2. How We Use Your Information</h2>
					<ul>
						<li>To provide, operate, maintain, and improve the Service.</li>
						<li>
							To generate AI-powered video scripts, images, voiceovers, and
							metadata based on your input.
						</li>
						<li>
							To publish videos to your connected third-party platform accounts
							on your behalf when you authorize us to do so.
						</li>
						<li>
							To process payments and manage subscription and credit balances.
						</li>
						<li>
							To send transactional emails (verification codes, receipts).
						</li>
						<li>To respond to support inquiries.</li>
						<li>
							To detect, prevent, and address security issues, fraud, or abuse.
						</li>
						<li>
							To enforce our Terms of Service and protect our legal rights.
						</li>
					</ul>

					<h2>3. How We Share Your Information</h2>
					<p>
						We do not sell your personal information. We may share data with:
					</p>
					<ul>
						<li>
							<strong>AI providers:</strong> Your video ideas and channel
							configuration are sent to third-party AI model providers (e.g.,
							Google Gemini, ElevenLabs, OpenRouter) to generate content. These
							providers have their own privacy policies and data practices, and
							we are not responsible for how they process data once transmitted.
						</li>
						<li>
							<strong>Publishing platforms:</strong> When you connect a
							third-party account and authorize publishing, video content and
							metadata are sent to that platform (e.g., YouTube Data API) using
							your OAuth credentials. We have no control over how those
							platforms handle the content after delivery.
						</li>
						<li>
							<strong>Service providers:</strong> Payment processors (Polar.sh),
							email delivery (Resend), cloud storage (Cloudflare R2), and
							database hosting — only as necessary to operate the Service.
						</li>
						<li>
							<strong>Legal compliance:</strong> When required or permitted by
							law, regulation, legal process, subpoena, or governmental request,
							or to protect the safety, rights, or property of {siteConfig.name}
							, users, or the public.
						</li>
						<li>
							<strong>Business transfers:</strong> In connection with a merger,
							acquisition, financing, reorganization, or sale of all or a
							portion of our assets, your data may be transferred as part of
							that transaction.
						</li>
					</ul>

					<h2>4. Third-Party Services — No Liability</h2>
					<p>
						The Service relies on and integrates with numerous third-party
						services including AI providers, cloud infrastructure, payment
						processors, and publishing platforms. We are not responsible for the
						privacy or security practices of any third-party service. Once data
						is transmitted to a third-party provider in order to fulfill your
						request, that data is governed by that provider&apos;s own privacy
						policy. We strongly encourage you to review the privacy policies of
						any third-party services you connect to through our platform.
					</p>

					<h2>5. Data Storage and Security</h2>
					<p>
						We implement industry-standard technical and organizational security
						measures including TLS encryption in transit, encryption at rest,
						hashed passwords, secure session management, and access controls.
						However, no method of transmission or storage is 100% secure. We
						cannot guarantee the absolute security of your information, and you
						use the Service at your own risk.
					</p>
					<p>
						Generated video files are stored in Cloudflare R2 and are subject to
						retention limits based on your plan. Free-tier videos may be purged
						after a shorter retention window without notice.
					</p>

					<h2>6. Data Retention</h2>
					<p>
						We retain your personal data for as long as your account is active
						or as needed to provide the Service. You may request deletion of
						your account and associated data at any time through the Settings
						page. Upon deletion, we will remove your personal data within 30
						days, except where retention is required by applicable law,
						regulation, or legitimate business purposes (e.g., fraud prevention,
						dispute resolution, or legal compliance).
					</p>

					<h2>7. Your Rights</h2>
					<p>
						Depending on your jurisdiction, you may have the right to access,
						correct, delete, restrict, or port your personal data, or to
						withdraw consent. To exercise these rights, contact us at{" "}
						<a href={`mailto:${siteConfig.supportEmail}`}>
							{siteConfig.supportEmail}
						</a>
						. We will respond within a reasonable timeframe and in accordance
						with applicable law. We may need to verify your identity before
						processing requests.
					</p>
					<p>
						We cannot delete data that we are legally required to retain or that
						is necessary to resolve an ongoing dispute or enforce our
						agreements.
					</p>

					<h2>8. Children&apos;s Privacy</h2>
					<p>
						The Service is not intended for users under 16 years of age. We do
						not knowingly collect personal data from children under 16. If we
						become aware that we have collected such data, we will take
						reasonable steps to delete it. We disclaim any liability arising
						from use of the Service by minors.
					</p>

					<h2>9. Limitation of Liability for Privacy Incidents</h2>
					<p>
						TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW,{" "}
						{siteConfig.name.toUpperCase()} SHALL NOT BE LIABLE FOR ANY DAMAGES,
						LOSSES, OR HARM ARISING FROM UNAUTHORIZED ACCESS TO, DISCLOSURE OF,
						OR DESTRUCTION OF YOUR PERSONAL DATA, INCLUDING INCIDENTS RESULTING
						FROM THIRD-PARTY BREACHES, FORCE MAJEURE, OR CIRCUMSTANCES BEYOND
						OUR REASONABLE CONTROL. OUR TOTAL LIABILITY FOR ANY PRIVACY-RELATED
						CLAIM SHALL NOT EXCEED THE AMOUNT YOU PAID FOR THE SERVICE IN THE
						ONE (1) MONTH PRECEDING THE INCIDENT.
					</p>

					<h2>10. Changes to This Policy</h2>
					<p>
						We may update this Privacy Policy at any time. We will notify you of
						material changes by posting the updated policy on this page and
						updating the &quot;Last updated&quot; date. Continued use of the
						Service after changes constitutes acceptance of the revised policy.
					</p>

					<h2>11. Contact Us</h2>
					<p>
						If you have questions about this Privacy Policy, contact us at{" "}
						<a href={`mailto:${siteConfig.supportEmail}`}>
							{siteConfig.supportEmail}
						</a>
						.
					</p>

					<hr />

					<p className="text-sm text-muted-foreground">
						See also: <Link to="/terms">Terms of Service</Link> &middot;{" "}
						<Link to="/refund">Refund Policy</Link>
					</p>
				</LegalArticle>
			</div>
		</main>
	)
}
