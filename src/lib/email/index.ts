import { Resend } from "resend";

import { env } from "@/env";

type BaseEmail = {
	to: string;
	from: string;
};

type RawEmail = BaseEmail & {
	template?: never;
	subject: string;
	html: string;
	text: string;
};

type TemplateEmail = BaseEmail & {
	template: {
		id: string;
		variables?: Record<string, string | number> | undefined;
	};
	subject?: never;
	html?: never;
	text?: never;
};

type SendEmailArgs = RawEmail | TemplateEmail;

/** Prefer server `EMAIL_FROM`; otherwise client-visible support address. */
export function getTransactionEmailFrom(): string {
	return env.EMAIL_FROM?.trim() || env.VITE_APP_SUPPORT_EMAIL?.trim();
}

export const sendEmail = async (data: SendEmailArgs) => {
	if (!env.RESEND_API_KEY) {
		console.warn("[email] RESEND_API_KEY not set; skipping send", {
			to: data.to,
		});
		return;
	}

	const resend = new Resend(env.RESEND_API_KEY);

	const { from, to, template, subject, html, text } = data;

	const payload = template
		? { from, to, template }
		: { from, to, subject, html, text };

	const { error } = await resend.emails.send(payload);

	if (error) {
		console.error("Failed to send email:", error);
		throw new Error(`Email delivery failed: ${error.message}`);
	}
};
