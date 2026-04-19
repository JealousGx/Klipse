import { siteConfig } from "@/config/site";
import { getTransactionEmailFrom, sendEmail } from ".";
import { brandEmailHtml, escapeHtml } from "./brand-layout";

/**
 * Sends an invite email to a user created by an admin.
 * The email contains a sign-in link — the user authenticates via email OTP
 * from that point on, no password required.
 */
export async function sendAdminInviteEmail(data: {
	email: string;
	name: string;
	invitedBy: string;
}): Promise<void> {
	const appName = siteConfig.name || "Klipse";
	const signInUrl = `${siteConfig.origin}?auth=signup`;

	const content = `
<h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;text-align:center;line-height:1.3;">
  You&rsquo;re invited to ${escapeHtml(appName)}
</h2>
<p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:#6b7280;text-align:center;">
  Hi ${escapeHtml(data.name)}, your account is ready. Sign in with your email to get started.
</p>
<p style="margin:0 0 28px;font-size:13px;line-height:1.5;color:#9ca3af;text-align:center;">
  Invited by <strong style="color:#6b7280;">${escapeHtml(data.invitedBy)}</strong>
</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;">
  <tr>
    <td style="text-align:center;">
      <a href="${escapeHtml(signInUrl)}"
        style="display:inline-block;background:#E07B30;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 32px;border-radius:8px;line-height:1.4;">
        Sign in to ${escapeHtml(appName)}
      </a>
    </td>
  </tr>
</table>
<p style="margin:0;font-size:13px;line-height:1.5;color:#9ca3af;text-align:center;">
  Use <strong style="color:#6b7280;">${escapeHtml(data.email)}</strong> &mdash; you&rsquo;ll receive a one-time code to verify your identity.
</p>
`.trim();

	const text = [
		`You're invited to ${appName}`,
		"",
		`Hi ${data.name}, your account is ready. Invited by ${data.invitedBy}.`,
		`Sign in at: ${signInUrl}`,
		"",
		`Use ${data.email} — you'll receive a one-time code to verify.`,
	].join("\n");

	await sendEmail({
		from: getTransactionEmailFrom(),
		to: data.email,
		subject: `You're invited to ${appName}`,
		html: brandEmailHtml({
			preheader: `Your ${appName} account is ready — sign in with ${data.email}.`,
			content,
		}),
		text,
	});
}
