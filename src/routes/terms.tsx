import { createFileRoute, Link } from "@tanstack/react-router";

import { LegalArticle } from "@/components/LegalArticle";
import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/terms")({
	head: () => ({
		meta: [
			{ title: `Terms of Service — ${siteConfig.name}` },
			{
				name: "description",
				content: `Read the Terms of Service for ${siteConfig.name}. Governs your access to and use of the AI video pipeline platform.`,
			},
		],
		links: [{ rel: "canonical", href: `${siteConfig.origin}/terms` }],
	}),
	component: TermsPage,
});

const LAST_UPDATED = "April 16, 2026";

function TermsPage() {
	return (
		<main className="page-wrap px-4 pb-16 pt-12">
			<div className="island-shell max-w-3xl rounded-2xl p-8 sm:p-10">
				<LegalArticle>
					<h1>Terms of Service</h1>
					<p className="lead">Last updated: {LAST_UPDATED}</p>

					<p>
						These Terms of Service (&quot;Terms&quot;) govern your access to and
						use of the {siteConfig.name} platform at{" "}
						<a href={siteConfig.origin}>{siteConfig.origin}</a> (the
						&quot;Service&quot;) operated by {siteConfig.name}
						(&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By accessing
						or using the Service, you agree to be bound by these Terms. If you
						do not agree, you must immediately stop using the Service.
					</p>

					<h2>1. Acceptance of Terms</h2>
					<p>
						By creating an account or using the Service in any way, you confirm
						that you are at least 16 years old, have read and understood these
						Terms, and agree to be legally bound by them and our{" "}
						<Link to="/privacy">Privacy Policy</Link>. Your continued use of the
						Service following any update to these Terms constitutes acceptance
						of the revised Terms.
					</p>

					<h2>2. Account Registration</h2>
					<ul>
						<li>
							You must provide accurate, current, and complete information when
							creating an account and keep it updated.
						</li>
						<li>
							You are solely responsible for all activity under your account and
							for maintaining the confidentiality of your credentials.
						</li>
						<li>
							You must notify us immediately of any unauthorized access to or
							use of your account. We are not liable for any loss or damage
							arising from your failure to comply with this obligation.
						</li>
						<li>
							We reserve the right to suspend or terminate accounts at our sole
							discretion, with or without notice, for any violation of these
							Terms or for any other reason we deem appropriate.
						</li>
					</ul>

					<h2>3. Description of Service</h2>
					<p>
						{siteConfig.name} provides AI-powered video creation and publishing
						infrastructure. The Service is provided strictly on an &quot;as
						is&quot; and &quot;as available&quot; basis and may include:
					</p>
					<ul>
						<li>AI script generation from user-provided ideas.</li>
						<li>AI image generation for video scenes.</li>
						<li>Text-to-speech voiceover synthesis.</li>
						<li>Automated video assembly and encoding.</li>
						<li>
							Multi-platform video publishing (YouTube, TikTok, Instagram, and
							others).
						</li>
						<li>
							Subscription-based access tiers with a credit system for
							generation jobs.
						</li>
					</ul>
					<p>
						We reserve the right to modify, limit, suspend, or discontinue any
						feature or aspect of the Service at any time without notice or
						liability.
					</p>

					<h2>4. Payments and Credits</h2>
					<ul>
						<li>
							Subscriptions and credit packs are processed through our payment
							provider, Polar.sh. Subscription billing recurs automatically at
							the selected interval (monthly or annual) until cancelled.
						</li>
						<li>
							Prices are subject to change at any time. Price changes apply only
							to future billing periods.
						</li>
						<li>
							Credits are non-transferable, have no cash value, and may expire
							per plan terms. Unused credits are forfeited upon account
							termination.
						</li>
						<li>
							<strong>All purchases are final and non-refundable.</strong> See
							our <Link to="/refund">Refund Policy</Link> for full details.
						</li>
					</ul>

					<h2>5. AI-Generated Content — No Guarantees</h2>
					<p>
						THE SERVICE USES THIRD-PARTY AI MODELS TO GENERATE SCRIPTS, IMAGES,
						VOICEOVERS, AND VIDEO METADATA. YOU EXPRESSLY ACKNOWLEDGE AND AGREE
						THAT:
					</p>
					<ul>
						<li>
							AI-generated outputs are inherently unpredictable and may be
							inaccurate, incomplete, inappropriate, offensive, or otherwise
							unsuitable. You are solely responsible for reviewing all outputs
							before use or publication.
						</li>
						<li>
							We make no warranty, express or implied, regarding the accuracy,
							quality, fitness, legality, or intellectual property status of any
							AI-generated content.
						</li>
						<li>
							We are not responsible for any claims, damages, or losses arising
							from AI-generated content, including but not limited to copyright
							infringement claims, defamation claims, or platform policy
							violations.
						</li>
						<li>
							You are solely responsible for all content published to
							third-party platforms through the Service and for compliance with
							those platforms&apos; terms of service, community guidelines, and
							applicable laws.
						</li>
						<li>
							We may include AI disclosure labels on published content where
							required by platform policies, but we do not guarantee compliance
							with all applicable AI disclosure requirements in every
							jurisdiction.
						</li>
					</ul>

					<h2>6. Third-Party Platforms</h2>
					<p>
						The Service integrates with third-party platforms (YouTube, TikTok,
						Instagram, Google, and others). We have no control over, and
						expressly disclaim all liability for:
					</p>
					<ul>
						<li>
							Actions taken by third-party platforms, including content removal,
							demonetization, account strikes, channel termination, or any other
							enforcement action.
						</li>
						<li>
							Changes to third-party platform APIs, policies, or terms that
							affect the Service&apos;s functionality.
						</li>
						<li>
							Downtime, errors, or failures of third-party platforms or
							services.
						</li>
						<li>
							Loss of subscribers, revenue, reach, or monetization on any
							third-party platform.
						</li>
					</ul>
					<p>
						By connecting a third-party account, you authorize {siteConfig.name}{" "}
						to publish content on your behalf. You are responsible for your
						connected accounts and ensuring your use complies with those
						platforms&apos; terms. If a third-party platform revokes access or
						takes action against your account, we bear no liability.
					</p>

					<h2>7. Acceptable Use</h2>
					<p>You agree not to:</p>
					<ul>
						<li>
							Use the Service for any unlawful purpose or in violation of any
							applicable local, national, or international laws or regulations.
						</li>
						<li>
							Generate or publish content that is defamatory, obscene, harmful,
							harassing, threatening, fraudulent, misleading, or infringing on
							any third-party rights.
						</li>
						<li>
							Attempt to gain unauthorized access to the Service, other
							accounts, our systems, or any related networks.
						</li>
						<li>
							Use automated tools (bots, scrapers, crawlers) to access the
							Service without our written consent.
						</li>
						<li>
							Reverse-engineer, decompile, disassemble, or otherwise attempt to
							derive the source code or underlying infrastructure of the
							Service.
						</li>
						<li>
							Resell, redistribute, sublicense, or commercially exploit access
							to the Service or its outputs without our express written
							permission.
						</li>
						<li>
							Connect third-party platform accounts without the legal authority
							to authorize such a connection.
						</li>
						<li>
							Introduce viruses, malware, or any other harmful code or material
							into the Service.
						</li>
					</ul>
					<p>
						We reserve the right to suspend or terminate access immediately and
						without notice for any violation of this section.
					</p>

					<h2>8. Intellectual Property</h2>
					<ul>
						<li>
							The Service, including its design, code, branding, trademarks, and
							AI pipeline infrastructure, is owned by or licensed to{" "}
							{siteConfig.name} and is protected by applicable intellectual
							property laws. Nothing in these Terms grants you any ownership
							interest in the Service.
						</li>
						<li>
							You retain ownership of the original ideas and input content you
							submit. By using the Service, you grant us a limited,
							non-exclusive, royalty-free license to process your input solely
							to provide the Service.
						</li>
						<li>
							AI-generated outputs (scripts, images, videos, metadata) are
							provided for your use. We make no representation or warranty
							regarding the copyright status, originality, or ownership of
							AI-generated content, and you assume all risk associated with its
							use or publication.
						</li>
					</ul>

					<h2>9. Disclaimer of Warranties</h2>
					<p>
						TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS
						PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT ANY
						WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR
						OTHERWISE. WE EXPRESSLY DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT
						LIMITED TO:
					</p>
					<ul>
						<li>
							ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
							PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
						</li>
						<li>
							ANY WARRANTY THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE,
							SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
						</li>
						<li>
							ANY WARRANTY THAT AI-GENERATED CONTENT WILL MEET YOUR
							REQUIREMENTS, ACHIEVE ANY SPECIFIC RESULTS, OR BE SUITABLE FOR
							PUBLICATION ON ANY PLATFORM.
						</li>
						<li>
							ANY WARRANTY REGARDING THE ACCURACY, RELIABILITY, COMPLETENESS, OR
							TIMELINESS OF ANY CONTENT OR INFORMATION PROVIDED THROUGH THE
							SERVICE.
						</li>
					</ul>
					<p>
						YOU USE THE SERVICE ENTIRELY AT YOUR OWN RISK. IF YOU ARE
						DISSATISFIED WITH THE SERVICE, YOUR SOLE REMEDY IS TO DISCONTINUE
						USE.
					</p>

					<h2>10. Limitation of Liability</h2>
					<p>
						TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL{" "}
						{siteConfig.name.toUpperCase()}, ITS OFFICERS, DIRECTORS, EMPLOYEES,
						AGENTS, AFFILIATES, LICENSORS, OR SERVICE PROVIDERS BE LIABLE FOR
						ANY:
					</p>
					<ul>
						<li>
							INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR
							PUNITIVE DAMAGES OF ANY KIND;
						</li>
						<li>
							LOSS OF REVENUE, PROFITS, DATA, BUSINESS, GOODWILL, SUBSCRIBERS,
							VIEWS, MONETIZATION, OR PUBLISHING OPPORTUNITIES;
						</li>
						<li>
							DAMAGES ARISING FROM UNAUTHORIZED ACCESS TO OR ALTERATION OF YOUR
							CONTENT OR ACCOUNT;
						</li>
						<li>
							DAMAGES ARISING FROM ACTIONS OR INACTIONS OF THIRD-PARTY
							PLATFORMS, AI PROVIDERS, OR OTHER THIRD PARTIES;
						</li>
						<li>
							ANY OTHER DAMAGES ARISING OUT OF OR IN CONNECTION WITH YOUR USE
							OF, OR INABILITY TO USE, THE SERVICE;
						</li>
					</ul>
					<p>
						WHETHER BASED ON CONTRACT, TORT, STRICT LIABILITY, OR ANY OTHER
						LEGAL THEORY, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF
						SUCH DAMAGES.
					</p>
					<p>
						IN JURISDICTIONS THAT DO NOT ALLOW THE EXCLUSION OR LIMITATION OF
						CERTAIN DAMAGES, OUR LIABILITY IS LIMITED TO THE MAXIMUM EXTENT
						PERMITTED BY LAW. IN ALL CASES, OUR TOTAL CUMULATIVE LIABILITY TO
						YOU FOR ANY CLAIMS ARISING FROM OR RELATED TO THE SERVICE SHALL NOT
						EXCEED THE TOTAL AMOUNT YOU ACTUALLY PAID TO US IN THE ONE (1)
						CALENDAR MONTH IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE
						CLAIM, OR USD $10.00, WHICHEVER IS GREATER.
					</p>

					<h2>11. Indemnification</h2>
					<p>
						You agree to defend, indemnify, and hold harmless {siteConfig.name},
						its officers, directors, employees, contractors, agents, licensors,
						and affiliates from and against any and all claims, damages, losses,
						liabilities, costs, and expenses (including reasonable
						attorneys&apos; fees) arising out of or related to:
					</p>
					<ul>
						<li>Your access to or use of the Service;</li>
						<li>
							Any content you submit, generate, or publish through the Service;
						</li>
						<li>Your violation of these Terms or any applicable law;</li>
						<li>
							Your violation of any third-party right, including intellectual
							property rights, privacy rights, or platform terms of service;
						</li>
						<li>
							Any claim that content published through your account caused
							damage to a third party.
						</li>
					</ul>
					<p>
						We reserve the right, at our expense, to assume exclusive defense
						and control of any matter subject to indemnification by you. You
						agree to cooperate fully with our defense of such claims.
					</p>

					<h2>12. Force Majeure</h2>
					<p>
						We shall not be liable for any delay or failure to perform our
						obligations under these Terms arising from causes beyond our
						reasonable control, including but not limited to acts of God, war,
						terrorism, riots, embargoes, actions of civil or military
						authorities, fire, floods, earthquakes, accidents, strikes,
						epidemics, pandemics, failure of third-party infrastructure
						(including AI providers, cloud services, payment processors, or
						platform APIs), or internet or network outages.
					</p>

					<h2>13. Modifications to the Service</h2>
					<p>
						We reserve the right to modify, suspend, or permanently discontinue
						any part or all of the Service at any time, with or without notice,
						for any reason. We are not liable to you or any third party for any
						modification, suspension, or discontinuation of the Service.
					</p>

					<h2>14. Changes to These Terms</h2>
					<p>
						We may update these Terms at any time. We will notify you of
						material changes by posting the updated Terms and revising the
						&quot;Last updated&quot; date. Continued use of the Service after
						the effective date of any changes constitutes your binding
						acceptance of the revised Terms. If you do not agree to the revised
						Terms, you must stop using the Service immediately.
					</p>

					<h2>15. Termination</h2>
					<p>
						We may terminate or suspend your access to the Service immediately,
						without prior notice or liability, for any reason, including without
						limitation if you breach these Terms. Upon termination, your right
						to use the Service ceases immediately and any unused credits are
						forfeited without refund. Provisions that by their nature should
						survive termination shall survive, including Sections 9, 10, 11, and
						15.
					</p>

					<h2>16. Governing Law and Disputes</h2>
					<p>
						These Terms are governed by applicable law without regard to
						conflict-of-law principles. You agree that any dispute arising out
						of or relating to these Terms or the Service shall first be
						addressed through good-faith negotiation. We both waive any right to
						a jury trial in connection with any dispute under these Terms.
					</p>

					<h2>17. Severability and Entire Agreement</h2>
					<p>
						If any provision of these Terms is found to be unenforceable or
						invalid, that provision shall be modified to the minimum extent
						necessary to make it enforceable, and the remaining provisions shall
						continue in full force and effect. These Terms, together with the{" "}
						<Link to="/privacy">Privacy Policy</Link> and{" "}
						<Link to="/refund">Refund Policy</Link>, constitute the entire
						agreement between you and {siteConfig.name} with respect to the
						Service and supersede all prior agreements.
					</p>

					<h2>18. Contact Us</h2>
					<p>
						If you have questions about these Terms, contact us at{" "}
						<a href={`mailto:${siteConfig.supportEmail}`}>
							{siteConfig.supportEmail}
						</a>
						.
					</p>

					<hr />

					<p className="text-sm text-muted-foreground">
						See also: <Link to="/privacy">Privacy Policy</Link> &middot;{" "}
						<Link to="/refund">Refund Policy</Link>
					</p>
				</LegalArticle>
			</div>
		</main>
	);
}
