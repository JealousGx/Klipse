import "@tanstack/react-start/server-only";

import { siteConfig } from "@/config/site";
import { getTransactionEmailFrom, sendEmail } from ".";
import { brandEmailHtml, escapeHtml } from "./brand-layout";

export interface TiktokDisconnectEmailInput {
	to: string;
	channelName: string;
	publishingUrl: string;
}

/**
 * Notifies a user that their TikTok connection has expired or been
 * revoked, and a pending video could not be published.
 */
export async function sendTiktokDisconnectEmail(
	input: TiktokDisconnectEmailInput,
): Promise<void> {
	const { to, channelName, publishingUrl } = input;
	const safeName = channelName.trim() || "your TikTok account";

	const preheader = `Your ${safeName} TikTok connection needs to be refreshed.`;

	const content = `
<h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;text-align:center;line-height:1.3;">
  TikTok account disconnected
</h2>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#6b7280;text-align:center;">
  Your connection to <strong style="color:#111827;">${escapeHtml(safeName)}</strong> has
  expired or been revoked. A video was ready to publish but couldn&rsquo;t go out.
</p>
<p style="text-align:center;margin:0 0 28px;">
  <a href="${publishingUrl}"
     style="display:inline-block;background:#E07B30;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:10px;font-weight:600;font-size:15px;line-height:1;">
    Reconnect TikTok
  </a>
</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
       style="background-color:#fef9f0;border:1px solid #fed7aa;border-radius:10px;margin:0 0 24px;">
  <tr>
    <td style="padding:16px 18px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#9a3412;text-transform:uppercase;letter-spacing:0.05em;">
        What to do
      </p>
      <p style="margin:0;font-size:14px;line-height:1.55;color:#7c2d12;">
        Head to <strong>Publishing</strong> in ${escapeHtml(siteConfig.name)} and reconnect your TikTok account.
        Once reconnected, any pending videos will publish automatically.
      </p>
    </td>
  </tr>
</table>
<p style="margin:0;font-size:13px;line-height:1.5;color:#9ca3af;text-align:center;">
  If you no longer want to publish to this account, you can remove it from your publishing destinations.
</p>
`.trim();

	const text = [
		`TikTok account disconnected — ${safeName}`,
		"",
		`Your connection to "${safeName}" has expired or been revoked.`,
		"A video was ready to publish but couldn't go out.",
		"",
		`Reconnect TikTok: ${publishingUrl}`,
		"",
		"Once reconnected, any pending videos will publish automatically.",
	].join("\n");

	await sendEmail({
		from: getTransactionEmailFrom(),
		to,
		subject: `${siteConfig.name} · Reconnect your TikTok account — ${safeName}`,
		html: brandEmailHtml({ preheader, content }),
		text,
	});
}
