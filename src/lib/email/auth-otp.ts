import { siteConfig } from "@/config/site"
import { getTransactionEmailFrom, sendEmail } from "."
import { brandEmailHtml, escapeHtml } from "./brand-layout"

export async function sendAuthOTPEmail(data: { email: string; otp: string }) {
	const appName = siteConfig.name || "Klipse"

	const content = `
<h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;text-align:center;line-height:1.3;">
  Verify your email
</h2>
<p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#6b7280;text-align:center;">
  Use the code below to sign in to <strong style="color:#111827;">${escapeHtml(appName)}</strong>.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;">
  <tr>
    <td style="text-align:center;">
      <div style="display:inline-block;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:12px;padding:20px 40px;">
        <span style="font-size:36px;font-weight:700;letter-spacing:0.18em;color:#111827;font-family:'Courier New',Courier,monospace;">${escapeHtml(data.otp)}</span>
      </div>
    </td>
  </tr>
</table>
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#9ca3af;text-align:center;">
  Code expires in <strong style="color:#6b7280;">10 minutes</strong>.
</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#9ca3af;text-align:center;">
  If you didn&rsquo;t request this, you can safely ignore this email.
</p>
`.trim()

	const text = [
		`Your ${appName} verification code: ${data.otp}`,
		"",
		"This code expires in 10 minutes.",
		"If you didn't request this, ignore this email.",
	].join("\n")

	await sendEmail({
		from: getTransactionEmailFrom(),
		to: data.email,
		subject: `${data.otp} is your ${appName} verification code`,
		html: brandEmailHtml({
			preheader: `Your verification code is ${data.otp}. Expires in 10 minutes.`,
			content,
		}),
		text,
	})
}
