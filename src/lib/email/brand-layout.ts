import "@tanstack/react-start/server-only"

import { siteConfig } from "@/config/site"

/**
 * Escape HTML special characters for safe interpolation.
 */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
}

interface BrandEmailOptions {
	/** Optional pre-header text shown in inbox preview. */
	preheader?: string
	/** Inner content HTML injected into the card body. */
	content: string
}

/**
 * Wraps email content in a centered, branded HTML shell.
 *
 * Brand primary: #E07B30 (≈ oklch(0.6716 0.1368 48.513))
 * Logo: absolute URL from siteConfig.origin/logo.png
 */
export function brandEmailHtml({
	preheader,
	content,
}: BrandEmailOptions): string {
	const appName = siteConfig.name || "Klipse"
	const appUrl = siteConfig.origin || "https://klipse.app"
	const logoUrl = `${appUrl}/logo.png`
	const primary = "#E07B30"
	const domainDisplay = appUrl.replace(/^https?:\/\//, "")

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(appName)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style type="text/css">
    body,table,td{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    table,td{mso-table-lspace:0;mso-table-rspace:0;border-collapse:collapse;}
    img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
    body{background-color:#f3f4f6;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;}
    a{color:${primary};}
    @media only screen and (max-width:600px){
      .email-wrapper{padding:24px 12px!important;}
      .email-card{border-radius:0!important;}
      .email-section{padding:24px 20px!important;}
    }
  </style>
</head>
<body>
  ${
		preheader
			? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
			: ""
	}
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f4f6;">
    <tr>
      <td class="email-wrapper" style="padding:40px 16px;">
        <!-- Card -->
        <table role="presentation" class="email-card" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07);">

          <!-- Logo header -->
          <tr>
            <td class="email-section" style="padding:32px 40px 24px;text-align:center;background-color:#ffffff;">
              <a href="${appUrl}" style="text-decoration:none;display:inline-block;">
                <img src="${logoUrl}" alt="${escapeHtml(appName)}" height="40" width="auto" style="height:40px;width:auto;display:block;margin:0 auto;" />
              </a>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background-color:#e5e7eb;"></div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="email-section" style="padding:32px 40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="email-section" style="padding:0 40px 32px;text-align:center;">
              <div style="height:1px;background-color:#f3f4f6;margin-bottom:24px;"></div>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#9ca3af;">
                Made with <a href="${appUrl}" style="color:${primary};text-decoration:none;font-weight:500;">${escapeHtml(appName)}</a>
              </p>
              <p style="margin:5px 0 0;font-size:12px;line-height:1.4;color:#d1d5db;">
                <a href="${appUrl}" style="color:#d1d5db;text-decoration:none;">${escapeHtml(domainDisplay)}</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->
      </td>
    </tr>
  </table>
</body>
</html>`
}
